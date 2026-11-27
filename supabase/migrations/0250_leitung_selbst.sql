-- =============================================================
-- 0250 · Schichtleitung: bei sich selbst nur, wenn der Betrieb es erlaubt
--
-- Ist „Leitung entscheidet eigene Anträge“ aus, trägt bei der Schichtleitung
-- selbst die Administration ein. Bisher ging das über drei Wege trotzdem:
-- Abwesenheit (z. B. Urlaub) für sich eintragen, den eigenen Urlaubsanspruch
-- und das eigene AF-Stundenkonto ändern. Krank melden darf sich jede Leitung
-- weiter selbst. Für alle anderen Personen bleibt alles wie es ist
-- (Leitung darf bei jedem eintragen). Gilt auch beim direkten Schreiben in die
-- Abwesenheiten (das eigene AF-Konto direkt in employees schützt schon die
-- bestehende Regel „Führungsrolle nur durch die Administration“). Die Funktionen sind sonst unverändert
-- (Stand live: 0224, 0013, 0109 mit heute()).
-- =============================================================

create or replace function public._leitung_selbst_gesperrt(p_employee_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(not is_admin()
                  and p_employee_id = auth_employee_id()
                  and not leitung_eigene_antraege_erlaubt(), false)
$$;
revoke all on function public._leitung_selbst_gesperrt(uuid) from public, anon;
-- Wird in den Zugriffsregeln unten gebraucht (läuft dort mit den Rechten der Person);
-- verrät nur, ob die angefragte Person man selbst ist und die Regel greift.
grant execute on function public._leitung_selbst_gesperrt(uuid) to authenticated;

-- Auch direkt an der Tabelle: Führung darf Abwesenheiten sonst ohne Funktion schreiben
-- (Regel „Abwesenheiten pflegt Fuehrung“). Einschränkend – gilt zusätzlich zu den
-- bestehenden Regeln; krank bleibt erlaubt.
drop policy if exists "Leitung bei sich selbst nur mit Erlaubnis (neu)" on public.absences;
create policy "Leitung bei sich selbst nur mit Erlaubnis (neu)" on public.absences as restrictive
  for insert to authenticated
  with check (type = 'krank' or not public._leitung_selbst_gesperrt(employee_id));
drop policy if exists "Leitung bei sich selbst nur mit Erlaubnis (aendern)" on public.absences;
create policy "Leitung bei sich selbst nur mit Erlaubnis (aendern)" on public.absences as restrictive
  for update to authenticated
  using (type = 'krank' or not public._leitung_selbst_gesperrt(employee_id))
  with check (type = 'krank' or not public._leitung_selbst_gesperrt(employee_id));
drop policy if exists "Leitung bei sich selbst nur mit Erlaubnis (loeschen)" on public.absences;
create policy "Leitung bei sich selbst nur mit Erlaubnis (loeschen)" on public.absences as restrictive
  for delete to authenticated
  using (type = 'krank' or not public._leitung_selbst_gesperrt(employee_id));


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

  if p_type <> 'krank' and _leitung_selbst_gesperrt(p_employee_id) then
    raise exception 'Bei dir selbst trägt die Administration ein – nur krank melden geht selbst.';
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
    if p_type::text in ('schulung', 'berufsschule') then
      -- Schulung und Berufsschule: auch freie Tage, solange die Person beschäftigt ist.
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
    if p_type::text in ('schulung', 'berufsschule') then
      raise exception 'In diesem Zeitraum ist schon alles eingetragen oder die Person ist nicht beschäftigt.';
    end if;
    raise exception 'In diesem Zeitraum gibt es keinen eingeplanten Arbeitstag ohne bestehenden Eintrag.';
  end if;

  return v_count;
end;
$function$;

create or replace function public.set_leave_entitlement(
  p_employee_id uuid,
  p_entitlement numeric,
  p_year smallint default extract(year from now())::smallint
)
returns leave_balances
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result leave_balances;
  emp_company uuid;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;
  if p_entitlement is null or p_entitlement < 0 then
    raise exception 'Der Urlaubsanspruch muss eine Zahl ab 0 sein.';
  end if;

  select company_id into emp_company from employees where id = p_employee_id;
  if emp_company is null or emp_company is distinct from auth_company_id() then
    raise exception 'Der Mitarbeiter wurde nicht gefunden.';
  end if;

  if _leitung_selbst_gesperrt(p_employee_id) then
    raise exception 'Bei dir selbst trägt die Administration ein.';
  end if;

  insert into leave_balances (company_id, employee_id, year, entitlement)
  values (emp_company, p_employee_id, p_year, p_entitlement)
  on conflict (employee_id, year)
  do update set entitlement = excluded.entitlement, updated_at = now()
  returning * into result;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    emp_company, auth.uid(), 'leave_balance.entitlement_updated', 'leave_balances', result.id,
    jsonb_build_object('year', p_year, 'entitlement', p_entitlement)
  );

  return result;
end;
$function$;

create or replace function public.set_stundenstand(p_employee_id uuid, p_art text, p_stunden numeric, p_stichtag date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_firma uuid := auth_company_id();
  e employees;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_art = 'v' then
    raise exception 'V-Tage werden in Tagen geführt – bitte in der Verwaltung Tage hinzufügen oder abziehen.';
  end if;
  if p_art is distinct from 'af' then
    raise exception 'Unbekanntes Konto.';
  end if;
  select * into e from employees where id = p_employee_id and company_id = v_firma;
  if e.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if _leitung_selbst_gesperrt(p_employee_id) then
    raise exception 'Bei dir selbst trägt die Administration ein.';
  end if;
  if p_stichtag is not null then
    if p_stichtag < date '2000-01-01' or p_stichtag > public.heute() then
      raise exception 'Das Datum des Stands darf nicht in der Zukunft liegen.';
    end if;
    if p_stunden is null or p_stunden < -500 or p_stunden > 2000 then
      raise exception 'Bitte einen Stundenstand zwischen -500 und 2000 angeben.';
    end if;
  end if;

  update employees
     set af_ab = p_stichtag,
         af_start_stunden = case when p_stichtag is null then 0 else round(p_stunden, 2) end
   where id = p_employee_id;

  perform write_audit(v_firma, 'stundenkonto.af', 'employees', p_employee_id,
    jsonb_build_object(
      'vorher_ab', e.af_ab,
      'vorher_stunden', e.af_start_stunden,
      'nachher_ab', p_stichtag, 'nachher_stunden', p_stunden));
end;
$function$;
