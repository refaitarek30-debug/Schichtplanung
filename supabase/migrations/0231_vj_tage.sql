-- =============================================================
-- 0231 · VJ-Tage (V-Tag aus der Jahresplanung) ab 2027
--
-- Vorgabe Urlaub 2027: Die V-Tage eines Jahres teilen sich in
--   - 75 % VJ-Tage: fest eingeplant, gelten für die Beschäftigten wie Urlaub,
--   - 25 % V-Tage: können bei dringender betrieblicher Notwendigkeit
--     widerrufen werden.
-- VJ wird aufgerundet (27 V-Tage → 21 VJ + 6 V). Es bleibt EIN Konto
-- (V-Tage); VJ ist nur eine Kennzeichnung am Antrag.
--
-- 1. leave_requests.v_jahresplanung: true = VJ, false = V, null = kein
--    V-Tag oder vor 2027.
-- 2. Trigger: neue V-Tag-Anträge ab 2027 werden VJ, solange das
--    VJ-Kontingent des Jahres reicht – sonst V.
-- 3. submit_leave_auto(): die automatische Verteilung nimmt bei V-Tagen
--    erst VJ, solange da, dann V (Tag für Tag, eigene Blöcke).
-- 4. schichtplan_kompakt(): je Tag ein fünfter Wert „VJ ja/nein“ – nur
--    wenn dort ohnehin „V“ sichtbar ist (gleiche Sichtbarkeit wie bisher).
-- =============================================================

alter table public.leave_requests add column if not exists v_jahresplanung boolean;
comment on column public.leave_requests.v_jahresplanung is
  'Nur bei V-Tagen ab 2027: true = VJ (Jahresplanung, wie Urlaub), false = V (widerrufbar). Sonst null.';

/** VJ-Kontingent eines Jahres: 75 % aller verfügbaren V-Tage, aufgerundet. */
create or replace function public.vj_kontingent(p_employee_id uuid, p_year integer)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(ceil(0.75 * (b.v_entitlement + b.v_carried_over + coalesce(b.v_korrektur, 0))), 0)
    from leave_balances b
   where b.employee_id = p_employee_id and b.year = p_year;
$$;

/** Noch freie VJ-Tage eines Jahres (beantragt und genehmigt zählen). */
create or replace function public.vj_rest(p_employee_id uuid, p_year integer, p_ohne uuid default null)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(vj_kontingent(p_employee_id, p_year), 0)
       - coalesce((select sum(r.requested_days) from leave_requests r
                    where r.employee_id = p_employee_id
                      and r.kind = 'v_tag'
                      and r.v_jahresplanung
                      and r.status in ('approved', 'pending')
                      and extract(year from r.start_date) = p_year
                      and r.id is distinct from p_ohne), 0);
$$;

revoke all on function public.vj_kontingent(uuid, integer) from public, anon;
revoke all on function public.vj_rest(uuid, integer, uuid) from public, anon;
grant execute on function public.vj_kontingent(uuid, integer) to authenticated;
grant execute on function public.vj_rest(uuid, integer, uuid) to authenticated;

/**
 * Kennzeichnung setzen. Läuft nach dem Berechnen der Tage (Name „zz_…“ –
 * Postgres führt BEFORE-Trigger alphabetisch aus). Wer schon true/false
 * mitgibt (die automatische Verteilung), behält das.
 */
