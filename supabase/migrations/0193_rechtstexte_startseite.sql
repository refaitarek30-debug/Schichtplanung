-- Datenschutzerklärung 2.23 (28.10.2026): Personalnummer/Abteilung selbst eintragbar,
-- Geburtsdatum selbst änderbar mit Bestätigung, Startseite „kompakt“, Neuigkeiten.
-- Erst nach dem Livegang einspielen.
update public.legal_versions set version = '2.23', valid_from = current_date where doc = 'datenschutz';
