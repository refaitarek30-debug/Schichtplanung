-- =============================================================
-- Phase 3 · Urlaubskonto, Urlaubsanträge, Genehmigungsworkflow
--
-- Baut auf 0003_planning.sql auf. Benennt Spalten auf den Wortlaut aus
-- der Phase-3-Spezifikation um und ergänzt:
--   - serverseitige Berechnung der Urlaubstage (Trigger, nicht der Client)
--   - atomare Genehmigung/Ablehnung (verhindert doppelte Entscheidungen)
--   - ein berechnetes Urlaubskonto als View statt manuell gepflegter Felder
--   - eine vorbereitete notifications-Tabelle
-- =============================================================

-- ---------------------------------------------------------------
-- 1) Spalten umbenennen / ergänzen
-- ---------------------------------------------------------------

alter table leave_balances rename column carry_over to carried_over;

alter table leave_requests rename column days to requested_days;
alter table leave_requests rename column comment to reason;
alter table leave_requests rename column decided_by to reviewed_by;
alter table leave_requests rename column decided_at to reviewed_at;
alter table leave_requests rename column decision_note to rejection_reason;

-- Vormittags/nachmittags nur bei eintägigen Anträgen relevant.
do $$ begin
  create type half_day_period as enum ('vormittag', 'nachmittag');
exception when duplicate_object then null; end $$;

alter table leave_requests
  add column if not exists half_day_period half_day_period;

alter table leave_requests
  add constraint half_day_only_single_day
  check (half_day_period is null or start_date = end_date);

alter table leave_requests
  add constraint rejection_reason_required
  check (status <> 'rejected' or rejection_reason is not null);

create index if not exists leave_requests_employee_status_idx
  on leave_requests (employee_id, status);

-- ---------------------------------------------------------------
-- 2) Urlaubstage serverseitig berechnen
--
-- Der Client darf `requested_days` mitschicken (für die Live-Vorschau),
-- der Server verwirft den Wert aber und rechnet ihn aus start_date,
-- end_date und half_day_period gegen die Feiertage des Unternehmens neu.
-- Damit lässt sich der Wert nicht durch einen manipulierten Request ändern.
-- ---------------------------------------------------------------

create or replace function calculate_leave_days(
  p_company_id uuid,
  p_start_date date,
  p_end_date date,
  p_half_day_period half_day_period
)
returns numeric(4, 1) language plpgsql stable as $$
declare
  workdays int;
begin
  select count(*) into workdays
  from generate_series(p_start_date, p_end_date, interval '1 day') as day
  where extract(isodow from day) < 6  -- 1..5 = Mo..Fr
    and not exists (
      select 1 from holidays h
      where h.date = day::date
        and (h.company_id = p_company_id or h.company_id is null)
    );

  if p_half_day_period is not null and workdays = 1 then
    return 0.5;
  end if;

  return workdays::numeric(4, 1);
end;
$$;

create or replace function leave_requests_set_computed_days()
returns trigger language plpgsql as $$
begin
  if new.end_date < new.start_date then
    raise exception 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  end if;

  new.requested_days := calculate_leave_days(
    new.company_id, new.start_date, new.end_date, new.half_day_period
  );
  new.half_day := new.half_day_period is not null;

  if new.requested_days <= 0 then
    raise exception 'Der gewählte Zeitraum enthält keinen Arbeitstag.';
  end if;

  return new;
end;
$$;

drop trigger if exists leave_requests_compute_days on leave_requests;
create trigger leave_requests_compute_days
  before insert or update of start_date, end_date, half_day_period
  on leave_requests
  for each row execute function leave_requests_set_computed_days();

-- ---------------------------------------------------------------
-- 3) Urlaubskonto als berechnete View
--
-- `remaining_days` etc. werden nicht gespeichert, sondern aus den
-- tatsächlichen Anträgen berechnet – genau wie leaveBalance() in
-- src/lib/staffing.ts, nur serverseitig und für alle Clients verbindlich.
-- `security_invoker` sorgt dafür, dass die RLS-Policies der Basistabellen
-- gelten und nicht die Rechte des View-Eigentümers.
-- ---------------------------------------------------------------

create or replace view leave_balances_view
with (security_invoker = true) as
select
  b.id,
  b.company_id,
  b.employee_id,
  b.year,
  b.entitlement,
  b.carried_over,
  coalesce(used.days, 0)    as used_days,
  coalesce(planned.days, 0) as planned_days,
  coalesce(pending.days, 0) as pending_days,
  b.entitlement + b.carried_over
    - coalesce(used.days, 0)
    - coalesce(planned.days, 0)
    - coalesce(pending.days, 0) as remaining_days,
  b.created_at,
  b.updated_at
