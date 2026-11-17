-- =============================================================
-- 0232 · VJ/V von Hand, 4er-Regel, Gruppenwechsel ab Datum
--
-- 1. VJ/V überall:
--    - split_leave_request_day(): beim Herauslösen eines Tages bleibt die
--      VJ/V-Kennzeichnung der Reststücke erhalten.
--    - set_leave_for_day(): neue Arten 'vj' (VJ-Tag) und 'v' (V-Tag,
--      widerrufbar) – die Leitung legt fest, was es ist.
--    - vj_umstellen(): Leitung stellt einen V-Tag-Antrag auf VJ oder V um.
--    - vj_stand(): VJ-Kontingent, davon belegt, Rest (für die Kacheln).
--    - preview_leave_auto(): Vorschau sagt je Tag auch VJ oder V.
-- 2. 4er-Regel (Vorgabe 2027, nur Hinweis): je Schichtgruppe und Tag
--    höchstens 4 mit Urlaub/VJ/V; sind es 4, muss einer davon V sein.
--    vierer_regel_tage() liefert dafür je Tag die anderen Abwesenden.
-- 3. Gruppenwechsel ab Datum (z. B. ab 01.01.2027 von A nach B):
--    Tabelle employee_gruppenwechsel. Bis zum Datum gilt die alte Gruppe,
--    ab dem Datum die neue – im Plan, in der Rotation und bei der 4er-Regel.
--    Am Tag selbst stellt ein stündlicher Job die Gruppe im Stammsatz um.
-- =============================================================

-- ---------- 1. VJ/V ----------------------------------------------------------

create or replace function public.split_leave_request_day(r leave_requests, p_date date, p_kind leave_kind)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  head_from date := r.start_date;
  head_to   date := p_date - 1;
  tail_from date := p_date + 1;
  tail_to   date := r.end_date;
begin
  -- Teil VOR dem Tag: kuerzen, wenn dort noch ein Arbeitstag liegt, sonst weg.
  if head_to >= head_from
     and calculate_leave_days_for_employee(r.employee_id, head_from, head_to, null) > 0 then
    update leave_requests
       set end_date = head_to, half_day_period = null
     where id = r.id;
  else
    delete from leave_requests where id = r.id;
  end if;

  -- Teil NACH dem Tag als eigener Antrag, gleiche Art, gleicher Status, gleiche VJ/V-Kennzeichnung.
  if tail_to >= tail_from
     and calculate_leave_days_for_employee(r.employee_id, tail_from, tail_to, null) > 0 then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at, requested_days, v_jahresplanung, request_group_id
    )
    values (
      r.company_id, r.employee_id, tail_from, tail_to, r.status, r.kind,
      r.reason, r.reviewed_by, r.reviewed_at, 0, r.v_jahresplanung, r.request_group_id
    );
  end if;

  -- Der herausgeloeste Tag in der gewuenschten Art. p_kind null = entfernen.
  if p_kind is not null then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at, requested_days, v_jahresplanung
    )
    values (
      r.company_id, r.employee_id, p_date, p_date, 'approved', p_kind,
      'Direkt im Schichtplan geaendert', auth.uid(), now(), 0,
      case when p_kind = 'v_tag' and r.kind = 'v_tag' then r.v_jahresplanung end
    );
  end if;
end;
$function$;

/**
 * Tag im Plan setzen (Leitung). Neu: p_mode 'vj' = VJ-Tag, 'v' = V-Tag
 * (widerrufbar). 'v_tag' wie bisher = VJ, solange das Kontingent reicht.
 */
