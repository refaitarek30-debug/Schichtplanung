drop function if exists absence_report(int, int);

create function absence_report(
  p_year int,
  p_month int default null
)
returns table (
  employee_id uuid,
  name text,
  rotation_team text,
  monat int,
  soll_tage int,
  anwesend_tage int,
  krank_tage int,
  urlaub_tage int,
  v_tage int,
  sonderurlaub_tage int,
  altersfreizeit_tage int,
  bildungsurlaub_tage int,
  gewerkschaftstag_tage int,
  seminar_tage int,
  sonstige_tage int,
  ausfall_tage int,
  soll_stunden numeric,
  anwesend_stunden numeric,
  krank_stunden numeric,
  ausfall_stunden numeric,
  ausfallquote numeric,
  gesundheitsrate numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  firma uuid := auth_company_id();
  von date;
  bis date;
  stunden numeric;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Auswertungen sehen.';
  end if;
  if p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  if p_month is not null and (p_month < 1 or p_month > 12) then
    raise exception 'Ungültiger Monat.';
  end if;

  von := make_date(p_year, coalesce(p_month, 1), 1);
  bis := case when p_month is null
              then make_date(p_year, 12, 31)
              else (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
         end;

  stunden := company_rule_number('stunden_pro_arbeitstag', 'stunden', 8);

  return query
  with arbeitstage as (
    select
      e.id as emp,
      e.first_name || ' ' || e.last_name as voller_name,
      e.rotation_team::text as team,
      d::date as tag,
      extract(month from d)::int as m
    from employees e
    cross join generate_series(von, bis, interval '1 day') d
    where e.company_id = firma
      and e.active
      and is_planned_workday(e.id, d::date)
  ),
  -- Genau eine Kategorie je Tag. Erfasste Abwesenheit sticht Urlaub;
  -- ein genehmigter Urlaubstag, an dem jemand krankgemeldet ist, zaehlt
  -- als Kranktag und nicht doppelt.
  eingeteilt as (
    select
      a.emp, a.voller_name, a.team, a.m,
      coalesce(
        (select ab.type::text from absences ab
          where ab.employee_id = a.emp and ab.date = a.tag
          order by case ab.type::text
                     when 'krank' then 1
                     when 'sonderurlaub' then 2
                     when 'altersfreizeit' then 3
                     when 'bildungsurlaub' then 4
                     when 'schulung' then 5
                     else 6 end
          limit 1),
        -- Seit den neuen Antragsarten steht die Art direkt im Antrag.
        -- Vorher wurde alles ausser 'v_tag' als Urlaub gezaehlt -- ein
        -- Sonderurlaub waere damit als Urlaub in der Auswertung gelandet.
        (select r.kind::text
           from leave_requests r
          where r.employee_id = a.emp
            and r.status = 'approved'
            and a.tag between r.start_date and r.end_date
          limit 1),
        'anwesend'
      ) as art
    from arbeitstage a
  ),
  gezaehlt as (
    select
      g.emp, g.voller_name, g.team, g.m,
      count(*)::int as soll,
      count(*) filter (where g.art = 'anwesend')::int       as anwesend,
      count(*) filter (where g.art = 'krank')::int          as krank,
      count(*) filter (where g.art = 'urlaub')::int         as urlaub,
      count(*) filter (where g.art = 'v_tag')::int          as v,
      count(*) filter (where g.art = 'sonderurlaub')::int   as su,
      count(*) filter (where g.art = 'altersfreizeit')::int as af,
      count(*) filter (where g.art = 'bildungsurlaub')::int as bu,
      count(*) filter (where g.art = 'gewerkschaftstag')::int as gt,
      count(*) filter (where g.art = 'schulung')::int       as seminar,
      count(*) filter (where g.art = 'sonstiges')::int      as sonstige
    from eingeteilt g
    group by g.emp, g.voller_name, g.team, g.m
  )
  select
    z.emp, z.voller_name, z.team, z.m,
    z.soll, z.anwesend, z.krank, z.urlaub, z.v, z.su, z.af, z.bu, z.gt,
    z.seminar, z.sonstige,
    -- Ausfall ist der ungeplante Teil: Krankheit und Sonstiges. Urlaub,
    -- V-Tage, Sonderurlaub, Altersfreizeit und Bildungsurlaub sind
    -- geplante Abwesenheiten und keine Ausfaelle.
    (z.krank + z.sonstige) as ausfall,
    round(z.soll * stunden, 1),
    -- Seminar zaehlt als Anwesenheit: die Person arbeitet, nur woanders.
    -- So rechnet es auch die Excel-Vorlage.
    round((z.anwesend + z.seminar) * stunden, 1),
    round(z.krank * stunden, 1),
    round((z.krank + z.sonstige) * stunden, 1),
    case when (z.anwesend + z.seminar + z.krank + z.sonstige) = 0 then null
         else round(100.0 * (z.krank + z.sonstige)
                    / (z.anwesend + z.seminar + z.krank + z.sonstige), 1)
    end,
    -- Gesundheitsrate = Anwesenheit / (Anwesenheit + Ausfall) x 100.
    -- Anders als die Excel-Vorlage, die Kranktage nicht von der
    -- Anwesenheit abzieht und sie dadurch doppelt zaehlt.
    case when (z.anwesend + z.seminar + z.krank + z.sonstige) = 0 then null
         else round(100.0 * (z.anwesend + z.seminar)
                    / (z.anwesend + z.seminar + z.krank + z.sonstige), 1)
    end
  from gezaehlt z
  order by z.team nulls last, z.voller_name, z.m;
end;
$$;

comment on function absence_report(int, int) is
  'Ausfall und Anwesenheit je Person und Monat. Nur fuer die Administration.';

revoke execute on function absence_report(int, int) from public, anon;
grant execute on function absence_report(int, int) to authenticated;
