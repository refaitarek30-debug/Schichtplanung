-- Startseite: jede Person wählt, was beim Öffnen der App zuerst kommt.
-- Leer = Dashboard (wie bisher). Die bestehende Regel „eigenes Profil
-- aendern“ erlaubt das Schreiben der eigenen Zeile; Rolle, Firma und
-- Aktiv-Kennzeichen sind dort ohnehin gesperrt.
alter table public.profiles add column if not exists start_seite text;
alter table public.profiles drop constraint if exists profiles_start_seite_check;
alter table public.profiles
  add constraint profiles_start_seite_check
  check (start_seite is null or start_seite in ('dashboard', 'schichtplan', 'kalender'));
