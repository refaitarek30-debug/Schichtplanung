-- Kurze Umfrage im Privatbereich (einmalig, 3 Tage nach dem Einrichten)
-- und aufgeräumte Betreiber-Übersicht.
--
-- 1. privat_umfrage: je Privatkonto höchstens eine Zeile – beantwortet oder
--    übersprungen. Keine Policies: Lesen und Schreiben nur über die
--    Funktionen unten. Beim Löschen des Privatbereichs fällt die Zeile mit weg.
-- 2. privat_umfrage_offen(): ob das Popup jetzt kommen soll.
-- 3. privat_umfrage_senden(): Antwort speichern (alles leer = übersprungen).
-- 4. platform_umfrage(): Auswertung für die Betreiber-Seite – nur Summen und
--    Texte, ohne Konto, E-Mail oder Namen. Nur mit dem Service-Schlüssel.
-- 5. platform_dashboard(): Konten mit Betrieb und Privatbereich heißen jetzt
--    „beide“ (vorher nur „privat“, die Firma war weg).

create table if not exists public.privat_umfrage (
  user_id uuid primary key references public.privat_konten (user_id) on delete cascade,
  quelle text check (quelle in ('tiktok', 'instagram', 'suche', 'freunde', 'arbeit', 'sonstiges')),
  zufriedenheit smallint check (zufriedenheit between 1 and 5),
  verbesserung text check (verbesserung is null or length(verbesserung) between 1 and 1000),
  uebersprungen boolean not null default false,
  erstellt_am timestamptz not null default now()
);

alter table public.privat_umfrage enable row level security;
revoke all on table public.privat_umfrage from anon, authenticated;

create or replace function public.privat_umfrage_offen()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from privat_konten k
            where k.user_id = auth.uid()
              and k.erstellt_am <= now() - interval '3 days')
     and not exists (select 1 from privat_umfrage u where u.user_id = auth.uid());
$$;

create or replace function public.privat_umfrage_senden(
  p_quelle text default null,
  p_zufriedenheit integer default null,
  p_verbesserung text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_text text := nullif(btrim(coalesce(p_verbesserung, '')), '');
begin
  if auth.uid() is null or not exists (select 1 from privat_konten where user_id = auth.uid()) then
    raise exception 'Kein Privatbereich.' using errcode = '42501';
  end if;
  insert into privat_umfrage (user_id, quelle, zufriedenheit, verbesserung, uebersprungen)
  values (
    auth.uid(),
    p_quelle,
    p_zufriedenheit,
    left(v_text, 1000),
    p_quelle is null and p_zufriedenheit is null and v_text is null
  )
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.privat_umfrage_offen() from public, anon;
revoke all on function public.privat_umfrage_senden(text, integer, text) from public, anon;
grant execute on function public.privat_umfrage_offen() to authenticated;
grant execute on function public.privat_umfrage_senden(text, integer, text) to authenticated;

create or replace function public.platform_umfrage()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with b as (select * from privat_umfrage where not uebersprungen)
  select jsonb_build_object(
    'antworten', (select count(*) from b),
    'uebersprungen', (select count(*) from privat_umfrage where uebersprungen),
    'durchschnitt', (select round(avg(zufriedenheit)::numeric, 1) from b where zufriedenheit is not null),
    'zufriedenheit', coalesce((select jsonb_object_agg(zufriedenheit, n) from (
        select zufriedenheit, count(*) n from b where zufriedenheit is not null group by 1) z), '{}'::jsonb),
    'quellen', coalesce((select jsonb_object_agg(quelle, n) from (
        select quelle, count(*) n from b where quelle is not null group by 1) q), '{}'::jsonb),
    'texte', coalesce((select jsonb_agg(jsonb_build_object(
        'text', t.verbesserung, 'zufriedenheit', t.zufriedenheit, 'tag', (t.erstellt_am at time zone 'Europe/Berlin')::date)
        order by t.erstellt_am desc)
      from (select * from b where verbesserung is not null order by erstellt_am desc limit 100) t), '[]'::jsonb)
  );
$$;

revoke all on function public.platform_umfrage() from public, anon, authenticated;
grant execute on function public.platform_umfrage() to service_role;

create or replace function public.platform_dashboard(p_limit integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  with echte as (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at
      from auth.users u
     where not exists (
       select 1 from profiles p join companies c on c.id = p.company_id
        where p.id = u.id and c.is_demo)
  ),
  neu as (
    select e.email, e.created_at, e.last_sign_in_at, e.email_confirmed_at is not null as bestaetigt,
           case when k.user_id is not null and p.id is not null then 'beide'
                when k.user_id is not null then 'privat'
                when p.id is not null then 'firma'
                else 'ohne' end as art,
           c.name as firma
      from echte e
      left join privat_konten k on k.user_id = e.id
      left join profiles p on p.id = e.id
      left join companies c on c.id = p.company_id
     order by e.created_at desc
     limit greatest(1, least(coalesce(p_limit, 30), 200))
  )
  select jsonb_build_object(
    'konten', (select count(*) from echte),
    'neu_heute', (select count(*) from echte where created_at >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'),
    'neu_7', (select count(*) from echte where created_at >= now() - interval '7 days'),
    'neu_30', (select count(*) from echte where created_at >= now() - interval '30 days'),
    'privat', (select count(*) from privat_konten k join echte e on e.id = k.user_id),
    'firma', (select count(*) from profiles p join echte e on e.id = p.id),
    'beide', (select count(*) from privat_konten k join profiles p on p.id = k.user_id join echte e on e.id = k.user_id),
    'angemeldet_24h', (select count(*) from echte where last_sign_in_at >= now() - interval '24 hours'),
    'angemeldet_7', (select count(*) from echte where last_sign_in_at >= now() - interval '7 days'),
    'neu', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from neu n), '[]'::jsonb),
    'summen', jsonb_build_object(
      'firmen', (select count(*) from companies where not is_demo),
      'mitarbeiter', (select count(*) from employees e join companies c on c.id = e.company_id where e.active and not c.is_demo),
      'plan_eintraege', (select count(*) from shift_assignments a join companies c on c.id = a.company_id where not c.is_demo),
      'urlaubsantraege', (select count(*) from leave_requests r join companies c on c.id = r.company_id where not c.is_demo),
      'offene_antraege', (select count(*) from leave_requests r join companies c on c.id = r.company_id where r.status = 'pending' and not c.is_demo),
      'privat_tage', (select count(*) from privat_tage),
      'eigene_tage', (select count(*) from kalender_eigene_tage),
      'termine', (select count(*) from kalender_termine),
      'todos', (select count(*) from kalender_todos),
      'personen', (select count(*) from kalender_personen),
      'verbindungen', (select count(*) from kalender_verbindungen),
      'gruppen', (select count(*) from kalender_gruppen)
    )
  );
$$;

-- Datenschutzerklärung 2.31: kurze Umfrage im Privatbereich.
update public.legal_versions set version = '2.31', valid_from = current_date where doc = 'datenschutz';
