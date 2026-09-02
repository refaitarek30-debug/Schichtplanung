-- =============================================================
-- Nachtrag zu 0011: PUBLIC-Rechte auf interne Helferfunktionen entziehen
--
-- `anon` erbt EXECUTE über PUBLIC, wenn es nicht explizit entzogen wird.
-- 0011 hatte das für die RPC-Funktionen bereits korrigiert, hier folgen
-- die internen Helfer (auth_company_id, is_leadership, …) sowie die
-- Trigger-Funktionen, die ohnehin niemand von außen aufrufen soll.
-- =============================================================

revoke execute on function auth_company_id() from public;
revoke execute on function auth_role() from public;
revoke execute on function auth_employee_id() from public;
revoke execute on function is_admin() from public;
revoke execute on function is_leadership() from public;

grant execute on function auth_company_id() to authenticated;
grant execute on function auth_role() to authenticated;
grant execute on function auth_employee_id() to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function is_leadership() to authenticated;

revoke execute on function handle_new_user() from public;
revoke execute on function leave_requests_notify_leadership() from public;
revoke execute on function leave_requests_set_computed_days() from public;
revoke execute on function leave_requests_check_block() from public;
revoke execute on function employees_ensure_leave_balance() from public;
revoke execute on function set_updated_at() from public;
