-- Fehlzeiten: wahlweise von den AF-Stunden statt von den V-Tagen abziehen.
--
-- Die Schichtleitung entscheidet je Eintrag:
--   * abzug = 'v'  (Standard): fehlende Stunden / 8 gehen von den V-Tagen ab.
--   * abzug = 'af': die fehlenden Stunden gehen 1:1 vom AF-Stundenkonto ab
--                   (2 Std. früher gegangen = −2 AF-Std.). Geht nur bei
--                   Personen mit AF-Konto.
-- Unabhängig davon wird die Altersfreizeit für den Tag nur anteilig
-- angespart (0,82 × gearbeitete Std. / 8) – wie bisher.

alter table public.fehlzeiten
  add column if not exists abzug text not null default 'v'
    check (abzug in ('v', 'af'));

comment on column public.fehlzeiten.abzug is
  'Wovon die fehlenden Stunden abgehen: v = V-Tage (Stunden/8), af = AF-Stundenkonto (1:1).';

-- Neue Signatur mit p_abzug. Die alte (ohne) wird ersetzt; das Frontend,
-- das sie aufruft, ist noch nicht ausgeliefert.
drop function if exists public.fehlzeit_speichern(uuid, date, text, numeric, text);

create or replace function public.fehlzeit_speichern(
  p_employee_id uuid,
  p_tag date,
  p_art text,
  p_stunden numeric,
  p_notiz text default null,
  p_abzug text default 'v'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e employees;
  andere numeric;
  neu uuid;
  art_text text;
  abzug_text text;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Diese Person gehört nicht zu deinem Unternehmen.';
  end if;
  if not darf_urlaub_entscheiden(p_employee_id) then
    raise exception 'Du darfst nur Fehlzeiten deiner eigenen Schicht eintragen.';
  end if;
  if p_art not in ('frueher_gegangen', 'spaeter_gekommen') then
    raise exception 'Ungültige Art.';
  end if;
  if coalesce(p_abzug, '') not in ('v', 'af') then
    raise exception 'Ungültiger Abzug.';
  end if;
  if p_abzug = 'af' and (e.af_ab is null) then
    raise exception '% % hat kein AF-Stundenkonto – bitte von den V-Tagen abziehen.', e.first_name, e.last_name;
  end if;
  if p_stunden is null or p_stunden <= 0 or p_stunden >= 8 or p_stunden * 4 <> floor(p_stunden * 4) then
    raise exception 'Bitte Stunden in Viertelstunden zwischen 0,25 und 7,75 angeben.';
  end if;
  if p_tag is null then
    raise exception 'Bitte einen Tag angeben.';
  end if;
  if p_abzug = 'af' and p_tag <= e.af_ab then
    raise exception 'Der Tag liegt vor dem Stichtag des AF-Kontos (%).', to_char(e.af_ab, 'DD.MM.YYYY');
  end if;
  if not is_planned_workday(p_employee_id, p_tag) then
    raise exception '% % hat am % keine Schicht.', e.first_name, e.last_name, to_char(p_tag, 'DD.MM.YYYY');
  end if;
  if exists (select 1 from absences a where a.employee_id = p_employee_id and a.date = p_tag)
     or exists (select 1 from leave_requests r
                 where r.employee_id = p_employee_id
                   and r.status in ('approved', 'pending')
                   and p_tag between r.start_date and r.end_date) then
    raise exception '% % ist am % ohnehin abwesend (Urlaub, V-Tag, Krank o. Ä.).',
      e.first_name, e.last_name, to_char(p_tag, 'DD.MM.YYYY');
  end if;

  select coalesce(sum(f.stunden), 0) into andere
    from fehlzeiten f
   where f.employee_id = p_employee_id and f.tag = p_tag and f.art <> p_art;
  if andere + p_stunden >= 8 then
    raise exception 'Zusammen fehlen dann 8 Stunden oder mehr – dafür bitte einen ganzen V-Tag eintragen.';
  end if;

  insert into fehlzeiten (company_id, employee_id, tag, art, stunden, notiz, erfasst_von, abzug)
  values (e.company_id, p_employee_id, p_tag, p_art, p_stunden, nullif(btrim(p_notiz), ''), auth.uid(), p_abzug)
  on conflict (employee_id, tag, art)
  do update set stunden = excluded.stunden, notiz = excluded.notiz,
                erfasst_von = excluded.erfasst_von, abzug = excluded.abzug, created_at = now()
  returning id into neu;

  perform ensure_leave_balance(p_employee_id, extract(year from p_tag)::int);

  perform write_audit(e.company_id, 'fehlzeit.gespeichert', 'fehlzeiten', neu,
    jsonb_build_object('employee_id', p_employee_id, 'tag', p_tag, 'art', p_art,
                       'stunden', p_stunden, 'abzug', p_abzug));

  art_text := case when p_art = 'frueher_gegangen' then 'früher gegangen' else 'später gekommen' end;
  abzug_text := case when p_abzug = 'af'
    then replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',') || ' AF-Stunden'
    else replace(trim(to_char(p_stunden / 8, 'FM990.00')), '.', ',') || ' V-Tage' end;
  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (
    e.company_id, p_employee_id, 'fehlzeit',
    'Fehlzeit eingetragen',
    to_char(p_tag, 'DD.MM.YYYY') || ': ' || replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',')
      || ' Std. ' || art_text || '. Abgezogen: ' || abzug_text || '.',
    'fehlzeiten', neu
  );

  return neu;
