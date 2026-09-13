-- Feste search_path für die beiden Feiertagsfunktionen.
--
-- Ohne festen Pfad entscheidet die Sitzung, welches Schema zuerst
-- durchsucht wird. Bei einer SECURITY-DEFINER-Funktion kann damit eine
-- untergeschobene Funktion gleichen Namens mit erhöhten Rechten laufen.
-- Die beiden hier rechnen nur mit Datumswerten, trotzdem gehört der
-- Pfad festgenagelt – die übrigen Funktionen im Schema haben ihn.
--
-- Bereits live angewendet am 13.09.2026.
alter function public.easter_sunday(integer) set search_path = public, pg_temp;
alter function public.german_holidays(integer, text) set search_path = public, pg_temp;
