-- =============================================================
-- 0229 · Betreiber-Konsole: Seite „Nutzung“ + Datenschutzerklärung 2.39
--
-- Nur zusammengezählte Werte – keine Namen, keine E-Mail-Adressen, keine
-- Inhalte, nichts je Person.
--
-- 1. plattform_tageszahlen: eine Zeile je Tag mit reinen Summen (Verlauf).
--    Wird beim Öffnen der Konsole für „heute“ geschrieben. Kein Personenbezug.
-- 2. platform_nutzung(): Wachstum je Woche, Zahlen zum Privatbereich
--    (nur reine Privatkonten – ohne Betriebszugang), Zustand der
--    Benachrichtigungen. Zu den Betrieben kommt hier NICHTS Neues dazu:
--    dort bleibt es bei den Zählwerten aus platform_overview.
-- 3. Datenschutzerklärung 2.39 beschreibt das.
-- =============================================================

create table if not exists public.plattform_tageszahlen (
  tag date primary key,
  konten integer not null,
  privat integer not null,
  aktiv_7 integer not null,
  aktiv_30 integer not null,
  privat_aktiv_7 integer not null
);
alter table public.plattform_tageszahlen enable row level security;
revoke all on public.plattform_tageszahlen from public, anon, authenticated;

create or replace function public.platform_nutzung()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v jsonb;
begin
  -- Summen von heute festhalten (für den Verlauf).
  insert into plattform_tageszahlen (tag, konten, privat, aktiv_7, aktiv_30, privat_aktiv_7)
  select v_heute,
         count(*),
         count(*) filter (where rein_privat),
         count(*) filter (where last_sign_in_at >= now() - interval '7 days'),
         count(*) filter (where last_sign_in_at >= now() - interval '30 days'),
         count(*) filter (where rein_privat and last_sign_in_at >= now() - interval '7 days')
    from (
      select u.last_sign_in_at,
             exists (select 1 from privat_konten k where k.user_id = u.id)
               and not exists (select 1 from profiles p where p.id = u.id) as rein_privat
        from auth.users u
       where not exists (
         select 1 from profiles p join companies c on c.id = p.company_id
          where p.id = u.id and c.is_demo)
    ) e
  on conflict (tag) do update
     set konten = excluded.konten, privat = excluded.privat, aktiv_7 = excluded.aktiv_7,
         aktiv_30 = excluded.aktiv_30, privat_aktiv_7 = excluded.privat_aktiv_7;

  with echte as (
    select u.id, u.created_at, u.last_sign_in_at,
           exists (select 1 from profiles p where p.id = u.id) as betrieb
      from auth.users u
     where not exists (
       select 1 from profiles p join companies c on c.id = p.company_id
        where p.id = u.id and c.is_demo)
  ),
  -- Reine Privatkonten: mit Privatbereich, ohne Betriebszugang.
  pr as (
    select e.id, e.created_at, e.last_sign_in_at
      from echte e join privat_konten k on k.user_id = e.id
     where not e.betrieb
  ),
  wochen as (
    select g::date as woche,
           (select count(*) from echte e where not e.betrieb
              and date_trunc('week', e.created_at at time zone 'Europe/Berlin') = g) as privat,
           (select count(*) from echte e where e.betrieb
              and date_trunc('week', e.created_at at time zone 'Europe/Berlin') = g) as betrieb
      from generate_series(
             date_trunc('week', now() at time zone 'Europe/Berlin') - interval '11 weeks',
             date_trunc('week', now() at time zone 'Europe/Berlin'),
             interval '1 week') g
  )
  select jsonb_build_object(
    'wochen', (select jsonb_agg(to_jsonb(w) order by w.woche) from wochen w),
    'verlauf', coalesce((select jsonb_agg(to_jsonb(t) order by t.tag)
                           from plattform_tageszahlen t where t.tag >= v_heute - 60), '[]'::jsonb),
    'privat', jsonb_build_object(
      'konten', (select count(*) from pr),
      'aktiv_7', (select count(*) from pr where last_sign_in_at >= now() - interval '7 days'),
      'aktiv_30', (select count(*) from pr where last_sign_in_at >= now() - interval '30 days'),
      'mit_schichten', (select count(*) from pr where exists (
          select 1 from privat_tage t where t.user_id = pr.id and t.tag >= v_heute - 30)),
      'plant_voraus', (select count(*) from pr where exists (
          select 1 from privat_tage t where t.user_id = pr.id and t.tag > v_heute)),
      -- Wiederkehr: Konten, die mindestens 14 Tage alt sind – wie viele kamen nach der ersten Woche wieder?
      'wiederkehr_basis', (select count(*) from pr where created_at <= now() - interval '14 days'),
      'wiederkehr', (select count(*) from pr where created_at <= now() - interval '14 days'
                       and last_sign_in_at >= created_at + interval '7 days'),
      -- Wie viele Konten eine Funktion überhaupt nutzen (Konten, nicht Einträge).
      'funktionen', jsonb_build_object(
        'schichtarten', (select count(*) from pr where exists (select 1 from privat_schichtarten s where s.user_id = pr.id)),
        'termine', (select count(*) from pr where exists (select 1 from kalender_termine t where t.owner_id = pr.id)),
        'todos', (select count(*) from pr where exists (select 1 from kalender_todos t where t.owner_id = pr.id)),
        'teilen', (select count(*) from pr where exists (select 1 from kalender_verbindungen v where v.a = pr.id or v.b = pr.id)
                     or exists (select 1 from kalender_personen kp where kp.owner_id = pr.id)),
        'kalender_abo', (select count(*) from pr where exists (select 1 from kalender_abo a where a.user_id = pr.id and a.beendet_am is null)),
        'push', (select count(*) from pr where exists (select 1 from push_abos a where a.user_id = pr.id))
      )
    ),
    'technik', jsonb_build_object(
      'push_gesendet_24h', (select count(*) from push_warteschlange where gesendet_am >= now() - interval '24 hours'),
      'push_haengt', (select count(*) from push_warteschlange
                       where gesendet_am is null and coalesce(senden_ab, erstellt_am) < now() - interval '1 hour'),
      'mail_fehler_7', (select count(*) from email_outbox
                         where letzter_fehler is not null and gesendet_at is null and created_at >= now() - interval '7 days')
    )
  ) into v;
  return v;
end;
$$;

revoke all on function public.platform_nutzung() from public, anon, authenticated;
grant execute on function public.platform_nutzung() to service_role;

update public.legal_versions set version = '2.39', valid_from = current_date where doc = 'datenschutz';
