-- Schulung auch an freien Tagen.
--
-- create_absence_range() hat bisher für JEDE Art die Tage übersprungen, an
-- denen die Person laut Schichtmuster frei hat (is_planned_workday). Bei
-- Krankheit ist das richtig. Eine Schulung findet aber auch an einem freien
-- Tag statt – die Person kommt dafür extra. Deshalb gilt jetzt:
--
--   * Schulung: jeder Tag im Zeitraum, an dem die Person beschäftigt ist
--     (Eintritt/Austritt), auch freie Tage laut Muster.
--   * Krank, Sonstiges usw.: unverändert nur geplante Arbeitstage.
--
-- Sonst ändert sich nichts (Rechte, Krank sticht Urlaub, Rückgabewert).
-- Der Schichtplan zeigt eine Schulung an einem freien Tag schon heute als
-- „FB“ an (shift_plan_grid liest absences unabhängig von der Schicht).

create or replace function public.create_absence_range(
  p_employee_id uuid,
  p_from date,
  p_to date,
  p_type absence_type,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e employees;
  v_count int := 0;
  d date;
  r leave_requests;
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
    if p_type = 'schulung' then
      -- Schulung: auch freie Tage, aber nur solange die Person beschäftigt ist.
      continue when not is_employed_on(e, d);
    else
      continue when not is_planned_workday(p_employee_id, d);
    end if;

    if p_type = 'krank' then
      loop
        select * into r
          from leave_requests
         where employee_id = p_employee_id
           and status in ('approved', 'pending')
           and d between start_date and end_date
         order by start_date
         limit 1;
        exit when r.id is null;
        perform split_leave_request_day(r, d, null);
      end loop;
    end if;

    insert into absences (company_id, employee_id, date, type, note)
    values (e.company_id, p_employee_id, d, p_type, nullif(trim(p_note), ''))
    on conflict (employee_id, date, type) do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  if v_count = 0 then
    if p_type = 'schulung' then
      raise exception 'In diesem Zeitraum ist schon überall Schulung eingetragen oder die Person ist nicht beschäftigt.';
    end if;
    raise exception 'In diesem Zeitraum gibt es keinen eingeplanten Arbeitstag ohne bestehenden Eintrag.';
  end if;

  return v_count;
end;
$function$;
