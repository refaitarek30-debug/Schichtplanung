-- =============================================================
-- Feiertage sind Arbeitstage, freie Reihenfolge im Plan,
-- Abwesenheiten ueber Zeitraeume
-- =============================================================

-- ---------------------------------------------------------------
-- 1) An Feiertagen wird gearbeitet
--
-- shift_runs_on() hat Feiertage bisher grundsaetzlich ausgeschlossen.
-- Im durchlaufenden Betrieb ist das falsch: die Anlage laeuft weiter, die
-- Schicht ist eingeteilt. Die Folgen waren nicht offensichtlich, aber
-- teuer -- gerechnet an echten Daten: Jonas Brandt, Woche 21.-27.12.2026,
-- fuenf eingeplante Schichten, aber nur 3,0 Tage vom Urlaubskonto
-- abgezogen. Zwei Urlaubstage haben sich in Luft aufgeloest, weil der 25.
-- und 26.12. uebersprungen wurden. Dasselbe galt fuer die Besetzung: an
-- Feiertagen sah der Plan aus, als arbeite niemand.
--
-- Weil das nicht fuer jeden Betrieb gilt, haengt es an einer Einstellung
-- je Unternehmen. Vorgabe ist "ja" -- so arbeiten Schichtbetriebe.
--
-- Fuer Mitarbeiter *ohne* Schichtzuordnung aendert sich nichts: dort
-- bleiben Feiertage frei, das regeln is_planned_workday() und
-- calculate_leave_days_for_employee() in ihrem eigenen Zweig.
-- ---------------------------------------------------------------

alter table company_settings
  add column if not exists work_on_holidays boolean not null default true;

comment on column company_settings.work_on_holidays is
  'Laeuft der Schichtbetrieb auch an gesetzlichen Feiertagen? Vorgabe ja. Bei nein zaehlen Feiertage weder zur Besetzung noch zum Urlaubsabzug.';

create or replace function shift_runs_on(p_shift shifts, p_date date)
returns boolean
language sql stable set search_path = public as $$
  select
    extract(dow from p_date)::int = any(p_shift.weekdays)
    and (
      coalesce(
        (select cs.work_on_holidays from company_settings cs
          where cs.company_id = p_shift.company_id),
        true)
      or not exists (
        select 1 from holidays h
        where h.date = p_date
          and (h.company_id = p_shift.company_id or h.company_id is null)
      )
    );
$$;

-- ---------------------------------------------------------------
-- 2) Reihenfolge der Mitarbeiter im Schichtplan
--
-- Bisher stand die Reihenfolge fest: Gruppe, dann Nachname. Wer seine
-- Mannschaft nach Arbeitsplatz oder Anlage sortiert sehen will, konnte
-- nichts machen. sort_order ist bewusst nullable -- wer nie sortiert,
-- bleibt alphabetisch.
-- ---------------------------------------------------------------

alter table employees
  add column if not exists sort_order integer;

comment on column employees.sort_order is
  'Platz im Schichtplan innerhalb der Gruppe. Null = alphabetisch einsortieren.';

create index if not exists employees_sort_idx
  on employees (company_id, rotation_team, sort_order nulls last);

/**
 * Reihenfolge festschreiben. Uebergeben wird die komplette Liste einer
 * Gruppe in der gewuenschten Reihenfolge; daraus werden die Plaetze
 * 1..n. Nur Schichtleitung und Administration, und nur im eigenen
 * Unternehmen -- die Pruefung steht hier und nicht im Browser.
 */
