-- Erinnerungen per Mitteilung (Web Push) für Termine und To-dos.
--
-- * push_abos: je Gerät die Adresse für Mitteilungen (vom Browser), nur
--   über Funktionen erreichbar.
-- * faellige_erinnerungen(): was gerade fällig ist – nur für den Server
--   (Service-Role). Jede Erinnerung geht genau einmal raus
--   (erinnerung_gesendet).
-- * Jede Minute prüft pg_cron, ob etwas fällig ist, und stößt dann den
--   Versand an (/api/erinnerungen, mit eigenem Geheimnis aus dem Vault).

create table if not exists public.push_abos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 10 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  geraet text not null default '',
  erstellt_am timestamptz not null default now()
);
create index if not exists push_abos_user on public.push_abos (user_id);
alter table public.push_abos enable row level security;
revoke all on public.push_abos from anon, authenticated;

create table if not exists public.erinnerung_gesendet (
  art text not null,
  ref_id uuid not null,
  faellig_am timestamptz not null,
  gesendet_am timestamptz not null default now(),
  primary key (art, ref_id, faellig_am)
);
alter table public.erinnerung_gesendet enable row level security;
revoke all on public.erinnerung_gesendet from anon, authenticated;

-- ---- Für angemeldete Personen ------------------------------------------------

create or replace function public.push_abo_speichern(p_endpoint text, p_p256dh text, p_auth text, p_geraet text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  insert into push_abos (user_id, endpoint, p256dh, auth, geraet)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_geraet, ''), 60))
  on conflict (endpoint) do update
     set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
         geraet = excluded.geraet, erstellt_am = now();
  -- Höchstens 10 Geräte je Person: die ältesten fallen raus.
  delete from push_abos
   where user_id = auth.uid()
     and id not in (select id from push_abos where user_id = auth.uid() order by erstellt_am desc limit 10);
end;
$$;

create or replace function public.push_abo_entfernen(p_endpoint text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from push_abos where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

revoke all on function public.push_abo_speichern(text, text, text, text) from public, anon;
revoke all on function public.push_abo_entfernen(text) from public, anon;
grant execute on function public.push_abo_speichern(text, text, text, text) to authenticated;
grant execute on function public.push_abo_entfernen(text) to authenticated;

-- ---- Für den Server ----------------------------------------------------------------

-- Fälligkeiten im Fenster [jetzt - 15 Min., jetzt + 30 Sek.], noch nicht gesendet.
create or replace function public.erinnerungen_im_fenster()
returns table(user_id uuid, art text, ref_id uuid, titel text, datum date, beginn text, ganztaegig boolean, faellig_am timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with tage as (
    select d::date as d from generate_series(current_date - 1, current_date + 3, interval '1 day') d
  ),
  termine as (
    select t.owner_id, t.id, t.titel, x.d, t.beginn, t.ganztaegig,
           (case t.erinnerung
              when 'm10' then (x.d + t.beginn) - interval '10 minutes'
              when 'h1' then (x.d + t.beginn) - interval '1 hour'
              when 'd1' then (x.d + t.beginn) - interval '1 day'
              when 'morgens8' then x.d + time '08:00'
              when 'vortag18' then (x.d - 1) + time '18:00'
              when 'tag8' then x.d + time '08:00'
              when 'd2' then (x.d - 2) + time '08:00'
            end) at time zone 'Europe/Berlin' as faellig
      from kalender_termine t
      join tage x on x.d >= t.datum
     where t.erinnerung is not null
       and (t.ganztaegig or t.beginn is not null or t.erinnerung in ('morgens8', 'vortag18', 'tag8', 'd2'))
       and case t.wiederholung
             when 'taeglich' then true
             when 'woechentlich' then (x.d - t.datum) % 7 = 0
             when 'monatlich' then extract(day from x.d) = extract(day from t.datum)
             else x.d = t.datum
           end
  ),
  todos as (
    select o.owner_id, o.id, o.titel, o.datum, o.uhrzeit,
           (o.datum + o.uhrzeit) at time zone 'Europe/Berlin' as faellig
      from kalender_todos o
     where not o.erledigt and o.uhrzeit is not null
       and o.datum between current_date - 1 and current_date + 1
  ),
  alle as (
    select owner_id, 'termin'::text as art, id, titel, d as datum, to_char(beginn, 'HH24:MI') as beginn, ganztaegig, faellig from termine
    union all
    select owner_id, 'todo', id, titel, datum, to_char(uhrzeit, 'HH24:MI'), false, faellig from todos
  )
  select a.owner_id, a.art, a.id, a.titel, a.datum, a.beginn, a.ganztaegig, a.faellig
    from alle a
   where a.faellig between now() - interval '15 minutes' and now() + interval '30 seconds'
     and not exists (select 1 from erinnerung_gesendet g
                      where g.art = a.art and g.ref_id = a.id and g.faellig_am = a.faellig);
$$;

-- Holt die fälligen Erinnerungen und merkt sie als gesendet (genau einmal).
create or replace function public.faellige_erinnerungen()
returns table(user_id uuid, art text, ref_id uuid, titel text, datum date, beginn text, ganztaegig boolean, faellig_am timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from erinnerung_gesendet where erinnerung_gesendet.faellig_am < now() - interval '3 days';
  return query
    with f as (select * from erinnerungen_im_fenster()),
    neu as (
      insert into erinnerung_gesendet (art, ref_id, faellig_am)
      select f.art, f.ref_id, f.faellig_am from f
      on conflict do nothing
      returning erinnerung_gesendet.art, erinnerung_gesendet.ref_id, erinnerung_gesendet.faellig_am
    )
    select f.user_id, f.art, f.ref_id, f.titel, f.datum, f.beginn, f.ganztaegig, f.faellig_am
      from f join neu on neu.art = f.art and neu.ref_id = f.ref_id and neu.faellig_am = f.faellig_am
     where exists (select 1 from push_abos p where p.user_id = f.user_id);
end;
$$;

create or replace function public.push_abos_fuer(p_users uuid[])
returns table(user_id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path to 'public' as $$
  select p.user_id, p.endpoint, p.p256dh, p.auth from push_abos p where p.user_id = any(p_users);
$$;

create or replace function public.push_abo_ungueltig(p_endpoint text)
returns void language sql security definer set search_path to 'public' as $$
  delete from push_abos where endpoint = p_endpoint;
$$;

revoke all on function public.erinnerungen_im_fenster() from public, anon, authenticated;
revoke all on function public.faellige_erinnerungen() from public, anon, authenticated;
revoke all on function public.push_abos_fuer(uuid[]) from public, anon, authenticated;
revoke all on function public.push_abo_ungueltig(text) from public, anon, authenticated;
grant execute on function public.faellige_erinnerungen() to service_role;
grant execute on function public.push_abos_fuer(uuid[]) to service_role;
grant execute on function public.push_abo_ungueltig(text) to service_role;

-- ---- Jede Minute: nur wenn etwas fällig ist, den Versand anstoßen ----------------

create or replace function public.erinnerungen_anstossen()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  geheimnis text;
begin
  if not exists (
    select 1 from erinnerungen_im_fenster() f
     where exists (select 1 from push_abos p where p.user_id = f.user_id)
  ) then
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

-- Das Geheimnis (vault: erinnerung_geheimnis) und die Umgebungsvariable
-- ERINNERUNG_GEHEIMNIS werden einmalig von Hand gesetzt – nicht im Repo.
select cron.schedule('erinnerungen', '* * * * *', $$select public.erinnerungen_anstossen()$$);
