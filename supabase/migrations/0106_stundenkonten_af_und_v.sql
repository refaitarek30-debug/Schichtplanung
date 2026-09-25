-- Stundenkonten für Altersfreizeit (AF) und V-Tage.
--
-- Beide Konten funktionieren gleich: Administration oder Schichtleitung
-- tragen den Stand in Stunden zu einem Datum ein (aus der Abrechnung). Ab
-- dem Folgetag:
--   AF: +0,83 Std. je tatsächlich gearbeiteter Schicht, −8 Std. je AF-Tag
--   V:  +0,75 Std. je tatsächlich gearbeiteter Schicht, −7,5 Std. je V-Tag
-- „Gearbeitet" heißt: eingeplanter Schichttag, vorbei, ohne Abwesenheit und
-- ohne genehmigten Antrag. Urlaub, krank, V, AF usw. bringen nichts.
--
-- Gerechnet wird nur mit dem, was schon angespart ist – nicht mit Stunden,
-- die bis zu einem geplanten Tag noch dazukämen:
--   Stand heute     = Start + Angespartes − Kosten × schon genommene Tage
--   noch möglich    = (Stand heute − Kosten × eingeplante Tage) / Kosten
-- AF darf nicht ins Minus: ein AF-Antrag geht nur, wenn „noch möglich"
-- reicht. V darf ins Minus; angezeigt wird aber, wie viele V-Tage noch
-- gehen, bevor es ins Minus geht.

alter table public.employees
  add column if not exists v_ab date,
  add column if not exists v_start_stunden numeric(7,2) not null default 0;

comment on column public.employees.v_ab is
  'V-Stundenkonto: Stichtag des eingetragenen Stands (null = V wird in Tagen geführt).';
comment on column public.employees.v_start_stunden is
  'V-Stundenstand zum Stichtag v_ab.';