create or replace function set_employee_order(p_employee_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen die Reihenfolge ändern.';
  end if;
  if p_employee_ids is null or array_length(p_employee_ids, 1) is null then
    return 0;
  end if;
  if array_length(p_employee_ids, 1) > 500 then
    raise exception 'Zu viele Mitarbeiter auf einmal.';
  end if;

  update employees e
     set sort_order = pos.ord
    from (
      select id, ordinality::int as ord
        from unnest(p_employee_ids) with ordinality as t(id, ordinality)
    ) pos
   where e.id = pos.id
     and e.company_id = auth_company_id();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function set_employee_order(uuid[]) from public, anon;
grant execute on function set_employee_order(uuid[]) to authenticated;

-- ---------------------------------------------------------------
-- 3) Abwesenheit ueber einen Zeitraum
--
-- absences haelt eine Zeile je Tag. Wer mehrere Wochen krank ist, musste
-- bisher jeden Tag einzeln eintragen. Diese Funktion legt den ganzen
-- Zeitraum in einem Aufruf an -- in einer Transaktion, damit nicht die
-- halbe Krankmeldung stehen bleibt, wenn etwas schiefgeht.
--
-- Tage, an denen der Mitarbeiter ohnehin frei hat, werden uebersprungen:
-- eine Krankmeldung an einem Freitag aus dem Rotationsmuster aendert
-- nichts und wuerde die Besetzungsrechnung nur verwirren.
-- ---------------------------------------------------------------

create or replace function create_absence_range(
  p_employee_id uuid,
  p_from date,
  p_to date,
  p_type absence_type,
  p_note text default null
)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  e employees;
  v_count int := 0;
  d date;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen Abwesenheiten erfassen.';
  end if;

  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_from is null or p_to is null then
    raise exception 'Bitte Beginn und Ende angeben.';
  end if;
  if p_to < p_from then
    raise exception 'Das Ende darf nicht vor dem Beginn liegen.';
  end if;
  if p_to - p_from > 365 then
    raise exception 'Der Zeitraum ist zu lang.';
  end if;

  for d in select g::date from generate_series(p_from, p_to, '1 day') g loop
    continue when not is_planned_workday(p_employee_id, d);

    insert into absences (company_id, employee_id, date, type, note)
    values (e.company_id, p_employee_id, d, p_type, nullif(trim(p_note), ''))
    on conflict (employee_id, date, type) do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'In diesem Zeitraum gibt es keinen eingeplanten Arbeitstag ohne bestehenden Eintrag.';
  end if;

  return v_count;
end;
$$;

revoke execute on function create_absence_range(uuid, date, date, absence_type, text) from public, anon;
grant execute on function create_absence_range(uuid, date, date, absence_type, text) to authenticated;

-- ---------------------------------------------------------------
-- 4) Der Schichtplan achtet auf die Reihenfolge
-- ---------------------------------------------------------------

create or replace function shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
returns table (employee_id uuid, employee_name text, rotation_team text, personnel_number text,
               day date, shift_name text, shift_code text, absence_code text, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team from employees e where e.id = me;

  return query
  select e.id, e.first_name || ' ' || e.last_name, e.rotation_team::text, e.personnel_number,
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
    and shift_runs_on(s, gs.day::date)
  where e.company_id = p_company_id
    and e.active
    and (
      fuehrung
      or e.id = me
      or (mein_team is not null and e.rotation_team = mein_team)
    )
  -- Wer einen Platz bekommen hat, steht dort; alle anderen alphabetisch
  -- dahinter. So bleibt eine teilweise sortierte Gruppe benutzbar.
  order by e.rotation_team nulls last, e.sort_order nulls last, e.last_name, gs.day;
end;
$$;

revoke execute on function shift_plan_grid(uuid, date, integer) from public, anon;
grant execute on function shift_plan_grid(uuid, date, integer) to authenticated;

-- ---------------------------------------------------------------
-- 5) Die Feiertagsregel muss einstellbar und sichtbar sein
--
-- Sie aendert, wie viel Urlaub ein Antrag kostet. So etwas darf nicht
-- unsichtbar in einer Funktion stehen.
-- ---------------------------------------------------------------

create or replace function get_company_rules()
returns table (work_on_holidays boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(s.work_on_holidays, true)
  from company_settings s where s.company_id = auth_company_id();
$$;

revoke execute on function get_company_rules() from public, anon;
grant execute on function get_company_rules() to authenticated;

create or replace function set_work_on_holidays(p_value boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf die Planungsregeln ändern.';
  end if;
  insert into company_settings (company_id, work_on_holidays, updated_at)
  values (auth_company_id(), coalesce(p_value, true), now())
  on conflict (company_id)
    do update set work_on_holidays = excluded.work_on_holidays, updated_at = now();
end;
$$;

revoke execute on function set_work_on_holidays(boolean) from public, anon;
grant execute on function set_work_on_holidays(boolean) to authenticated;
