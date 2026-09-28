-- Paket vom 28.09.: vollständiges Löschen, AF-Satz 0,82, nächster Urlaub
-- mit Sonderurlaub, Schichtmeister ohne Wochentagssperre.
--
-- 1) mitarbeiter_endgueltig_loeschen(): Eine deaktivierte Person wird mit
--    allem entfernt – Personalstammsatz, Anträge, Abwesenheiten, Konten,
--    Zuordnungen, Qualifikationen (per ON DELETE CASCADE), dazu Zugang
--    (auth.users → profiles, privacy_settings, personal_details), an andere
--    gerichtete Mitteilungen und Mails zu ihren Anträgen und Ersatzanfragen
--    wegen ihres Ausfalls. Alles in einer Transaktion: klappt ein Teil
--    nicht, bleibt alles, wie es war. Im Protokoll bleibt nur, dass
--    gelöscht wurde – ohne Namen.
--
-- 2) stundenkonto(): Altersfreizeit spart 0,82 statt 0,83 Stunden je
--    gearbeiteter Schicht an. Der Stand wird bei jeder Abfrage neu
--    gerechnet – gespeicherte Werte gibt es nicht, alle Stände passen sich
--    damit sofort an.
--
-- 3) mein_naechster_urlaub(): Sonderurlaub steht als Abwesenheit, nicht als
--    Antrag, in der Datenbank. Er zählt jetzt zum zusammenhängenden
--    Zeitraum mit, genauso wie Urlaub und V-Tage.
--
-- 4) schicht_laeuft_fuer(): Eine ausdrücklich eingetragene Schicht gilt an
--    jedem Tag, auch wenn die Schicht an diesem Wochentag sonst nicht
--    läuft (Tagschicht am Samstag). Bisher war sie gespeichert, erschien
--    aber nicht im Plan. Genutzt im Plan, bei den Urlaubstagen und bei der
--    Besetzungsprüfung eines Antrags.

-- 1) Vollständig löschen -------------------------------------------------

create or replace function public.mitarbeiter_endgueltig_loeschen(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  e employees;
  zugaenge uuid[];
  antraege uuid[];
  n_zugang int := 0;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Personen löschen.';
  end if;

  select * into e from employees
   where id = p_employee_id and company_id = v_firma
   for update;
  if e.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if e.active then
    raise exception 'Bitte die Person zuerst deaktivieren. Erst danach lässt sie sich endgültig löschen.';
  end if;

  -- Zugänge: am Stammsatz hängend, dazu eine verwaiste Anmeldung derselben
  -- Adresse ohne Stammsatz (Rest aus früheren Löschungen).
  select coalesce(array_agg(p.id), '{}') into zugaenge
    from profiles p
   where p.company_id = v_firma
     and (p.employee_id = e.id
          or (p.employee_id is null and e.email is not null
              and lower(p.email) = lower(e.email)));

  if auth.uid() = any(zugaenge) then
    raise exception 'Du kannst dich nicht selbst löschen.';
  end if;

  select coalesce(array_agg(r.id), '{}') into antraege
    from leave_requests r where r.employee_id = e.id;

  -- Mitteilungen an die Führung zu ihren Anträgen tragen ihren Namen.
  delete from notifications n
   where n.company_id = v_firma and n.related_id = any(antraege);
  delete from email_outbox o
   where o.company_id = v_firma
     and (o.related_id = any(antraege)
          or (e.email is not null and lower(o.empfaenger) = lower(e.email)));

  -- Ersatzanfragen wegen ihres Ausfalls (die Spalte würde sonst nur geleert).
  delete from replacement_requests
   where company_id = v_firma and absent_employee_id = e.id;

  -- Stammsatz: Anträge, Abwesenheiten, Zuordnungen, Konten, Qualifikationen,
  -- Ausbildung, AF-Freigaben und eigene Mitteilungen gehen per CASCADE mit.
  delete from employees where id = e.id;

  -- Zugang: Profil, Datenschutz-Einstellungen und Geburtsdatum per CASCADE.
  delete from auth.users u where u.id = any(zugaenge);
  get diagnostics n_zugang = row_count;
  delete from profiles where id = any(zugaenge);

  perform write_audit(v_firma, 'employee.deleted', 'employees', e.id,
                      jsonb_build_object('vollstaendig', true, 'zugaenge', n_zugang));

  return jsonb_build_object('zugaenge', n_zugang);
end;
$$;

revoke all on function public.mitarbeiter_endgueltig_loeschen(uuid) from public, anon;
grant execute on function public.mitarbeiter_endgueltig_loeschen(uuid) to authenticated;

-- 2) Altersfreizeit 0,82 Std. je Schicht ---------------------------------

