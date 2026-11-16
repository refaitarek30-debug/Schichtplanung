-- =============================================================
-- 0226 · Datenschutzerklärung 2.36: Lohn-Rechner im Privatbereich
--
-- Neu beschrieben: der lokale Speicher sp_lohn:… (Steuerklasse, Kinder,
-- Kirchensteuer, Zusatzbeitrag, feste Zulagen, Extras des zuletzt
-- bearbeiteten Monats, gespeicherte Monatsergebnisse). Alles bleibt im
-- Browser, nichts davon kommt in die Datenbank.
-- =============================================================

update public.legal_versions set version = '2.36', valid_from = current_date where doc = 'datenschutz';
