-- Datenschutzerklärung Fassung 2.15: Privatkonten (ohne Firma) bleiben bis zu
-- 30 Tage ohne Benutzung angemeldet (bisher 12 Stunden); die Cookies zur
-- Inaktivität gelten bis zu 31 Tage. Erst nach dem Ausrollen der neuen
-- Fassung anwenden.
update public.legal_versions set version = '2.15', valid_from = current_date where doc = 'datenschutz';
