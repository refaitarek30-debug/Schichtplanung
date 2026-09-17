-- Dieselbe Regel, aber ohne die Personalzeile dreimal je Tag zu holen.
--
-- Die Jahresauswertung prueft 50 Mitarbeiter x 365 Tage. Jeder dieser
-- 18.250 Aufrufe von is_planned_workday() schlug die Zeile in `employees`
-- gleich dreimal nach: einmal selbst, einmal ueber is_employed_on() und
-- einmal ueber effective_shift_id(), das seinerseits noch einmal
-- is_employed_on() rief. Gemessen: 3,31 s fuer ein Jahr.
--
-- Die Regel wird deshalb NICHT kopiert -- das waere eine zweite Wahrheit.
-- Stattdessen bekommt is_employed_on() eine Fassung, die die bereits
-- geladene Zeile entgegennimmt. Die bisherige Fassung mit der ID ruft sie
-- auf, es bleibt also bei einer Definition der Regel.

create or replace function is_employed_on(e employees, p_date date)
returns boolean
language sql immutable set search_path = public as $$
  select (e.entry_date is null or p_date >= e.entry_date)
     and (e.exit_date  is null or p_date <= e.exit_date);
$$;

comment on function is_employed_on(employees, date) is
  'Gehoert diese Person an diesem Tag zum Betrieb? Fassung fuer eine '
  'bereits geladene Zeile -- spart in Schleifen den erneuten Zugriff.';

create or replace function is_employed_on(p_employee_id uuid, p_date date)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_employed_on(e, p_date) from employees e where e.id = p_employee_id),
    false
  );
$$;

revoke execute on function is_employed_on(employees, date) from public, anon;
grant execute on function is_employed_on(employees, date) to authenticated;

-- Beide heissen Funktionen laden die Zeile ohnehin schon und pruefen
-- jetzt damit, statt noch einmal nachzuschlagen.
create or replace function effective_shift_id(p_employee_id uuid, p_date date)
returns uuid
language plpgsql stable set search_path = public as $$
declare
  assigned uuid;
  emp employees;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then return null; end if;

  if not is_employed_on(emp, p_date) then
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

  if not is_employed_on(e, p_date) then
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

-- Der Blick in shift_assignments und holidays laeuft in der Auswertung
-- millionenfach; ohne passenden Index wird daraus ein Tabellendurchlauf.
create index if not exists shift_assignments_employee_date_idx
  on shift_assignments (employee_id, date);
create index if not exists absences_employee_date_idx
  on absences (employee_id, date);
create index if not exists leave_requests_employee_zeitraum_idx
  on leave_requests (employee_id, status, start_date, end_date);

-- rotation_shift_for() war der groesste Einzelposten: 0,077 ms je Tag und
-- Person, bei 18.250 Kombinationen also gut 1,4 Sekunden. Drei Abfragen
-- je Aufruf, obwohl das Muster fuer alle gleich ist und sich waehrend
-- einer Auswertung nicht aendert:
--
--   1. employees  -- hat der Aufrufer meist schon geladen
--   2. rotation_patterns
--   3. rotation_cycle_length() -- fragt rotation_patterns ein zweites Mal
--
-- Zwei davon fallen weg: die Zykluslaenge wird aus den bereits geladenen
-- Schritten gerechnet, und eine Fassung nimmt die Personalzeile entgegen.
-- Die Regel selbst bleibt unveraendert und steht weiterhin nur einmal.

create or replace function rotation_shift_for(emp employees, p_date date)
returns uuid
language plpgsql stable set search_path = public as $$
declare
  pat rotation_patterns;
  cycle int := 0;
  pos int;
  acc int := 0;
  step jsonb;
begin
  if emp.rotation_pattern_id is null then return null; end if;

  select * into pat from rotation_patterns where id = emp.rotation_pattern_id and active;
  if pat.id is null then return null; end if;

  -- Zykluslaenge aus den schon geladenen Schritten, statt
  -- rotation_patterns ein zweites Mal zu lesen.
  for step in select * from jsonb_array_elements(pat.steps) loop
    cycle := cycle + (step ->> 'days')::int;
  end loop;
  if cycle <= 0 then return null; end if;

  pos := (((p_date - pat.anchor_date - emp.rotation_offset_days) % cycle) + cycle) % cycle;

  for step in select * from jsonb_array_elements(pat.steps) loop
    acc := acc + (step ->> 'days')::int;
    if pos < acc then
      return nullif(step ->> 'shift', '')::uuid;
    end if;
  end loop;

  return null;
end;
$$;

comment on function rotation_shift_for(employees, date) is
  'Schicht aus dem Rotationsmuster. Fassung fuer eine bereits geladene '
  'Zeile -- spart in Schleifen den erneuten Zugriff.';

-- Die bisherige Fassung bleibt fuer alle vorhandenen Aufrufer und ruft
-- die neue auf. Es bleibt bei einer Definition der Regel.
create or replace function rotation_shift_for(p_employee_id uuid, p_date date)
returns uuid
language sql stable set search_path = public as $$
  select rotation_shift_for(e, p_date) from employees e where e.id = p_employee_id;
$$;

revoke execute on function rotation_shift_for(employees, date) from public, anon;
grant execute on function rotation_shift_for(employees, date) to authenticated;

-- effective_shift_id() hat die Zeile bereits und reicht sie jetzt weiter.
create or replace function effective_shift_id(p_employee_id uuid, p_date date)
returns uuid
language plpgsql stable set search_path = public as $$
declare
  assigned uuid;
  emp employees;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then return null; end if;

  if not is_employed_on(emp, p_date) then
    return null;
  end if;

  select shift_id into assigned from shift_assignments
   where employee_id = p_employee_id and date = p_date;
  if found then
    return assigned;
  end if;

  if emp.shift_worker and emp.rotation_pattern_id is not null then
    return rotation_shift_for(emp, p_date);
  end if;

  return emp.shift_id;
end;
$$;
