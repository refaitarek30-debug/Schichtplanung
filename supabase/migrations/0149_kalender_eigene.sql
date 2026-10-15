-- =====================================================================
-- Mein Kalender (Firma): eigene Farben und private Einträge.
--
-- Zunächst nur für freigeschaltete Personen (funktion 'kalender_neu').
-- Freigabe für alle später mit einer Zeile:
--   update funktionen set fuer_alle = true where funktion = 'kalender_neu';
-- (vorher: Datenschutzerklärung ergänzen)
--
-- Alles hier gehört genau einer Person und ist nur für sie sichtbar –
-- auch die Firma (Schichtleitung, Verwaltung) sieht es nicht. Der echte
-- Schichtplan wird davon nicht berührt.
-- =====================================================================

-- Eigene Eintragsarten, z. B. „Nebenjob“ – mit Farbe und Uhrzeit.
create table if not exists public.kalender_eigene_arten (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 30),
  kuerzel text not null check (length(btrim(kuerzel)) between 1 and 3),
  farbe text not null check (farbe ~ '^#[0-9a-fA-F]{6}$'),
  beginn time,
  ende time,
  reihenfolge integer not null default 0,
  erstellt_am timestamptz not null default now(),
  unique (user_id, id)
);
create index if not exists kalender_eigene_arten_user on public.kalender_eigene_arten (user_id);

-- Höchstens ein eigener Eintrag je Tag.
create table if not exists public.kalender_eigene_tage (
  user_id uuid not null references auth.users (id) on delete cascade,
  tag date not null check (tag between date '2000-01-01' and date '2100-12-31'),
  art_id uuid not null,
  primary key (user_id, tag),
  foreign key (user_id, art_id)
    references public.kalender_eigene_arten (user_id, id) on delete cascade
);
create index if not exists kalender_eigene_tage_art on public.kalender_eigene_tage (art_id);

-- Eigene Farben für die Schichten und Abwesenheiten des Plans.
create table if not exists public.kalender_farben (
  user_id uuid not null references auth.users (id) on delete cascade,
  schluessel text not null check (schluessel ~ '^[A-Za-z0-9:_-]{1,40}$'),
  farbe text not null check (farbe ~ '^#[0-9a-fA-F]{6}$'),
  primary key (user_id, schluessel)
);

alter table public.kalender_eigene_arten enable row level security;
alter table public.kalender_eigene_tage enable row level security;
alter table public.kalender_farben enable row level security;

revoke all on public.kalender_eigene_arten, public.kalender_eigene_tage, public.kalender_farben from anon, authenticated;
grant select, insert, update, delete on public.kalender_eigene_arten, public.kalender_eigene_tage, public.kalender_farben to authenticated;

-- Lesen und Löschen: nur die eigenen Zeilen. Anlegen und Ändern: nur mit
-- Firmenprofil und Freischaltung.
drop policy if exists kalender_eigene_arten_lesen on public.kalender_eigene_arten;
create policy kalender_eigene_arten_lesen on public.kalender_eigene_arten
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists kalender_eigene_arten_loeschen on public.kalender_eigene_arten;
create policy kalender_eigene_arten_loeschen on public.kalender_eigene_arten
  for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists kalender_eigene_arten_anlegen on public.kalender_eigene_arten;
create policy kalender_eigene_arten_anlegen on public.kalender_eigene_arten
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select auth_employee_id()) is not null and (select hat_funktion('kalender_neu')));
drop policy if exists kalender_eigene_arten_aendern on public.kalender_eigene_arten;
create policy kalender_eigene_arten_aendern on public.kalender_eigene_arten
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select auth_employee_id()) is not null and (select hat_funktion('kalender_neu')));

drop policy if exists kalender_eigene_tage_lesen on public.kalender_eigene_tage;
create policy kalender_eigene_tage_lesen on public.kalender_eigene_tage
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists kalender_eigene_tage_loeschen on public.kalender_eigene_tage;
create policy kalender_eigene_tage_loeschen on public.kalender_eigene_tage
  for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists kalender_eigene_tage_anlegen on public.kalender_eigene_tage;
create policy kalender_eigene_tage_anlegen on public.kalender_eigene_tage
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select auth_employee_id()) is not null and (select hat_funktion('kalender_neu')));
drop policy if exists kalender_eigene_tage_aendern on public.kalender_eigene_tage;
create policy kalender_eigene_tage_aendern on public.kalender_eigene_tage
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select auth_employee_id()) is not null and (select hat_funktion('kalender_neu')));

drop policy if exists kalender_farben_lesen on public.kalender_farben;
create policy kalender_farben_lesen on public.kalender_farben
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists kalender_farben_loeschen on public.kalender_farben;
create policy kalender_farben_loeschen on public.kalender_farben
  for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists kalender_farben_anlegen on public.kalender_farben;
create policy kalender_farben_anlegen on public.kalender_farben
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select auth_employee_id()) is not null and (select hat_funktion('kalender_neu')));
drop policy if exists kalender_farben_aendern on public.kalender_farben;
create policy kalender_farben_aendern on public.kalender_farben
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select auth_employee_id()) is not null and (select hat_funktion('kalender_neu')));

-- Obergrenzen gegen Wildwuchs.
create or replace function public.kalender_eigene_grenze()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_table_name = 'kalender_eigene_arten'
     and (select count(*) from kalender_eigene_arten where user_id = new.user_id) >= 30 then
    raise exception 'Höchstens 30 eigene Einträge.';
  end if;
  if tg_table_name = 'kalender_farben'
     and (select count(*) from kalender_farben where user_id = new.user_id) >= 60 then
    raise exception 'Zu viele Farben gespeichert.';
  end if;
  return new;
end;
$$;
revoke all on function public.kalender_eigene_grenze() from public, anon, authenticated;
drop trigger if exists kalender_eigene_arten_grenze on public.kalender_eigene_arten;
create trigger kalender_eigene_arten_grenze before insert on public.kalender_eigene_arten
  for each row execute function public.kalender_eigene_grenze();
drop trigger if exists kalender_farben_grenze on public.kalender_farben;
create trigger kalender_farben_grenze before insert on public.kalender_farben
  for each row execute function public.kalender_eigene_grenze();

-- Freischaltung: erst nur für Tarek.
insert into public.funktionen (funktion, fuer_alle) values ('kalender_neu', false) on conflict do nothing;
insert into public.funktionen_zugang (funktion, user_id)
values ('kalender_neu', '2a78e4d4-b093-4f55-a485-fd12fe9c1f56') on conflict do nothing;
