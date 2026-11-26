-- =============================================================
-- 0244 · Datenschutzerklärung 2.45, AVV 1.6
--
-- Anmeldung, Registrierung, Demo-Start und Passwortänderung laden die
-- Sicherheitsprüfung Cloudflare Turnstile. Beide Texte nennen Cloudflare
-- jetzt als Dienstleister; hier ziehen die Fassungen in der Datenbank nach.
-- =============================================================

update public.legal_versions set version = '2.45', valid_from = current_date where doc = 'datenschutz';
update public.legal_versions set version = '1.6', valid_from = current_date where doc = 'avv';
