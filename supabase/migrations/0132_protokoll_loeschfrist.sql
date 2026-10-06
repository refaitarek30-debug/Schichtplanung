-- Löschfrist für das Protokoll (gehört zu 0131_protokoll.sql).
--
-- Anmeldungen, Abmeldungen und Fehlermeldungen werden nach 90 Tagen
-- gelöscht, Änderungen wie bisher nach 24 Monaten. Eigene Datei, weil die
-- Funktion Löschbefehle enthält und deshalb von Hand bestätigt eingespielt
-- wird (Supabase → SQL Editor). Bis dahin gilt für alles die 24-Monats-Frist.


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
  n_zugriff int;
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

  delete from public.audit_logs
   where created_at < now() - interval '90 days'
     and (action like 'anmeldung%' or action like 'abmeldung%' or action like 'fehler.%');
  get diagnostics n_zugriff = row_count;

  return jsonb_build_object(
    'rate_limit_hits', n_rate,
    'email_outbox', n_mail,
    'notifications', n_notif,
    'plan_kommentare', n_komm,
    'audit_logs', n_audit,
    'protokoll_anmeldungen_fehler', n_zugriff
  );
end;
$$;

revoke all on function public.retention_cleanup() from public, anon, authenticated;
grant execute on function public.retention_cleanup() to service_role;
