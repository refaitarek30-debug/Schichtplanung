-- Datenschutzerklärung 2.26 (09.11.2026): Privatbereich – andere Uhrzeit an einzelnen
-- Tagen (Migration 0202, in der Datenbank) und Gehalts-Rechnung je Job (nur im Browser).
update public.legal_versions set version = '2.26', valid_from = current_date where doc = 'datenschutz';
