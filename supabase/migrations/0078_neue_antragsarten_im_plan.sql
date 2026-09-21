-- Neue Antragsarten: Anzeige, Entscheidung und Auswertung.
--
-- Baut auf 0076 auf. Die vier neuen Arten sind jetzt überall sichtbar und
-- werden richtig verbucht.
--
-- Kürzel im Plan, nach Absprache:
--   AF  Altersfreizeit      SU  Sonderurlaub
--   BU  Bildungsurlaub      G   Gewerkschaftstag
--
-- Kleingeschrieben heisst "beantragt", genau wie bei u und v. "A" behält
-- seine Bedeutung: abwesend, Grund nicht freigegeben. Altersfreizeit
-- bekommt deshalb AF und nicht A -- sonst wäre nicht mehr zu unterscheiden,
-- ob jemand Altersfreizeit hat oder nur seinen Grund nicht freigibt.

-- ---------------------------------------------------------------------------
-- 1) Ein Kürzel je Art, an einer Stelle
-- ---------------------------------------------------------------------------
create or replace function public.leave_kind_code(p_kind leave_kind, p_genehmigt boolean)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'urlaub'           then case when p_genehmigt then 'U'  else 'u'  end
    when 'v_tag'            then case when p_genehmigt then 'V'  else 'v'  end
    when 'altersfreizeit'   then case when p_genehmigt then 'AF' else 'af' end
    when 'sonderurlaub'     then case when p_genehmigt then 'SU' else 'su' end
    when 'bildungsurlaub'   then case when p_genehmigt then 'BU' else 'bu' end
    when 'gewerkschaftstag' then case when p_genehmigt then 'G'  else 'g'  end
  end;
$$;

comment on function public.leave_kind_code(leave_kind, boolean) is
  'Kuerzel fuer den Schichtplan. Grossbuchstaben = genehmigt, klein = beantragt.';

revoke all on function public.leave_kind_code(leave_kind, boolean) from public, anon;
grant execute on function public.leave_kind_code(leave_kind, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Der Plan kennt die neuen Arten
-- ---------------------------------------------------------------------------
create or replace function public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
returns table (
  employee_id uuid, employee_name text, rotation_team text, personnel_number text,
  day date, shift_name text, shift_code text, absence_code text, is_me boolean
)
language plpgsql
stable
security definer
set search_path = public
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

  select e.rotation_team into mein_team
  from public.employees e
  where e.id = me and e.company_id = p_company_id;

  select coalesce(cs.work_on_holidays, true) into feiertage_arbeiten
  from public.company_settings cs where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  with sichtbar as (
    -- Wer ist überhaupt zu sehen, und hat diese Person ihrer Schicht etwas
    -- freigegeben? Beides einmal je Person, nicht einmal je Tag.
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
    select a.employee_id as emp, a.date as tag,
           bool_or(a.type = 'krank') as krank,
           bool_or(a.type = 'schulung') as schulung
    from public.absences a
    join sichtbar x on x.id = a.employee_id
    where a.date between p_from and bis
    group by a.employee_id, a.date
  ),
  frei as (
    -- Urlaubszeiträume auf Tage aufgelöst, einmal für den ganzen Zeitraum.
    -- Statt vier Wahrheitswerten wird jetzt die Art selbst mitgeführt, sonst
    -- bräuchte jede neue Antragsart zwei weitere Spalten.
    --
    -- Zwei Anträge am selben Tag verhindert leave_requests_check_overlap();
    -- käme es dennoch dazu, gewinnt der genehmigte Eintrag.
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
          when a.tag is not null then 'A'
          when f.art is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      when fuehrung then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then 'A'
          when f.art is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      else
        -- Ohne Freigabe steht hier nur "A". Die Reihenfolge ist dieselbe wie
        -- vorher, damit sich am Angezeigten nichts verschiebt.
        case
          when coalesce(a.krank, false) then
            case when e.krank_frei then 'K' else 'A' end
          when a.tag is not null then
            case when e.grund_frei
                 then case when coalesce(a.schulung, false) then 'FB' else 'A' end
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
$$;

revoke all on function public.shift_plan_grid(uuid, date, int) from public, anon;
grant execute on function public.shift_plan_grid(uuid, date, int) to authenticated;
