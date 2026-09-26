-- Abwesenheitsgründe vorerst nur für Schichtleitung und Administration.
--
-- Bisher sahen Kolleginnen und Kollegen derselben Schichtgruppe den Grund
-- (Urlaub, V-Tag, Krank …), wenn die Person ihn in ihren
-- Datenschutz-Einstellungen freigegeben hatte. Der Betrieb will das
-- vorerst für alle abschalten: Kollegen sehen nur „Abwesend", die
-- Führung sieht weiter alles, jeder sieht seine eigenen Einträge.
--
-- Umgesetzt als Betriebsschalter (Standard: aus) statt die persönlichen
-- Einstellungen zu überschreiben. Die Wahl jeder Person bleibt gespeichert
-- und gilt wieder, sobald die Administration die Anzeige freigibt.
--
-- Betroffen sind die beiden einzigen Wege, auf denen Beschäftigte Gründe
-- von Kollegen sehen konnten: shift_plan_grid und my_shift_leave. Alle
-- anderen Abfragen zeigen Gründe ohnehin nur der Führung (RLS bzw.
-- is_leadership() in der Funktion).

alter table public.company_settings
  add column if not exists gruende_fuer_kollegen boolean not null default false;

comment on column public.company_settings.gruende_fuer_kollegen is
  'Dürfen Kollegen den Abwesenheitsgrund sehen, wenn die Person ihn freigegeben hat? Aus = nur Führung sieht Gründe.';

-- Liest den Schalter der eigenen Firma. Für alle Angemeldeten lesbar,
-- damit die Datenschutz-Seite erklären kann, warum eine Freigabe gerade
-- nicht wirkt.
create or replace function public.gruende_fuer_kollegen_erlaubt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select cs.gruende_fuer_kollegen from company_settings cs where cs.company_id = auth_company_id()),
    false);
$$;

revoke all on function public.gruende_fuer_kollegen_erlaubt() from public, anon;
grant execute on function public.gruende_fuer_kollegen_erlaubt() to authenticated;

create or replace function public.set_gruende_fuer_kollegen(p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf diese Einstellung ändern.';
  end if;
  insert into company_settings (company_id, gruende_fuer_kollegen, updated_at)
  values (v_firma, coalesce(p_value, false), now())
  on conflict (company_id)
    do update set gruende_fuer_kollegen = excluded.gruende_fuer_kollegen, updated_at = now();
  perform write_audit(v_firma, 'datenschutz.gruende_fuer_kollegen', 'company_settings', v_firma,
                      jsonb_build_object('erlaubt', coalesce(p_value, false)));
end;
$$;

revoke all on function public.set_gruende_fuer_kollegen(boolean) from public, anon;
grant execute on function public.set_gruende_fuer_kollegen(boolean) to authenticated;

-- Schichtplan: Freigabe des Grundes wirkt nur noch, wenn der Betrieb sie erlaubt.
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
  -- Betriebsschalter: ohne ihn sehen Kollegen nie einen Grund.
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
   and shift_runs_on(s, gs.day::date, feiertage_arbeiten)
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, e.id, gs.day;
end;
$function$;

revoke all on function public.shift_plan_grid(uuid, date, integer) from public, anon;
grant execute on function public.shift_plan_grid(uuid, date, integer) to authenticated, service_role;

-- „Wer fehlt in meiner Schicht": dieselbe Regel.
create or replace function public.my_shift_leave(p_from date, p_to date)
 returns table(employee_id uuid, employee_name text, start_date date, end_date date, status leave_status, is_me boolean, reason_visible boolean, kind leave_kind)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  meine_firma uuid := auth_company_id();
  fuehrung boolean := is_leadership();
  freigabe boolean := gruende_fuer_kollegen_erlaubt();
  my_shift uuid;
  my_pattern uuid;
begin
  if me is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  select e.shift_id, e.rotation_pattern_id into my_shift, my_pattern
  from employees e where e.id = me;

  return query
  with sichtbar as (
    select
      r.employee_id as emp_id,
      e.first_name || ' ' || e.last_name as emp_name,
      r.start_date as von,
      r.end_date as bis,
      r.status as stand,
      (r.employee_id = me) as ich,
      e.last_name as nachname,
      r.kind as art,
      case
        when r.employee_id = me then true
        when fuehrung then true
        when not freigabe then false
        else exists (
          select 1
          from public.profiles sp
          join public.privacy_settings ps on ps.user_id = sp.id
          where sp.employee_id = r.employee_id
            and sp.company_id = meine_firma
            and ps.company_id = meine_firma
            and ps.absence_visibility = 'shift'
        )
      end as grund_sichtbar
    from leave_requests r
    join employees e on e.id = r.employee_id
    where e.company_id = meine_firma
      and e.active
      and r.status in ('approved', 'pending')
      and r.start_date <= p_to
      and r.end_date >= p_from
      and (
        (my_shift is not null and e.shift_id = my_shift)
        or (my_pattern is not null and e.rotation_pattern_id = my_pattern)
        or r.employee_id = me
      )
  )
  select emp_id, emp_name, von, bis, stand, ich, grund_sichtbar,
         case when grund_sichtbar then art else null end
  from sichtbar
  where grund_sichtbar or stand = 'approved'
  order by von, nachname;
end;
$function$;
