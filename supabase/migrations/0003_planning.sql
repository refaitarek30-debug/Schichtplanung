-- =============================================================
-- Phase 2 · Planungstabellen, vorbereitet für Phase 3 und 4
-- Struktur und Policies stehen schon; die Anwendung schreibt hier
-- erst ab Phase 3 hinein.
-- =============================================================

do $$ begin
  create type leave_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type absence_type as enum ('urlaub', 'krank', 'schulung', 'sonstiges');
exception when duplicate_object then null; end $$;

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  year smallint not null,
  entitlement numeric(4, 1) not null default 30,
  carry_over numeric(4, 1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, year)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  days numeric(4, 1) not null,
  comment text,
  status leave_status not null default 'pending',
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_range check (end_date >= start_date)
);

create table absences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  date date not null,
  type absence_type not null,
  note text,
  created_at timestamptz not null default now(),
  unique (employee_id, date, type)
);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies (id) on delete cascade,
  date date not null,
  name text not null,
  region text not null default 'NW',
  company_closure boolean not null default false,
  unique (company_id, date)
);

create table staffing_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  shift_id uuid references shifts (id) on delete cascade,
  key text not null,
  value jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, shift_id, key)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title text not null,
  body text not null,
  level text not null default 'info',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create trigger leave_balances_updated_at
  before update on leave_balances for each row execute function set_updated_at();
create trigger leave_requests_updated_at
  before update on leave_requests for each row execute function set_updated_at();

create index on leave_requests (company_id, start_date, end_date);
create index on leave_requests (employee_id, status);
create index on absences (company_id, date);

alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table absences enable row level security;
alter table holidays enable row level security;
alter table staffing_rules enable row level security;
alter table announcements enable row level security;

create policy "Urlaubskonto lesen" on leave_balances
  for select using (
    company_id = auth_company_id()
    and (employee_id = auth_employee_id() or is_leadership())
  );

create policy "Urlaubskonto pflegt Admin" on leave_balances
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

create policy "Anträge lesen" on leave_requests
  for select using (
    company_id = auth_company_id()
    and (employee_id = auth_employee_id() or is_leadership())
  );

create policy "eigenen Antrag stellen" on leave_requests
  for insert with check (
    company_id = auth_company_id()
    and employee_id = auth_employee_id()
    and status = 'pending'
  );

create policy "eigenen offenen Antrag zurückziehen" on leave_requests
  for update using (employee_id = auth_employee_id() and status = 'pending')
  with check (employee_id = auth_employee_id() and status in ('pending', 'withdrawn'));

create policy "Führung entscheidet" on leave_requests
  for update using (company_id = auth_company_id() and is_leadership())
  with check (company_id = auth_company_id() and is_leadership());

-- Für Mitarbeiter zählt nur, DASS jemand fehlt, nicht warum. Deshalb
-- liest die Anwendung Abwesenheitsgründe über diese View aus.
create policy "Abwesenheiten liest Führung" on absences
  for select using (
    company_id = auth_company_id()
    and (employee_id = auth_employee_id() or is_leadership())
  );

create policy "Abwesenheiten pflegt Führung" on absences
  for all using (company_id = auth_company_id() and is_leadership())
  with check (company_id = auth_company_id() and is_leadership());

create policy "Feiertage lesen" on holidays
  for select using (company_id is null or company_id = auth_company_id());

create policy "Feiertage pflegt Admin" on holidays
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

create policy "Regeln lesen" on staffing_rules
  for select using (company_id = auth_company_id());

create policy "Regeln pflegt Admin" on staffing_rules
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

create policy "Mitteilungen lesen" on announcements
  for select using (company_id = auth_company_id());

create policy "Mitteilungen pflegt Führung" on announcements
  for all using (company_id = auth_company_id() and is_leadership())
  with check (company_id = auth_company_id() and is_leadership());
