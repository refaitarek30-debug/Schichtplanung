-- Die Einführung im Kalender nur einmal pro Konto zeigen, nicht pro Gerät.
-- Auf Arbeits-PCs, die Browserdaten löschen, kam sie sonst bei jeder Anmeldung wieder.
alter table public.anzeige_einstellungen
  add column if not exists einfuehrung_gesehen boolean not null default false;
