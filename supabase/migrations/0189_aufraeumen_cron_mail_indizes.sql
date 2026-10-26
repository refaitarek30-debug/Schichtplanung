-- Aufräumen und Entlasten (Prüfung vom 26.10.2026).
--
-- 1. Der Protokollspeicher des Zeitplaners (cron.job_run_details) war mit 42 MB
--    zwei Drittel der ganzen Datenbank (64 MB): zwei Aufträge laufen jede
--    Minute, und nie wurde etwas gelöscht. Einmal leeren, danach täglich alles
--    löschen, was älter als 2 Tage ist.
-- 2. Der Mailversand rief jede Minute die Edge-Funktion auf – 1.440 Aufrufe am
--    Tag, auch wenn der Postausgang leer war. Jetzt nur noch, wenn etwas offen ist.
-- 3. Ein paar Verweise ohne Index, die beim Löschen von Personen und Betrieben
--    und bei Abfragen nach Schicht bzw. Person gebraucht werden.

-- ---- 1. Protokoll des Zeitplaners --------------------------------------------------

truncate table cron.job_run_details;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cron-aufraeumen') then
    perform cron.unschedule('cron-aufraeumen');
  end if;
  perform cron.schedule(
    'cron-aufraeumen',
    '29 3 * * *',
    $cmd$delete from cron.job_run_details where end_time < now() - interval '2 days'$cmd$
  );
end $$;

-- ---- 2. Mailversand nur bei Bedarf -----------------------------------------------------
-- Der Schlüssel (der öffentliche „anon“-Schlüssel, derselbe wie in der App) wird aus
-- dem bestehenden Auftrag übernommen, damit er nirgends neu eingetippt werden muss.

do $$
declare
  befehl text;
  schluessel text;
begin
  select command into befehl from cron.job where jobname = 'mail-versand-minute';
  if befehl is null then
    raise exception 'Auftrag mail-versand-minute nicht gefunden – nichts geändert.';
  end if;
  schluessel := substring(befehl from 'Bearer ([A-Za-z0-9._-]+)');
  if schluessel is null then
    raise exception 'Schlüssel im Auftrag nicht gefunden – nichts geändert.';
  end if;

  execute format($f$
    create or replace function public.mail_versand_anstossen()
    returns void language plpgsql security definer set search_path to 'public' as $body$
    begin
      -- Nichts im Postausgang: keinen Aufruf auslösen.
      if not exists (select 1 from email_outbox where status = 'offen' and versuche < 5) then
        return;
      end if;
      perform net.http_post(
        url := 'https://ehmphogahhqytscdwtla.supabase.co/functions/v1/mail-versand',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %s'),
        body := '{}'::jsonb
      );
    end;
    $body$;
  $f$, schluessel);

  revoke all on function public.mail_versand_anstossen() from public, anon, authenticated;

  perform cron.unschedule('mail-versand-minute');
  perform cron.schedule('mail-versand-minute', '* * * * *', 'select public.mail_versand_anstossen()');
end $$;

-- ---- 3. Indizes ------------------------------------------------------------------------

create index if not exists employees_shift_id_idx on public.employees (shift_id);
create index if not exists shift_assignments_shift_id_idx on public.shift_assignments (shift_id);
create index if not exists kalender_termine_von_user_idx on public.kalender_termine (von_user);
create index if not exists kalender_termine_person_id_idx on public.kalender_termine (person_id);
create index if not exists privat_tage_schichtart_idx on public.privat_tage (user_id, schichtart_id);
create index if not exists kalender_eigene_tage_art_fk_idx on public.kalender_eigene_tage (user_id, art_id);
create index if not exists hinweise_von_profile_idx on public.hinweise (von_profile);
