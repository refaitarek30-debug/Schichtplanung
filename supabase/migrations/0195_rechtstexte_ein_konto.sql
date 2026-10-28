-- Datenschutzerklärung 2.24 (28.10.2026): ein Konto für Betrieb und Privatbereich,
-- Austritt (privat weitermachen) und Beitritt mit bestehendem Konto.
-- Erst nach dem Livegang einspielen.
update public.legal_versions set version = '2.24', valid_from = current_date where doc = 'datenschutz';
