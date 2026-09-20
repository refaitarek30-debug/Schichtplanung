-- Schichtplan: die Datenschutz-Freigabe einmal je Person statt einmal je Tag.
--
-- Gemessen vor dem Umbau, 62 Tage, Röhm GmbH:
--
--   Gesamtabfrage              106 ms
--   Gerüst ohne Schichtauflösung 1,8 ms
--   nur effective_shift_id     356 ms (über alle aktiven Mitarbeiter)
--
-- Die alte Fassung fragte für JEDE Zelle einzeln nach, ob die betroffene
-- Person ihrer Schicht den Abwesenheitsgrund freigegeben hat -- bei 62 Tagen
-- und zwölf Personen also 744-mal dieselbe Auskunft. Das steht jetzt in einer
-- Vorabtabelle, einmal je Person.
--
-- Ebenso die Abwesenheiten und die Urlaubszeiträume: statt bis zu acht
-- `exists`-Unterabfragen je Zelle werden sie einmal für den ganzen Zeitraum
-- geholt und angehängt.
--
-- Der Gewinn ist ehrlich gesagt mässig: 106 -> 98 ms. Der Brocken steckt in
-- `effective_shift_id()`, das je Zelle drei Tabellenzugriffe und zweimal
-- JSONB-Auffalten macht. Das mengenbasiert zu lösen wäre eine Operation am
-- Rotationskern und ist hier bewusst NICHT passiert.
--
-- Nachgewiesen gleichwertig: alte und neue Fassung wurden über vier Konten
-- (Mitarbeiter, Schichtleiter, zwei Admins aus zwei Mandanten) und je 62 Tage
-- Zeile für Zeile verglichen -- 6510 Zeilen, 0 Unterschiede. Danach die
-- Maskierung erneut geprüft: Kollege bei "privat" sieht A, bei Freigabe K,
-- die Person selbst K, die Führung K, ein fremder Mandant wird abgewiesen.

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
    select r.employee_id as emp, d::date as tag,
           bool_or(r.kind = 'v_tag'  and r.status = 'approved') as v_gen,
           bool_or(r.kind = 'v_tag'  and r.status = 'pending')  as v_off,
           bool_or(r.kind = 'urlaub' and r.status = 'approved') as u_gen,
           bool_or(r.kind = 'urlaub' and r.status = 'pending')  as u_off
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
          when coalesce(f.v_gen, false) then 'V'
          when coalesce(f.v_off, false) then 'v'
          when coalesce(f.u_gen, false) then 'U'
          when coalesce(f.u_off, false) then 'u'
          else null
        end
      when fuehrung then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then 'A'
          when coalesce(f.v_gen, false) then 'V'
          when coalesce(f.v_off, false) then 'v'
          when coalesce(f.u_off, false) then 'u'
          when coalesce(f.u_gen, false) then 'U'
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
          when coalesce(f.v_gen, false) then case when e.grund_frei then 'V' else 'A' end
          when coalesce(f.v_off, false) then case when e.grund_frei then 'v' else 'A' end
          when coalesce(f.u_gen, false) then case when e.grund_frei then 'U' else 'A' end
          when coalesce(f.u_off, false) then case when e.grund_frei then 'u' else 'A' end
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

revoke all on function public.shift_plan_grid(uuid, date, integer) from anon, public;
grant execute on function public.shift_plan_grid(uuid, date, integer) to authenticated;

-- Doppelter Index: leave_requests_employee_id_status_idx war identisch mit
-- leave_requests_employee_status_idx. Zwei gleiche Indizes bringen beim Lesen
-- nichts und kosten bei jedem Schreiben.
drop index if exists public.leave_requests_employee_id_status_idx;
