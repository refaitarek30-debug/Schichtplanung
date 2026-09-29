-- Fehlzeiten: früher gegangen / später gekommen.
--
-- Die Schichtleitung trägt ein, wenn jemand einen Teil seiner Schicht
-- nicht gearbeitet hat (z. B. 2 Std. früher gegangen). Grundlage ist eine
-- Schicht von 8 Stunden:
--
--   * V-Tage: die fehlenden Stunden gehen vom V-Konto ab – 2 Std. =
--     2/8 = 0,25 V-Tage. Sie zählen als „genommen“ im jeweiligen Jahr.
--   * Altersfreizeit: für den Tag gibt es nur den gearbeiteten Anteil der
--     0,82 Std. – bei 6 von 8 Std. also 0,82 × 6/8 = 0,615 Std.
--
-- Eintragen und löschen darf, wer auch über die Anträge der Person
-- entscheidet (Schichtleitung für die eigene Schicht, Administration für
-- alle). Die Person selbst sieht ihre eigenen Einträge.
--
-- Außerdem: Schulferien NRW 2027 ergänzt (bisher nur bis Ende 2026).

-- 1) Tabelle ---------------------------------------------------------------

create table if not exists public.fehlzeiten (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  tag date not null,
  art text not null check (art in ('frueher_gegangen', 'spaeter_gekommen')),
  stunden numeric(4,2) not null
    check (stunden > 0 and stunden < 8 and stunden * 4 = floor(stunden * 4)),
  notiz text check (notiz is null or char_length(notiz) <= 200),
  erfasst_von uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, tag, art)
);

create index if not exists fehlzeiten_firma_tag on public.fehlzeiten (company_id, tag);

comment on table public.fehlzeiten is
  'Teilweise nicht gearbeitete Schichten (früher gegangen / später gekommen). Mindern V-Tage und AF-Ansparen anteilig (Basis 8 Std.).';

alter table public.fehlzeiten enable row level security;
revoke all on table public.fehlzeiten from anon, authenticated;
grant select on table public.fehlzeiten to authenticated;

drop policy if exists "Fehlzeiten lesen" on public.fehlzeiten;
create policy "Fehlzeiten lesen" on public.fehlzeiten
  for select to authenticated
  using (
    company_id = auth_company_id()
    and (is_leadership() or employee_id = auth_employee_id())
  );

-- Änderungen melden sich wie Abwesenheiten: Konten und Plan laden neu.
drop trigger if exists aenderung_fehlzeiten on public.fehlzeiten;
create trigger aenderung_fehlzeiten
  after insert or update or delete on public.fehlzeiten
  for each row execute function public.aenderung_zaehlen('abwesenheiten');

-- 2) Eintragen / löschen / auflisten ----------------------------------------

create or replace function public.fehlzeit_speichern(
  p_employee_id uuid,
  p_tag date,
  p_art text,
  p_stunden numeric,
  p_notiz text default null
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
  if p_stunden is null or p_stunden <= 0 or p_stunden >= 8 or p_stunden * 4 <> floor(p_stunden * 4) then
    raise exception 'Bitte Stunden in Viertelstunden zwischen 0,25 und 7,75 angeben.';
  end if;
  if p_tag is null then
    raise exception 'Bitte einen Tag angeben.';
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

  insert into fehlzeiten (company_id, employee_id, tag, art, stunden, notiz, erfasst_von)
  values (e.company_id, p_employee_id, p_tag, p_art, p_stunden, nullif(btrim(p_notiz), ''), auth.uid())
  on conflict (employee_id, tag, art)
  do update set stunden = excluded.stunden, notiz = excluded.notiz,
                erfasst_von = excluded.erfasst_von, created_at = now()
  returning id into neu;

  perform ensure_leave_balance(p_employee_id, extract(year from p_tag)::int);

  perform write_audit(e.company_id, 'fehlzeit.gespeichert', 'fehlzeiten', neu,
    jsonb_build_object('employee_id', p_employee_id, 'tag', p_tag, 'art', p_art, 'stunden', p_stunden));

  art_text := case when p_art = 'frueher_gegangen' then 'früher gegangen' else 'später gekommen' end;
  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (
    e.company_id, p_employee_id, 'fehlzeit',
    'Fehlzeit eingetragen',
    to_char(p_tag, 'DD.MM.YYYY') || ': ' || replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',')
      || ' Std. ' || art_text || '. Abgezogen: '
      || replace(trim(to_char(p_stunden / 8, 'FM990.00')), '.', ',') || ' V-Tage.',
    'fehlzeiten', neu
  );

  return neu;
