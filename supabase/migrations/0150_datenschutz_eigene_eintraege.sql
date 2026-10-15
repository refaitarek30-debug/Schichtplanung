-- Datenschutzerklärung Fassung 2.7: eigene Farben und eigene Einträge im
-- persönlichen Kalender (Abschnitt 8, Ergänzungen in 3 und 10).
update public.legal_versions
   set version = '2.7', valid_from = current_date
 where doc = 'datenschutz';
