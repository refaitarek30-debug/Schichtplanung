-- Automatische Löschfristen (Datenminimierung).
--
-- Ein täglicher Job löscht Daten, die ihren Zweck erfüllt haben:
--   * Ratenbegrenzungs-Zähler        nach   1 Tag
--   * Postausgang (E-Mail-Texte)     nach  30 Tagen
--   * Benachrichtigungen             nach 180 Tagen
--   * Kommentare im Schichtplan      12 Monate nach dem Tag, auf den sie sich beziehen
--   * Änderungsprotokoll             nach  24 Monaten
--
-- Diese Fristen stehen so in der Datenschutzerklärung (Abschnitt 9) – bei
-- Änderungen beides anpassen. Stamm-, Antrags-, Abwesenheits- und Kontodaten
-- werden NICHT automatisch gelöscht: darüber entscheidet der Kunde
-- (Aufbewahrungspflichten).

create or replace function public.retention_cleanup()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_rate int;
  n_mail int;
  n_notif int;
  n_komm int;
  n_audit int;
begin
  delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  get diagnostics n_rate = row_count;

  delete from public.email_outbox where created_at < now() - interval '30 days';
  get diagnostics n_mail = row_count;

  delete from public.notifications where created_at < now() - interval '180 days';
  get diagnostics n_notif = row_count;

  delete from public.plan_kommentare where tag < current_date - 365;
  get diagnostics n_komm = row_count;

  delete from public.audit_logs where created_at < now() - interval '24 months';
  get diagnostics n_audit = row_count;

  return jsonb_build_object(
    'rate_limit_hits', n_rate,
    'email_outbox', n_mail,
    'notifications', n_notif,
    'plan_kommentare', n_komm,
    'audit_logs', n_audit
  );
end;
$$;

revoke all on function public.retention_cleanup() from public, anon, authenticated;
grant execute on function public.retention_cleanup() to service_role;

do $do$
begin
  if exists (select 1 from cron.job where jobname = 'retention-taeglich') then
    perform cron.unschedule('retention-taeglich');
  end if;
  perform cron.schedule('retention-taeglich', '17 3 * * *', 'select public.retention_cleanup();');
end $do$;
