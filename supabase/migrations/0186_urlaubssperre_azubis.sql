-- Urlaubssperre gilt nicht für Azubis.
--
-- Azubis zählen nicht zur Besetzung (siehe 0111) – eine Sperre, die die
-- Mindestbesetzung schützen soll, hat für sie keinen Grund. Bisher wies der
-- Trigger ihren Antrag trotzdem ab.
--
-- urlaubssperre_pruefen() ist die eine Stelle der Regel: der Trigger nutzt
-- sie, und das Antragsformular fragt sie vorab, damit niemand erst beim
-- Absenden von der Sperre erfährt. Sie beachtet auch Sperren, die nur für
-- eine Schicht gelten (blocked_days() zeigt alle Sperren des Betriebs).

create or replace function public.urlaubssperre_pruefen(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  emp employees;
  grund text;
begin
  select * into emp from employees where id = p_employee_id;
  if not found then
    return jsonb_build_object('grund', null, 'azubi', false);
  end if;
  -- Aus der App nur für den eigenen Betrieb; der Trigger läuft ohne Sitzungsprüfung.
  if auth.uid() is not null and emp.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  grund := leave_block_for_range(emp.company_id, emp.shift_id, p_start_date, p_end_date);
  if grund is null then
    return jsonb_build_object('grund', null, 'azubi', false);
  end if;
  if coalesce(emp.is_apprentice, false) then
    -- Sperre besteht, gilt aber nicht für diese Person.
    return jsonb_build_object('grund', null, 'azubi', true, 'sperre', grund);
  end if;
  return jsonb_build_object('grund', grund, 'azubi', false);
end;
$$;

revoke execute on function public.urlaubssperre_pruefen(uuid, date, date) from anon, public;
grant execute on function public.urlaubssperre_pruefen(uuid, date, date) to authenticated;

create or replace function public.leave_requests_check_block()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  block_reason text;
  emp employees;
begin
  select * into emp from employees where id = new.employee_id;
  -- Azubis zählen nicht zur Besetzung – für sie gilt keine Urlaubssperre.
  if coalesce(emp.is_apprentice, false) then
    return new;
  end if;
  select leave_block_for_range(new.company_id, emp.shift_id, new.start_date, new.end_date)
    into block_reason;
  if block_reason is not null then
    raise exception 'Für diesen Zeitraum gilt eine Urlaubssperre: %. Bei Fragen wende dich bitte an deine Schichtleitung.', rtrim(block_reason, '. ');
  end if;
  return new;
end;
$$;
