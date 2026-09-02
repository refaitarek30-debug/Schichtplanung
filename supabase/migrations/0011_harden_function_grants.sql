-- =============================================================
-- Härtung der Ausführungsrechte (Korrektur zu 0007)
--
-- WICHTIG, falls jemand die frühere Fassung schon eingespielt hat:
-- `REVOKE EXECUTE ... FROM PUBLIC` reicht in Supabase NICHT. Supabase
-- vergibt EXECUTE zusätzlich direkt an die Rollen `anon` und
-- `authenticated`. Ein Entzug nur gegen PUBLIC lässt die Funktionen
-- deshalb weiterhin unangemeldet über /rest/v1/rpc/... aufrufbar.
-- Der Supabase-Security-Linter meldet das als
-- "anon_security_definer_function_executable".
--
-- Deshalb hier: gegen anon UND gegen public entziehen, und nur
-- authenticated gezielt wieder berechtigen.
--
-- Zusätzlich wird bei allen Funktionen der search_path festgenagelt,
-- damit ein manipulierter search_path sie nicht auf untergeschobene
-- Tabellen umlenken kann (Linter: "function_search_path_mutable").
-- =============================================================

revoke execute on function staffing_snapshot(uuid, date) from anon, public;
revoke execute on function staffing_for_day(uuid, date) from anon, public;
revoke execute on function staffing_range(uuid, date, int) from anon, public;
revoke execute on function staffing_month_overview(uuid, int, int) from anon, public;
revoke execute on function check_leave_staffing_impact(uuid, date, date) from anon, public;
revoke execute on function shift_leave_overlap(uuid, date, date) from anon, public;
revoke execute on function decide_leave_request(uuid, leave_status, text) from anon, public;
revoke execute on function withdraw_leave_request(uuid) from anon, public;
revoke execute on function my_shift_plan(date, int) from anon, public;
revoke execute on function rotation_preview(uuid, int, date, int) from anon, public;
revoke execute on function shift_assignments_for_range(uuid, date, date) from anon, public;
revoke execute on function assign_shift(uuid, uuid, date) from anon, public;

grant execute on function staffing_snapshot(uuid, date) to authenticated;
grant execute on function staffing_for_day(uuid, date) to authenticated;
grant execute on function staffing_range(uuid, date, int) to authenticated;
grant execute on function staffing_month_overview(uuid, int, int) to authenticated;
grant execute on function check_leave_staffing_impact(uuid, date, date) to authenticated;
grant execute on function shift_leave_overlap(uuid, date, date) to authenticated;
grant execute on function decide_leave_request(uuid, leave_status, text) to authenticated;
grant execute on function withdraw_leave_request(uuid) to authenticated;
grant execute on function my_shift_plan(date, int) to authenticated;
grant execute on function rotation_preview(uuid, int, date, int) to authenticated;
grant execute on function shift_assignments_for_range(uuid, date, date) to authenticated;
grant execute on function assign_shift(uuid, uuid, date) to authenticated;

-- Interne Helfer: `authenticated` braucht EXECUTE, weil die RLS-Policies
-- diese Funktionen mit den Rechten des Aufrufers auswerten. `anon` nicht.
revoke execute on function auth_company_id() from anon, public;
revoke execute on function auth_role() from anon, public;
revoke execute on function auth_employee_id() from anon, public;
revoke execute on function is_admin() from anon, public;
revoke execute on function is_leadership() from anon, public;

grant execute on function auth_company_id() to authenticated;
grant execute on function auth_role() to authenticated;
grant execute on function auth_employee_id() to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function is_leadership() to authenticated;

-- Trigger-Funktionen gehören gar nicht in die REST-API.
revoke execute on function handle_new_user() from anon, authenticated, public;
revoke execute on function leave_requests_notify_leadership() from anon, authenticated, public;
revoke execute on function leave_requests_set_computed_days() from anon, authenticated, public;
revoke execute on function leave_requests_check_block() from anon, authenticated, public;
revoke execute on function employees_ensure_leave_balance() from anon, authenticated, public;
revoke execute on function set_updated_at() from anon, authenticated, public;

alter function set_updated_at() set search_path = public;
alter function is_admin() set search_path = public;
alter function is_leadership() set search_path = public;
alter function calculate_leave_days(uuid, date, date, half_day_period) set search_path = public;
alter function leave_requests_set_computed_days() set search_path = public;
alter function employees_ensure_leave_balance() set search_path = public;
alter function shift_runs_on(shifts, date) set search_path = public;
alter function employees_absent_on(date, boolean, uuid) set search_path = public;
alter function effective_shift_id(uuid, date) set search_path = public;
alter function leave_block_for_range(uuid, uuid, date, date) set search_path = public;
alter function leave_requests_check_block() set search_path = public;
alter function rotation_cycle_length(uuid) set search_path = public;
alter function rotation_shift_for(uuid, date) set search_path = public;
alter function assign_shift(uuid, uuid, date) set search_path = public;

-- Prüfen lässt sich das anschließend so (alle Zeilen müssen anon = false zeigen):
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon_darf,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_darf
--   from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1;
