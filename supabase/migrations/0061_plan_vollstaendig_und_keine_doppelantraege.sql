-- 0061 – Der Plan war ab Zeile 1000 abgeschnitten, und Urlaub liess sich
-- doppelt beantragen.
--
-- 1) PostgREST liefert hoechstens 1000 Zeilen je Antwort. Der Schichtplan
--    braucht eine Zeile je Person und Tag: 50 Personen ueber 28 Tage sind
--    1400. Die letzten 400 fielen weg – im Demobetrieb genau Schicht D und
--    die Tagschicht. Das Frontend holt den Plan jetzt seitenweise; damit
--    ueber Seitengrenzen hinweg keine Zeile doppelt kommt oder verloren
--    geht, braucht die Sortierung ein eindeutiges letztes Merkmal. Alle
--    50 Personen haben `sort_order = null`, sortiert wurde also nach
--    Nachname – bei zwei gleichen Nachnamen ist die Reihenfolge sonst
--    nicht festgelegt.
--
-- 2) Ein Antrag liess sich beliebig oft ueber denselben Zeitraum stellen.
--    Die automatische Verteilung hat das erkannt und abgelehnt, die Arten
--    „Urlaub“ und „V-Tag“ nicht – dort wurde doppelt vom Konto abgebucht.

-- ---------------------------------------------------------------------
-- 1) Sortierung des Plans eindeutig machen
-- ---------------------------------------------------------------------

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
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'krank') then 'K'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'schulung') then 'FB'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date) then 'A'
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
  -- `e.id` zuletzt: erst damit ist die Reihenfolge bei gleichem Nachnamen
  -- festgelegt und das seitenweise Laden liefert jede Zeile genau einmal.
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, e.id, gs.day;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Keine zwei Antraege ueber denselben Tag
-- ---------------------------------------------------------------------

create or replace function leave_requests_check_overlap()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  kollision leave_requests;
begin
  -- Zurueckgezogene und abgelehnte Antraege belegen keinen Tag.
  if new.status not in ('approved', 'pending') then
    return new;
  end if;

  select * into kollision
    from leave_requests r
   where r.employee_id = new.employee_id
     and r.id is distinct from new.id
     and r.status in ('approved', 'pending')
     and r.start_date <= new.end_date
     and r.end_date >= new.start_date
     -- Zwei halbe Tage am selben Tag schliessen sich nicht aus, solange
     -- sie verschiedene Haelften belegen.
     and not (
       new.start_date = new.end_date
       and r.start_date = r.end_date
       and new.half_day_period is not null
       and r.half_day_period is not null
       and r.half_day_period is distinct from new.half_day_period
     )
   order by r.start_date
   limit 1;

  if kollision.id is not null then
    raise exception 'Für % bis % liegt bereits ein Antrag vor (% bis %, %). Bitte zuerst den bestehenden Antrag zurückziehen.',
      to_char(new.start_date, 'DD.MM.YYYY'),
      to_char(new.end_date, 'DD.MM.YYYY'),
      to_char(kollision.start_date, 'DD.MM.YYYY'),
      to_char(kollision.end_date, 'DD.MM.YYYY'),
      case kollision.status::text when 'approved' then 'genehmigt' else 'offen' end;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_requests_no_overlap on leave_requests;

-- Nach `leave_requests_compute_days` (Namen alphabetisch): erst stehen die
-- berechneten Tage fest, dann wird geprueft.
create trigger leave_requests_no_overlap
  before insert or update of start_date, end_date, status, half_day_period
  on leave_requests
  for each row execute function leave_requests_check_overlap();