create or replace function public.set_leave_for_day(p_employee_id uuid, p_date date, p_mode text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e employees;
  r leave_requests;
  target leave_kind;
  vj boolean;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration duerfen das.';
  end if;
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not darf_urlaub_entscheiden(p_employee_id) then
    raise exception 'Urlaub eintragen darfst du nur für deine eigene Schicht.';
  end if;

  select * into r
    from leave_requests
   where employee_id = p_employee_id
     and status in ('approved', 'pending')
     and p_date between start_date and end_date
   order by start_date
   limit 1;

  if p_mode = 'clear' then
    if r.id is null then return; end if;
    perform split_leave_request_day(r, p_date, null);
    insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
    values (
      e.company_id, auth.uid(), 'leave.day_removed', 'leave_requests', r.id,
      jsonb_build_object('tag', p_date, 'kind', r.kind, 'status', r.status)
    );
    perform benachrichtige_ruecknahme(
      r.id, p_employee_id, leave_kind_label(r.kind), p_date, p_date, r.status = 'approved', null
    );
    return;
  end if;

  -- VJ/V nur ab 2027; davor ist ein V-Tag einfach ein V-Tag.
  vj := case when p_mode = 'vj' and extract(year from p_date) >= 2027 then true
             when p_mode = 'v'  and extract(year from p_date) >= 2027 then false
             else null end;
  target := case
    when p_mode in ('vj', 'v') then 'v_tag'::leave_kind
    when p_mode in ('urlaub', 'v_tag', 'altersfreizeit', 'sonderurlaub',
                    'bildungsurlaub', 'gewerkschaftstag')
      then p_mode::leave_kind
    else 'urlaub'::leave_kind
  end;

  if r.id is null then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at, v_jahresplanung
    )
    values (
      e.company_id, p_employee_id, p_date, p_date, 'approved', target,
      'Direkt im Schichtplan eingetragen', auth.uid(), now(), vj
    );
    return;
  end if;

  if r.kind = target and (vj is null or r.v_jahresplanung is not distinct from vj) then
    return;
  end if;

  -- Nur VJ ↔ V an einem eintägigen Antrag: Kennzeichnung umstellen.
  if r.kind = target and r.start_date = r.end_date then
    update leave_requests set v_jahresplanung = vj where id = r.id;
    return;
  end if;

  perform split_leave_request_day(r, p_date, target);
  if vj is not null then
    update leave_requests set v_jahresplanung = vj
     where employee_id = p_employee_id and kind = 'v_tag' and status = 'approved'
       and start_date = p_date and end_date = p_date;
  end if;
end;
$function$;

