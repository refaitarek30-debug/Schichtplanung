-- Altersfreizeit, Sonderurlaub und Bildungsurlaub aus dem Import zeigen.
--
-- Die aus dem Schichtplan 2026 übernommenen Tage stehen als Abwesenheit
-- (absences.type) in der Datenbank, nicht als Antrag. shift_plan_grid
-- wertete bei Abwesenheiten aber nur krank und Schulung aus; alles andere
-- wurde pauschal zu "A". Dadurch standen 28 Altersfreizeit-, 9
-- Sonderurlaubs- und 2 Bildungsurlaubstage als "A" im Plan.
--
-- Jetzt bekommen sie ihr eigenes Kürzel (AF, SU, BU) -- dasselbe wie bei
-- einem Antrag dieser Art. Die Sichtbarkeitsregel bleibt unverändert:
-- Kollegen ohne Freigabe des Grundes sehen weiterhin nur "A".
--
-- Vor dem Einspielen verglichen: das ganze Jahr 2026, aus Sicht von Admin,
-- Schichtleitung und Mitarbeiter. Geändert haben sich ausschliesslich
-- Zellen von "A" zu AF/SU/BU (Admin 38, Schichtleitung 38, Mitarbeiter 21),
-- keine einzige andere Zelle.
create or replace function public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
 returns table(employee_id uuid, employee_name text, rotation_team text, personnel_number text, day date, shift_name text, shift_code text, absence_code text, is_me boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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

  select e.rotation_team into mein_team
  from public.employees e
  where e.id = me and e.company_id = p_company_id;

  select coalesce(cs.work_on_holidays, true) into feiertage_arbeiten
  from public.company_settings cs where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  with sichtbar as (
    select e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
           e.personnel_number, e.sort_order,
           coalesce(bool_or(ps.absence_visibility = 'shift'), false)
             and mein_team is not null and e.rotation_team = mein_team as grund_frei,
           coalesce(bool_or(ps.sickness_visibility = 'shift'), false)
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
      and (fuehrung or e.id = me or (mein_team is not null and e.rotation_team = mein_team))
    group by e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
             e.personnel_number, e.sort_order
  ),
  abw as (
    -- Neben krank und Schulung wird jetzt auch die Art der übrigen
    -- Abwesenheiten mitgeführt. Vorher wurde alles andere pauschal zu "A" --
    -- auch die aus dem Schichtplan 2026 übernommenen Altersfreizeit-,
    -- Sonderurlaubs- und Bildungsurlaubstage, die als Abwesenheit und nicht
    -- als Antrag gespeichert sind.
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
        -- Kollegen: unverändert. Ohne Freigabe des Grundes bleibt es "A".
        case
          when coalesce(a.krank, false) then
            case when e.krank_frei then 'K' else 'A' end
          when a.tag is not null then
            case when e.grund_frei
                 then case when coalesce(a.schulung, false) then 'FB' else a.art_code end
                 else 'A' end
          when f.art is not null then
            case when e.grund_frei then leave_kind_code(f.art, f.genehmigt) else 'A' end
          else null
        end
    end,
    (e.id = me)
  from sichtbar e
  cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  left join abw  a on a.emp = e.id and a.tag = gs.day::date
  left join frei f on f.emp = e.id and f.tag = gs.day::date
  left join public.shifts s
    on s.id = effective_shift_id(e.id, gs.day::date)
   and shift_runs_on(s, gs.day::date, feiertage_arbeiten)
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, e.id, gs.day;
end;
$function$;
