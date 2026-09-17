-- Eintritts- und Austrittsdatum.
--
-- Bisher gab es nur das Kennzeichen `active`. Wer am 01.06. anfängt, stand
-- damit ab dem ersten Tag der Erfassung im Plan und zählte zur Besetzung;
-- wer zum 31.03. geht, blieb bis zum Deaktivieren stehen. In der
-- Excel-Vorlage behilft man sich mit Namenszusätzen wie „(Ab 06/26)".
--
-- Statt die Prüfung über Dutzende Stellen zu streuen, steht sie an genau
-- zwei Punkten: is_planned_workday() und effective_shift_id(). Alles
-- Weitere -- Schichtplan, Besetzung, Urlaubsberechnung, Auswertung --
-- liest bereits durch diese beiden und erbt die Regel dadurch.

alter table employees
  add column if not exists entry_date date,
  add column if not exists exit_date  date,
  add column if not exists is_apprentice boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.employees'::regclass
       and conname = 'employees_austritt_nach_eintritt'
  ) then
    alter table employees
      add constraint employees_austritt_nach_eintritt
      check (exit_date is null or entry_date is null or exit_date >= entry_date);
  end if;
end $$;

comment on column employees.entry_date is
  'Erster Arbeitstag. Leer = unbekannt, dann gilt keine untere Grenze.';
comment on column employees.exit_date is
  'Letzter Arbeitstag, einschließlich. Leer = unbefristet.';
comment on column employees.is_apprentice is
  'Auszubildende. Trennt den Ausbildungsblock ab, ohne eine zweite '
  'Mitarbeiterverwaltung zu erzeugen.';

-- Gehört diese Person an diesem Tag zum Betrieb?
--
-- Leere Felder bedeuten „keine Grenze": ein Bestand ohne gepflegte Daten
-- verhält sich damit exakt wie bisher. Das Austrittsdatum zählt als
-- letzter Arbeitstag mit, deshalb `>=` und nicht `>`.
create or replace function is_employed_on(p_employee_id uuid, p_date date)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employees e
     where e.id = p_employee_id
       and (e.entry_date is null or p_date >= e.entry_date)
       and (e.exit_date  is null or p_date <= e.exit_date)
  );
$$;

revoke execute on function is_employed_on(uuid, date) from public, anon;
grant execute on function is_employed_on(uuid, date) to authenticated;

-- Erster von zwei Punkten: ohne Beschäftigung keine Schicht. Die Prüfung
-- steht vor dem Blick in shift_assignments -- eine von Hand gesetzte
-- Zuweisung außerhalb der Beschäftigungszeit soll ebenfalls nicht greifen.
create or replace function effective_shift_id(p_employee_id uuid, p_date date)
returns uuid
language plpgsql stable set search_path = public as $$
declare
  assigned uuid;
  emp employees;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then return null; end if;

  if not is_employed_on(p_employee_id, p_date) then
    return null;
  end if;

  select shift_id into assigned from shift_assignments
   where employee_id = p_employee_id and date = p_date;
  if found then
    return assigned;
  end if;

  if emp.shift_worker and emp.rotation_pattern_id is not null then
    return rotation_shift_for(p_employee_id, p_date);
  end if;

  return emp.shift_id;
end;
$$;

-- Zweiter Punkt: die Tagschicht läuft nicht über effective_shift_id, also
-- braucht sie die Prüfung hier noch einmal.
create or replace function is_planned_workday(p_employee_id uuid, p_date date)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then
    return false;
  end if;

  if not is_employed_on(p_employee_id, p_date) then
    return false;
  end if;

  -- Schichtbetrieb: allein der Plan entscheidet. Feiertage sind hier
  -- bewusst Arbeitstage – im durchlaufenden Betrieb wird an ihnen
  -- gearbeitet, deshalb sind sie später auch Zuschlagstage.
  if e.shift_worker and (e.shift_id is not null or e.rotation_pattern_id is not null) then
    return effective_shift_id(p_employee_id, p_date) is not null;
  end if;

  -- Tagschicht: Montag bis Freitag, Feiertage frei.
  return extract(isodow from p_date) < 6
     and not exists (
       select 1 from holidays h
        where h.date = p_date
          and (h.company_id = e.company_id or h.company_id is null)
     );