from leave_balances b
left join lateral (
  select sum(r.requested_days) as days
  from leave_requests r
  where r.employee_id = b.employee_id
    and r.status = 'approved'
    and r.end_date < current_date
    and extract(year from r.start_date) = b.year
) used on true
left join lateral (
  select sum(r.requested_days) as days
  from leave_requests r
  where r.employee_id = b.employee_id
    and r.status = 'approved'
    and r.end_date >= current_date
    and extract(year from r.start_date) = b.year
) planned on true
left join lateral (
  select sum(r.requested_days) as days
  from leave_requests r
  where r.employee_id = b.employee_id
    and r.status = 'pending'
    and extract(year from r.start_date) = b.year
) pending on true;

-- Für neue Mitarbeiter automatisch ein Urlaubskonto des laufenden Jahres anlegen.
create or replace function employees_ensure_leave_balance()
returns trigger language plpgsql as $$
begin
  insert into leave_balances (company_id, employee_id, year, entitlement, carried_over)
  values (new.company_id, new.id, extract(year from current_date)::smallint, new.vacation_days, 0)
  on conflict (employee_id, year) do nothing;
  return new;
end;
$$;

drop trigger if exists employees_leave_balance on employees;
create trigger employees_leave_balance
  after insert on employees
  for each row execute function employees_ensure_leave_balance();

-- ---------------------------------------------------------------
-- 4) Atomare Genehmigung / Ablehnung
--
-- Ein bedingtes UPDATE (`where status = 'pending'`) ist in Postgres
-- atomar: Klicken zwei Schichtleiter gleichzeitig auf "Genehmigen",
-- gewinnt genau eine Transaktion, die andere bekommt 0 betroffene
-- Zeilen zurück und damit einen klaren Hinweis statt eines stillen
-- doppelten Verbrauchs. Zusätzlich prüft die Funktion erneut das
-- verfügbare Kontingent, um eine Überschreitung im Rennfall auszuschließen.
-- ---------------------------------------------------------------

-- SECURITY DEFINER: läuft mit den Rechten der Funktion (in Supabase der
-- `postgres`-Rolle) und umgeht damit die RLS-Policy, die direkte
-- Status-Änderungen von Clients verbietet. Die Berechtigungsprüfung
-- übernimmt die Funktion selbst über is_leadership()/auth_company_id() –
-- beide sind ihrerseits SECURITY DEFINER und lesen sicher aus `profiles`.
create or replace function decide_leave_request(
  p_request_id uuid,
  p_decision leave_status,   -- 'approved' oder 'rejected'
  p_rejection_reason text default null
)
returns leave_requests language plpgsql security definer set search_path = public as $$
declare
  result leave_requests;
  remaining numeric(4, 1);
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Ungültige Entscheidung.';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_rejection_reason), '') = '' then
    raise exception 'Für eine Ablehnung ist eine Begründung erforderlich.';
  end if;
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  if p_decision = 'approved' then
    select remaining_days into remaining
    from leave_balances_view v
    join leave_requests r on r.employee_id = v.employee_id
      and v.year = extract(year from r.start_date)
    where r.id = p_request_id;

    -- verfügbare Tage schließen den zu entscheidenden Antrag selbst
    -- bereits als "pending" ein, deshalb genügt remaining_days >= 0.
    if remaining is not null and remaining < 0 then
      raise exception 'Für diesen Antrag stehen nicht genügend Urlaubstage zur Verfügung.';
    end if;
  end if;

  update leave_requests
  set status = p_decision,
      rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id
    and company_id = auth_company_id()
    and status = 'pending'
  returning * into result;

  if result.id is null then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    result.company_id, auth.uid(),
    case when p_decision = 'approved' then 'leave.approved' else 'leave.rejected' end,
    'leave_requests', result.id,
    jsonb_build_object('reason', p_rejection_reason)
  );

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    result.company_id, e.id,
    case when p_decision = 'approved' then 'leave_approved' else 'leave_rejected' end,
    case when p_decision = 'approved' then 'Urlaubsantrag genehmigt' else 'Urlaubsantrag abgelehnt' end,
    case when p_decision = 'approved'
      then 'Dein Urlaubsantrag wurde genehmigt.'
      else 'Dein Urlaubsantrag wurde abgelehnt: ' || coalesce(p_rejection_reason, '')
    end,
    'leave_requests', result.id
  from employees e where e.id = result.employee_id;

  return result;
end;
$$;

-- Zurückziehen ebenfalls als atomare Funktion, damit dieselbe
-- Race-Condition-Sicherung wie bei der Genehmigung gilt. SECURITY DEFINER
-- aus demselben Grund; die Prüfung `employee_id = auth_employee_id()`
-- übernimmt weiterhin die eigentliche Zugriffskontrolle.
create or replace function withdraw_leave_request(p_request_id uuid)
returns leave_requests language plpgsql security definer set search_path = public as $$
declare
  result leave_requests;
