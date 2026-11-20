-- =============================================================
-- 0236 · Datenschutzerklärung 2.40
--
-- Der Gerätespeicher (sp_geraet:…) hält die eigenen Schichten jetzt bis zu
-- fünf Jahre im Voraus, damit der Kalender ohne Netz funktioniert.
-- Krankheitstage liegen dort nur noch als „abwesend“. Die Erklärung
-- beschreibt das; hier zieht die Fassung in der Datenbank nach.
-- =============================================================

update public.legal_versions set version = '2.40', valid_from = current_date where doc = 'datenschutz';
