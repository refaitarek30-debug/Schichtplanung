-- Persönliche Anzeige-Einstellungen, für Firmen- und Privatkonten gleich.
-- Gilt nur für die Person selbst, auf allen ihren Geräten:
--
-- * wochenende: Samstag und Sonntag in Kalender und Schichtplan
--   hervorheben – aus, leicht oder kräftig.
-- * plan_ansicht: Schichtplan kompakt (mehr Tage im Bild) oder groß.
-- * plan_eigene_farben: die eigenen Kalenderfarben auch im Schichtplan
--   verwenden. Aus = die gewohnten Farben des Betriebs.

create table if not exists public.anzeige_einstellungen (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wochenende text not null default 'leicht' check (wochenende in ('aus', 'leicht', 'kraeftig')),
  plan_ansicht text not null default 'kompakt' check (plan_ansicht in ('kompakt', 'gross')),
  plan_eigene_farben boolean not null default false,
  geaendert_am timestamptz not null default now()
);

alter table public.anzeige_einstellungen enable row level security;
revoke all on public.anzeige_einstellungen from anon, authenticated;
grant select, insert, update on public.anzeige_einstellungen to authenticated;

drop policy if exists anzeige_einstellungen_lesen on public.anzeige_einstellungen;
create policy anzeige_einstellungen_lesen on public.anzeige_einstellungen
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists anzeige_einstellungen_anlegen on public.anzeige_einstellungen;
create policy anzeige_einstellungen_anlegen on public.anzeige_einstellungen
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists anzeige_einstellungen_aendern on public.anzeige_einstellungen;
create policy anzeige_einstellungen_aendern on public.anzeige_einstellungen
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
