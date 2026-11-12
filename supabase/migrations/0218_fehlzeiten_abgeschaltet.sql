-- Fehlzeiten („früher gegangen“ / „später gekommen“) abgeschaltet.
--
-- Die Leiste ist aus der Anwendung entfernt. Damit auch niemand mehr direkt
-- über die Datenbank etwas einträgt oder löscht, dürfen angemeldete Nutzer die
-- beiden Schreib-Funktionen nicht mehr aufrufen. Bereits erfasste Einträge
-- bleiben bestehen (Entscheidung des Betreibers) und werden weiter mit dem
-- V-/Altersfreizeit-Konto verrechnet; Lesen bleibt erlaubt.

revoke execute on function public.fehlzeit_speichern(uuid, date, text, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.fehlzeit_loeschen(uuid) from public, anon, authenticated;

-- Datenschutzerklärung 2.32: Fehlzeiten-Erfassung abgeschaltet.
update public.legal_versions set version = '2.32', valid_from = current_date where doc = 'datenschutz';
