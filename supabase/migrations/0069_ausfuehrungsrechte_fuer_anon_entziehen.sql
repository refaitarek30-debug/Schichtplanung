-- Ausführungsrechte für nicht angemeldete Besucher (`anon`) entziehen.
--
-- Zwei Ursachen, beide hier behoben:
--
-- 1) Supabase vergibt über `alter default privileges` an JEDE neu angelegte
--    Funktion im Schema `public` automatisch Rechte an `anon`. Ein
--    `revoke ... from public` in der anlegenden Migration greift dagegen
--    nicht, weil `anon` das Recht direkt hält und nicht über PUBLIC. Genau
--    das ist `my_shift_leave` aus Migration 0068 passiert -- die Funktion
--    ist SECURITY DEFINER und stand damit dem offenen Netz zur Verfügung.
--
--    Nachgemessen: ein Aufruf als `anon` bricht mit "Du hast keine
--    Berechtigung für diesen Bereich." ab, weil `auth_employee_id()` ohne
--    Anmeldung null ist. Es sind also keine Daten abgeflossen. Das Recht
--    gehört trotzdem weg: die Funktion soll gar nicht erst erreichbar sein,
--    statt sich auf ihre erste Zeile zu verlassen.
--
-- 2) Fünf Helferfunktionen waren in einer früheren Migration bereits für
--    `anon` gesperrt worden. Diese Migration ist nie in `main` gelandet --
--    sie steckte auf einem Branch, der nicht zusammengeführt wurde. Der
--    Entzug war in der Datenbank wirksam, ging aber durch spätere
--    Neuanlagen der Funktionen wieder verloren. Ohne diese Datei hier
--    hätte ein Neuaufbau aus den Migrationen die Rechte erneut geöffnet.
--
--    Diese fünf sind NICHT SECURITY DEFINER: sie laufen mit den Rechten
--    des Aufrufers, Row Level Security greift also ohnehin und `anon`
--    bekommt nichts zu sehen. Der Entzug ist zusätzliche Absicherung,
--    nicht die einzige.
--
-- `register_company` behält sein Recht bewusst: ohne sie kann sich kein
-- neues Unternehmen registrieren, und dabei ist noch niemand angemeldet.

-- Ein Entzug allein bei `anon` genügt nicht: eine Funktion ist in
-- PostgreSQL nach dem Anlegen zusätzlich über PUBLIC für jeden ausführbar,
-- und `anon` erbt von PUBLIC. Nachgemessen -- nach dem reinen
-- `revoke ... from anon` stand `has_function_privilege('anon', ...)` bei
-- sechs der Funktionen weiterhin auf wahr. Deshalb beides, und danach die
-- Erlaubnis für angemeldete Personen ausdrücklich wieder setzen, damit die
-- Anwendung weiterläuft.

revoke execute on function public.my_shift_leave(date, date) from anon, public;
grant execute on function public.my_shift_leave(date, date) to authenticated;

revoke execute on function public.effective_shift_id(uuid, date) from anon, public;
grant execute on function public.effective_shift_id(uuid, date) to authenticated;

revoke execute on function public.rotation_shift_for(uuid, date) from anon, public;
grant execute on function public.rotation_shift_for(uuid, date) to authenticated;

revoke execute on function public.rotation_cycle_length(uuid) from anon, public;
grant execute on function public.rotation_cycle_length(uuid) to authenticated;

revoke execute on function public.leave_block_for_range(uuid, uuid, date, date) from anon, public;
grant execute on function public.leave_block_for_range(uuid, uuid, date, date) to authenticated;

revoke execute on function public.calculate_leave_days(uuid, date, date, half_day_period) from anon, public;
grant execute on function public.calculate_leave_days(uuid, date, date, half_day_period) to authenticated;

revoke execute on function public.shift_runs_on(shifts, date) from anon, public;
grant execute on function public.shift_runs_on(shifts, date) to authenticated;
