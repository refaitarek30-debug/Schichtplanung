-- =============================================================
-- 0224 · Berufsschule als eigene Abwesenheit
--
-- 1. Neue Art „berufsschule“. Im Plan steht sie als „BS“.
-- 2. Eintragen dürfen:
--    * Schichtleitung und Administration über create_absence_range
--      (wie Schulung: jeder Tag, an dem die Person beschäftigt ist,
--      auch freie Tage laut Muster),
--    * Auszubildende selbst über berufsschule_selbst() – nur für sich,
--      nur diese Art, auch als Serie (z. B. jeden Montag).
-- 3. shift_plan_grid zeigt „BS“. Sichtbarkeit wie die anderen Gründe:
--    die Person selbst und die Führung immer, Kollegen nur mit Freigabe.
-- =============================================================

alter type public.absence_type add value if not exists 'berufsschule';

-- ---- Führung: Zeitraum eintragen (wie 0198, Berufsschule wie Schulung) ----
create or replace function public.create_absence_range(
  p_employee_id uuid,
  p_from date,
  p_to date,
  p_type absence_type,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    if p_type::text in ('schulung', 'berufsschule') then
      -- Schulung und Berufsschule: auch freie Tage, solange die Person beschäftigt ist.
      continue when not is_employed_on(e, d);
    else
      continue when not is_planned_workday(p_employee_id, d);
    end if;

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
    if p_type::text in ('schulung', 'berufsschule') then
      raise exception 'In diesem Zeitraum ist schon alles eingetragen oder die Person ist nicht beschäftigt.';
    end if;
    raise exception 'In diesem Zeitraum gibt es keinen eingeplanten Arbeitstag ohne bestehenden Eintrag.';
  end if;

  return v_count;
end;
$function$;

-- ---- Azubi: Berufsschule selbst eintragen oder entfernen ----
-- p_wochentage: ISO-Wochentage (1 = Montag … 7 = Sonntag); leer = jeder Tag.
create or replace function public.berufsschule_selbst(
  p_von date,
  p_bis date,
  p_wochentage int[] default null,
  p_entfernen boolean default false
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e employees;
  v_count int := 0;
  d date;
begin
  select * into e from employees where id = auth_employee_id();
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Kein Mitarbeiterkonto.';
  end if;
  if not coalesce(e.is_apprentice, false) then
    raise exception 'Berufsschule tragen nur Auszubildende selbst ein.';
  end if;
  if p_von is null or p_bis is null or p_bis < p_von then
    raise exception 'Bitte Beginn und Ende angeben.';
  end if;
  if p_bis - p_von > 366 then
    raise exception 'Der Zeitraum ist zu lang.';
  end if;

  if p_entfernen then
    delete from absences a
     where a.employee_id = e.id
       and a.type::text = 'berufsschule'
       and a.date between p_von and p_bis
       and (p_wochentage is null or extract(isodow from a.date)::int = any(p_wochentage));
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  for d in select g::date from generate_series(p_von, p_bis, '1 day') g loop
    continue when p_wochentage is not null and not (extract(isodow from d)::int = any(p_wochentage));
    continue when not is_employed_on(e, d);
    insert into absences (company_id, employee_id, date, type, note)
    values (e.company_id, e.id, d, 'berufsschule'::absence_type, null)
    on conflict (employee_id, date, type) do nothing;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.berufsschule_selbst(date, date, int[], boolean) from public, anon;
grant execute on function public.berufsschule_selbst(date, date, int[], boolean) to authenticated;

-- ---- Schichtplan: „BS“ für Berufsschule ----
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
  zelle as (
    select e.id as emp, gs.day::date as tag,
           sa.employee_id is not null as zugewiesen,
           case
             when not ((e.entry_date is null or gs.day::date >= e.entry_date)
                   and (e.exit_date is null or gs.day::date <= e.exit_date)) then null
             when sa.employee_id is not null then sa.shift_id
             when e.shift_worker and e.rotation_pattern_id is not null then (
               select m.shift_id
                 from muster m
                where m.id = e.rotation_pattern_id
                  and m.zyklus > 0
                  and (((gs.day::date - m.anchor_date - e.rotation_offset_days) % m.zyklus) + m.zyklus) % m.zyklus < m.bis_pos
                order by m.ord
                limit 1)
             else e.shift_id
           end as schicht
      from sichtbar e
      cross join generate_series(p_from, bis, interval '1 day') as gs(day)
      left join public.shift_assignments sa
        on sa.employee_id = e.id and sa.date = gs.day::date
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
    case when e.shift_worker then e.rotation_team::text else null end,
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
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, e.id, z.tag;
end;
$function$;
