-- =============================================================
-- Phase 4 · Automatische Besetzungsprüfung, Urlaubssperren
--
-- Baut auf 0001–0006 auf. Spiegelt src/lib/staffing.ts als Postgres-
-- Funktionen, damit Kalender, Besetzungsseite und Genehmigung mit
-- echten Zahlen arbeiten statt mit Demo-Daten.
--
-- Designentscheidung (siehe PROJECT_STATUS.md): die Besetzung wird über
-- die statische Zuordnung `employees.shift_id` berechnet, nicht über
-- `shift_assignments` (datumsgenau). Das entspricht exakt der Demo-Logik
-- aus Phase 1 (`employeesOfShift`) und hält Phase 4 überschaubar;
-- `shift_assignments` bleibt für eine spätere Rotationsplanung stehen.
-- =============================================================

-- ---------------------------------------------------------------
-- 1) Läuft eine Schicht an einem Tag?
-- ---------------------------------------------------------------

create or replace function shift_runs_on(p_shift shifts, p_date date)
returns boolean language sql stable as $$
  select
    extract(dow from p_date)::int = any(p_shift.weekdays)
    and not exists (
      select 1 from holidays h
      where h.date = p_date
        and (h.company_id = p_shift.company_id or h.company_id is null)
    );
$$;

-- ---------------------------------------------------------------
-- 2) Wer fehlt an einem Tag? (genehmigter Urlaub + Abwesenheiten)
--
-- `p_include_pending` erlaubt dieselbe Vorschau wie `absentOn()` in
-- staffing.ts ("was wäre, wenn dieser offene Antrag auch zählt") –
-- gebraucht für die Live-Prüfung beim Genehmigen.
-- ---------------------------------------------------------------

create or replace function employees_absent_on(
  p_date date,
  p_include_pending boolean default false,
  p_include_request_id uuid default null
)
returns table (employee_id uuid) language sql stable as $$
  select employee_id from absences where date = p_date
  union
  select employee_id from leave_requests
  where p_date between start_date and end_date
    and (
      status = 'approved'
      or (p_include_pending and status = 'pending')
      or id = p_include_request_id
    );
$$;

-- ---------------------------------------------------------------
-- 3) Besetzung einer Schicht an einem Tag
--
-- SECURITY DEFINER: `absences` und `leave_requests` sind per RLS für
-- normale Mitarbeitende auf die eigenen Zeilen beschränkt (Grund einer
-- Abwesenheit bleibt privat). Für die Besetzungszahl selbst – "wie viele
-- sind da, wie viele fehlen" – ist das zu eng: eine Schichtleitung muss
-- die ganze Schicht sehen, und ein Mitarbeiter braucht beim Beantragen
-- zumindest die Gesamtzahl der überschneidenden Abwesenheiten (Abschnitt
-- 17 der Phase-3-Spezifikation), ohne die Namen oder Gründe der anderen zu
-- erfahren. Diese Funktionen geben ausschließlich aggregierte Zahlen
-- zurück (nie einzelne Mitarbeiter-IDs) und übernehmen die
-- Berechtigungsprüfung deshalb selbst, statt sich auf RLS zu verlassen.
-- ---------------------------------------------------------------

do $$ begin
  create type staffing_status as enum ('ok', 'warn', 'critical');
exception when duplicate_object then null; end $$;

create or replace function staffing_snapshot(p_shift_id uuid, p_date date)
returns table (
  shift_id uuid,
  date date,
  target smallint,
  minimum smallint,
  planned int,
  absent int,
  present int,
  status staffing_status
) language plpgsql stable security definer set search_path = public as $$
declare
  s shifts;
  v_planned int;
  v_absent int;
begin
  select * into s from shifts where id = p_shift_id;
  if s.id is null then
    raise exception 'Schicht nicht gefunden.';
  end if;
  if s.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  select count(*) into v_planned from employees e
  where e.shift_id = s.id and e.active;

  select count(*) into v_absent from employees e
  where e.shift_id = s.id and e.active
    and e.id in (select employee_id from employees_absent_on(p_date));

  return query select
    s.id, p_date, s.target_staff, s.minimum_staff,
    v_planned, v_absent, v_planned - v_absent,
    case
      when v_planned - v_absent < s.minimum_staff then 'critical'::staffing_status
      when v_planned - v_absent < s.target_staff then 'warn'::staffing_status
      else 'ok'::staffing_status
    end;
end;
$$;

-- Besetzung aller an einem Tag laufenden Schichten eines Unternehmens.
-- Nur für Führung/Admin – Mitarbeitende sehen Besetzungszahlen im
-- Frontend ohnehin nur auf Seiten, die für ihre Rolle gar nicht verlinkt
-- sind, aber die Funktion prüft es zusätzlich selbst ab.
create or replace function staffing_for_day(p_company_id uuid, p_date date)
returns table (
  shift_id uuid,
  shift_name text,
  date date,
  target smallint,
  minimum smallint,
  planned int,
  absent int,
  present int,
  status staffing_status
) language plpgsql stable security definer set search_path = public as $$
begin
  if p_company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select s.id, s.name, snap.date, snap.target, snap.minimum, snap.planned,
         snap.absent, snap.present, snap.status
  from shifts s
  cross join lateral staffing_snapshot(s.id, p_date) as snap
  where s.company_id = p_company_id
    and s.active
    and s.target_staff > 0  -- "Tagdienst"-artige Schichten ohne Sollwert ausblenden
    and shift_runs_on(s, p_date);
