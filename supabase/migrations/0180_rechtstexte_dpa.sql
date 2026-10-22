-- Datenschutz 2.18 und AVV 1.2: Supabase-DPA/TIA bestätigt, Unterauftragnehmer von Supabase genannt.
-- Erst nach dem Ausrollen der neuen Fassungen anwenden.
update public.legal_versions set version = '2.18', valid_from = current_date where doc = 'datenschutz';
update public.legal_versions set version = '1.2', valid_from = current_date where doc = 'avv';
