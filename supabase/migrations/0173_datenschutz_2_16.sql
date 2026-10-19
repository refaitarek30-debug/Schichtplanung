-- Datenschutzerklärung Fassung 2.16: Passwort zurücksetzen mit einem Code
-- (Migration 0172) statt per E-Mail – gespeichert wird nur ein Prüfwert.
-- Erst nach dem Ausrollen der neuen Fassung anwenden.
update public.legal_versions set version = '2.16', valid_from = current_date where doc = 'datenschutz';
