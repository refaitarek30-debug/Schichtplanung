-- Datenschutz 2.22: gemerkte Offline-Seite des Privat-Kalenders (Service-Worker-Zwischenspeicher)
-- und gemerkte eigene Termine/To-dos auf dem Gerät. Erst nach dem Ausrollen der neuen Fassung anwenden.
update public.legal_versions set version = '2.22', valid_from = current_date where doc = 'datenschutz';
