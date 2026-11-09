-- Privatbereich: Lohnabrechnungen hochladen (09.11.2026).
--
-- Dateien liegen im privaten Speicher-Bucket „lohnzettel“ unter
-- <user_id>/<datei>. Nur die Person selbst liest, schreibt und löscht – und
-- erst nach ausdrücklicher Einwilligung (Lohnabrechnungen können Angaben zur
-- Religion (Kirchensteuer) und Gesundheit enthalten, Art. 9 DSGVO).
-- Bilder werden im Browser verkleinert, PDFs bleiben PDF; höchstens 10 MB.
--
-- Wird ein Eintrag gelöscht – auch mit dem Konto (cascade) –, merkt sich ein
-- Trigger die Datei; /api/erinnerungen löscht sie dann im Speicher. So bleibt
-- keine Datei liegen, egal auf welchem Weg ein Konto verschwindet.

alter table public.privat_konten add column if not exists lohnzettel_einwilligung timestamptz;

create table if not exists public.privat_lohnzettel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.privat_konten (user_id) on delete cascade,
  monat date not null check (extract(day from monat) = 1),
  titel text not null default '' check (length(titel) <= 60),
  pfad text not null unique,
  typ text not null check (typ in ('image/jpeg', 'application/pdf')),
  groesse integer not null check (groesse > 0 and groesse <= 10485760),
  erstellt_am timestamptz not null default now(),
  check (pfad like user_id::text || '/%')
);
create index if not exists privat_lohnzettel_user on public.privat_lohnzettel (user_id, monat desc);

alter table public.privat_lohnzettel enable row level security;
drop policy if exists privat_lohnzettel_eigen on public.privat_lohnzettel;
create policy privat_lohnzettel_eigen on public.privat_lohnzettel
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.privat_konten k where k.user_id = (select auth.uid()) and k.lohnzettel_einwilligung is not null)
  );
revoke all on public.privat_lohnzettel from anon, authenticated;
grant select, insert, delete on public.privat_lohnzettel to authenticated;
grant update (titel, monat) on public.privat_lohnzettel to authenticated;

-- Höchstens 300 Lohnzettel je Person.
create or replace function public.privat_lohnzettel_grenze()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (select count(*) from privat_lohnzettel where user_id = new.user_id) >= 300 then
    raise exception 'Höchstens 300 Lohnabrechnungen.';
  end if;
  return new;
end;
$$;
revoke execute on function public.privat_lohnzettel_grenze() from public, anon, authenticated;
drop trigger if exists privat_lohnzettel_grenze on public.privat_lohnzettel;
create trigger privat_lohnzettel_grenze before insert on public.privat_lohnzettel
  for each row execute function public.privat_lohnzettel_grenze();

-- Einwilligung geben bzw. zurücknehmen (zurücknehmen nur, wenn nichts mehr gespeichert ist).
create or replace function public.lohnzettel_einwilligung(p_an boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from privat_konten where user_id = auth.uid()) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if not p_an and exists (select 1 from privat_lohnzettel where user_id = auth.uid()) then
    raise exception 'Bitte zuerst alle Lohnabrechnungen löschen.';
  end if;
  update privat_konten set lohnzettel_einwilligung = case when p_an then now() end where user_id = auth.uid();
end;
$$;
revoke execute on function public.lohnzettel_einwilligung(boolean) from public, anon;
grant execute on function public.lohnzettel_einwilligung(boolean) to authenticated;

-- Dateien zum Löschen im Speicher (nur der Server liest das).
create table if not exists public.lohnzettel_aufraeumen (
  pfad text primary key,
  seit timestamptz not null default now()
);
alter table public.lohnzettel_aufraeumen enable row level security;
revoke all on public.lohnzettel_aufraeumen from anon, authenticated;

create or replace function public.privat_lohnzettel_weg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into lohnzettel_aufraeumen (pfad) values (old.pfad) on conflict do nothing;
  return null;
end;
$$;
revoke execute on function public.privat_lohnzettel_weg() from public, anon, authenticated;
drop trigger if exists privat_lohnzettel_weg on public.privat_lohnzettel;
create trigger privat_lohnzettel_weg after delete on public.privat_lohnzettel
  for each row execute function public.privat_lohnzettel_weg();

-- Speicher: privater Bucket, nur JPEG und PDF, höchstens 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lohnzettel', 'lohnzettel', false, 10485760, array['image/jpeg', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Lohnzettel lesen" on storage.objects;
create policy "Lohnzettel lesen" on storage.objects for select to authenticated
  using (bucket_id = 'lohnzettel' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Lohnzettel hochladen" on storage.objects;
create policy "Lohnzettel hochladen" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lohnzettel'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.privat_konten k where k.user_id = (select auth.uid()) and k.lohnzettel_einwilligung is not null)
  );

drop policy if exists "Lohnzettel löschen" on storage.objects;
create policy "Lohnzettel löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'lohnzettel' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Anstoßen auch, wenn Dateien aufzuräumen sind.
create or replace function public.erinnerungen_anstossen()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  geheimnis text;
begin
  if not exists (
    select 1 from erinnerungen_im_fenster() f
     where exists (select 1 from push_abos p where p.user_id = f.user_id)
  ) and not exists (select 1 from push_warteschlange
                     where gesendet_am is null and (senden_ab is null or senden_ab <= now()))
    and not exists (select 1 from lohnzettel_aufraeumen) then
    return;
  end if;
  select decrypted_secret into geheimnis from vault.decrypted_secrets where name = 'erinnerung_geheimnis';
  if geheimnis is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://ready-flame.vercel.app/api/erinnerungen',
    headers := jsonb_build_object('content-type', 'application/json', 'x-erinnerung', geheimnis),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function public.erinnerungen_anstossen() from public, anon, authenticated;
