-- Datenschutzerklärung Fassung 2.13: Das Kalender-Abo enthält auch die eigenen
-- Einträge aus „Mein Kalender“ (Name und Uhrzeit), nur im eigenen Abo-Link der
-- Person. Erst nach dem Ausrollen der neuen Fassung anwenden.
update public.legal_versions set version = '2.13', valid_from = current_date where doc = 'datenschutz';