end;
$function$;

revoke all on function public.fehlzeit_speichern(uuid, date, text, numeric, text, text) from public, anon;
grant execute on function public.fehlzeit_speichern(uuid, date, text, numeric, text, text) to authenticated;

-- Liste mit Abzug. Neue Rückgabespalte → alte Funktion ersetzen.
drop function if exists public.fehlzeiten_liste(date, date);

create or replace function public.fehlzeiten_liste(p_von date, p_bis date)
returns table (
  id uuid,
  employee_id uuid,
  employee_name text,
  rotation_team text,
  tag date,
  art text,
  stunden numeric,
  notiz text,
  darf_aendern boolean,
  abzug text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select f.id, f.employee_id, e.first_name || ' ' || e.last_name, e.rotation_team::text,
         f.tag, f.art, f.stunden, f.notiz, darf_urlaub_entscheiden(f.employee_id), f.abzug
    from fehlzeiten f
    join employees e on e.id = f.employee_id
   where f.company_id = auth_company_id()
     and is_leadership()
     and f.tag between p_von and p_bis
   order by f.tag desc, e.last_name, e.first_name;
$function$;

revoke all on function public.fehlzeiten_liste(date, date) from public, anon;
grant execute on function public.fehlzeiten_liste(date, date) to authenticated;

-- V-Tage: nur Fehlzeiten mit abzug = 'v'.
create or replace view public.leave_balances_view
with (security_invoker = true)
as
 WITH leave_days AS (
         SELECT DISTINCT r.employee_id,
            gs.day::date AS day,
            r.status,
            r.kind,
            EXTRACT(year FROM gs.day)::integer AS jahr
           FROM leave_requests r
             CROSS JOIN LATERAL generate_series(r.start_date::timestamp with time zone, r.end_date::timestamp with time zone, '1 day'::interval) gs(day)
          WHERE (r.status = ANY (ARRAY['approved'::leave_status, 'pending'::leave_status])) AND is_planned_workday(r.employee_id, gs.day::date)
        ), counted AS (
         SELECT leave_days.employee_id,
            leave_days.jahr,
            count(*) FILTER (WHERE leave_days.kind = 'urlaub'::leave_kind AND leave_days.status = 'approved'::leave_status AND leave_days.day < CURRENT_DATE) AS used_days,
            count(*) FILTER (WHERE leave_days.kind = 'urlaub'::leave_kind AND leave_days.status = 'approved'::leave_status AND leave_days.day >= CURRENT_DATE) AS planned_days,
            count(*) FILTER (WHERE leave_days.kind = 'urlaub'::leave_kind AND leave_days.status = 'pending'::leave_status) AS pending_days,
            count(*) FILTER (WHERE leave_days.kind = 'urlaub'::leave_kind AND leave_days.status = 'approved'::leave_status AND leave_days.day <= make_date(leave_days.jahr, 3, 31)) AS used_until_march,
            count(*) FILTER (WHERE leave_days.kind = 'v_tag'::leave_kind AND leave_days.status = 'approved'::leave_status) AS v_used,
            count(*) FILTER (WHERE leave_days.kind = 'v_tag'::leave_kind AND leave_days.status = 'pending'::leave_status) AS v_pending
           FROM leave_days
          GROUP BY leave_days.employee_id, leave_days.jahr
        ), fehl AS (
         SELECT f.employee_id,
            EXTRACT(year FROM f.tag)::integer AS jahr,
            sum(f.stunden) AS stunden
           FROM fehlzeiten f
          WHERE f.abzug = 'v'
          GROUP BY f.employee_id, (EXTRACT(year FROM f.tag)::integer)
        )
 SELECT b.id,
    b.company_id,
    b.employee_id,
    b.year,
    b.entitlement,
        CASE
            WHEN CURRENT_DATE <= make_date(b.year::integer, 3, 31) THEN b.carried_over
            ELSE LEAST(b.carried_over, COALESCE(c.used_until_march, 0::bigint)::numeric)
        END AS carried_over,
    COALESCE(c.used_days, 0::bigint)::numeric AS used_days,
    COALESCE(c.planned_days, 0::bigint)::numeric AS planned_days,
    COALESCE(c.pending_days, 0::bigint)::numeric AS pending_days,
    b.entitlement +
        CASE
            WHEN CURRENT_DATE <= make_date(b.year::integer, 3, 31) THEN b.carried_over
            ELSE LEAST(b.carried_over, COALESCE(c.used_until_march, 0::bigint)::numeric)
        END - COALESCE(c.used_days, 0::bigint)::numeric - COALESCE(c.planned_days, 0::bigint)::numeric - COALESCE(c.pending_days, 0::bigint)::numeric AS remaining_days,
    b.v_entitlement,
    b.v_carried_over,
    COALESCE(c.v_used, 0::bigint)::numeric + COALESCE(round(fe.stunden / 8, 4), 0::numeric) AS v_used_days,
    COALESCE(c.v_pending, 0::bigint)::numeric AS v_pending_days,
    b.v_entitlement + b.v_carried_over + b.v_korrektur - COALESCE(c.v_used, 0::bigint)::numeric - COALESCE(round(fe.stunden / 8, 4), 0::numeric) - COALESCE(c.v_pending, 0::bigint)::numeric AS v_remaining_days,
    b.created_at,
    b.updated_at,
    b.v_korrektur,
    COALESCE(fe.stunden, 0::numeric) AS v_fehl_stunden
   FROM leave_balances b
     LEFT JOIN counted c ON c.employee_id = b.employee_id AND c.jahr = b.year
     LEFT JOIN fehl fe ON fe.employee_id = b.employee_id AND fe.jahr = b.year;

-- AF: anteiliges Ansparen (alle Fehlzeiten) und Abzug 1:1 (abzug = 'af').
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
  fehl numeric;
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

  select count(*), coalesce(sum(fz.std), 0)
    into n, fehl
    from generate_series(ab + 1, current_date - 1, interval '1 day') g
    left join lateral (
      select sum(f.stunden) as std
        from fehlzeiten f
       where f.employee_id = e.id and f.tag = g::date
    ) fz on true
   where is_planned_workday(e.id, g::date)
     and not exists (select 1 from absences a
                      where a.employee_id = e.id and a.date = g::date)
     and not exists (select 1 from leave_requests r
                      where r.employee_id = e.id
                        and r.status = 'approved'
                        and g::date between r.start_date and r.end_date);

  if p_art = 'af' then
    anspar := round(n * v_satz - v_satz * fehl / 8, 2);
    -- Fehlstunden, die die Schichtleitung vom AF-Konto abzieht (1:1).
    select coalesce(sum(f.stunden), 0) into af_abzug
      from fehlzeiten f
     where f.employee_id = e.id and f.abzug = 'af' and f.tag > ab;
  else
    anspar := round(n * v_satz, 2);
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
