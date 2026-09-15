-- Die Tagschicht arbeitet Montag bis Freitag, Feiertage frei.
--
-- Bisher gab es zwei widersprüchliche Antworten auf die Frage, ob jemand
-- Schichtarbeiter ist:
--
--   * `employees.shift_worker` – das ausdrückliche Kennzeichen, das im
--     Formular gesetzt wird. Danach richtet sich seit 0031, auf welches
--     Konto ein Urlaubstag gebucht wird.
--   * `shift_id is not null or rotation_pattern_id is not null` – daraus
--     schlossen `calculate_leave_days_for_employee()` und
--     `is_planned_workday()`, welche Tage überhaupt Arbeitstage sind.
--
-- Wer kein Schichtarbeiter ist, aber trotzdem eine Schichtgruppe zugewiesen
-- bekommen hat, fiel deshalb in die Schichtlogik: Samstag, Sonntag und
-- Feiertage galten als Arbeitstage und kosteten Urlaub, dafür waren
-- Wochentage frei. Am Datenbestand nachgemessen kostete derselbe Zeitraum
-- vom 03.10. bis 11.10.2026 sieben statt fünf Urlaubstage.
--
-- Ab hier entscheidet allein `shift_worker`. Eine Schichtgruppe an einer
-- Tagschichtkraft ist damit folgenlos, statt stillschweigend die
-- Urlaubsberechnung umzustellen.

-- Die Wurzel sitzt eine Ebene tiefer: effective_shift_id() ließ das
-- Rotationsmuster auch für Nicht-Schichtarbeiter greifen. Dadurch stand
-- eine Tagschichtkraft mit Schichtgruppe im Schichtplan samstags und
-- sonntags im Dienst und zählte dort zur Besetzung – während die
-- Urlaubsberechnung sie nach der Korrektur oben als frei führt. Zwei
-- Antworten auf dieselbe Frage.
--
-- Ein ausdrücklicher Eintrag in shift_assignments gilt weiterhin: setzt
-- die Schichtleitung jemanden von Hand auf einen Tag, ist das gewollt und
-- schlägt jede Automatik. Nur das automatische Muster entfällt.
create or replace function effective_shift_id(p_employee_id uuid, p_date date)
returns uuid
language plpgsql stable set search_path = public as $$
declare
  assigned uuid;
  emp employees;
begin
  select shift_id into assigned from shift_assignments
   where employee_id = p_employee_id and date = p_date;
  if found then
    return assigned;
  end if;

  select * into emp from employees where id = p_employee_id;
  if emp.id is null then return null; end if;

  if emp.shift_worker and emp.rotation_pattern_id is not null then
    return rotation_shift_for(p_employee_id, p_date);
  end if;

  return emp.shift_id;
end;
$$;

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

  -- Montag bis Freitag, Feiertage frei – für die Tagschicht, und ebenso
  -- für Schichtarbeiter ohne jede Zuordnung, bei denen es keinen Plan
  -- gibt, aus dem sich etwas anderes ergeben könnte.
  --
  -- Der erste Teil der Bedingung ist neu: eine Schichtgruppe an einer
  -- Tagschichtkraft stellte bisher stillschweigend auf Schichtlogik um.
  if not emp.shift_worker
     or (emp.shift_id is null and emp.rotation_pattern_id is null) then
    select count(*) into counted
    from generate_series(p_start_date, p_end_date, interval '1 day') as day
    where extract(isodow from day) < 6
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

  -- Schichtbetrieb: allein der Plan entscheidet. Feiertage sind hier
  -- bewusst Arbeitstage – im durchlaufenden Betrieb wird an ihnen
  -- gearbeitet, deshalb sind sie später auch Zuschlagstage.
  if e.shift_worker and (e.shift_id is not null or e.rotation_pattern_id is not null) then
    return effective_shift_id(p_employee_id, p_date) is not null;
  end if;

  -- Tagschicht: Montag bis Freitag, Feiertage frei. Dieselbe Regel wie in
  -- calculate_leave_days_for_employee(), damit Vorschau und verbindliche
  -- Berechnung nie auseinanderlaufen.
  return extract(isodow from p_date) < 6
     and not exists (
       select 1 from holidays h
        where h.date = p_date
          and (h.company_id = e.company_id or h.company_id is null)
     );
end;
$$;

comment on column employees.shift_worker is
  'Fährt diese Person Schicht? Entscheidet, welche Tage als Arbeitstage '
  'zählen (Schichtplan gegen Montag–Freitag ohne Feiertage) und auf welches '
  'Konto ein Urlaubstag gebucht wird. Eine Schichtgruppe an einer '
  'Tagschichtkraft bleibt folgenlos.';

-- Letzte Stelle derselben Sache: im Schichtplan stand eine Tagschichtkraft
-- mit alter Schichtgruppe weiterhin unter „Schicht C", obwohl ihre Zeile
-- jetzt leer ist. Die ausgegebene Gruppe folgt deshalb ebenfalls
-- `shift_worker` – dann landet sie in der Gruppe „Tagschicht", zu der sie
-- gehört, und die Sortierung geht denselben Weg.
--
-- Die Sichtbarkeitsregel weiter unten bleibt bewusst unangetastet: sie
-- entscheidet, wer wessen Plan sehen darf. Das ist eine Frage der
-- Berechtigung, nicht der Darstellung, und sie hier stillschweigend zu
-- verengen wäre die falsche Stelle.
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
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team from employees e where e.id = me;

  -- Einmal lesen statt einmal je Zelle.
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
  cross join generate_series(p_from, p_from + (p_days - 1), interval '1 day') as gs(day)
  left join shifts s on s.id = effective_shift_id(e.id, gs.day::date)
    and shift_runs_on(s, gs.day::date, feiertage_arbeiten)
  where e.company_id = p_company_id
    and e.active
    and (
      fuehrung
      or e.id = me
      or (mein_team is not null and e.rotation_team = mein_team)
    )
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, gs.day;
end;
$$;
