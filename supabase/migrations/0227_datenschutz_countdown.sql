-- =============================================================
-- 0227 · Datenschutzerklärung 2.37: Countdown im Privatbereich
--
-- Neu beschrieben: der lokale Speicher sp_countdown (Kennungen gemerkter
-- Termine, selbst angelegte Countdowns). Bleibt im Browser, nichts davon
-- kommt in die Datenbank.
-- =============================================================

update public.legal_versions set version = '2.37', valid_from = current_date where doc = 'datenschutz';
