-- 0062 – Wer im Urlaub krank wird, bekommt den Tag zurück.
--
-- Bisher hat `create_absence_range()` die Urlaubsantraege nicht angefasst.
-- Eine Krankmeldung mitten im genehmigten Urlaub legte also nur einen
-- zusaetzlichen Eintrag an: der Urlaubstag blieb vom Konto abgebucht, und
-- die Person hat ihn schlicht verloren. § 9 BUrlG sagt das Gegenteil –
-- Krankheitstage waehrend des Urlaubs werden nicht auf den Urlaub
-- angerechnet.
--
-- Herausgeloest wird mit `split_leave_request_day()`, derselben Funktion,
-- die auch eine Planaenderung benutzt. Der Antrag drumherum bleibt
-- bestehen, nur der Krankheitstag faellt heraus – und damit ist er auf dem
-- Konto wieder frei, weil `leave_balances_view` aus den Antraegen rechnet.
--
-- Das gilt bewusst nur fuer `krank`. Schulung und Sonstiges sind keine
-- Krankheit und erhalten den Urlaubsanspruch nicht zurueck.
--
-- Zweitens standen Plan und Auswertung im Widerspruch: `absence_report()`
-- laesst seit 0058 die erfasste Abwesenheit ueber den genehmigten Urlaub
-- stechen, `shift_plan_grid()` zeigte aber den Urlaub. Dieselbe Person am
-- selben Tag war im Plan „U“ und in der Auswertung „krank“. Ab hier gilt
-- ueberall dieselbe Rangfolge.

-- ---------------------------------------------------------------------
-- 1) Krank loest Urlaub und V-Tag heraus
-- ---------------------------------------------------------------------

create or replace function create_absence_range(
  p_employee_id uuid, p_from date, p_to date,
  p_type absence_type, p_note text default null
)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare
  e employees;
  v_count int := 0;
  d date;
  r leave_requests;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen Abwesenheiten erfassen.';
  end if;

  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_from is null or p_to is null then
    raise exception 'Bitte Beginn und Ende angeben.';
  end if;
  if p_to < p_from then
    raise exception 'Das Ende darf nicht vor dem Beginn liegen.';
  end if;
  if p_to - p_from > 365 then
    raise exception 'Der Zeitraum ist zu lang.';
  end if;

  for d in select g::date from generate_series(p_from, p_to, '1 day') g loop
    continue when not is_planned_workday(p_employee_id, d);

    -- Krankheit sticht Urlaub und V-Tag: den Tag aus jedem laufenden oder
    -- genehmigten Antrag herausloesen, damit er dem Konto gutgeschrieben
    -- wird. Die Schleife, weil an einem Tag zwei halbe Antraege liegen
    -- koennen – die einzige Ueberschneidung, die 0061 noch zulaesst.
    if p_type = 'krank' then
      loop
        select * into r
          from leave_requests
         where employee_id = p_employee_id
           and status in ('approved', 'pending')
           and d between start_date and end_date
         order by start_date
         limit 1;
        exit when r.id is null;
        perform split_leave_request_day(r, d, null);
      end loop;
    end if;

    insert into absences (company_id, employee_id, date, type, note)
    values (e.company_id, p_employee_id, d, p_type, nullif(trim(p_note), ''))
    on conflict (employee_id, date, type) do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'In diesem Zeitraum gibt es keinen eingeplanten Arbeitstag ohne bestehenden Eintrag.';
  end if;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Im Plan sticht die erfasste Abwesenheit den Urlaub
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
      -- Erfasste Abwesenheit zuerst – sie ist eingetreten, der Urlaub war
      -- nur geplant. Dieselbe Rangfolge benutzt `absence_report()`.
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'krank') then 'K'
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
