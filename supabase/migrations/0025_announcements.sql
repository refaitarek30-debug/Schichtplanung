-- =============================================================
-- Phase 11b · Mitteilungen aus der Betriebsleitung
--
-- Bisher standen auf dem Dashboard feste Beispieltexte. Jetzt schreibt die
-- Führung echte Mitteilungen auf der Regeln-Seite; jeder im Unternehmen
-- sieht sie auf dem Dashboard. Urlaubssperren blendet die Anwendung
-- zusätzlich ein, dafür braucht es keine zweite Tabelle.
-- =============================================================

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title text not null,
  body text not null default '',
  level text not null default 'info' check (level in ('info', 'warn')),
  created_by uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_company_created_idx
  on announcements (company_id, created_at desc);

alter table announcements enable row level security;

drop trigger if exists announcements_updated_at on announcements;
create trigger announcements_updated_at
  before update on announcements
  for each row execute function set_updated_at();

drop policy if exists "Mitteilungen liest das Unternehmen" on announcements;
create policy "Mitteilungen liest das Unternehmen" on announcements
  for select using (company_id = auth_company_id());

drop policy if exists "Mitteilungen pflegt Fuehrung" on announcements;
create policy "Mitteilungen pflegt Fuehrung" on announcements
  for all
  using (company_id = auth_company_id() and is_leadership())
  with check (company_id = auth_company_id() and is_leadership());

revoke all on table announcements from public, anon;
grant select, insert, update, delete on table announcements to authenticated;
