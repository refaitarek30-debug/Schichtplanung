-- Gibt es im Betrieb Zeitausgleich (V-Tage)? Wird bei der Registrierung gefragt.
-- Nein = die App blendet das V-Tage-Konto in Formularen und Übersichten aus.
-- Bestehende Betriebe behalten es (Standard: ja).
alter table public.companies add column if not exists zeitausgleich boolean not null default true;
