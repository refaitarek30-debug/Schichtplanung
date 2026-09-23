-- Rechte nachschärfen – Ergebnis der Sicherheitsprüfung vom 23.09.2026.
--
-- Nur Einschränkungen, keine Daten werden geändert oder gelöscht. Jeder
-- Punkt wurde vorher als Mitarbeiter bzw. als Person einer fremden Firma
-- ausprobiert (in einer zurückgerollten Transaktion).
--
-- 1. ensure_holidays(): Jede Person im Unternehmen konnte die Feiertage mit
--    p_replace = true neu erzeugen lassen – dabei werden von Hand gepflegte
--    Feiertage (außer Betriebsruhe) gelöscht. Und wer angemeldet war, aber
--    noch kein Profil hatte, kam an jede fremde Firma heran. Jetzt:
--      * Aufruf aus der Datenbank selbst (register_company als anon, Jobs):
--        wie bisher erlaubt,
--      * angemeldet ohne Profil: nur für ein eben angelegtes Unternehmen
--        ohne jedes Profil (der Registrierungsweg),
--      * sonst nur die eigene Firma, und Ersetzen nur für die Administration.
--
-- 2. suggest_leave_kind(): lieferte für jede Person der eigenen Firma den
--    Resturlaub und die restlichen V-Tage mit – auch an Kolleginnen und
--    Kollegen. Jetzt nur für sich selbst oder als Führung.
--
-- 3. leave_kind_kontingent(): hatte gar keine Prüfung, auch über Firmen
--    hinweg (Altersfreizeit-/Sonderurlaubsverbrauch einer beliebigen
--    Person). Die App ruft sie nie direkt auf; sie läuft nur innerhalb von
--    Funktionen mit Eigentümerrechten (Antragsprüfung, my_leave_kind_quotas).
--    Deshalb wird das direkte Ausführen entzogen.
--
-- 4. Triggerfunktionen: lassen sich zwar nicht direkt aufrufen, standen aber
--    teils für anon offen (Hinweis des Supabase-Advisors). Entzogen – Trigger
--    feuern unabhängig davon weiter.
--
-- 5. register_company(): für anon offen (bewusst, Selbstregistrierung).
--    Neu ist eine Bremse gegen Massenanlage: höchstens 10 nicht übernommene
--    Unternehmen (ohne jedes Profil) pro Stunde. Echte Registrierungen
--    bekommen ihr Profil sofort beim Anlegen des Zugangs und zählen nicht.

-- 1 ------------------------------------------------------------------------
create or replace function public.ensure_holidays(p_company_id uuid, p_year integer, p_replace boolean default false)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  bl text;
  n int;
  meine_firma uuid := auth_company_id();
begin
  if auth.uid() is not null then
    if meine_firma is null then
      -- Registrierung: das Unternehmen ist eben erst entstanden und gehört
      -- noch niemandem. Alles andere ist tabu.
      if not exists (
        select 1 from companies c
         where c.id = p_company_id
           and c.created_at > now() - interval '15 minutes'
           and not exists (select 1 from profiles p where p.company_id = c.id)
      ) then
        raise exception 'Du hast keine Berechtigung für diesen Bereich.';
      end if;
    elsif p_company_id is distinct from meine_firma then
      raise exception 'Du hast keine Berechtigung für diesen Bereich.';
    elsif p_replace and not is_admin() then
      raise exception 'Nur die Administration darf die Feiertage neu erzeugen.';
    end if;
  end if;

  if p_year < 2020 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  select coalesce(s.state, 'NW') into bl
    from company_settings s where s.company_id = p_company_id;
  bl := coalesce(bl, 'NW');

  if p_replace then
    -- Betriebsruhe bleibt stehen, die ist von Hand gepflegt.
    delete from holidays
     where company_id = p_company_id
       and extract(year from date) = p_year
       and not company_closure;
  end if;

  with neu as (
    insert into holidays (company_id, date, name, region)
    select p_company_id, h.tag, h.bezeichnung, bl
      from german_holidays(p_year, bl) h
    on conflict (company_id, date) do nothing
    returning 1
  )
  select count(*) into n from neu;

  return n;
end;
$function$;