create or replace function public.leave_requests_vj_setzen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind is distinct from 'v_tag' or extract(year from new.start_date) < 2027 then
    new.v_jahresplanung := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.kind = 'v_tag' and old.v_jahresplanung is not null
     and new.v_jahresplanung is null then
    new.v_jahresplanung := old.v_jahresplanung;
  end if;
  if new.v_jahresplanung is null then
    new.v_jahresplanung :=
      vj_rest(new.employee_id, extract(year from new.start_date)::int, new.id) >= coalesce(new.requested_days, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists zz_leave_requests_vj on public.leave_requests;
create trigger zz_leave_requests_vj
  before insert or update of kind, start_date on public.leave_requests
  for each row execute function public.leave_requests_vj_setzen();

-- Automatische Verteilung: bei V-Tagen erst VJ, solange da, dann V.
create or replace function public.submit_leave_auto(p_start_date date, p_end_date date, p_reason text default null)
returns table(urlaub_tage integer, v_tage integer, antraege integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  e employees; tag date; art leave_kind; jahr int; idx int;
  jahre int[] := '{}'; ru numeric[] := '{}'; rv numeric[] := '{}'; rvj numeric[] := '{}';
  tage date[] := '{}'; arten leave_kind[] := '{}'; vjs boolean[] := '{}';
  vj boolean;
  i int; block_von date; block_bis date; block_art leave_kind; block_vj boolean;
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
    ru := ru || coalesce((select remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || v_tage_rest(me, jahr);
    rvj := rvj || case when jahr >= 2027 then vj_rest(me, jahr) else 0 end;
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
    if art = 'urlaub' and ru[idx] < 1 then art := 'v_tag'; end if;
    if art = 'v_tag'  and rv[idx] < 1 and ru[idx] >= 1 then art := 'urlaub'; end if;
    vj := null;
    if art = 'urlaub' then
      ru[idx] := ru[idx] - 1; n_u := n_u + 1;
    else
      rv[idx] := rv[idx] - 1; n_v := n_v + 1;
      if extract(year from tag) >= 2027 then
        vj := rvj[idx] >= 1;
        if vj then rvj[idx] := rvj[idx] - 1; end if;
      end if;
    end if;
    tage  := tage  || tag;
    arten := arten || art;
    vjs   := vjs   || vj;
  end loop;

  if array_length(tage, 1) is null then
    raise exception 'In diesem Zeitraum hast du keinen eingeplanten Arbeitstag.';
  end if;

  perform set_config('schichtplan.sammelantrag', 'an', true);

  block_von := tage[1]; block_bis := tage[1]; block_art := arten[1]; block_vj := vjs[1];

  for i in 2 .. array_length(tage, 1) loop
    if arten[i] = block_art and vjs[i] is not distinct from block_vj and tage[i] = block_bis + 1
       and extract(year from tage[i]) = extract(year from block_bis) then
      block_bis := tage[i];
    else
      insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days, request_group_id, v_jahresplanung)
      values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0, v_gruppe, block_vj);
      n_a := n_a + 1;
      block_von := tage[i]; block_bis := tage[i]; block_art := arten[i]; block_vj := vjs[i];
    end if;
  end loop;

  insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days, request_group_id, v_jahresplanung)
  values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0, v_gruppe, block_vj);
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

-- Plan: fünfter Wert je Tag = VJ (nur wo „V“/„v“ ohnehin sichtbar ist).
create or replace function public.schichtplan_kompakt(p_company_id uuid, p_from date, p_days integer)
returns table(employee_id uuid, employee_name text, rotation_team text, personnel_number text, is_me boolean, is_apprentice boolean, tage jsonb)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select g.employee_id,
         min(g.employee_name),
         min(g.rotation_team),
         min(g.personnel_number),
         bool_or(g.is_me),
         bool_or(g.is_apprentice),
         jsonb_agg(jsonb_build_array(
           g.day, g.shift_name, g.shift_code, g.absence_code,
           g.absence_code in ('V', 'v') and exists (
             select 1 from public.leave_requests r
              where r.employee_id = g.employee_id
                and r.kind = 'v_tag'
                and r.v_jahresplanung
                and r.status in ('approved', 'pending')
                and g.day between r.start_date and r.end_date)
         ) order by g.day)
    from public.shift_plan_grid(p_company_id, p_from, p_days) with ordinality as g(
           employee_id, employee_name, rotation_team, personnel_number, day,
           shift_name, shift_code, absence_code, is_me, is_apprentice, nr)
   group by g.employee_id
   order by min(g.nr);
$function$;

-- Einmalig: schon gestellte V-Tag-Anträge ab 2027 einteilen – nach
-- Antragsreihenfolge VJ, solange das Kontingent reicht, danach V.
-- Abgelehnte und zurückgenommene bekommen nur die Kennzeichnung, zählen aber nicht.
do $$
declare
  r record;
begin
  for r in
    select id, employee_id, extract(year from start_date)::int as jahr, requested_days
      from leave_requests
     where kind = 'v_tag' and start_date >= date '2027-01-01' and v_jahresplanung is null
       and status in ('approved', 'pending')
     order by created_at, start_date
  loop
    update leave_requests
       set v_jahresplanung = vj_rest(r.employee_id, r.jahr, r.id) >= r.requested_days
     where id = r.id;
  end loop;
  update leave_requests set v_jahresplanung = false
   where kind = 'v_tag' and start_date >= date '2027-01-01' and v_jahresplanung is null;
end;
$$;
