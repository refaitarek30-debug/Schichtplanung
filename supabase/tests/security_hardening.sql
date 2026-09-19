-- Security regression checks for Schichtplanung.
-- Execute against a disposable Supabase branch or a CI database.
-- The assertions do not mutate data permanently.

begin;

create temp table _security_assertions (
  name text primary key,
  ok boolean not null,
  detail text
) on commit drop;

insert into _security_assertions values
('anon_cleanup_rpc_revoked',
  not has_function_privilege('anon','public.discard_unclaimed_company(uuid)','execute'),
  'discard_unclaimed_company must be service-role only'),
('authenticated_cleanup_rpc_revoked',
  not has_function_privilege('authenticated','public.discard_unclaimed_company(uuid)','execute'),
  'discard_unclaimed_company must be service-role only'),
('platform_overview_not_client_callable',
  not has_function_privilege('authenticated','public.platform_overview()','execute'),
  'tenant admins must not call platform overview directly'),
('notifications_direct_insert_revoked',
  not has_table_privilege('authenticated','public.notifications','insert'),
  'notifications are written by trusted server-side paths'),
('audit_direct_insert_revoked',
  not has_table_privilege('authenticated','public.audit_logs','insert'),
  'audit logs cannot be forged by tenant users'),
('privacy_defaults_exist',
  exists (
    select 1 from public.privacy_settings
    where absence_visibility='minimal'
      and sickness_visibility='private'
  ),
  'all new/backfilled rows use privacy-by-default unless explicitly changed'),
('sickness_notes_empty',
  not exists (
    select 1 from public.absences
    where type='krank' and nullif(trim(note),'') is not null
  ),
  'medical free text must not exist on sickness absences');

-- Every client-visible profile query is bounded by owner/leadership policy.
insert into _security_assertions
select
  'profiles_has_restrictive_select_policies',
  exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='profiles'
      and policyname='profiles own select'
  )
  and exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='profiles'
      and policyname='profiles leadership select'
  ),
  'profiles must not use the old broad same-tenant select policy';

-- The database-level identity guard must exist and be a trigger.
insert into _security_assertions values
('profiles_identity_guard_trigger',
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='profiles'
      and t.tgname='trg_profiles_guard_self_identity'
      and not t.tgisinternal
  ),
  'profile identity fields are protected by a DB trigger');

-- Employee-scoped helper RPCs must remain tenant scoped.
insert into _security_assertions values
('employee_scoped_helpers_have_tenant_check',
  (
    select count(*) = 4
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('is_employed_on','is_planned_workday','is_premium_day','calculate_leave_days_for_employee')
      and position('auth_company_id()' in pg_get_functiondef(p.oid)) > 0
  ),
  'employee helper RPCs must reject foreign employee ids');

select name, ok, detail
from _security_assertions
order by name;

do $$
declare failures integer;
begin
  select count(*) into failures from _security_assertions where not ok;
  if failures > 0 then
    raise exception 'Security regression test failed: % assertion(s)', failures;
  end if;
end $$;

rollback;