begin
  update leave_requests
  set status = 'withdrawn'
  where id = p_request_id
    and employee_id = auth_employee_id()
    and status = 'pending'
  returning * into result;

  if result.id is null then
    raise exception 'Der Antrag lässt sich nicht mehr zurückziehen.';
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------
-- 5) Überschneidungen in der eigenen Schicht
--
-- Erste, einfache Prüfung für Phase 3. Die vollständige
-- Mindestbesetzungsprüfung mit Schichtzuordnung folgt in Phase 4.
-- ---------------------------------------------------------------

create or replace function shift_leave_overlap(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (overlapping_employees int) language sql stable as $$
  select count(distinct r.employee_id)::int
  from leave_requests r
  join employees e on e.id = r.employee_id
  where e.shift_id = (select shift_id from employees where id = p_employee_id)
    and r.employee_id <> p_employee_id
    and r.status in ('approved', 'pending')
    and r.start_date <= p_end_date
    and r.end_date >= p_start_date;
$$;

-- ---------------------------------------------------------------
-- 6) Benachrichtigungen (vorbereitet)
-- ---------------------------------------------------------------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  type text not null,               -- 'leave_approved', 'leave_rejected', 'leave_submitted', …
  title text not null,
  body text not null,
  related_entity text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_employee_idx
  on notifications (employee_id, read_at);

alter table notifications enable row level security;

create policy "eigene Benachrichtigungen lesen" on notifications
  for select using (
    company_id = auth_company_id()
    and (employee_id = auth_employee_id() or is_admin())
  );

create policy "eigene Benachrichtigungen als gelesen markieren" on notifications
  for update using (employee_id = auth_employee_id())
  with check (employee_id = auth_employee_id());

create policy "Benachrichtigungen anlegen" on notifications
  for insert with check (company_id = auth_company_id());

-- Bei Antragstellung die Führung benachrichtigen (alle Schichtleiter/Admins
-- des Unternehmens – ohne Zuordnungstabelle die einfachste korrekte Lösung).
create or replace function leave_requests_notify_leadership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
    select
      new.company_id, p.employee_id,
      'leave_submitted', 'Neuer Urlaubsantrag',
      (select first_name || ' ' || last_name from employees where id = new.employee_id)
        || ' hat Urlaub beantragt.',
      'leave_requests', new.id
    from profiles p
    where p.company_id = new.company_id
      and p.role in ('shift_leader', 'admin')
      and p.employee_id is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists leave_requests_notify on leave_requests;
create trigger leave_requests_notify
  after insert on leave_requests
  for each row execute function leave_requests_notify_leadership();

-- ---------------------------------------------------------------
-- 7) RLS-Nachschärfung für leave_requests
--
-- Ersetzt die Update-Policy aus 0003: normale Schreibzugriffe auf
-- `status`, `reviewed_by`, `reviewed_at` und `rejection_reason` laufen
-- ab jetzt ausschließlich über decide_leave_request() /
-- withdraw_leave_request() (SECURITY INVOKER, prüft also weiter über
-- RLS). Direkte UPDATEs bleiben nur für den Antragsteller im
-- pending-Zustand erlaubt (z. B. um den Kommentar zu korrigieren).
-- ---------------------------------------------------------------

drop policy if exists "Führung entscheidet" on leave_requests;
drop policy if exists "eigenen offenen Antrag zurückziehen" on leave_requests;

-- Direkte UPDATEs von Clients dürfen den Status nicht mehr ändern.
-- Genehmigen, Ablehnen und Zurückziehen laufen ausschließlich über
-- decide_leave_request() bzw. withdraw_leave_request() (beide
-- SECURITY DEFINER, mit eigener Berechtigungsprüfung und Race-Condition-
-- Schutz durch das bedingte `where status = 'pending'`).
create policy "Führung sieht offene Anträge, ändert nur über Funktion" on leave_requests
  for update using (company_id = auth_company_id() and is_leadership())
  with check (company_id = auth_company_id() and is_leadership() and status = 'pending');

-- ---------------------------------------------------------------
-- 8) Bestandsdaten nachziehen
--
-- Der Trigger aus Abschnitt 3 legt Urlaubskonten nur für künftig neu
-- angelegte Mitarbeiter an. Für bereits vorhandene (z. B. aus
-- 0004_seed_demo.sql) fehlt das Konto sonst.
-- ---------------------------------------------------------------

insert into leave_balances (company_id, employee_id, year, entitlement, carried_over)
select e.company_id, e.id, extract(year from current_date)::smallint, e.vacation_days, 0
from employees e
on conflict (employee_id, year) do nothing;
