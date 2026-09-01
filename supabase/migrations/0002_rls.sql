-- =============================================================
-- Phase 2 · Row Level Security
-- Grundsatz: jede Zeile gehört genau einem Unternehmen, und niemand
-- sieht etwas außerhalb des eigenen. Das Frontend ist keine Grenze.
-- =============================================================

-- Hilfsfunktionen als SECURITY DEFINER: sie lesen selbst aus `profiles`
-- und würden sonst die Policy auf `profiles` rekursiv auslösen.
create or replace function auth_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid() and active;
$$;

create or replace function auth_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active;
$$;

create or replace function auth_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select employee_id from profiles where id = auth.uid() and active;
$$;

create or replace function is_admin()
returns boolean language sql stable as $$ select auth_role() = 'admin'; $$;

create or replace function is_leadership()
returns boolean language sql stable as $$
  select auth_role() in ('shift_leader', 'admin');
$$;

alter table companies enable row level security;
alter table shifts enable row level security;
alter table employees enable row level security;
alter table profiles enable row level security;
alter table shift_assignments enable row level security;
alter table audit_logs enable row level security;

-- Unternehmen --------------------------------------------------
create policy "eigenes Unternehmen lesen" on companies
  for select using (id = auth_company_id());

create policy "Unternehmen ändert Admin" on companies
  for update using (id = auth_company_id() and is_admin())
  with check (id = auth_company_id() and is_admin());

-- Schichten ----------------------------------------------------
create policy "Schichten lesen" on shifts
  for select using (company_id = auth_company_id());

create policy "Schichten verwaltet Admin" on shifts
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

-- Personalstammdaten -------------------------------------------
-- Mitarbeiter sehen nur den eigenen Datensatz, Führung das ganze
-- Unternehmen. Kein Zugriff über Unternehmensgrenzen hinweg.
create policy "eigene Personaldaten lesen" on employees
  for select using (
    company_id = auth_company_id()
    and (id = auth_employee_id() or is_leadership())
  );

create policy "Personaldaten verwaltet Admin" on employees
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

-- Profile ------------------------------------------------------
-- Name und Rolle der Kolleginnen und Kollegen sind im Unternehmen
-- sichtbar; ändern darf man nur sich selbst.
create policy "Profile im Unternehmen lesen" on profiles
  for select using (company_id = auth_company_id());

create policy "eigenes Profil ändern" on profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Rolle, Unternehmen und Aktivstatus bleiben unverändert:
    and role = auth_role()
    and company_id = auth_company_id()
    and active = true
  );

create policy "Profile verwaltet Admin" on profiles
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

-- Schichtzuordnung ---------------------------------------------
create policy "Schichtzuordnung lesen" on shift_assignments
  for select using (
    company_id = auth_company_id()
    and (employee_id = auth_employee_id() or is_leadership())
  );

create policy "Schichtzuordnung pflegt Führung" on shift_assignments
  for all using (company_id = auth_company_id() and is_leadership())
  with check (company_id = auth_company_id() and is_leadership());

-- Protokoll -----------------------------------------------------
create policy "Protokoll liest Admin" on audit_logs
  for select using (company_id = auth_company_id() and is_admin());

create policy "Protokoll schreiben" on audit_logs
  for insert with check (company_id = auth_company_id());
