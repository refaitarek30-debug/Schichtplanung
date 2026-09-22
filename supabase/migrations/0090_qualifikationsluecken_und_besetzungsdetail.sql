-- Welche Qualifikation wird an einem Tag knapp?
--
-- Die Anforderungen stehen seit jeher in shift_qualification_needs (je
-- Schicht und Qualifikation eine Mindestzahl). Geprüft wurden sie bisher
-- nirgends -- die Besetzungswarnung kannte nur Köpfe, nicht Fähigkeiten.
--
-- Diese Funktion beantwortet für EINE Schicht an EINEM Tag: wer ist da,
-- welche Qualifikation fehlt und wie oft. `p_zusaetzlich_abwesend` erlaubt
-- die Frage "und was wäre, wenn diese Person auch noch fehlt" -- genau das
-- braucht die Prüfung eines Urlaubsantrags.
create or replace function public.shift_qualification_gaps(
  p_shift_id uuid,
  p_date date,
  p_zusaetzlich_abwesend uuid default null
)
returns table (qualification_id uuid, label text, benoetigt int, vorhanden int, fehlt int)
language sql
stable
security definer
set search_path = public
as $$
  with anwesend as (
    select e.id
    from employees e
    where e.active
      and e.company_id = (select s.company_id from shifts s where s.id = p_shift_id)
      and effective_shift_id(e.id, p_date) = p_shift_id
      and e.id not in (select a.employee_id from employees_absent_on(p_date, true) a)
      and (p_zusaetzlich_abwesend is null or e.id <> p_zusaetzlich_abwesend)
  )
  select n.qualification_id,
         q.label,
         n.minimum::int,
         count(eq.employee_id)::int,
         greatest(n.minimum - count(eq.employee_id), 0)::int
  from shift_qualification_needs n
  join qualifications q on q.id = n.qualification_id
  left join employee_qualifications eq
    on eq.qualification_id = n.qualification_id
   and eq.employee_id in (select id from anwesend)
  where n.shift_id = p_shift_id
    and n.company_id = auth_company_id()
    and n.minimum > 0
    and q.active
  group by n.qualification_id, q.label, n.minimum, q.sort_order
  order by q.sort_order, q.label;
$$;

comment on function public.shift_qualification_gaps(uuid, date, uuid) is
  'Qualifikationsluecken einer Schicht an einem Tag. Die Anforderungen kommen aus shift_qualification_needs, nichts ist fest verdrahtet.';

revoke all on function public.shift_qualification_gaps(uuid, date, uuid) from public, anon;
grant execute on function public.shift_qualification_gaps(uuid, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Besetzungsdetail zu einem Antragszeitraum
-- ---------------------------------------------------------------------------
-- Baut auf check_leave_staffing_impact auf und ergänzt zwei Dinge, die der
-- Führung bisher fehlten: den Namen der betroffenen Schicht und die
-- konkreten Qualifikationslücken.
--
-- Bewusst KEINE zweite Besetzungslogik: Anwesenheit, Soll und Mindest
-- kommen unverändert aus check_leave_staffing_impact. Ergänzt wird nur der
-- Blick auf die Fähigkeiten.
create or replace function public.leave_staffing_detail(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  tag date,
  shift_name text,
  present int,
  target int,
  minimum int,
  status staffing_status,
  luecken jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  return query
  select i.date,
         s.name,
         i.present,
         i.target::int,
         i.minimum::int,
         i.status,
         coalesce(
           (select jsonb_agg(jsonb_build_object('label', g.label, 'fehlt', g.fehlt)
                             order by g.label)
              from public.shift_qualification_gaps(
                     effective_shift_id(p_employee_id, i.date), i.date, p_employee_id) g
             where g.fehlt > 0),
           '[]'::jsonb)
  from public.check_leave_staffing_impact(p_employee_id, p_start_date, p_end_date) i
  left join shifts s on s.id = effective_shift_id(p_employee_id, i.date)
  order by i.date;
end;
$$;

revoke all on function public.leave_staffing_detail(uuid, date, date) from public, anon;
grant execute on function public.leave_staffing_detail(uuid, date, date) to authenticated;