-- Das gemeinsame Rechenwerk ------------------------------------------------
create or replace function public.stundenkonto(p_employee_id uuid, p_art text, p_ohne_antrag uuid default null)
returns table (
  stichtag date,
  start_stunden numeric,
  arbeitstage integer,
  angespart numeric,
  genommen numeric,
  beantragt numeric,
  verplant numeric,
  stand_heute numeric,
  noch_moeglich numeric,
  rest_stunden numeric,
  satz numeric,
  kosten numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e employees;
  ab date;
  v_start numeric;
  v_satz numeric;
  v_kosten numeric;
  v_art leave_kind;
  n int;
  gen numeric;
  plan numeric;
  bea numeric;
  stand numeric;
  frei numeric;
  moeglich numeric;
begin
  select * into e from employees where id = p_employee_id;
  if p_art = 'af' then
    ab := e.af_ab; v_start := e.af_start_stunden; v_satz := 0.83; v_kosten := 8; v_art := 'altersfreizeit';
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

  select count(*) into n
    from generate_series(ab + 1, current_date - 1, interval '1 day') g
   where is_planned_workday(e.id, g::date)
     and not exists (select 1 from absences a
                      where a.employee_id = e.id and a.date = g::date)
     and not exists (select 1 from leave_requests r
                      where r.employee_id = e.id
                        and r.status = 'approved'
                        and g::date between r.start_date and r.end_date);

  -- Tage der Art nach dem Stichtag, je Tag gewogen (halber Tag = 0,5).
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
    -- Von der Führung direkt eingetragene AF-Tage (nur AF kennt das).
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

  stand := v_start + round(n * v_satz, 2) - v_kosten * gen;
  frei := stand - v_kosten * plan;
  moeglich := floor(frei / v_kosten);

  return query select ab, v_start, n, round(n * v_satz, 2), gen, bea, plan,
                      stand, moeglich, round(frei - v_kosten * moeglich, 2), v_satz, v_kosten;
end;
$$;

revoke all on function public.stundenkonto(uuid, text, uuid) from public, anon, authenticated;

-- AF-Konto auf das Rechenwerk umstellen ------------------------------------
drop function if exists public.my_af_konto();
drop function if exists public.af_uebersicht();
drop function if exists public.team_sonder_konten(integer);
drop function if exists public.af_konto(uuid, uuid);

create function public.af_konto(p_employee_id uuid, p_ohne_antrag uuid default null)
returns table (
  freigeschaltet_ab date,
  start_stunden numeric,
  arbeitstage integer,
  stunden_angespart numeric,
  genommen numeric,
  beantragt numeric,
  verplant numeric,
  stand_stunden numeric,
  verfuegbar numeric,
  rest_stunden numeric,
  tage_erworben numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select k.stichtag, k.start_stunden, k.arbeitstage, k.angespart, k.genommen, k.beantragt,
         k.verplant, k.stand_heute, k.noch_moeglich, k.rest_stunden,
         greatest(k.noch_moeglich, 0) + k.genommen + k.verplant
    from stundenkonto(p_employee_id, 'af', p_ohne_antrag) k;
$$;

revoke all on function public.af_konto(uuid, uuid) from public, anon, authenticated;

create function public.my_af_konto()
returns table (
  freigeschaltet_ab date,
  start_stunden numeric,
  arbeitstage integer,
  stunden_angespart numeric,
  genommen numeric,
  beantragt numeric,
  verplant numeric,
  stand_stunden numeric,
  verfuegbar numeric,
  rest_stunden numeric,
  tage_erworben numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth_employee_id();
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  return query select * from af_konto(me);
end;
$$;

revoke all on function public.my_af_konto() from public, anon;
grant execute on function public.my_af_konto() to authenticated;

-- V-Stundenkonto -----------------------------------------------------------
create or replace function public.my_v_konto()
returns table (
  stichtag date,
  start_stunden numeric,
  arbeitstage integer,
  angespart numeric,
  genommen numeric,
  beantragt numeric,
  verplant numeric,
  stand_heute numeric,
  noch_moeglich numeric,
  rest_stunden numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth_employee_id();
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  return query
  select k.stichtag, k.start_stunden, k.arbeitstage, k.angespart, k.genommen, k.beantragt,
         k.verplant, k.stand_heute, k.noch_moeglich, k.rest_stunden
    from stundenkonto(me, 'v') k;
end;
$$;

revoke all on function public.my_v_konto() from public, anon;
grant execute on function public.my_v_konto() to authenticated;

-- Stand eintragen: p_art 'af' oder 'v'. p_stichtag null = zurücknehmen.
create or replace function public.set_stundenstand(p_employee_id uuid, p_art text, p_stunden numeric, p_stichtag date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  e employees;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_art not in ('af', 'v') then
    raise exception 'Unbekanntes Konto.';
  end if;
  select * into e from employees where id = p_employee_id and company_id = v_firma;
  if e.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if p_stichtag is not null then
    if p_stichtag < date '2000-01-01' or p_stichtag > current_date then
      raise exception 'Das Datum des Stands darf nicht in der Zukunft liegen.';
    end if;
    if p_stunden is null or p_stunden < -500 or p_stunden > 2000 then
      raise exception 'Bitte einen Stundenstand zwischen -500 und 2000 angeben.';
    end if;
  end if;

  if p_art = 'af' then
    update employees
       set af_ab = p_stichtag,
           af_start_stunden = case when p_stichtag is null then 0 else round(p_stunden, 2) end
     where id = p_employee_id;
  else
    update employees
       set v_ab = p_stichtag,
           v_start_stunden = case when p_stichtag is null then 0 else round(p_stunden, 2) end
     where id = p_employee_id;
  end if;

  perform write_audit(v_firma, 'stundenkonto.' || p_art, 'employees', p_employee_id,
    jsonb_build_object(
      'vorher_ab', case when p_art = 'af' then e.af_ab else e.v_ab end,
      'vorher_stunden', case when p_art = 'af' then e.af_start_stunden else e.v_start_stunden end,
      'nachher_ab', p_stichtag, 'nachher_stunden', p_stunden));
end;
$$;

revoke all on function public.set_stundenstand(uuid, text, numeric, date) from public, anon;
grant execute on function public.set_stundenstand(uuid, text, numeric, date) to authenticated;

-- Die Vorgängerfunktion bleibt für alte Clients erhalten, geht aber über das
-- neue Rechenwerk.
create or replace function public.set_af_stand(p_employee_id uuid, p_stunden numeric, p_stichtag date)
returns void
language sql
security definer
set search_path = public
as $$
  select set_stundenstand(p_employee_id, 'af', p_stunden, p_stichtag);
$$;

-- Übersicht für die Führung: AF und V je Person ---------------------------
create function public.af_uebersicht()
returns table (
  employee_id uuid,
  employee_name text,
  rotation_team text,
  birth_date date,
  alter_heute integer,
  hat_profil boolean,
  af_ab date,
  af_start numeric,
  af_arbeitstage integer,
  af_angespart numeric,
  af_genommen numeric,
  af_verplant numeric,
  af_stand numeric,
  af_moeglich numeric,
  v_ab date,
  v_start numeric,
  v_arbeitstage integer,
  v_angespart numeric,
  v_genommen numeric,
  v_verplant numeric,
  v_stand numeric,
  v_moeglich numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id,
         e.first_name || ' ' || e.last_name,
         e.rotation_team::text,
         pd.birth_date,
         case when pd.birth_date is null then null
              else extract(year from age(current_date, pd.birth_date))::int end,
         p.id is not null,
         a.stichtag, a.start_stunden, a.arbeitstage, a.angespart, a.genommen, a.verplant,
         a.stand_heute, a.noch_moeglich,
         v.stichtag, v.start_stunden, v.arbeitstage, v.angespart, v.genommen, v.verplant,
         v.stand_heute, v.noch_moeglich
    from employees e
    left join profiles p on p.employee_id = e.id and p.company_id = v_firma
    left join personal_details pd on pd.user_id = p.id and pd.company_id = v_firma
    cross join lateral stundenkonto(e.id, 'af') a
    cross join lateral stundenkonto(e.id, 'v') v
   where e.company_id = v_firma
     and e.active
   order by e.last_name, e.first_name;
end;
$$;

revoke all on function public.af_uebersicht() from public, anon;
grant execute on function public.af_uebersicht() to authenticated;

create function public.team_sonder_konten(p_year integer default null)
returns table (
  employee_id uuid,
  su_erlaubt boolean,
  su_anspruch numeric,
  su_rest numeric,
  af_freigeschaltet boolean,
  af_verfuegbar numeric,
  af_rest_stunden numeric,
  af_stand numeric,
  v_stunden boolean,
  v_stand numeric,
  v_moeglich numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  y int := coalesce(p_year, extract(year from current_date)::int);
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id,
         su.anspruch > 0,
         su.anspruch, su.rest,
         e.af_ab is not null,
         af.noch_moeglich, af.rest_stunden, af.stand_heute,
         e.v_ab is not null,
         v.stand_heute, v.noch_moeglich
    from employees e
    cross join lateral leave_kind_kontingent(e.id, 'sonderurlaub', y) su
    cross join lateral stundenkonto(e.id, 'af') af
    cross join lateral stundenkonto(e.id, 'v') v
   where e.company_id = auth_company_id()
     and e.active;
end;
$$;

revoke all on function public.team_sonder_konten(integer) from public, anon;
grant execute on function public.team_sonder_konten(integer) to authenticated;

-- V-Rest für die automatische Verteilung ----------------------------------
-- Mit V-Stundenkonto: wie viele V-Tage noch gehen, bevor es ins Minus geht.
-- Ohne: wie bisher aus dem Tageskonto des Jahres.
create or replace function public.v_tage_rest(p_employee_id uuid, p_year integer)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r numeric;
begin
  if (select v_ab from employees where id = p_employee_id) is not null then
    select k.noch_moeglich into r from stundenkonto(p_employee_id, 'v') k;
    return coalesce(r, 0);
  end if;
  select v_remaining_days into r from leave_balances_view
   where employee_id = p_employee_id and year = p_year;
  return coalesce(r, 0);
end;
$$;

revoke all on function public.v_tage_rest(uuid, integer) from public, anon, authenticated;

-- Automatische Verteilung und Empfehlung nutzen den V-Rest aus dem
-- Stundenkonto, sobald eines eingetragen ist.

create or replace function public.preview_leave_auto(p_start_date date, p_end_date date)
returns table(tag date, art text, grund text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  e employees;
  d date;
  k leave_kind;
  warum text;
  jahr int;
  idx int;
  jahre int[] := '{}';
  ru numeric[] := '{}';
  rv numeric[] := '{}';
begin
  if me is null then return; end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 366 then return; end if;

  select * into e from employees where id = me;

  for jahr in
    select distinct extract(year from g)::int
      from generate_series(p_start_date, p_end_date, '1 day') g
     order by 1
  loop
    perform ensure_leave_balance(me, jahr);
    jahre := jahre || jahr;
    ru := ru || coalesce(
      (select remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || v_tage_rest(me, jahr);
  end loop;

  for d in select g::date from generate_series(p_start_date, p_end_date, '1 day') g loop
    continue when not is_planned_workday(me, d);
    continue when exists (
      select 1 from leave_requests r
       where r.employee_id = me and r.status in ('approved', 'pending')
         and d between r.start_date and r.end_date
    );

    idx := array_position(jahre, extract(year from d)::int);

    if not e.shift_worker then
      k := 'urlaub'; warum := 'kein Schichtsystem';
    elsif exists (select 1 from holidays h where h.date = d
                    and (h.company_id = e.company_id or h.company_id is null)) then
      k := 'urlaub'; warum := 'Feiertag';
    elsif extract(dow from d) = 0 then
      k := 'urlaub'; warum := 'Sonntag';
    elsif (select s.name from shifts s where s.id = effective_shift_id(me, d)) ilike 'Nacht%' then
      k := 'urlaub'; warum := 'Nachtschicht';
    else
      k := 'v_tag'; warum := 'kein Zuschlagstag';
    end if;

    if k = 'urlaub' and ru[idx] < 1 then
      -- Urlaub leer: V-Tag, notfalls ins Minus.
      k := 'v_tag';
      warum := case when rv[idx] >= 1 then 'Urlaub aufgebraucht' else 'Konten leer – V-Tag ins Minus' end;
    elsif k = 'v_tag' and rv[idx] < 1 and ru[idx] >= 1 then
      k := 'urlaub'; warum := 'V-Tage aufgebraucht';
    elsif k = 'v_tag' and rv[idx] < 1 then
      warum := 'Konten leer – V-Tag ins Minus';
    end if;

    if k = 'urlaub' then
      ru[idx] := ru[idx] - 1;
    else
      rv[idx] := rv[idx] - 1;
    end if;

    return query select d, k::text, warum;
  end loop;
end;
$function$;

create or replace function public.submit_leave_auto(p_start_date date, p_end_date date, p_reason text default null::text)
returns table(urlaub_tage integer, v_tage integer, antraege integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  e employees; tag date; art leave_kind; jahr int; idx int;
  jahre int[] := '{}'; ru numeric[] := '{}'; rv numeric[] := '{}';
  tage date[] := '{}'; arten leave_kind[] := '{}';
  i int; block_von date; block_bis date; block_art leave_kind;
  n_u int := 0; n_v int := 0; n_a int := 0;
  v_gruppe uuid := gen_random_uuid();
  v_erste uuid;
  v_arten text;
  v_tage_gesamt numeric;
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  if p_end_date < p_start_date then
    raise exception 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Der Zeitraum ist zu lang.';
  end if;

  select * into e from employees where id = me;

  for jahr in
    select distinct extract(year from d)::int
      from generate_series(p_start_date, p_end_date, '1 day') d order by 1
  loop
    perform ensure_leave_balance(me, jahr);
    jahre := jahre || jahr;
    ru := ru || coalesce((select remaining_days   from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || v_tage_rest(me, jahr);
  end loop;

  for tag in select d::date from generate_series(p_start_date, p_end_date, '1 day') d loop
    continue when not is_planned_workday(me, tag);
    continue when exists (
      select 1 from leave_requests r
       where r.employee_id = me and r.status in ('approved', 'pending')
         and tag between r.start_date and r.end_date);

    idx := array_position(jahre, extract(year from tag)::int);
    if not e.shift_worker then art := 'urlaub';
    elsif is_premium_day(me, tag) then art := 'urlaub';
    else art := 'v_tag'; end if;
    -- Urlaub leer: V-Tag (auch ins Minus). V leer, Urlaub da: Urlaub.
    if art = 'urlaub' and ru[idx] < 1 then art := 'v_tag'; end if;
    if art = 'v_tag'  and rv[idx] < 1 and ru[idx] >= 1 then art := 'urlaub'; end if;
    if art = 'urlaub' then
      ru[idx] := ru[idx] - 1; n_u := n_u + 1;
    else
      rv[idx] := rv[idx] - 1; n_v := n_v + 1;
    end if;
    tage  := tage  || tag;
    arten := arten || art;
  end loop;

  if array_length(tage, 1) is null then
    raise exception 'In diesem Zeitraum hast du keinen eingeplanten Arbeitstag.';
  end if;

  perform set_config('schichtplan.sammelantrag', 'an', true);

  block_von := tage[1]; block_bis := tage[1]; block_art := arten[1];

  for i in 2 .. array_length(tage, 1) loop
    if arten[i] = block_art and tage[i] = block_bis + 1
       and extract(year from tage[i]) = extract(year from block_bis) then
      block_bis := tage[i];
    else
      insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days, request_group_id)
      values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0, v_gruppe);
      n_a := n_a + 1;
      block_von := tage[i]; block_bis := tage[i]; block_art := arten[i];
    end if;
  end loop;

  insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days, request_group_id)
  values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0, v_gruppe);
  n_a := n_a + 1;

  perform set_config('schichtplan.sammelantrag', '', true);

  select (array_agg(id order by start_date))[1],
         string_agg(distinct leave_kind_label(kind), ' und '),
         sum(requested_days)
    into v_erste, v_arten, v_tage_gesamt
  from leave_requests where request_group_id = v_gruppe;

  perform notify_leave_submitted(
    e.company_id, me, v_erste,
    e.first_name || ' ' || e.last_name, e.rotation_team,
    v_arten, tage[1], tage[array_length(tage, 1)], v_tage_gesamt, p_reason
  );

  return query select n_u, n_v, n_a;
end;
$function$;

create or replace function public.suggest_leave_kind(p_employee_id uuid, p_date date)
returns table(kind text, grund text, u_rest numeric, v_rest numeric)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  e employees; v_u numeric; v_v numeric;
  is_holiday boolean; is_sunday boolean; is_night boolean; sname text; lohnt boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  if p_employee_id is distinct from auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  select remaining_days, v_remaining_days into v_u, v_v
  from leave_balances_view where employee_id = p_employee_id and year = extract(year from p_date);
  v_u := coalesce(v_u,0); v_v := v_tage_rest(p_employee_id, extract(year from p_date)::int);

  if not is_planned_workday(p_employee_id, p_date) then
    return query select 'keins'::text, 'Freier Tag – kostet keinen Urlaub'::text, v_u, v_v;
    return;
  end if;

  select exists(select 1 from holidays h where h.date = p_date
    and (h.company_id = e.company_id or h.company_id is null)) into is_holiday;
  is_sunday := extract(dow from p_date) = 0;
  select name into sname from shifts where id = effective_shift_id(p_employee_id, p_date);
  is_night := coalesce(sname ilike 'Nacht%', false);

  if not e.shift_worker then
    if v_u > 0 then
      return query select 'urlaub'::text, 'Kein Schichtsystem – der Tag kostet Urlaub'::text, v_u, v_v;
    else
      return query select 'v_tag'::text, 'Urlaub aufgebraucht – V-Tag (darf ins Minus)'::text, v_u, v_v;
    end if;
    return;
  end if;

  lohnt := is_holiday or is_sunday or is_night;

  if lohnt and v_u > 0 then
    return query select 'urlaub'::text,
      case when is_holiday then 'Feiertag – mit Urlaub wird der Zuschlag mitbezahlt'
           when is_sunday  then 'Sonntag – mit Urlaub wird der Zuschlag mitbezahlt'
           else 'Nachtschicht – mit Urlaub wird der Zuschlag mitbezahlt' end, v_u, v_v;
  elsif lohnt and v_u <= 0 then
    return query select 'v_tag'::text,
      'Zuschlagstag, aber Urlaub aufgebraucht – V-Tag als Ersatz'::text, v_u, v_v;
  elsif not lohnt and v_v > 0 then
    return query select 'v_tag'::text,
      'Kein Zuschlagstag – V-Tag verwenden und Urlaub sparen'::text, v_u, v_v;
  elsif v_u > 0 then
    return query select 'urlaub'::text, 'V-Tage aufgebraucht – Urlaub wird verwendet'::text, v_u, v_v;
  else
    return query select 'v_tag'::text, 'Beide Konten aufgebraucht – V-Tag geht ins Minus'::text, v_u, v_v;
  end if;
end;
$function$;