/** Leitung: einen V-Tag-Antrag (ab 2027) auf VJ (true) oder V (false) umstellen. */
create or replace function public.vj_umstellen(p_request_id uuid, p_vj boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r leave_requests;
begin
  select * into r from leave_requests where id = p_request_id;
  if r.id is null or r.company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if not darf_urlaub_entscheiden(r.employee_id) then
    raise exception 'Das darfst du nur für deine eigene Schicht.';
  end if;
  if r.kind <> 'v_tag' or extract(year from r.start_date) < 2027 then
    raise exception 'VJ und V gibt es erst ab 2027 und nur bei V-Tagen.';
  end if;
  update leave_requests set v_jahresplanung = p_vj where id = r.id;
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (r.company_id, auth.uid(), 'leave.vj_umgestellt', 'leave_requests', r.id,
          jsonb_build_object('vj', p_vj, 'von', r.start_date, 'bis', r.end_date));
end;
$$;
revoke all on function public.vj_umstellen(uuid, boolean) from public, anon;
grant execute on function public.vj_umstellen(uuid, boolean) to authenticated;

/**
 * VJ-Stand eines Jahres: Kontingent (75 % der V-Tage, aufgerundet), davon
 * belegt (beantragt + genehmigt), Rest. Vor 2027 leer. Ohne Person = ich.
 */
create or replace function public.vj_stand(p_year integer, p_employee_id uuid default null)
returns table(kontingent numeric, belegt numeric, rest numeric, v_belegt numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  emp uuid := coalesce(p_employee_id, auth_employee_id());
begin
  if p_year < 2027 or emp is null then return; end if;
  if emp is distinct from auth_employee_id()
     and not (is_leadership() and exists (select 1 from employees e where e.id = emp and e.company_id = auth_company_id())) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  select vj_kontingent(emp, p_year),
         vj_kontingent(emp, p_year) - vj_rest(emp, p_year),
         vj_rest(emp, p_year),
         coalesce((select sum(r.requested_days) from leave_requests r
                    where r.employee_id = emp and r.kind = 'v_tag' and r.v_jahresplanung = false
                      and r.status in ('approved', 'pending')
                      and extract(year from r.start_date) = p_year), 0);
end;
$$;
revoke all on function public.vj_stand(integer, uuid) from public, anon;
grant execute on function public.vj_stand(integer, uuid) to authenticated;

-- Vorschau der automatischen Verteilung, jetzt mit VJ/V je Tag.
drop function if exists public.preview_leave_auto(date, date);
create function public.preview_leave_auto(p_start_date date, p_end_date date)
returns table(tag date, art text, grund text, vj boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  e employees;
  d date;
  k leave_kind;
  warum text;
  jahr int;
  idx int;
  jahre int[] := '{}';
  ru numeric[] := '{}';
  rv numeric[] := '{}';
  rvj numeric[] := '{}';
  ist_vj boolean;
begin
  if me is null then return; end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 366 then return; end if;

  select * into e from employees where id = me;

  for jahr in
    select distinct extract(year from g)::int
      from generate_series(p_start_date, p_end_date, '1 day') g
     order by 1
  loop
    perform ensure_leave_balance(me, jahr);
    jahre := jahre || jahr;
    ru := ru || coalesce(
      (select remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || v_tage_rest(me, jahr);
    rvj := rvj || case when jahr >= 2027 then vj_rest(me, jahr) else 0 end;
  end loop;

  for d in select g::date from generate_series(p_start_date, p_end_date, '1 day') g loop
    continue when not is_planned_workday(me, d);
    continue when exists (
      select 1 from leave_requests r
       where r.employee_id = me and r.status in ('approved', 'pending')
         and d between r.start_date and r.end_date
    );

    idx := array_position(jahre, extract(year from d)::int);

    if not e.shift_worker then
      k := 'urlaub'; warum := 'kein Schichtsystem';
    elsif exists (select 1 from holidays h where h.date = d
                    and (h.company_id = e.company_id or h.company_id is null)) then
      k := 'urlaub'; warum := 'Feiertag';
    elsif extract(dow from d) = 0 then
      k := 'urlaub'; warum := 'Sonntag';
    elsif (select s.name from shifts s where s.id = effective_shift_id(me, d)) ilike 'Nacht%' then
      k := 'urlaub'; warum := 'Nachtschicht';
    else
      k := 'v_tag'; warum := 'kein Zuschlagstag';
    end if;

    if k = 'urlaub' and ru[idx] < 1 then
      k := 'v_tag';
      warum := case when rv[idx] >= 1 then 'Urlaub aufgebraucht' else 'Konten leer – V-Tag ins Minus' end;
    elsif k = 'v_tag' and rv[idx] < 1 and ru[idx] >= 1 then
      k := 'urlaub'; warum := 'V-Tage aufgebraucht';
    elsif k = 'v_tag' and rv[idx] < 1 then
      warum := 'Konten leer – V-Tag ins Minus';
    end if;

    ist_vj := null;
    if k = 'urlaub' then
      ru[idx] := ru[idx] - 1;
    else
      rv[idx] := rv[idx] - 1;
      if extract(year from d) >= 2027 then
        ist_vj := rvj[idx] >= 1;
        if ist_vj then rvj[idx] := rvj[idx] - 1;
        else warum := warum || ' · VJ aufgebraucht'; end if;
      end if;
    end if;

    return query select d, k::text, warum, ist_vj;
  end loop;
end;
$function$;
revoke all on function public.preview_leave_auto(date, date) from public, anon;
grant execute on function public.preview_leave_auto(date, date) to authenticated;

-- ---------- 3. Gruppenwechsel (vor der 4er-Regel, die ihn braucht) ----------

create table if not exists public.employee_gruppenwechsel (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  ab date not null,
  von_team rotation_team,
  nach_team rotation_team not null,
  vollzogen_am timestamptz,
  angelegt_von uuid default auth.uid(),
  angelegt_am timestamptz not null default now(),
  unique (employee_id, ab)
);
create index if not exists employee_gruppenwechsel_emp on public.employee_gruppenwechsel (employee_id, ab);
alter table public.employee_gruppenwechsel enable row level security;
revoke all on public.employee_gruppenwechsel from anon;
drop policy if exists "Gruppenwechsel lesen Fuehrung" on public.employee_gruppenwechsel;
create policy "Gruppenwechsel lesen Fuehrung" on public.employee_gruppenwechsel
  for select using (company_id = (select auth_company_id()) and (select is_leadership()));
grant select on public.employee_gruppenwechsel to authenticated;

/** Gruppe einer Person an einem Tag – berücksichtigt geplante Wechsel. */
create or replace function public.gruppe_am(p_employee_id uuid, p_tag date, p_jetzt rotation_team)
returns rotation_team
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select w.nach_team from employee_gruppenwechsel w
      where w.employee_id = p_employee_id and w.ab <= p_tag order by w.ab desc limit 1),
    (select w.von_team from employee_gruppenwechsel w
      where w.employee_id = p_employee_id and w.ab > p_tag order by w.ab asc limit 1),
    p_jetzt);
$$;
revoke all on function public.gruppe_am(uuid, date, rotation_team) from public, anon;
grant execute on function public.gruppe_am(uuid, date, rotation_team) to authenticated;

/** Versatz im Rotationsmuster für eine Gruppe (A = 0, B = 1 Schritt …). */
create or replace function public.gruppe_versatz(p_pattern_id uuid, p_team rotation_team)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when p_team is null then 0 else
    (array_position(array['A', 'B', 'C', 'D', 'E']::text[], p_team::text) - 1)
    * coalesce((select team_offset_days from rotation_patterns where id = p_pattern_id), 7) end;
$$;

create or replace function public.rotation_shift_for(emp employees, p_date date)
returns uuid
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  pat rotation_patterns;
  cycle int := 0;
  pos int;
  acc int := 0;
  step jsonb;
  versatz int := emp.rotation_offset_days;
  team rotation_team;
begin
  if emp.rotation_pattern_id is null then return null; end if;

  select * into pat from rotation_patterns where id = emp.rotation_pattern_id and active;
  if pat.id is null then return null; end if;

  -- Geplanter Gruppenwechsel: an diesem Tag gilt vielleicht eine andere Gruppe.
  if exists (select 1 from employee_gruppenwechsel w where w.employee_id = emp.id) then
    team := gruppe_am(emp.id, p_date, emp.rotation_team);
    if team is distinct from emp.rotation_team then
      versatz := gruppe_versatz(emp.rotation_pattern_id, team);
    end if;
  end if;

  for step in select * from jsonb_array_elements(pat.steps) loop
    cycle := cycle + (step ->> 'days')::int;
  end loop;
  if cycle <= 0 then return null; end if;

  pos := (((p_date - pat.anchor_date - versatz) % cycle) + cycle) % cycle;

  for step in select * from jsonb_array_elements(pat.steps) loop
    acc := acc + (step ->> 'days')::int;
    if pos < acc then
      return nullif(step ->> 'shift', '')::uuid;
    end if;
  end loop;

  return null;
end;
$function$;

/** Leitung: Gruppenwechsel ab Datum planen. Liegt das Datum heute oder früher, gilt er sofort. */
create or replace function public.gruppenwechsel_planen(p_employee_id uuid, p_ab date, p_nach_team rotation_team)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e employees;
  v_id uuid;
  v_von rotation_team;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_ab is null or p_nach_team is null then
    raise exception 'Bitte Datum und neue Gruppe angeben.';
  end if;
  v_von := gruppe_am(p_employee_id, p_ab - 1, e.rotation_team);
  if v_von is not distinct from p_nach_team then
    raise exception 'Die Person ist an dem Tag schon in Gruppe %.', p_nach_team;
  end if;
  insert into employee_gruppenwechsel (company_id, employee_id, ab, von_team, nach_team)
  values (e.company_id, p_employee_id, p_ab, v_von, p_nach_team)
  on conflict (employee_id, ab) do update set nach_team = excluded.nach_team, von_team = excluded.von_team, vollzogen_am = null
  returning id into v_id;
  -- Spätere Wechsel beginnen jetzt in der neuen Gruppe.
  update employee_gruppenwechsel w set von_team = p_nach_team
   where w.employee_id = p_employee_id
     and w.ab = (select min(x.ab) from employee_gruppenwechsel x where x.employee_id = p_employee_id and x.ab > p_ab);
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (e.company_id, auth.uid(), 'employee.gruppenwechsel_geplant', 'employees', p_employee_id,
          jsonb_build_object('ab', p_ab, 'von', v_von, 'nach', p_nach_team));
  if p_ab <= heute() then
    perform gruppenwechsel_vollziehen();
  end if;
  return v_id;
end;
$$;
revoke all on function public.gruppenwechsel_planen(uuid, date, rotation_team) from public, anon;
grant execute on function public.gruppenwechsel_planen(uuid, date, rotation_team) to authenticated;

/** Leitung: geplanten (noch nicht vollzogenen) Gruppenwechsel streichen. */
create or replace function public.gruppenwechsel_loeschen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w employee_gruppenwechsel;
begin
  select * into w from employee_gruppenwechsel where id = p_id;
  if w.id is null or w.company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if w.vollzogen_am is not null then
    raise exception 'Dieser Wechsel ist schon vollzogen. Plane stattdessen einen neuen Wechsel zurück.';
  end if;
  delete from employee_gruppenwechsel where id = p_id;
  -- Der nächste Wechsel beginnt wieder in der Gruppe davor.
  update employee_gruppenwechsel x set von_team = w.von_team
   where x.employee_id = w.employee_id
     and x.ab = (select min(y.ab) from employee_gruppenwechsel y where y.employee_id = w.employee_id and y.ab > w.ab);
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (w.company_id, auth.uid(), 'employee.gruppenwechsel_gestrichen', 'employees', w.employee_id,
          jsonb_build_object('ab', w.ab, 'nach', w.nach_team));
end;
$$;
revoke all on function public.gruppenwechsel_loeschen(uuid) from public, anon;
grant execute on function public.gruppenwechsel_loeschen(uuid) to authenticated;

/** Fällige Wechsel in den Stammsatz übernehmen (stündlich und beim Planen). */
create or replace function public.gruppenwechsel_vollziehen()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  w record;
begin
  for w in
    select distinct on (x.employee_id) x.id, x.employee_id, x.nach_team
      from employee_gruppenwechsel x
     where x.ab <= heute() and x.vollzogen_am is null
     order by x.employee_id, x.ab desc
  loop
    update employees set rotation_team = w.nach_team where id = w.employee_id;
    update employee_gruppenwechsel set vollzogen_am = now()
     where employee_id = w.employee_id and ab <= heute() and vollzogen_am is null;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.gruppenwechsel_vollziehen() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('gruppenwechsel-stuendlich');
exception when others then null;
end $$;
select cron.schedule('gruppenwechsel-stuendlich', '11 * * * *', 'select public.gruppenwechsel_vollziehen();');

-- Plan: Gruppe und Rotation je Tag (geplante Wechsel), sonst unverändert.
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
    select e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
           e.personnel_number, e.sort_order, e.is_apprentice,
           e.shift_id, e.rotation_pattern_id, e.rotation_offset_days,
           e.entry_date, e.exit_date,
           exists (select 1 from public.employee_gruppenwechsel w where w.employee_id = e.id) as wechselt,
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
             e.personnel_number, e.sort_order, e.is_apprentice,
             e.shift_id, e.rotation_pattern_id, e.rotation_offset_days,
             e.entry_date, e.exit_date
  ),
  muster as (
    select x.id, x.anchor_date, x.ord, x.shift_id,
           x.bis_pos - x.tage as von_pos, x.bis_pos, x.zyklus
      from (
        select p.id, p.anchor_date, st.ord,
               nullif(st.step ->> 'shift', '')::uuid as shift_id,
               (st.step ->> 'days')::int as tage,
               sum((st.step ->> 'days')::int) over (partition by p.id order by st.ord) as bis_pos,
               sum((st.step ->> 'days')::int) over (partition by p.id) as zyklus
          from public.rotation_patterns p
          cross join lateral jsonb_array_elements(p.steps) with ordinality as st(step, ord)
         where p.active
           and p.id in (select s.rotation_pattern_id from sichtbar s)
      ) x
  ),
  tage as (
    select e.id as emp, gs.day::date as tag,
           case when e.wechselt then gruppe_am(e.id, gs.day::date, e.rotation_team) else e.rotation_team end as team
      from sichtbar e
      cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  ),
  zelle as (
    select t.emp, t.tag, t.team,
           sa.employee_id is not null as zugewiesen,
           case
             when not ((e.entry_date is null or t.tag >= e.entry_date)
                   and (e.exit_date is null or t.tag <= e.exit_date)) then null
             when sa.employee_id is not null then sa.shift_id
             when e.shift_worker and e.rotation_pattern_id is not null then (
               select m.shift_id
                 from muster m
                where m.id = e.rotation_pattern_id
                  and m.zyklus > 0
                  and (((t.tag - m.anchor_date
                         - case when t.team is not distinct from e.rotation_team then e.rotation_offset_days
                                else gruppe_versatz(e.rotation_pattern_id, t.team) end
                        ) % m.zyklus) + m.zyklus) % m.zyklus < m.bis_pos
                order by m.ord
                limit 1)
             else e.shift_id
           end as schicht
      from tage t
      join sichtbar e on e.id = t.emp
      left join public.shift_assignments sa
        on sa.employee_id = t.emp and sa.date = t.tag
  ),
  abw as (
    select a.employee_id as emp, a.date as tag,
           bool_or(a.type = 'krank') as krank,
           bool_or(a.type = 'schulung') as schulung,
           case
             when bool_or(a.type::text = 'berufsschule') then 'BS'
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
    case when e.shift_worker then z.team::text else null end,
    case when fuehrung then e.personnel_number else null end,
    z.tag,
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
          when f.art is not null and s.id is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      when fuehrung then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then a.art_code
          when f.art is not null and s.id is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      else
        case
          when coalesce(a.krank, false) then
            case when e.krank_frei then 'K' else 'A' end
          when a.tag is not null then
            case when e.grund_frei
                 then case when coalesce(a.schulung, false) then 'FB' else a.art_code end
                 else 'A' end
          when f.art is not null and s.id is not null then
            case when e.grund_frei then leave_kind_code(f.art, f.genehmigt)
                 when f.genehmigt then 'A'
                 else null end
          else null
        end
    end,
    (e.id = me),
    coalesce(e.is_apprentice, false)
  from sichtbar e
  join zelle z on z.emp = e.id
  left join abw  a on a.emp = e.id and a.tag = z.tag
  left join frei f on f.emp = e.id and f.tag = z.tag
  left join public.shifts s
    on s.id = z.schicht
   and (
     z.zugewiesen
     or (
       extract(dow from z.tag)::int = any(s.weekdays)
       and (
         feiertage_arbeiten
         or not exists (
           select 1 from public.holidays h
            where h.date = z.tag
              and (h.company_id = s.company_id or h.company_id is null)
         )
       )
     )
   )
  order by case when e.shift_worker then
             (case when e.wechselt then gruppe_am(e.id, bis, e.rotation_team) else e.rotation_team end) end nulls last,
           e.sort_order nulls last, e.last_name, e.id, z.tag;
end;
$function$;

-- Kompakt: Gruppe = die am letzten Tag des Zeitraums (wer ab 1.1. wechselt, steht im Januar in der neuen).
create or replace function public.schichtplan_kompakt(p_company_id uuid, p_from date, p_days integer)
returns table(employee_id uuid, employee_name text, rotation_team text, personnel_number text, is_me boolean, is_apprentice boolean, tage jsonb)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select g.employee_id,
         min(g.employee_name),
         (array_agg(g.rotation_team order by g.day desc))[1],
         min(g.personnel_number),
         bool_or(g.is_me),
         bool_or(g.is_apprentice),
         jsonb_agg(jsonb_build_array(
           g.day, g.shift_name, g.shift_code, g.absence_code,
           g.absence_code in ('V', 'v') and exists (
             select 1 from public.leave_requests r
              where r.employee_id = g.employee_id
                and r.kind = 'v_tag'
                and r.v_jahresplanung
                and r.status in ('approved', 'pending')
                and g.day between r.start_date and r.end_date)
         ) order by g.day)
    from public.shift_plan_grid(p_company_id, p_from, p_days) with ordinality as g(
           employee_id, employee_name, rotation_team, personnel_number, day,
           shift_name, shift_code, absence_code, is_me, is_apprentice, nr)
   group by g.employee_id
   order by min(g.nr);
$function$;

-- ---------- 2. 4er-Regel (nur Hinweis, ab 2027) ------------------------------

/**
 * Je Tag im Zeitraum: wie viele ANDERE aus derselben Schichtgruppe haben an
 * dem Tag Urlaub, VJ oder V (beantragt oder genehmigt), und wie viele davon
 * einen V-Tag (widerrufbar). Azubis zählen nicht. Nur Tage ab 2027, an denen
 * die Person selbst eingeplant ist. p_ohne_antrag: diesen Antrag nicht mitzählen
 * (beim Genehmigen). Die App warnt daraus: mehr als 4, oder 4 ohne V.
 */
create or replace function public.vierer_regel_tage(p_employee_id uuid, p_von date, p_bis date, p_ohne_antrag uuid default null)
returns table(tag date, andere integer, andere_v integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if e.id is distinct from auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_bis < p_von or p_bis - p_von > 366 or not e.shift_worker then return; end if;

  return query
  with tage as (
    select d::date as tag, gruppe_am(e.id, d::date, e.rotation_team) as team
      from generate_series(greatest(p_von, date '2027-01-01'), p_bis, interval '1 day') d
  )
  select t.tag,
         count(distinct r.employee_id)::int,
         count(distinct r.employee_id) filter (where r.kind = 'v_tag' and r.v_jahresplanung = false)::int
    from tage t
    left join leave_requests r
      on t.tag between r.start_date and r.end_date
     and r.status in ('approved', 'pending')
     and r.kind in ('urlaub', 'v_tag')
     and r.employee_id <> e.id
     and r.id is distinct from p_ohne_antrag
     and exists (select 1 from employees o
                  where o.id = r.employee_id and o.company_id = e.company_id and o.active
                    and not coalesce(o.is_apprentice, false)
                    and gruppe_am(o.id, t.tag, o.rotation_team) is not distinct from t.team)
     and is_planned_workday(r.employee_id, t.tag)
   where t.team is not null
     and is_planned_workday(e.id, t.tag)
   group by t.tag
   order by t.tag;
end;
$$;
revoke all on function public.vierer_regel_tage(uuid, date, date, uuid) from public, anon;
grant execute on function public.vierer_regel_tage(uuid, date, date, uuid) to authenticated;
