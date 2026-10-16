-- Datenschutzerklärung Fassung 2.8: Teilen mit mehreren Personen und
-- Gruppen im persönlichen Kalender (Abschnitt 8, Ergänzungen in 3, 8a, 10).
update public.legal_versions
   set version = '2.8', valid_from = current_date
 where doc = 'datenschutz';