create or replace function public.stundenkonto(p_employee_id uuid, p_art text, p_ohne_antrag uuid default null::uuid)
 returns table(stichtag date, start_stunden numeric, arbeitstage integer, angespart numeric, genommen numeric, beantragt numeric, verplant numeric, stand_heute numeric, noch_moeglich numeric, rest_stunden numeric, satz numeric, kosten numeric)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  e employees;
  ab date;
  v_start numeric;
  v_satz numeric;
  v_kosten numeric;
  v_art leave_kind;
  n int;
  gen numeric;
  plan numeric;
  bea numeric;
  stand numeric;
  frei numeric;
  moeglich numeric;
begin
  select * into e from employees where id = p_employee_id;
  if p_art = 'af' then
    ab := e.af_ab; v_start := e.af_start_stunden; v_satz := 0.82; v_kosten := 8; v_art := 'altersfreizeit';
  elsif p_art = 'v' then
    ab := e.v_ab; v_start := e.v_start_stunden; v_satz := 0.75; v_kosten := 7.5; v_art := 'v_tag';
  else
    raise exception 'Unbekanntes Konto.';
  end if;

  if e.id is null or ab is null then
    return query select null::date, 0::numeric, 0, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
                        0::numeric, 0::numeric, 0::numeric, v_satz, v_kosten;
    return;
  end if;

  select count(*) into n
    from generate_series(ab + 1, current_date - 1, interval '1 day') g
   where is_planned_workday(e.id, g::date)
     and not exists (select 1 from absences a
                      where a.employee_id = e.id and a.date = g::date)
     and not exists (select 1 from leave_requests r
                      where r.employee_id = e.id
                        and r.status = 'approved'
                        and g::date between r.start_date and r.end_date);

  with tage as (
    select d::date as tag,
           r.status,
           case when r.half_day_period is not null then 0.5 else 1 end as gewicht
      from leave_requests r
      cross join lateral generate_series(greatest(r.start_date, ab + 1), r.end_date, interval '1 day') d
     where r.employee_id = e.id
       and r.kind = v_art
       and r.status in ('approved', 'pending')
       and r.end_date > ab
       and r.id is distinct from p_ohne_antrag
       and is_planned_workday(e.id, d::date)
    union all
    select a.date, 'approved'::leave_status, 1
      from absences a
     where p_art = 'af'
       and a.employee_id = e.id
       and a.type = 'altersfreizeit'
       and a.date > ab
       and not exists (select 1 from leave_requests r
                        where r.employee_id = e.id
                          and r.kind = 'altersfreizeit'
                          and r.status in ('approved', 'pending')
                          and a.date between r.start_date and r.end_date)
  )
  select coalesce(sum(gewicht) filter (where status = 'approved' and tag < current_date), 0),
         coalesce(sum(gewicht) filter (where status = 'pending' or tag >= current_date), 0),
         coalesce(sum(gewicht) filter (where status = 'pending'), 0)
    into gen, plan, bea
    from tage;

  stand := v_start + round(n * v_satz, 2) - v_kosten * gen;
  frei := stand - v_kosten * plan;
  moeglich := floor(frei / v_kosten);

  return query select ab, v_start, n, round(n * v_satz, 2), gen, bea, plan,
                      stand, moeglich, round(frei - v_kosten * moeglich, 2), v_satz, v_kosten;
end;
$function$;

-- 3) Nächster Urlaub mit Sonderurlaub ------------------------------------

create or replace function public.mein_naechster_urlaub()
 returns table(von date, bis date, tage numeric, kalendertage integer, arten text[], offen boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  r record;
  b_von date;
  b_bis date;
  b_tage numeric := 0;
  b_arten text[] := '{}';
  b_offen boolean := false;
  luecke_frei boolean;
begin
  if me is null then
    return;
  end if;

  for r in
    select x.start_date, x.end_date, x.tage, x.art, x.status
      from (
        select lr.start_date, lr.end_date, lr.requested_days as tage,
               lr.kind::text as art, lr.status
          from leave_requests lr
         where lr.employee_id = me
           and lr.status in ('approved', 'pending')
           and lr.end_date >= current_date
        union all
        -- Sonderurlaub (und andere freie Tage mit Konto) als Abwesenheit
        select a.date, a.date, 1::numeric, a.type::text, 'approved'::leave_status
          from absences a
         where a.employee_id = me
           and a.type in ('sonderurlaub', 'altersfreizeit', 'bildungsurlaub')
           and a.date >= current_date
           and not exists (select 1 from leave_requests lr
                            where lr.employee_id = me
                              and lr.status in ('approved', 'pending')
                              and a.date between lr.start_date and lr.end_date)
      ) x
     order by x.start_date
  loop
    if b_von is null then
      b_von := r.start_date;
      b_bis := r.end_date;
    else
      if r.start_date > b_bis + 1 then
        select not exists (
          select 1 from generate_series(b_bis + 1, r.start_date - 1, interval '1 day') g
           where is_planned_workday(me, g::date)
        ) into luecke_frei;
        exit when not luecke_frei;
      end if;
      b_bis := greatest(b_bis, r.end_date);
    end if;
    b_tage := b_tage + coalesce(r.tage, 0);
    if not (r.art = any(b_arten)) then
      b_arten := b_arten || r.art;
    end if;
    b_offen := b_offen or r.status = 'pending';
  end loop;

  if b_von is null then
    return;
  end if;

  return query select b_von, b_bis, b_tage, (b_bis - b_von + 1)::int, b_arten, b_offen;
end;
$function$;

-- 4) Eingetragene Schicht gilt an jedem Wochentag ------------------------