end;
$$;

-- Die Tagschicht-Zweig von calculate_leave_days_for_employee() zählt
-- Wochentage direkt aus generate_series und geht nicht über die beiden
-- Funktionen oben – also auch hier die Grenze.
create or replace function calculate_leave_days_for_employee(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date,
  p_half_day_period half_day_period
)
returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  emp employees;
  d date;
  s shifts;
  day_shift uuid;
  counted int := 0;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then
    return 0;
  end if;

  if not emp.shift_worker
     or (emp.shift_id is null and emp.rotation_pattern_id is null) then
    select count(*) into counted
    from generate_series(p_start_date, p_end_date, interval '1 day') as day
    where extract(isodow from day) < 6
      and is_employed_on(p_employee_id, day::date)
      and not exists (
        select 1 from holidays h
        where h.date = day::date
          and (h.company_id = emp.company_id or h.company_id is null)
      );
  else
    d := p_start_date;
    while d <= p_end_date loop
      day_shift := effective_shift_id(p_employee_id, d);
      if day_shift is not null then
        select * into s from shifts where id = day_shift;
        if s.id is not null and shift_runs_on(s, d) then
          counted := counted + 1;
        end if;
      end if;
      d := d + 1;
    end loop;
  end if;

  if p_half_day_period is not null and counted = 1 then
    return 0.5;
  end if;

  return counted::numeric(4, 1);
end;
$$;

-- Im Schichtplan reicht es nicht, dass die Zellen leer bleiben: wer im
-- ganzen gezeigten Zeitraum nicht zum Betrieb gehört, soll gar nicht erst
-- als Zeile erscheinen. Wer mittendrin ein- oder austritt, bleibt stehen
-- und hat außerhalb seiner Zeit leere Zellen -- sonst verschwände jemand
-- aus einem Zeitraum, in dem er teilweise gearbeitet hat.
create or replace function shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
returns table (
  employee_id uuid, employee_name text, rotation_team text, personnel_number text,
  day date, shift_name text, shift_code text, absence_code text, is_me boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
  feiertage_arbeiten boolean;
  bis date := p_from + (p_days - 1);
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team from employees e where e.id = me;

  select coalesce(cs.work_on_holidays, true) into feiertage_arbeiten
    from company_settings cs where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  select e.id, e.first_name || ' ' || e.last_name,
    case when e.shift_worker then e.rotation_team::text else null end,
    e.personnel_number,
    gs.day::date, s.name,
    case when s.name ilike 'Früh%' then 'F' when s.name ilike 'Spät%' then 'S'
         when s.name ilike 'Nacht%' then 'N'
         when s.name is not null then upper(left(s.name, 1)) else null end,
    case
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'approved' and r.kind = 'v_tag'
        and gs.day::date between r.start_date and r.end_date) then 'V'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'pending' and r.kind = 'v_tag'
        and gs.day::date between r.start_date and r.end_date) then 'v'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'approved' and r.kind = 'urlaub'
        and gs.day::date between r.start_date and r.end_date) then 'U'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'pending' and r.kind = 'urlaub'
        and gs.day::date between r.start_date and r.end_date) then 'u'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'krank') then 'K'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'schulung') then 'FB'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date) then 'A'
      else null end,
    (e.id = me)
  from employees e
  cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  left join shifts s on s.id = effective_shift_id(e.id, gs.day::date)
    and shift_runs_on(s, gs.day::date, feiertage_arbeiten)
  where e.company_id = p_company_id
    and e.active
    -- Überschneidet sich die Beschäftigung überhaupt mit dem Zeitraum?
    and (e.entry_date is null or e.entry_date <= bis)
    and (e.exit_date  is null or e.exit_date  >= p_from)
    and (
      fuehrung
      or e.id = me
      or (mein_team is not null and e.rotation_team = mein_team)
    )
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, gs.day;
end;
$$;