end;
$$;

-- ---------------------------------------------------------------
-- 4) Auswirkung eines Urlaubszeitraums auf die Besetzung
--
-- Spiegelt `checkLeaveImpact()`: rechnet die antragstellende Person
-- testweise als abwesend ein und liefert je betroffenem Tag den Status.
-- Wird sowohl im Formular (Vorschau über RPC) als auch in
-- `decide_leave_request()` (echte Prüfung vor der Genehmigung) genutzt.
-- ---------------------------------------------------------------

create or replace function check_leave_staffing_impact(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  date date,
  present int,
  target smallint,
  minimum smallint,
  status staffing_status
) language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
  s shifts;
  d date;
  base record;
  already_absent boolean;
  adjusted_present int;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then
    return;
  end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if e.shift_id is null then
    return;
  end if;
  select * into s from shifts where id = e.shift_id;
  if s.id is null or s.target_staff = 0 then
    return;
  end if;

  d := p_start_date;
  while d <= p_end_date loop
    if shift_runs_on(s, d) then
      select * into base from staffing_snapshot(s.id, d);
      select exists(
        select 1 from employees_absent_on(d) a where a.employee_id = p_employee_id
      ) into already_absent;
      adjusted_present := base.present - case when already_absent then 0 else 1 end;

      return query select
        d, adjusted_present, base.target, base.minimum,
        case
          when adjusted_present < base.minimum then 'critical'::staffing_status
          when adjusted_present < base.target then 'warn'::staffing_status
          else 'ok'::staffing_status
        end;
    end if;
    d := d + 1;
  end loop;
end;
$$;

-- Für die Kalender-Heatmap: schlechtester Status je Tag über einen ganzen
-- Monat in einem einzigen Aufruf, statt bis zu 31 Einzelabfragen.
create or replace function staffing_month_overview(
  p_company_id uuid,
  p_year int,
  p_month int
)
returns table (day date, status staffing_status)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select
    gs.day::date,
    (array_agg(snap.status order by
      case snap.status when 'critical' then 0 when 'warn' then 1 else 2 end
    ))[1] as status
  from generate_series(
    make_date(p_year, p_month, 1),
    (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date,
    interval '1 day'
  ) as gs(day)
  join shifts s on s.company_id = p_company_id and s.active and s.target_staff > 0
  cross join lateral staffing_snapshot(s.id, gs.day::date) as snap
  where shift_runs_on(s, gs.day::date)
  group by gs.day::date;
end;
$$;

-- Mehrere Tage in einem Aufruf – für Besetzungsband und Engpassliste, statt
-- pro Tag einen eigenen Request zu schicken.
create or replace function staffing_range(
  p_company_id uuid,
  p_from date,
  p_days int
)
returns table (
  shift_id uuid,
  shift_name text,
  date date,
  target smallint,
  minimum smallint,
  planned int,
  absent int,
  present int,
  status staffing_status
) language plpgsql stable security definer set search_path = public as $$
begin
  if p_company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  return query
  select s.id, s.name, gs.day::date, snap.target, snap.minimum, snap.planned,
         snap.absent, snap.present, snap.status
  from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as gs(day)
  join shifts s on s.company_id = p_company_id and s.active and s.target_staff > 0
  cross join lateral staffing_snapshot(s.id, gs.day::date) as snap
  where shift_runs_on(s, gs.day::date)
  order by gs.day::date, s.name;
end;
$$;

-- ---------------------------------------------------------------
-- 5) Urlaubssperren
--
-- Nutzt die bereits in 0003_planning.sql angelegte `staffing_rules`
-- (key/value, je Unternehmen und optional je Schicht). Eine Sperre ist
-- eine Zeile mit key = 'urlaubssperre' und
-- value = {"start": "2026-12-24", "end": "2027-01-02", "reason": "…"}.
-- shift_id = null bedeutet: gilt unternehmensweit.
-- ---------------------------------------------------------------

create or replace function leave_block_for_range(
  p_company_id uuid,
  p_shift_id uuid,
  p_start_date date,
  p_end_date date
)
returns text language sql stable as $$
  select r.value ->> 'reason'
  from staffing_rules r
  where r.company_id = p_company_id
    and r.key = 'urlaubssperre'
    and r.active
    and (r.shift_id is null or r.shift_id = p_shift_id)
    and (r.value ->> 'start')::date <= p_end_date
    and (r.value ->> 'end')::date >= p_start_date
  order by (r.shift_id is not null) desc  -- schichtspezifische Sperre zuerst
  limit 1;
