-- Datenschutzerklärung Fassung 2.2: Protokoll (Anmeldungen, Änderungen,
-- angezeigte Fehlermeldungen) beschrieben – siehe 0131_protokoll.sql.
-- Löst bei bestehenden Personen keine erneute Abfrage aus.
update public.legal_versions
   set version = '2.2', valid_from = current_date
 where doc = 'datenschutz';
