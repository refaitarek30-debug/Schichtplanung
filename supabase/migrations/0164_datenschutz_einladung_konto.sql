-- Datenschutzerklärung Fassung 2.12: Einladen nur noch mit eigenem Konto
-- (Einladungslink 7 Tage, Anlegen von Spitzname und Passwort), Farben der
-- Schichten bei Verbundenen. Erst nach dem Ausrollen der neuen Fassung anwenden.
update public.legal_versions set version = '2.12', valid_from = current_date where doc = 'datenschutz';
