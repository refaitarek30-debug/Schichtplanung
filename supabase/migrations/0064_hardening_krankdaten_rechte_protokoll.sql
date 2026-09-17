-- 0064 – Hardening aus dem Sicherheitsaudit (docs/auftrag-security-…)
--
-- Was das Audit ergeben hat, bevor hier etwas geaendert wurde:
--
--   * 23 Tabellen, alle mit RLS. Keine Policy ohne `with_check`.
--   * Cross-Tenant geprueft als Rolle `authenticated`: alle sieben
--     Lese- und Schreibversuche auf eine fremde Firma blockiert,
--     Gegenprobe auf die eigene Firma lesbar.
--   * Anonym ueber die REST-Schnittstelle: kein Zugriff auf Tabellen,
--     keine Funktion liefert Daten, `discard_unclaimed_company` gibt
--     bei einer echten Firma `false` zurueck.
--   * 79 Funktionen mit `security definer`, alle mit `search_path`.
--
-- Die Mandantentrennung haelt also. Diese Migration schliesst die drei
-- Punkte, die tatsaechlich offen waren.

-- ---------------------------------------------------------------------
-- 1) Krankheitsdaten: Kollegen sehen nur noch „abwesend“
-- ---------------------------------------------------------------------
--
-- Belegt im Audit: ein einfacher Mitarbeiter sah im Vierwochenplan drei
-- Krank-Zellen seiner Kolleginnen und Kollegen. Ueber die Tabelle
-- `absences` kommt er nicht an die Daten – RLS haelt dort. Das Leck war
-- ausschliesslich `shift_plan_grid()`, die als `security definer` laeuft
-- und der Schichtgruppe bewusst die ganzen Zeilen zeigt.
--
-- Krankheit ist ein Gesundheitsdatum nach Art. 9 DSGVO. Die
-- Schichtgruppe braucht fuer die Planung „dieser Platz ist unbesetzt“,
-- nicht den Grund. Deshalb sieht ab hier:
--
--   * die Fuehrung weiterhin `K` – sie muss Ausfaelle disponieren,
--   * jede Person ihren eigenen Eintrag weiterhin vollstaendig,
--   * ein Mitarbeiter bei Kolleginnen und Kollegen `A` (abwesend)
--     statt `K`.
--
-- Bewusst NICHT geaendert: Urlaub und V-Tag bleiben sichtbar. Wer wann
-- Urlaub hat, ist im Schichtbetrieb Planungswissen und kein
-- Gesundheitsdatum. Schulung bleibt ebenfalls sichtbar.
--
-- Umkehrbar: die eine `case`-Verzweigung unten entfernen.

create or replace function shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
returns table (
  employee_id uuid, employee_name text, rotation_team text,
  personnel_number text, day date, shift_name text, shift_code text,
  absence_code text, is_me boolean
)
language plpgsql stable security definer set search_path to 'public'
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

  select e.rotation_team into mein_team from employees e where e.id = me;

  select coalesce(cs.work_on_holidays, true) into feiertage_arbeiten
    from company_settings cs where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  select e.id, e.first_name || ' ' || e.last_name,
    case when e.shift_worker then e.rotation_team::text else null end,
    e.personnel_number,
    gs.day::date, s.name,
    case when s.name ilike 'Früh%' then 'F' when s.name ilike 'Spät%' then 'S'
         when s.name ilike 'Nacht%' then 'N'
         when s.name is not null then upper(left(s.name, 1)) else null end,
    case
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'krank')
        -- Der Grund nur fuer die Fuehrung und fuer die Person selbst.
        then case when fuehrung or e.id = me then 'K' else 'A' end
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'schulung') then 'FB'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date) then 'A'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'approved' and r.kind = 'v_tag'
        and gs.day::date between r.start_date and r.end_date) then 'V'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'pending' and r.kind = 'v_tag'
        and gs.day::date between r.start_date and r.end_date) then 'v'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'approved' and r.kind = 'urlaub'
        and gs.day::date between r.start_date and r.end_date) then 'U'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'pending' and r.kind = 'urlaub'
        and gs.day::date between r.start_date and r.end_date) then 'u'
      else null end,
    (e.id = me)
  from employees e
  cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  left join shifts s on s.id = effective_shift_id(e.id, gs.day::date)
    and shift_runs_on(s, gs.day::date, feiertage_arbeiten)
  where e.company_id = p_company_id
    and e.active
    and (e.entry_date is null or e.entry_date <= bis)
    and (e.exit_date  is null or e.exit_date  >= p_from)
    and (
      fuehrung
      or e.id = me
      or (mein_team is not null and e.rotation_team = mein_team)
    )
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, e.id, gs.day;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Ueberfluessige Rechte fuer nicht angemeldete Aufrufer entziehen
-- ---------------------------------------------------------------------
--
-- Funktionen erhalten in PostgreSQL standardmaessig `EXECUTE` fuer
-- PUBLIC. Dadurch standen zehn Funktionen auch `anon` offen. Sieben davon
-- laufen als `security invoker`, dort greift RLS – gemessen: alle liefern
-- „permission denied“. Gefaehrlich waere nur `security definer` ohne
-- eigene Pruefung, und das trifft auf keine zu.
--
-- Trotzdem gilt: was nicht gebraucht wird, wird entzogen. Offen bleiben
-- nur die beiden Funktionen, die die Registrierung ohne Anmeldung
-- tatsaechlich braucht.

