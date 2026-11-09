-- Datenschutzerklärung 2.27 (09.11.2026): Lohnabrechnungen im Privatbereich (Migration 0204).
update public.legal_versions set version = '2.27', valid_from = current_date where doc = 'datenschutz';
