-- =============================================================
-- 0239 · Rechte nachziehen, Auswertung weg, lange nicht genutzte Konten
--
--  * Zwei Hilfsfunktionen waren ohne Anmeldung aufrufbar (gruppe_versatz,
--    leave_requests_vj_setzen). Jetzt nur noch angemeldet bzw. gar nicht
--    direkt (Trigger).
--  * Die Auswertung (Ausfall, Anwesenheit, Gesundheitsrate) ist aus der App
--    entfernt – die Datenbank liefert sie auch nicht mehr aus.
--  * Lange nicht genutzte Konten: Die Administration sieht, wer seit über
--    sechs Monaten nicht mehr in der App war, und kann das Konto auf allen
--    Geräten abmelden oder den Hinweis als erledigt markieren.
--  * Datenschutzerklärung 2.43.
-- =============================================================

revoke execute on function public.gruppe_versatz(uuid, public.rotation_team) from public, anon;
grant execute on function public.gruppe_versatz(uuid, public.rotation_team) to authenticated;

revoke execute on function public.leave_requests_vj_setzen() from public, anon, authenticated;

revoke execute on function public.absence_report(integer, integer) from public, anon, authenticated;
revoke execute on function public.absence_report_anonym(integer, integer) from public, anon, authenticated;

alter table public.profiles add column if not exists inaktiv_geprueft_am timestamptz;

-- Wer war seit über sechs Monaten nicht in der App? Zuletzt = späteste
-- Anmeldung oder Sitzungs-Erneuerung. Nur Administration, nur Name und Datum.
create or replace function public.inaktive_konten()
returns table(employee_id uuid, name text, zuletzt timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  with akt as (
    select p.employee_id as emp, p.inaktiv_geprueft_am as geprueft,
           greatest(u.last_sign_in_at,
                    (select max(coalesce(s.refreshed_at, s.updated_at::timestamp, s.created_at::timestamp))::timestamptz
                       from auth.sessions s where s.user_id = p.id)) as zuletzt
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.company_id = firma and p.active and p.employee_id is not null and p.id <> auth.uid()
  )
  select a.emp, e.first_name || ' ' || e.last_name, a.zuletzt
    from akt a
    join public.employees e on e.id = a.emp
   where e.active
     and a.zuletzt is not null
     and a.zuletzt < now() - interval '6 months'
     and (a.geprueft is null or a.geprueft < a.zuletzt)
   order by a.zuletzt;
end;
$function$;

revoke execute on function public.inaktive_konten() from public, anon;
grant execute on function public.inaktive_konten() to authenticated;

-- Hinweis erledigt; auf Wunsch vorher auf allen Geräten abmelden.
create or replace function public.inaktiv_erledigt(p_employee_id uuid, p_abmelden boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
  ziel uuid;
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select p.id into ziel from public.profiles p where p.employee_id = p_employee_id and p.company_id = firma limit 1;
  if ziel is null then
    raise exception 'Diese Person gibt es in deinem Betrieb nicht.';
  end if;
  if ziel = auth.uid() then
    raise exception 'Dich selbst kannst du hier nicht abmelden.';
  end if;
  if p_abmelden then
    delete from auth.refresh_tokens where user_id = ziel::text;
    delete from auth.sessions where user_id = ziel;
  end if;
  update public.profiles set inaktiv_geprueft_am = now() where id = ziel;
  perform public.write_audit(firma, case when p_abmelden then 'konto.abgemeldet' else 'konto.inaktiv_geprueft' end, 'profiles', ziel, null);
end;
$function$;

revoke execute on function public.inaktiv_erledigt(uuid, boolean) from public, anon;
grant execute on function public.inaktiv_erledigt(uuid, boolean) to authenticated;

update public.legal_versions set version = '2.43', valid_from = current_date where doc = 'datenschutz';