-- 2 ------------------------------------------------------------------------
create or replace function public.suggest_leave_kind(p_employee_id uuid, p_date date)
returns table(kind text, grund text, u_rest numeric, v_rest numeric)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  e employees; v_u numeric; v_v numeric;
  is_holiday boolean; is_sunday boolean; is_night boolean; sname text; lohnt boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  -- Kontostände anderer gehen nur die Führung etwas an.
  if p_employee_id is distinct from auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  select remaining_days, v_remaining_days into v_u, v_v
  from leave_balances_view where employee_id = p_employee_id and year = extract(year from p_date);
  v_u := coalesce(v_u,0); v_v := coalesce(v_v,0);

  if not is_planned_workday(p_employee_id, p_date) then
    return query select 'keins'::text, 'Freier Tag – kostet keinen Urlaub'::text, v_u, v_v;
    return;
  end if;

  select exists(select 1 from holidays h where h.date = p_date
    and (h.company_id = e.company_id or h.company_id is null)) into is_holiday;
  is_sunday := extract(dow from p_date) = 0;
  select name into sname from shifts where id = effective_shift_id(p_employee_id, p_date);
  is_night := coalesce(sname ilike 'Nacht%', false);

  if not e.shift_worker then
    if v_u > 0 then
      return query select 'urlaub'::text, 'Kein Schichtsystem – der Tag kostet Urlaub'::text, v_u, v_v;
    else
      return query select 'keins'::text, 'Dein Urlaubskonto ist aufgebraucht'::text, v_u, v_v;
    end if;
    return;
  end if;

  lohnt := is_holiday or is_sunday or is_night;

  if lohnt and v_u > 0 then
    return query select 'urlaub'::text,
      case when is_holiday then 'Feiertag – mit Urlaub wird der Zuschlag mitbezahlt'
           when is_sunday  then 'Sonntag – mit Urlaub wird der Zuschlag mitbezahlt'
           else 'Nachtschicht – mit Urlaub wird der Zuschlag mitbezahlt' end, v_u, v_v;
  elsif lohnt and v_u <= 0 then
    return query select 'v_tag'::text,
      'Zuschlagstag, aber Urlaub aufgebraucht – V-Tag als Ersatz'::text, v_u, v_v;
  elsif not lohnt and v_v > 0 then
    return query select 'v_tag'::text,
      'Kein Zuschlagstag – V-Tag verwenden und Urlaub sparen'::text, v_u, v_v;
  elsif v_u > 0 then
    return query select 'urlaub'::text, 'V-Tage aufgebraucht – Urlaub wird verwendet'::text, v_u, v_v;
  else
    return query select 'keins'::text, 'Beide Konten sind aufgebraucht'::text, v_u, v_v;
  end if;
end;
$function$;

-- 3 ------------------------------------------------------------------------
revoke execute on function public.leave_kind_kontingent(uuid, leave_kind, integer, uuid)
  from public, anon, authenticated;

-- 4 ------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end
$$;

-- 5 ------------------------------------------------------------------------
create or replace function public.register_company(p_company_name text, p_first_name text, p_last_name text, p_email text, p_avv_accepted boolean default false)
returns table(company_id uuid, employee_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company_id uuid;
  v_employee_id uuid;
  jahr int := extract(year from current_date)::int;
begin
  if coalesce(trim(p_company_name), '') = '' then raise exception 'Bitte einen Unternehmensnamen angeben.'; end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then raise exception 'Bitte Vor- und Nachnamen angeben.'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'Bitte eine E-Mail-Adresse angeben.'; end if;
  if not coalesce(p_avv_accepted, false) then
    raise exception 'Bitte die Datenschutzerklärung und den Auftragsverarbeitungsvertrag bestätigen.';
  end if;
  if length(p_company_name) > 200 or length(p_first_name) > 100
     or length(p_last_name) > 100 or length(p_email) > 320 then
    raise exception 'Eine der Angaben ist zu lang.';
  end if;

  -- Bremse gegen Massenanlage über den öffentlichen Zugang.
  if (select count(*) from companies c
       where c.created_at > now() - interval '1 hour'
         and not exists (select 1 from profiles p where p.company_id = c.id)) >= 10 then
    raise exception 'Gerade werden sehr viele Unternehmen angelegt. Bitte versuche es in einer Stunde erneut.';
  end if;

  insert into companies (name, avv_accepted_at)
  values (trim(p_company_name), now())
  returning id into v_company_id;

  insert into employees (
    company_id, personnel_number, first_name, last_name, email, role,
    vacation_days, v_days
  )
  values (
    v_company_id, '10000', trim(p_first_name), trim(p_last_name), trim(p_email), 'admin',
    0, 0
  )
  returning id into v_employee_id;

  insert into shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values
    (v_company_id, 'Frühschicht', 'F', '06:00', '14:00', '#F59E0B', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Spätschicht', 'S', '14:00', '22:00', '#16A34A', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Nachtschicht', 'N', '22:00', '06:00', '#2F5BEA', 1, 1, '{0,1,2,3,4,5,6}');

  if not exists (select 1 from company_settings cs where cs.company_id = v_company_id) then
    insert into company_settings (company_id, state) values (v_company_id, 'NW');
  end if;

  perform ensure_holidays(v_company_id, jahr, false);
  perform ensure_holidays(v_company_id, jahr + 1, false);

  return query select v_company_id, v_employee_id;
end;
$function$;
