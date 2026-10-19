-- Datenschutzerklärung Fassung 2.14: Abschnitt 11 nennt den Cookie sp_start
-- (gewählte Startseite) und den lokalen Speicher sp_geraet:… (zuletzt geladener
-- Stand der eigenen Schichten, damit der Kalender sofort aufgeht). Erst nach
-- dem Ausrollen der neuen Fassung anwenden.
update public.legal_versions set version = '2.14', valid_from = current_date where doc = 'datenschutz';
