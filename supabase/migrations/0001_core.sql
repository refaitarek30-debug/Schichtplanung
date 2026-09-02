-- =============================================================
-- Phase 2 · Kernschema: Mandanten, Profile, Personal, Schichten
-- Ausführen im Supabase SQL Editor (Reihenfolge: 0001 → 0004).
-- =============================================================

create extension if not exists "pgcrypto";

do $$ begin
  create type app_role as enum ('employee', 'shift_leader', 'admin');
exception when duplicate_object then null; end $$;

-- updated_at automatisch pflegen ------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Unternehmen (Mandant) ---------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at
  before update on companies for each row execute function set_updated_at();

-- Schichten ----------------------------------------------------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  short_name text not null,
  start_time time not null,
  end_time time not null,
  color text default '#2F5BEA',
  -- minimum_staff: darunter darf nicht gefahren werden (rot)
  minimum_staff smallint not null default 0 check (minimum_staff >= 0),
  -- target_staff: reguläre Soll-Besetzung (gelb, sobald unterschritten)
  target_staff smallint not null default 0 check (target_staff >= 0),
  -- 0 = Sonntag … 6 = Samstag
  weekdays smallint[] not null default '{1,2,3,4,5}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint minimum_not_above_target check (minimum_staff <= target_staff)
);

create trigger shifts_updated_at
  before update on shifts for each row execute function set_updated_at();

-- Personalstammdaten ------------------------------------------
-- Bewusst getrennt von `profiles`: ein Mitarbeiter existiert auch dann,
-- wenn er (noch) keinen Login hat.
create table employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  personnel_number text,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  role app_role not null default 'employee',
  department text,
  shift_id uuid references shifts (id) on delete set null,
  vacation_days numeric(4, 1) not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, personnel_number)
);

create trigger employees_updated_at
  before update on employees for each row execute function set_updated_at();

-- Profile: 1:1 zum Auth-Benutzer ------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  employee_id uuid unique references employees (id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  role app_role not null default 'employee',
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles for each row execute function set_updated_at();

-- Konkrete Schichtzuordnung je Tag ----------------------------
-- Noch ohne Rotationslogik; die kommt in Phase 4 obendrauf.
create table shift_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  shift_id uuid not null references shifts (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (employee_id, date)
);

-- Protokoll für spätere Nachvollziehbarkeit -------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  action text not null,          -- 'employee.created', 'leave.approved', …
  entity text not null,          -- Tabellenname
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index on employees (company_id, active);
create index on employees (company_id, shift_id);
create index on profiles (company_id);
create index on shift_assignments (company_id, date);
create index on audit_logs (company_id, created_at desc);

-- Einladung → Profil ------------------------------------------
-- Der Admin lädt über die Auth-Admin-API ein und gibt company_id,
-- employee_id und Rolle als Metadaten mit. Daraus entsteht das Profil.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if meta ? 'company_id' then
    insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
    values (
      new.id,
      (meta ->> 'company_id')::uuid,
      nullif(meta ->> 'employee_id', '')::uuid,
      coalesce(meta ->> 'first_name', ''),
      coalesce(meta ->> 'last_name', ''),
      new.email,
      coalesce((meta ->> 'role')::app_role, 'employee')
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();