revoke execute on function leave_requests_check_overlap() from anon, public;
revoke execute on function employees_absent_on(date, boolean, uuid) from anon;
revoke execute on function effective_shift_id(uuid, date) from anon;
revoke execute on function rotation_shift_for(uuid, date) from anon;
revoke execute on function rotation_cycle_length(uuid) from anon;
revoke execute on function calculate_leave_days(uuid, date, date, half_day_period) from anon;
revoke execute on function leave_block_for_range(uuid, uuid, date, date) from anon;
revoke execute on function shift_runs_on(shifts, date) from anon;

comment on function register_company(text, text, text, text, boolean) is
  'Bewusst fuer anon ausfuehrbar: die Registrierung erfolgt ohne Anmeldung.';
comment on function discard_unclaimed_company(uuid) is
  'Bewusst fuer anon ausfuehrbar: raeumt eine abgebrochene Registrierung auf. '
  'Loescht nur, wenn kein Login an der Firma haengt und sie juenger als 15 Minuten ist.';

-- ---------------------------------------------------------------------
-- 3) platform_admins: RLS aktiv, aber keine Policy
-- ---------------------------------------------------------------------
--
-- Das war der einzige Treffer im RLS-Scan. Ohne Policy ist die Tabelle
-- fuer `anon` und `authenticated` vollstaendig gesperrt – das ist der
-- gewuenschte Zustand, denn die Betreiberliste geht Mandanten nichts an.
-- Gelesen wird sie ausschliesslich ueber `security definer`-Funktionen.
-- Hier wird das nur festgeschrieben, damit der naechste Scan es nicht
-- erneut als Befund meldet.

comment on table platform_admins is
  'Betreiberliste. RLS aktiv und bewusst OHNE Policy: kein Mandant darf sie '
  'lesen oder schreiben. Zugriff nur ueber security-definer-Funktionen.';

-- ---------------------------------------------------------------------
-- 4) Protokoll vervollstaendigen
-- ---------------------------------------------------------------------
--
-- `audit_logs` gab es bereits, erfasst wurde aber nur `leave.approved`
-- (12 Eintraege). Ab hier eine einheitliche Schreibfunktion und Trigger
-- fuer die Vorgaenge, die wirklich zaehlen.
--
-- Bewusst NICHT protokolliert wird der Inhalt schutzbeduerftiger Daten.
-- Dass jemand eine Krankmeldung erfasst hat, gehoert ins Protokoll – die
-- Notiz dazu nicht.

create or replace function write_audit(
  p_company_id uuid, p_action text, p_entity text,
  p_entity_id uuid default null, p_payload jsonb default null
) returns void
language sql security definer set search_path to 'public'
as $$
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (p_company_id, auth.uid(), p_action, p_entity, p_entity_id, p_payload);
$$;

comment on function write_audit(uuid, text, text, uuid, jsonb) is
  'Einheitlicher Protokolleintrag. Niemals schutzbeduerftige Inhalte in p_payload.';

-- Rollenwechsel: die folgenreichste Aenderung ueberhaupt
create or replace function employees_audit_role()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    perform write_audit(new.company_id, 'employee.role_changed', 'employees', new.id,
      jsonb_build_object('von', old.role::text, 'nach', new.role::text));
  end if;
  if tg_op = 'UPDATE' and new.active is distinct from old.active then
    perform write_audit(new.company_id,
      case when new.active then 'employee.reactivated' else 'employee.deactivated' end,
      'employees', new.id, null);
  end if;
  if tg_op = 'INSERT' then
    perform write_audit(new.company_id, 'employee.created', 'employees', new.id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists employees_audit on employees;
create trigger employees_audit
  after insert or update of role, active on employees
  for each row execute function employees_audit_role();

-- Abwesenheiten: nur die Tatsache, nie die Notiz
create or replace function absences_audit()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(new.company_id, 'absence.created', 'absences', new.id,
      jsonb_build_object('art', new.type::text, 'tag', new.date));
  else
    perform write_audit(old.company_id, 'absence.deleted', 'absences', old.id,
      jsonb_build_object('art', old.type::text, 'tag', old.date));
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists absences_audit_trg on absences;
create trigger absences_audit_trg
  after insert or delete on absences
  for each row execute function absences_audit();

-- Das Protokoll darf niemand aendern oder loeschen, auch die
-- Administration nicht. Bisher gab es nur Lese- und Schreibpolicies;
-- update und delete waren damit schon verboten. Hier festgeschrieben.
comment on table audit_logs is
  'Protokoll. Bewusst nur SELECT (Admin) und INSERT: kein update, kein delete. '
  'Ein Protokoll, das der Protokollierte aendern kann, ist keines.';
