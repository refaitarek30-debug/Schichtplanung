-- Auswertung ohne Namen, Anmeldeprotokoll als „Blackbox“, Korrektur der Löschfristen.
--
-- 1) Korrektur zu 0214: `protokoll_zugang` ist NICHT das Anmeldeprotokoll, sondern die Liste der
--    Personen, die es sehen durften. Das Anmeldeprotokoll steht in `audit_logs` (Aktionen
--    anmeldung.*, abmeldung.*, fehler.*) und blieb dort 24 Monate – zugesagt sind 90 Tage.
--    Jetzt: diese drei Arten nach 90 Tagen löschen; die Zeile zu `protokoll_zugang` entfällt.
-- 2) Anmeldeprotokoll im Unternehmen nicht mehr einsehbar: alle Freischaltungen entfernt.
--    Es wird weiter geschrieben (Sicherheitsvorfälle), ansehen kann es nur noch der Betreiber.
-- 3) Auswertung ohne Namen: neue Funktion liefert nur Summen je Schicht und Monat, und die
--    Aufteilung nach Schicht nur, wenn jede Schicht mindestens 5 Personen hat. Unter 5 Personen
--    im Unternehmen gibt es keine Auswertung. Die alte Funktion mit Namen ist für die App gesperrt.

create or replace function public.retention_cleanup()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_rate int;
  n_mail int;
  n_notif int;
  n_komm int;
  n_audit int;
  n_anmeldung int;
  n_plattform int;
  n_pwcode int;
  n_vcode int;
  n_versuch int;
  n_push int;
begin
  delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  get diagnostics n_rate = row_count;

  delete from public.email_outbox where created_at < now() - interval '30 days';
  get diagnostics n_mail = row_count;

  delete from public.notifications where created_at < now() - interval '180 days';
  get diagnostics n_notif = row_count;

  delete from public.plan_kommentare where tag < public.heute() - 365;
  get diagnostics n_komm = row_count;

  -- Anmeldeprotokoll und angezeigte Fehlermeldungen: 90 Tage.
  delete from public.audit_logs
   where created_at < now() - interval '90 days'
     and split_part(action, '.', 1) in ('anmeldung', 'abmeldung', 'fehler');
  get diagnostics n_anmeldung = row_count;

  -- Änderungsprotokoll: 24 Monate.
  delete from public.audit_logs where created_at < now() - interval '24 months';
  get diagnostics n_audit = row_count;

  delete from public.plattform_protokoll where am < now() - interval '24 months';
  get diagnostics n_plattform = row_count;

  -- Abgelaufene Codes; eine laufende Sperre (zu viele Fehlversuche) bleibt bis zu ihrem Ende stehen.
  delete from public.passwort_codes
   where gueltig_bis < now() - interval '7 days'
     and (gesperrt_bis is null or gesperrt_bis < now());
  get diagnostics n_pwcode = row_count;

  delete from public.kalender_verbindung_codes where gueltig_bis < now() - interval '7 days';
  get diagnostics n_vcode = row_count;

  delete from public.kalender_code_versuche where zeit < now() - interval '1 day';
  get diagnostics n_versuch = row_count;

  delete from public.push_warteschlange
   where gesendet_am is not null and gesendet_am < now() - interval '30 days';
  get diagnostics n_push = row_count;

  return jsonb_build_object(
    'rate_limit_hits', n_rate,
    'email_outbox', n_mail,
    'notifications', n_notif,
    'plan_kommentare', n_komm,
    'anmeldeprotokoll', n_anmeldung,
    'audit_logs', n_audit,
    'plattform_protokoll', n_plattform,
    'passwort_codes', n_pwcode,
    'kalender_verbindung_codes', n_vcode,
    'kalender_code_versuche', n_versuch,
    'push_warteschlange', n_push
  );
end;
$function$;

revoke all on function public.retention_cleanup() from public, anon, authenticated;

-- 2) Blackbox: niemand im Unternehmen sieht Anmeldungen und Fehlermeldungen.
delete from public.protokoll_zugang;

-- 3) Auswertung ohne Namen.
create or replace function public.absence_report_anonym(p_year integer, p_month integer default null)
returns table (
  gruppe text,
  aufgeteilt boolean,
  personen integer,
  monat integer,
  soll_tage integer,
  anwesend_tage integer,
  krank_tage integer,
  urlaub_tage integer,
  v_tage integer,
  sonderurlaub_tage integer,
  altersfreizeit_tage integer,
  bildungsurlaub_tage integer,
  gewerkschaftstag_tage integer,
  seminar_tage integer,
  sonstige_tage integer,
  ausfall_tage integer,
  soll_stunden numeric,
  anwesend_stunden numeric,
  krank_stunden numeric,
  ausfall_stunden numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  mindest constant integer := 5;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Auswertungen sehen.';
  end if;

  return query
  with z as (
    select * from public.absence_report(p_year, p_month)
  ),
  je_schicht as (
    select coalesce(z.rotation_team, 'TS') as schicht, count(distinct z.employee_id) as n
      from z group by 1
  ),
  lage as (
    select (select count(distinct z.employee_id) from z) as alle,
           coalesce((select min(s.n) from je_schicht s), 0) >= mindest as teilbar
  )
  select
    case when l.teilbar then coalesce(z.rotation_team, 'TS') else 'alle' end,
    l.teilbar,
    count(distinct z.employee_id)::integer,
    z.monat,
    sum(z.soll_tage)::integer,
    sum(z.anwesend_tage)::integer,
    sum(z.krank_tage)::integer,
    sum(z.urlaub_tage)::integer,
    sum(z.v_tage)::integer,
    sum(z.sonderurlaub_tage)::integer,
    sum(z.altersfreizeit_tage)::integer,
    sum(z.bildungsurlaub_tage)::integer,
    sum(z.gewerkschaftstag_tage)::integer,
    sum(z.seminar_tage)::integer,
    sum(z.sonstige_tage)::integer,
    sum(z.ausfall_tage)::integer,
    sum(z.soll_stunden),
    sum(z.anwesend_stunden),
    sum(z.krank_stunden),
    sum(z.ausfall_stunden)
  from z cross join lage l
  where l.alle >= mindest
  group by 1, 2, z.monat;
end;
$function$;

revoke all on function public.absence_report_anonym(integer, integer) from public, anon;
grant execute on function public.absence_report_anonym(integer, integer) to authenticated;

-- Die Fassung mit Namen ist für die App nicht mehr aufrufbar (nur noch intern für die Summen).
revoke all on function public.absence_report(integer, integer) from public, anon, authenticated;

-- Datenschutzerklärung 2.29: Auswertung ohne Namen, Anmeldeprotokoll im Unternehmen nicht einsehbar.
update public.legal_versions set version = '2.29', valid_from = current_date where doc = 'datenschutz';
