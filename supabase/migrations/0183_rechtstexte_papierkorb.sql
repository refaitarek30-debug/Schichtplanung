-- Datenschutz 2.19 und AVV 1.3: Papierkorb von 14 Tagen vor dem endgültigen Löschen,
-- Sicherungen nach 14 Tagen. Erst nach dem Ausrollen der neuen Fassungen anwenden.
update public.legal_versions set version = '2.19', valid_from = current_date where doc = 'datenschutz';
update public.legal_versions set version = '1.3', valid_from = current_date where doc = 'avv';
