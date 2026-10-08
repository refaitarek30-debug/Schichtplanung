-- Fehlzeit (früher gegangen / später gekommen) geht immer 1:1 vom AF-Konto ab.
--
-- Bisher:
--   * Abzug „V“:  V-Konto −Std., AF-Konto nur anteilig weniger angespart
--                 (0,82 × Std./8 – bei 2 Std. also −0,21).
--   * Abzug „AF“: AF-Konto −Std. 1:1 (plus das anteilige Weniger-Ansparen).
-- Jetzt (Vorgabe Betrieb):
--   * Abzug „V“:  V-Konto −Std. UND AF-Konto −Std. (bei 2 Std.: −2 V-Std., −2 AF-Std.)
--   * Abzug „AF“: AF-Konto −Std.
-- Das anteilige Weniger-Ansparen entfällt, sonst ginge derselbe Ausfall
-- doppelt vom AF-Konto ab. Für Personen ohne AF-Konto (af_ab leer) und für
-- Tage bis zum AF-Stichtag ändert sich nichts.

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
  anspar numeric;
  af_abzug numeric := 0;
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

  select count(*)
    into n
    from generate_series(ab + 1, current_date - 1, interval '1 day') g
   where is_planned_workday(e.id, g::date)
     and not exists (select 1 from absences a
                      where a.employee_id = e.id and a.date = g::date)
     and not exists (select 1 from leave_requests r
                      where r.employee_id = e.id
                        and r.status = 'approved'
                        and g::date between r.start_date and r.end_date);

  anspar := round(n * v_satz, 2);

  if p_art = 'af' then
    -- Jede Fehlzeit nach dem Stichtag geht 1:1 ab – egal ob als Abzug
    -- „V“ (dann zusätzlich zum V-Konto) oder „AF“ eingetragen.
    select coalesce(sum(f.stunden), 0) into af_abzug
      from fehlzeiten f
     where f.employee_id = e.id and f.tag > ab;
  end if;

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

  stand := v_start + anspar - v_kosten * gen - af_abzug;
  frei := stand - v_kosten * plan;
  moeglich := floor(frei / v_kosten);

  return query select ab, v_start, n, anspar, gen, bea, plan,
                      stand, moeglich, round(frei - v_kosten * moeglich, 2), v_satz, v_kosten;
end;
$function$;

-- Benachrichtigung an die Person: beim Abzug „V“ auch die AF-Stunden nennen.
do $do$
declare
  d text;
  alt text := $x$else replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',') || ' V-Std. ('
      || replace(trim(to_char(p_stunden / 7.5, 'FM990.00')), '.', ',') || ' V-Tage)' end;$x$;
  neu text := $x$else replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',') || ' V-Std. ('
      || replace(trim(to_char(p_stunden / 7.5, 'FM990.00')), '.', ',') || ' V-Tage)'
      || case when e.af_ab is not null and p_tag > e.af_ab
              then ' und ' || replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',') || ' AF-Stunden'
              else '' end end;$x$;
begin
  select pg_get_functiondef('public.fehlzeit_speichern(uuid,date,text,numeric,text,text)'::regprocedure) into d;
  if position(alt in d) = 0 then
    raise exception 'fehlzeit_speichern hat sich geändert – Text nicht gefunden.';
  end if;
  execute replace(d, alt, neu);
end;
$do$;
