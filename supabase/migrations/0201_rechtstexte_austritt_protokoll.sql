-- Datenschutzerklärung 2.25 (09.11.2026): Austritt endet automatisch am Tag nach dem
-- letzten Arbeitstag (Migration 0199), Privatbereich ohne Frage; Änderungsprotokoll für
-- Schichtleitung und Administration (Migration 0200).
update public.legal_versions set version = '2.25', valid_from = current_date where doc = 'datenschutz';
