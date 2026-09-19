-- 0064 – Security, Privacy-by-Design und Tenant-Hardening
--
-- Ergänzt ausschließlich neue Sicherheits-/Privacy-Schichten. Bestehende
-- Migrationen bleiben unverändert.

begin;

do $$ begin
  create type public.absence_visibility_level as enum ('minimal', 'shift');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sickness_visibility_level as enum ('private', 'shift');
exception when duplicate_object then null; end $$;

create table if not exists public.privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  absence_visibility public.absence_visibility_level not null default 'minimal',
  sickness_visibility public.sickness_visibility_level not null default 'private',
  privacy_notice_version text not null default '1.0',
  accepted_at timestamptz,
  updated_at timestamptz not null default now(),
  absence_revoked_at timestamptz,
  sickness_revoked_at timestamptz
);

comment on table public.privacy_settings is
  'Persönliche freiwillige Sichtbarkeitseinstellungen für Abwesenheitsdetails; keine pauschale DSGVO-Einwilligung.';
comment on column public.privacy_settings.accepted_at is
  'Kenntnisnahme des angezeigten Datenschutzhinweises; kein pauschaler Einwilligungsnachweis.';
comment on column public.privacy_settings.absence_revoked_at is
  'Zeitpunkt der letzten Rücknahme der freiwilligen Abwesenheitsfreigabe.';
comment on column public.privacy_settings.sickness_revoked_at is
  'Zeitpunkt der letzten Rücknahme der freiwilligen Krankheitsfreigabe.';

alter table public.privacy_settings enable row level security;
alter table public.privacy_settings force row level security;

drop policy if exists "privacy own select" on public.privacy_settings;
create policy "privacy own select" on public.privacy_settings
for select to authenticated
using (user_id = auth.uid() and company_id = auth_company_id());

drop policy if exists "privacy own insert" on public.privacy_settings;
create policy "privacy own insert" on public.privacy_settings
for insert to authenticated
with check (user_id = auth.uid() and company_id = auth_company_id());

drop policy if exists "privacy own update" on public.privacy_settings;
create policy "privacy own update" on public.privacy_settings
for update to authenticated
using (user_id = auth.uid() and company_id = auth_company_id())
with check (user_id = auth.uid() and company_id = auth_company_id());

revoke all on public.privacy_settings from anon;
grant select, insert, update on public.privacy_settings to authenticated;

create or replace function public.privacy_settings_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_company uuid := auth_company_id();
begin
  if current_user_id is null then
    return new;
  end if;

  if current_company is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  if new.user_id is distinct from current_user_id then
    raise exception 'Du darfst nur deine eigenen Datenschutzeinstellungen ändern.';
  end if;

  if new.company_id is distinct from current_company then
    raise exception 'Ungültige Unternehmenszuordnung.';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if old.absence_visibility = 'shift' and new.absence_visibility = 'minimal' then
      new.absence_revoked_at := now();
    end if;
    if old.sickness_visibility = 'shift' and new.sickness_visibility = 'private' then
      new.sickness_revoked_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_privacy_settings_guard on public.privacy_settings;
create trigger trg_privacy_settings_guard
before insert or update on public.privacy_settings
for each row execute function public.privacy_settings_guard();

revoke execute on function public.privacy_settings_guard() from public, anon, authenticated;
grant execute on function public.privacy_settings_guard() to postgres, service_role;

create or replace function public.ensure_privacy_settings()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.privacy_settings (user_id, company_id)
  values (new.id, new.company_id)
  on conflict (user_id) do update set company_id = excluded.company_id;
  return new;
end;
$$;

drop trigger if exists trg_profiles_create_privacy_settings on public.profiles;
create trigger trg_profiles_create_privacy_settings
after insert on public.profiles
for each row execute function public.ensure_privacy_settings();

revoke execute on function public.ensure_privacy_settings() from public, anon, authenticated;
grant execute on function public.ensure_privacy_settings() to postgres, service_role;

insert into public.privacy_settings (user_id, company_id)
select p.id, p.company_id from public.profiles p
on conflict (user_id) do nothing;

drop policy if exists "Profile im Unternehmen lesen" on public.profiles;
drop policy if exists "Profil im Unternehmen lesen" on public.profiles;
drop policy if exists "profiles_same_company_select" on public.profiles;

create policy "profiles own select" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "profiles leadership select" on public.profiles
for select to authenticated
using (company_id = auth_company_id() and is_leadership());

create or replace function public.profiles_guard_self_identity()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.id = auth.uid() and not is_admin() then
    if new.employee_id is distinct from old.employee_id then
      raise exception 'Die Mitarbeiterzuordnung darf nicht selbst geändert werden.';
    end if;
    if new.company_id is distinct from old.company_id then
      raise exception 'Die Unternehmenszuordnung darf nicht selbst geändert werden.';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Die Rolle darf nicht selbst geändert werden.';
    end if;
    if new.active is distinct from old.active then
      raise exception 'Der Aktivstatus darf nicht selbst geändert werden.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Die E-Mail-Adresse darf nicht selbst geändert werden.';
    end if;
  end if;

  if new.avatar_url is not null and new.avatar_url !~* '^https?://' then
    raise exception 'Profilbild-URLs müssen mit http:// oder https:// beginnen.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_self_identity on public.profiles;
