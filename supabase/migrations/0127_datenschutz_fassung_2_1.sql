-- Datenschutzerklärung Fassung 2.1: Abschnitt zur Live-Demo ergänzt.
-- (Seit PR #70 löst eine neue Fassung bei bestehenden Personen keine Abfrage
-- mehr aus; neu angelegte Personen bestätigen die jeweils aktuelle Fassung.)
update public.legal_versions
   set version = '2.1', valid_from = current_date
 where doc = 'datenschutz';
