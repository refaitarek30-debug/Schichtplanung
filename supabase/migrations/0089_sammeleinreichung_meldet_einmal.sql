-- submit_leave_auto meldet die Einreichung einmal, mit dem ganzen Zeitraum.
--
-- Ergänzt 0088: dort schweigt der Zeilen-Auslöser bei gesetzter Markierung,
-- hier wird sie gesetzt und am Ende einmal gemeldet. Erst am Ende kennt die
-- Funktion den vollständigen Zeitraum -- die erste eingefügte Zeile kennt
-- nur ihren eigenen Block.
--
-- Gegenüber 0087 sonst unverändert: die Zerlegung in Blöcke gleicher Art
-- bleibt, weil Urlaubstage und V-Tage auf verschiedene Konten gehen. Neu
-- sind allein die Markierung und der abschliessende Hinweis.
create or replace function public.submit_leave_auto(
  p_start_date date, p_end_date date, p_reason text default null
)
returns table(urlaub_tage integer, v_tage integer, antraege integer)
language plpgsql security definer set search_path = public
as $function$
declare
  me uuid := auth_employee_id();
  e employees; tag date; art leave_kind; jahr int; idx int;
  jahre int[] := '{}'; ru numeric[] := '{}'; rv numeric[] := '{}';
  tage date[] := '{}'; arten leave_kind[] := '{}';
  i int; block_von date; block_bis date; block_art leave_kind;
  n_u int := 0; n_v int := 0; n_a int := 0; offen int := 0;
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
    rv := rv || coalesce((select v_remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
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
    if art = 'urlaub' and ru[idx] < 1 and rv[idx] >= 1 then art := 'v_tag'; end if;
    if art = 'v_tag'  and rv[idx] < 1 and ru[idx] >= 1 then art := 'urlaub'; end if;
    if art = 'urlaub' then
      if ru[idx] < 1 then offen := offen + 1; continue; end if;
      ru[idx] := ru[idx] - 1; n_u := n_u + 1;
    else
      if rv[idx] < 1 then offen := offen + 1; continue; end if;
      rv[idx] := rv[idx] - 1; n_v := n_v + 1;
    end if;
    tage  := tage  || tag;
    arten := arten || art;
  end loop;

  if offen > 0 then
    raise exception 'Für % Tag(e) reichen weder Urlaubstage noch V-Tage.', offen;
  end if;
  if array_length(tage, 1) is null then
    raise exception 'In diesem Zeitraum hast du keinen eingeplanten Arbeitstag.';
  end if;

  -- Ab hier schweigt der Zeilen-Ausloeser; gemeldet wird einmal am Ende.
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

revoke all on function public.submit_leave_auto(date, date, text) from public, anon;
grant execute on function public.submit_leave_auto(date, date, text) to authenticated;
