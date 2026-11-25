-- Nachbildung der Teile von Supabase, auf die unsere Migrationen bauen – nur für den
-- Sicherheitstest auf einem frischen PostgreSQL. Verhält sich wie Supabase, soweit es
-- für Rechte zählt: Rollen anon/authenticated/service_role, auth.uid() aus den
-- JWT-Angaben der Anfrage, auth.jwt() mit aal (Zwei-Faktor-Stufe).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

-- Wie bei Supabase: die API-Rollen dürfen das Schema public benutzen und bekommen
-- standardmäßig Rechte auf neue Objekte (die Migrationen entziehen sie gezielt).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
do $$ begin execute format('alter database %I set search_path = "$user", public, extensions', current_database()); end $$;
set search_path = "$user", public, extensions;

-- ---- auth ----------------------------------------------------------------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  is_anonymous boolean default false,
  phone text
);
create table if not exists auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friendly_name text,
  factor_type text default 'totp',
  status text default 'verified',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  refreshed_at timestamp,
  not_after timestamptz,
  aal text default 'aal1'
);
create table if not exists auth.refresh_tokens (
  id bigserial primary key,
  token text,
  user_id varchar(255),
  session_id uuid,
  revoked boolean default false,
  created_at timestamptz default now()
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', current_user)
$$;
create or replace function auth.email() returns text language sql stable as $$
  select auth.jwt() ->> 'email'
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- ---- storage -------------------------------------------------------------
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
create or replace function storage.filename(name text) returns text language sql immutable as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)]
$$;
grant execute on all functions in schema storage to anon, authenticated, service_role;

-- ---- cron / net / vault --------------------------------------------------
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create table if not exists cron.job_run_details (runid bigserial primary key, jobid bigint, status text, end_time timestamptz);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $$
declare i bigint;
begin
  delete from cron.job where jobname = job_name;
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid into i;
  return i;
end $$;
create or replace function cron.unschedule(job_name text) returns boolean language plpgsql as $$
begin
  delete from cron.job where jobname = job_name;
  return found;
end $$;

create schema if not exists net;
create table if not exists net.aufrufe (id bigserial primary key, url text, body jsonb, am timestamptz default now());
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$
declare i bigint;
begin
  insert into net.aufrufe (url, body) values (url, body) returning id into i;
  return i;
end $$;

create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text);
create or replace view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
returns uuid language sql as $$ insert into vault.secrets (name, secret) values (new_name, new_secret) returning id $$;

-- Einzelne frühe Migrationen richten das erste Admin-Konto der Musterfirma ein und
-- erwarten dafür den Anmelde-Benutzer.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-00000000ad01', 'admin@muster-produktion.de', now())
on conflict do nothing;