end;
$function$;

revoke all on function public.fehlzeit_speichern(uuid, date, text, numeric, text) from public, anon;
grant execute on function public.fehlzeit_speichern(uuid, date, text, numeric, text) to authenticated;

create or replace function public.fehlzeit_loeschen(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  f fehlzeiten;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into f from fehlzeiten where id = p_id and company_id = auth_company_id();
  if f.id is null then
    raise exception 'Eintrag nicht gefunden.';
  end if;
  if not darf_urlaub_entscheiden(f.employee_id) then
    raise exception 'Du darfst nur Fehlzeiten deiner eigenen Schicht löschen.';
  end if;
  delete from fehlzeiten where id = p_id;
  perform write_audit(f.company_id, 'fehlzeit.geloescht', 'fehlzeiten', f.id,
    jsonb_build_object('employee_id', f.employee_id, 'tag', f.tag, 'art', f.art, 'stunden', f.stunden));
end;
$function$;

revoke all on function public.fehlzeit_loeschen(uuid) from public, anon;
grant execute on function public.fehlzeit_loeschen(uuid) to authenticated;

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
  darf_aendern boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select f.id, f.employee_id, e.first_name || ' ' || e.last_name, e.rotation_team::text,
         f.tag, f.art, f.stunden, f.notiz, darf_urlaub_entscheiden(f.employee_id)
    from fehlzeiten f
    join employees e on e.id = f.employee_id
   where f.company_id = auth_company_id()
     and is_leadership()
     and f.tag between p_von and p_bis
   order by f.tag desc, e.last_name, e.first_name;
$function$;

revoke all on function public.fehlzeiten_liste(date, date) from public, anon;
grant execute on function public.fehlzeiten_liste(date, date) to authenticated;

-- 3) V-Tage: Fehlstunden / 8 gehen vom Konto ab ----------------------------
-- Bestehende Spalten unverändert in Name und Reihenfolge; neu am Ende:
-- v_fehl_stunden (Summe der Fehlstunden im Jahr).

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

-- 4) Altersfreizeit: Fehlstunden mindern das Ansparen anteilig --------------

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

  -- Gearbeitete Schichttage seit dem Stichtag bis gestern. Fehlstunden an
  -- diesen Tagen (früher gegangen / später gekommen) mindern das Ansparen
  -- anteilig: 0,82 × (8 − Fehlstunden) / 8.
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

  stand := v_start + anspar - v_kosten * gen;
  frei := stand - v_kosten * plan;
  moeglich := floor(frei / v_kosten);

  return query select ab, v_start, n, anspar, gen, bea, plan,
                      stand, moeglich, round(frei - v_kosten * moeglich, 2), v_satz, v_kosten;
end;
$function$;

-- 5) Schulferien NRW 2027 ---------------------------------------------------

insert into public.school_holidays (company_id, region, name, start_date, end_date)
select null, 'NW', x.name, x.von, x.bis
  from (values
    ('Weihnachtsferien', date '2027-01-01', date '2027-01-06'),
    ('Osterferien',      date '2027-03-22', date '2027-04-03'),
    ('Pfingstferien',    date '2027-05-18', date '2027-05-18'),
    ('Sommerferien',     date '2027-07-19', date '2027-08-31'),
    ('Herbstferien',     date '2027-10-23', date '2027-11-06'),
    ('Weihnachtsferien', date '2027-12-24', date '2027-12-31')
  ) as x(name, von, bis)
 where not exists (
   select 1 from public.school_holidays s
    where s.region = 'NW' and s.company_id is null and s.start_date = x.von
 );