$$;

-- In den Antrags-Trigger einziehen: eine Urlaubssperre blockiert das
-- Anlegen und jede Änderung von Start-/Enddatum eines Antrags.
create or replace function leave_requests_check_block()
returns trigger language plpgsql as $$
declare
  block_reason text;
  emp employees;
begin
  select * into emp from employees where id = new.employee_id;
  select leave_block_for_range(new.company_id, emp.shift_id, new.start_date, new.end_date)
    into block_reason;

  if block_reason is not null then
    raise exception 'Für diesen Zeitraum gilt eine Urlaubssperre: %', block_reason;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_requests_check_block_trg on leave_requests;
create trigger leave_requests_check_block_trg
  before insert or update of start_date, end_date
  on leave_requests
  for each row execute function leave_requests_check_block();

-- ---------------------------------------------------------------
-- 6) shift_leave_overlap() aus Phase 3 durch die echte
--    Mindestbesetzungsprüfung ersetzen
-- ---------------------------------------------------------------

drop function if exists shift_leave_overlap(uuid, date, date);

create or replace function shift_leave_overlap(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (overlapping_employees int, critical_days int, worst_status staffing_status)
language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then
    return;
  end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  with impact as (
    select * from check_leave_staffing_impact(p_employee_id, p_start_date, p_end_date)
  ),
  colleagues as (
    select count(distinct r.employee_id)::int as n
    from leave_requests r
    join employees c on c.id = r.employee_id
    where c.shift_id = e.shift_id
      and r.employee_id <> p_employee_id
      and r.status in ('approved', 'pending')
      and r.start_date <= p_end_date
      and r.end_date >= p_start_date
  )
  select
    (select n from colleagues),
    (select count(*)::int from impact where status = 'critical'),
    coalesce(
      (select status from impact order by
        case status when 'critical' then 0 when 'warn' then 1 else 2 end limit 1),
      'ok'::staffing_status
    );
end;
$$;

-- decide_leave_request() erneut prüfen lassen: vor dem Genehmigen soll
-- nicht nur das Urlaubskontingent, sondern auch die Mindestbesetzung
-- verlässlich geprüft sein. Blockiert wird nicht automatisch (das bleibt
-- eine Führungsentscheidung – ein Antrag kann trotz roter Ampel die
-- richtige Entscheidung sein, z. B. bei Krankheit), aber die Funktion
-- gibt den kritischen Status jetzt mit zurück, den die Anwendung anzeigt.
create or replace function decide_leave_request(
  p_request_id uuid,
  p_decision leave_status,
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

-- ---------------------------------------------------------------
-- 7) Berechtigungen: Urlaubssperren verwaltet die Administration
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- 8) Ausführungsrechte einschränken
--
-- PostgreSQL vergibt EXECUTE auf neue Funktionen standardmäßig an PUBLIC –
-- das schließt in Supabase die Rolle `anon` ein, also unangemeldete
-- Zugriffe über die REST/RPC-Schnittstelle. Die Funktionen prüfen zwar
-- selbst is_leadership()/auth_company_id(), aber ein anonymer Aufruf sollte
-- gar nicht erst bis zu dieser Prüfung kommen. Bewusste Verteidigung in
-- der Tiefe, zusätzlich zu den Berechtigungsprüfungen in den Funktionen
-- selbst (siehe IS DISTINCT FROM statt <> weiter oben – ein NULL bei
-- auth_company_id() darf eine Prüfung nie stillschweigend bestehen lassen).
-- ---------------------------------------------------------------

revoke execute on function staffing_snapshot(uuid, date) from public;
revoke execute on function staffing_for_day(uuid, date) from public;
revoke execute on function staffing_range(uuid, date, int) from public;
revoke execute on function staffing_month_overview(uuid, int, int) from public;
revoke execute on function check_leave_staffing_impact(uuid, date, date) from public;
revoke execute on function shift_leave_overlap(uuid, date, date) from public;
revoke execute on function decide_leave_request(uuid, leave_status, text) from public;
revoke execute on function withdraw_leave_request(uuid) from public;

grant execute on function staffing_snapshot(uuid, date) to authenticated;
grant execute on function staffing_for_day(uuid, date) to authenticated;
grant execute on function staffing_range(uuid, date, int) to authenticated;
grant execute on function staffing_month_overview(uuid, int, int) to authenticated;
grant execute on function check_leave_staffing_impact(uuid, date, date) to authenticated;
grant execute on function shift_leave_overlap(uuid, date, date) to authenticated;
grant execute on function decide_leave_request(uuid, leave_status, text) to authenticated;
grant execute on function withdraw_leave_request(uuid) to authenticated;

comment on table staffing_rules is
  'Konfigurierbare Planungsregeln je Unternehmen/Schicht. Bisher genutzter '
  'key: ''urlaubssperre'' mit value {"start","end","reason"}. RLS-Policies '
  'aus 0002_rls.sql gelten unverändert (Lesen: Unternehmen, Schreiben: Admin).';
