-- =============================================================
-- 0228 · Datenschutzerklärung 2.38: Fotos im Countdown
--
-- Neu beschrieben: sp_countdown kann je Countdown ein Foto enthalten.
-- Es wird im Browser verkleinert und bleibt im lokalen Speicher; nichts
-- davon kommt in die Datenbank oder auf einen Server.
-- =============================================================

update public.legal_versions set version = '2.38', valid_from = current_date where doc = 'datenschutz';
