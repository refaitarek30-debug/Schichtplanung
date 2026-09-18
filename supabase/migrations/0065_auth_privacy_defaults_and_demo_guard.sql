-- Auth/privacy defaults and protected privacy-settings writer.
-- Re-runnable: the live database may already contain these definitions.

alter table public.privacy_settings enable row level security;

alter table public.privacy_settings
  alter column absence_visibility set default 'minimal'::public.absence_visibility_level,
  alter column sickness_visibility set default 'private'::public.sickness_visibility_level,
  alter column privacy_notice_version set default '1.0';

update public.privacy_settings
set absence_visibility = 'minimal'
where absence_visibility is null;

update public.privacy_settings
set sickness_visibility = 'private'
where sickness_visibility is null;

create or replace function public.save_privacy_settings(
  p_absence_visibility public.absence_visibility_level,
  p_sickness_visibility public.sickness_visibility_level,
  p_notice_acknowledged boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := auth_company_id();
  v_user_id uuid := auth.uid();
  v_current privacy_settings;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  select * into v_current
  from public.privacy_settings
  where user_id = v_user_id and company_id = v_company_id
  for update;

  if v_current.user_id is null then
    insert into public.privacy_settings
      (user_id, company_id, absence_visibility, sickness_visibility, privacy_notice_version, accepted_at)
    values
      (v_user_id, v_company_id, p_absence_visibility, p_sickness_visibility, '1.0',
       case when p_notice_acknowledged then now() else null end);
  else
    update public.privacy_settings
       set absence_visibility = p_absence_visibility,
           sickness_visibility = p_sickness_visibility,
           privacy_notice_version = case when p_notice_acknowledged then '1.0' else v_current.privacy_notice_version end,
           accepted_at = case when p_notice_acknowledged then coalesce(v_current.accepted_at, now()) else v_current.accepted_at end,
           updated_at = now()
     where user_id = v_user_id and company_id = v_company_id;
  end if;
end;
$$;

revoke all on function public.save_privacy_settings(public.absence_visibility_level, public.sickness_visibility_level, boolean) from public, anon;
grant execute on function public.save_privacy_settings(public.absence_visibility_level, public.sickness_visibility_level, boolean) to authenticated, service_role;
