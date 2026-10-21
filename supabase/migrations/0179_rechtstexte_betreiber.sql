-- Betreiberangaben eingetragen (Name, Anschrift, Kontakt, Aufsichtsbehörde),
-- verschlüsselte Datensicherung bei GitHub als Unterauftragsverarbeiter,
-- Pilotphase drei Monate kostenlos. Erst nach dem Ausrollen der neuen Fassungen anwenden.
update public.legal_versions set version = '2.17', valid_from = current_date where doc = 'datenschutz';
update public.legal_versions set version = '1.1', valid_from = current_date where doc = 'nutzungsbedingungen';
update public.legal_versions set version = '1.1', valid_from = current_date where doc = 'avv';
