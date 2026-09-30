-- Datenschutzerklärung Fassung 2.
--
-- Erst anwenden, NACHDEM die Anwendung mit der neuen Erklärung (Fassung 2)
-- ausgeliefert ist: ab jetzt wird jede angemeldete Person beim nächsten
-- Besuch um die Kenntnisnahme der neuen Fassung gebeten
-- (privacy_settings.privacy_notice_version ≠ legal_versions.version).
update public.legal_versions
   set version = '2.0', valid_from = current_date
 where doc = 'datenschutz';
