-- Datenschutz 2.20: neue lokale Speicherung (sp_gehalt, sp_urlaub) für Gehalts-Schätzung und
-- Urlaubs-Planer im Privatbereich. Erst nach dem Ausrollen der neuen Fassung anwenden.
update public.legal_versions set version = '2.20', valid_from = current_date where doc = 'datenschutz';
