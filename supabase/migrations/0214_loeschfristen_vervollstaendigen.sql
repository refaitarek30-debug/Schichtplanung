-- Löschfristen vervollständigen (Fund D-02 aus docs/review, docs/loeschkonzept.md).
--
-- Die tägliche Aufräum-Funktion löschte bisher: Ratenbegrenzung (1 Tag), Postausgang
-- (30 Tage), Benachrichtigungen (180 Tage), Plan-Kommentare (12 Monate), Änderungsprotokoll
-- (24 Monate). Es fehlten:
--   * Anmeldeprotokoll und Fehlermeldungen (protokoll_zugang): 90 Tage – so steht es im
--     Verarbeitungsverzeichnis, gelöscht wurde aber nie.
--   * Betreiber-Protokoll (plattform_protokoll): 24 Monate, wie das Änderungsprotokoll.
--   * Abgelaufene Passwort-Codes und Verbindungs-Codes: 7 Tage nach Ablauf.
--   * Fehlversuche bei Verbindungs-Codes: 1 Tag.
--   * Bereits gesendete Push-Mitteilungen in der Warteschlange: 30 Tage.
-- Der Zeitplan (cron „retention-taeglich“, 3:17 Uhr UTC) bleibt unverändert.

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
  n_zugang int;
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

  delete from public.audit_logs where created_at < now() - interval '24 months';
  get diagnostics n_audit = row_count;

  delete from public.protokoll_zugang where created_at < now() - interval '90 days';
  get diagnostics n_zugang = row_count;

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
    'audit_logs', n_audit,
    'protokoll_zugang', n_zugang,
    'plattform_protokoll', n_plattform,
    'passwort_codes', n_pwcode,
    'kalender_verbindung_codes', n_vcode,
    'kalender_code_versuche', n_versuch,
    'push_warteschlange', n_push
  );
end;
$function$;

-- Wie bisher: nur der Zeitplan (und der Betreiber) ruft die Funktion auf.
revoke all on function public.retention_cleanup() from public, anon, authenticated;