create trigger trg_profiles_guard_self_identity
before update on public.profiles
for each row execute function public.profiles_guard_self_identity();

revoke execute on function public.profiles_guard_self_identity() from public, anon, authenticated;
grant execute on function public.profiles_guard_self_identity() to postgres, service_role;

update public.absences set note = null
where type = 'krank' and nullif(trim(note), '') is not null;

create or replace function public.absences_guard_medical_text()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.type = 'krank' and nullif(trim(new.note), '') is not null then
    raise exception 'Bei Krankheit werden keine medizinischen Angaben oder Freitexte erfasst.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_absences_guard_medical_text on public.absences;
create trigger trg_absences_guard_medical_text
before insert or update on public.absences
for each row execute function public.absences_guard_medical_text();

revoke execute on function public.absences_guard_medical_text() from public, anon, authenticated;
grant execute on function public.absences_guard_medical_text() to postgres, service_role;

drop policy if exists "Audit-Log anlegen" on public.audit_logs;
drop policy if exists "audit_logs_insert" on public.audit_logs;
revoke insert on public.audit_logs from authenticated, anon;

create or replace function public.write_audit(
  p_company_id uuid, p_action text, p_entity text,
  p_entity_id uuid default null, p_payload jsonb default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_company_id is distinct from auth_company_id()
     and auth.role() <> 'service_role' then
    raise exception 'Ungültiger Mandant für Audit-Log.';
  end if;

  insert into public.audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (p_company_id, auth.uid(), p_action, p_entity, p_entity_id, p_payload);
end;
$$;

revoke execute on function public.write_audit(uuid,text,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.write_audit(uuid,text,text,uuid,jsonb) to postgres, service_role;

create or replace function public.absences_audit()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.company_id, 'absence.created', 'absences', new.id, null);
  elsif tg_op = 'UPDATE' then
    perform public.write_audit(new.company_id, 'absence.updated', 'absences', new.id, null);
  elsif tg_op = 'DELETE' then
    perform public.write_audit(old.company_id, 'absence.deleted', 'absences', old.id, null);
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.absences_audit() from public, anon, authenticated;
grant execute on function public.absences_audit() to postgres, service_role;

create or replace function public.employees_audit_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    perform public.write_audit(new.company_id, 'role.changed', 'employees', new.id, null);
  end if;
  if tg_op = 'UPDATE' and new.active is distinct from old.active then
    perform public.write_audit(
      new.company_id,
      case when new.active then 'employee.reactivated' else 'employee.deactivated' end,
      'employees', new.id, null
    );
  end if;
  if tg_op = 'UPDATE' and new.* is distinct from old.* then
    perform public.write_audit(new.company_id, 'employee.updated', 'employees', new.id, null);
  end if;
  if tg_op = 'INSERT' then
    perform public.write_audit(new.company_id, 'employee.created', 'employees', new.id, null);
  end if;
  return new;
end;
$$;

revoke execute on function public.employees_audit_role() from public, anon, authenticated;
grant execute on function public.employees_audit_role() to postgres, service_role;

create or replace function public.privacy_settings_audit()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    perform public.write_audit(new.company_id, 'privacy.settings.changed', 'privacy_settings', new.user_id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_privacy_settings_audit on public.privacy_settings;
create trigger trg_privacy_settings_audit
after update on public.privacy_settings
for each row execute function public.privacy_settings_audit();

revoke execute on function public.privacy_settings_audit() from public, anon, authenticated;
grant execute on function public.privacy_settings_audit() to postgres, service_role;

revoke execute on function public.employees_absent_on(date,boolean,uuid) from public, anon;
grant execute on function public.employees_absent_on(date,boolean,uuid) to authenticated, service_role;

create or replace function public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
returns table (
  employee_id uuid, employee_name text, rotation_team text,
  personnel_number text, day date, shift_name text, shift_code text,
  absence_code text, is_me boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
  feiertage_arbeiten boolean;
  bis date := p_from + (p_days - 1);
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team
  from public.employees e
  where e.id = me and e.company_id = p_company_id;

  select coalesce(cs.work_on_holidays, true)
    into feiertage_arbeiten
  from public.company_settings cs
  where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  select
    e.id,
    e.first_name || ' ' || e.last_name,
    case when e.shift_worker then e.rotation_team::text else null end,
    case when fuehrung then e.personnel_number else null end,
    gs.day::date,
    s.name,
    case
      when s.name ilike 'Früh%' then 'F'
      when s.name ilike 'Spät%' then 'S'
      when s.name ilike 'Nacht%' then 'N'
      when s.name is not null then upper(left(s.name, 1))
      else null
    end,
    case
      when e.id = me then
        case
          when exists (select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date and a.type='krank') then 'K'
          when exists (select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date and a.type='schulung') then 'FB'
          when exists (select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date) then 'A'
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='approved' and r.kind='v_tag' and gs.day::date between r.start_date and r.end_date) then 'V'
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='pending' and r.kind='v_tag' and gs.day::date between r.start_date and r.end_date) then 'v'
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='approved' and r.kind='urlaub' and gs.day::date between r.start_date and r.end_date) then 'U'
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='pending' and r.kind='urlaub' and gs.day::date between r.start_date and r.end_date) then 'u'
          else null
        end
      when fuehrung then
        case
          when exists (select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date and a.type='krank') then 'K'
          when exists (select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date and a.type='schulung') then 'FB'
          when exists (select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date) then 'A'
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='approved' and r.kind='v_tag' and gs.day::date between r.start_date and r.end_date) then 'V'
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='pending' and r.kind='v_tag' and gs.day::date between r.start_date and r.end_date) then 'v'
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='pending' and r.kind='urlaub' and gs.day::date between r.start_date and r.end_date) then 'u'
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='approved' and r.kind='urlaub' and gs.day::date between r.start_date and r.end_date) then 'U'
          else null
        end
      else
        case
          when exists (select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date and a.type='krank') then
            case when exists (
              select 1 from public.profiles sp
              join public.privacy_settings ps on ps.user_id=sp.id
              where sp.employee_id=e.id and sp.company_id=p_company_id
                and ps.company_id=p_company_id and ps.sickness_visibility='shift'
                and mein_team is not null and e.rotation_team=mein_team
            ) then 'K' else 'A' end
          when exists (select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date) then
            case when exists (
              select 1 from public.profiles sp
              join public.privacy_settings ps on ps.user_id=sp.id
              where sp.employee_id=e.id and sp.company_id=p_company_id
                and ps.company_id=p_company_id and ps.absence_visibility='shift'
                and mein_team is not null and e.rotation_team=mein_team
            ) then
              case when exists (
                select 1 from public.absences a where a.employee_id=e.id and a.date=gs.day::date and a.type='schulung'
              ) then 'FB' else 'A' end
            else 'A' end
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='approved' and r.kind='v_tag' and gs.day::date between r.start_date and r.end_date) then
            case when exists (
              select 1 from public.profiles sp join public.privacy_settings ps on ps.user_id=sp.id
              where sp.employee_id=e.id and sp.company_id=p_company_id and ps.company_id=p_company_id
                and ps.absence_visibility='shift' and mein_team is not null and e.rotation_team=mein_team
            ) then 'V' else 'A' end
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='pending' and r.kind='v_tag' and gs.day::date between r.start_date and r.end_date) then
            case when exists (
              select 1 from public.profiles sp join public.privacy_settings ps on ps.user_id=sp.id
              where sp.employee_id=e.id and sp.company_id=p_company_id and ps.company_id=p_company_id
                and ps.absence_visibility='shift' and mein_team is not null and e.rotation_team=mein_team
            ) then 'v' else 'A' end
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='approved' and r.kind='urlaub' and gs.day::date between r.start_date and r.end_date) then
            case when exists (
              select 1 from public.profiles sp join public.privacy_settings ps on ps.user_id=sp.id
              where sp.employee_id=e.id and sp.company_id=p_company_id and ps.company_id=p_company_id
                and ps.absence_visibility='shift' and mein_team is not null and e.rotation_team=mein_team
            ) then 'U' else 'A' end
          when exists (select 1 from public.leave_requests r where r.employee_id=e.id and r.status='pending' and r.kind='urlaub' and gs.day::date between r.start_date and r.end_date) then
            case when exists (
              select 1 from public.profiles sp join public.privacy_settings ps on ps.user_id=sp.id
              where sp.employee_id=e.id and sp.company_id=p_company_id and ps.company_id=p_company_id
                and ps.absence_visibility='shift' and mein_team is not null and e.rotation_team=mein_team
            ) then 'u' else 'A' end
          else null
        end
    end,
    e.id = me
  from public.employees e
  cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  left join public.shifts s
    on s.id = effective_shift_id(e.id, gs.day::date)
   and shift_runs_on(s, gs.day::date, feiertage_arbeiten)
  where e.company_id = p_company_id
    and e.active
    and (e.entry_date is null or e.entry_date <= bis)
    and (e.exit_date is null or e.exit_date >= p_from)
    and (fuehrung or e.id=me or (mein_team is not null and e.rotation_team=mein_team))
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, e.id, gs.day;
end;
$$;

revoke execute on function public.shift_plan_grid(uuid,date,integer) from public, anon;
grant execute on function public.shift_plan_grid(uuid,date,integer) to authenticated, service_role;

commit;