create or replace function public.schicht_laeuft_fuer(
  p_employee_id uuid, p_date date, p_shift shifts, p_work_on_holidays boolean default null)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from shift_assignments sa
                  where sa.employee_id = p_employee_id
                    and sa.date = p_date
                    and sa.shift_id = p_shift.id)
      or case when p_work_on_holidays is null
              then shift_runs_on(p_shift, p_date)
              else shift_runs_on(p_shift, p_date, p_work_on_holidays) end;
$$;

revoke all on function public.schicht_laeuft_fuer(uuid, date, shifts, boolean) from public, anon;

create or replace function public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
 returns table(employee_id uuid, employee_name text, rotation_team text, personnel_number text, day date, shift_name text, shift_code text, absence_code text, is_me boolean, is_apprentice boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
  freigabe boolean := gruende_fuer_kollegen_erlaubt();
  feiertage_arbeiten boolean;
  bis date := p_from + (p_days - 1);
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team
  from public.employees e
  where e.id = me and e.company_id = p_company_id;

  select coalesce(cs.work_on_holidays, true) into feiertage_arbeiten
  from public.company_settings cs where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  with sichtbar as (
    -- Alle aktiven Personen des Unternehmens im Zeitraum. Den Grund einer
    -- Abwesenheit sehen Kollegen nur, wenn der Betrieb es erlaubt, die
    -- Person ihn freigegeben hat und sie in derselben Schichtgruppe ist.
    select e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
           e.personnel_number, e.sort_order, e.is_apprentice,
           freigabe
             and coalesce(bool_or(ps.absence_visibility = 'shift'), false)
             and mein_team is not null and e.rotation_team = mein_team as grund_frei,
           freigabe
             and coalesce(bool_or(ps.sickness_visibility = 'shift'), false)
             and mein_team is not null and e.rotation_team = mein_team as krank_frei
    from public.employees e
    left join public.profiles sp
      on sp.employee_id = e.id and sp.company_id = p_company_id
    left join public.privacy_settings ps
      on ps.user_id = sp.id and ps.company_id = p_company_id
    where e.company_id = p_company_id
      and e.active
      and (e.entry_date is null or e.entry_date <= bis)
      and (e.exit_date is null or e.exit_date >= p_from)
    group by e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
             e.personnel_number, e.sort_order, e.is_apprentice
  ),
  abw as (
    select a.employee_id as emp, a.date as tag,
           bool_or(a.type = 'krank') as krank,
           bool_or(a.type = 'schulung') as schulung,
           case
             when bool_or(a.type = 'altersfreizeit') then 'AF'
             when bool_or(a.type = 'sonderurlaub') then 'SU'
             when bool_or(a.type = 'bildungsurlaub') then 'BU'
             else 'A'
           end as art_code
    from public.absences a
    join sichtbar x on x.id = a.employee_id
    where a.date between p_from and bis
    group by a.employee_id, a.date
  ),
  frei as (
    select r.employee_id as emp, d::date as tag,
           (array_agg(r.kind order by (r.status = 'approved') desc, r.kind))[1] as art,
           bool_or(r.status = 'approved') as genehmigt
    from public.leave_requests r
    join sichtbar x on x.id = r.employee_id
    cross join lateral generate_series(
      greatest(r.start_date, p_from), least(r.end_date, bis), interval '1 day'
    ) d
    where r.status in ('approved', 'pending')
      and r.start_date <= bis and r.end_date >= p_from
    group by r.employee_id, d::date
  )
  select
    e.id,
    e.first_name || ' ' || e.last_name,
    case when e.shift_worker then e.rotation_team::text else null end,
    case when fuehrung then e.personnel_number else null end,
    gs.day::date,
    s.name,
    case
      when s.name ilike 'Früh%' then 'F'
      when s.name ilike 'Spät%' then 'S'
      when s.name ilike 'Nacht%' then 'N'
      when s.name is not null then upper(left(s.name, 1))
      else null
    end,
    case
      when e.id = me then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then a.art_code
          when f.art is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      when fuehrung then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then a.art_code
          when f.art is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      else
        -- Kollegen: ohne Freigabe des Grundes bleibt es "A".
        case
          when coalesce(a.krank, false) then
            case when e.krank_frei then 'K' else 'A' end
          when a.tag is not null then
            case when e.grund_frei
                 then case when coalesce(a.schulung, false) then 'FB' else a.art_code end
                 else 'A' end
          -- Offen beantragt ist nicht abwesend: ohne Freigabe steht dann
          -- nichts da.
          when f.art is not null then
            case when e.grund_frei then leave_kind_code(f.art, f.genehmigt)
                 when f.genehmigt then 'A'
                 else null end
          else null
        end
    end,
    (e.id = me),
    coalesce(e.is_apprentice, false)
  from sichtbar e
  cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  left join abw  a on a.emp = e.id and a.tag = gs.day::date
  left join frei f on f.emp = e.id and f.tag = gs.day::date
  left join public.shifts s
    on s.id = effective_shift_id(e.id, gs.day::date)
   -- Ausdrücklich eingetragen gilt immer, auch am Wochenende (z. B.
   -- Tagschicht am Samstag). Nur die Rotation richtet sich nach den
   -- Wochentagen der Schicht.
   and schicht_laeuft_fuer(e.id, gs.day::date, s, feiertage_arbeiten)
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, e.id, gs.day;
end;
$function$;

revoke all on function public.shift_plan_grid(uuid, date, integer) from public, anon;
grant execute on function public.shift_plan_grid(uuid, date, integer) to authenticated, service_role;

create or replace function public.calculate_leave_days_for_employee(p_employee_id uuid, p_start_date date, p_end_date date, p_half_day_period half_day_period)
 returns numeric
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  emp employees;
  d date;
  s shifts;
  day_shift uuid;
  counted int := 0;
begin
  select * into emp
    from employees
   where id = p_employee_id
     and company_id = auth_company_id();

  if emp.id is null then
    return 0;
  end if;

  if p_end_date < p_start_date or p_end_date - p_start_date > 366 then
    raise exception 'Ungültiger Zeitraum.';
  end if;

  if not emp.shift_worker
     or (emp.shift_id is null and emp.rotation_pattern_id is null) then
    select count(*) into counted
      from generate_series(p_start_date, p_end_date, interval '1 day') as day
     where extract(isodow from day) < 6
       and is_employed_on(p_employee_id, day::date)
       and not exists (
         select 1
           from holidays h
          where h.date = day::date
            and (h.company_id = emp.company_id or h.company_id is null)
       );
  else
    d := p_start_date;
    while d <= p_end_date loop
      day_shift := effective_shift_id(p_employee_id, d);
      if day_shift is not null then
        select * into s
          from shifts
         where id = day_shift
           and company_id = emp.company_id;
        if s.id is not null and schicht_laeuft_fuer(p_employee_id, d, s) then
          counted := counted + 1;
        end if;
      end if;
      d := d + 1;
    end loop;
  end if;

  if p_half_day_period is not null and counted = 1 then
    return 0.5;
  end if;

  return counted::numeric(4,1);
end;
$function$;

create or replace function public.check_leave_staffing_impact(p_employee_id uuid, p_start_date date, p_end_date date)
 returns table(date date, present integer, target smallint, minimum smallint, status staffing_status)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  e employees; s shifts; d date; day_shift uuid;
  planned int; absent int; adjusted_present int; already_counted boolean;
  zaehlt boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  zaehlt := zaehlt_zur_besetzung(e);

  d := p_start_date;
  while d <= p_end_date loop
    day_shift := effective_shift_id(p_employee_id, d);
    if day_shift is not null then
      select * into s from shifts where id = day_shift;
      if s.id is not null and s.target_staff > 0 and schicht_laeuft_fuer(p_employee_id, d, s) then
        select count(*) into planned from employees emp
        where emp.active and emp.company_id = e.company_id
          and zaehlt_zur_besetzung(emp)
          and effective_shift_id(emp.id, d) = day_shift;
        select count(*) into absent from employees emp
        where emp.active and emp.company_id = e.company_id
          and zaehlt_zur_besetzung(emp)
          and effective_shift_id(emp.id, d) = day_shift
          and emp.id in (select employee_id from employees_absent_on(d, true));
        select exists(select 1 from employees_absent_on(d, true) a where a.employee_id = p_employee_id)
          into already_counted;
        adjusted_present := planned - absent
          - case when already_counted or not zaehlt then 0 else 1 end;
        return query select d, adjusted_present, s.target_staff, s.minimum_staff,
          case when adjusted_present < s.minimum_staff then 'critical'::staffing_status
               when adjusted_present < s.target_staff then 'warn'::staffing_status
               else 'ok'::staffing_status end;
      end if;
    end if;
    d := d + 1;
  end loop;
end;
$function$;
