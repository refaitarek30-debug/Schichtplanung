-- =============================================================
-- Phase 13c · Automatik über den Jahreswechsel
--
-- Bisher hat die Verteilung nur das Konto des Startjahres gelesen. Ein
-- Zeitraum vom 28.12. bis 5.1. hätte damit Tage aus dem neuen Jahr gegen
-- das alte Konto gerechnet. Jetzt wird je Jahr getrennt gezählt, und die
-- Konten der betroffenen Jahre werden vorher angelegt bzw. nachgezogen.
-- =============================================================

create or replace function submit_leave_auto(
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns table (urlaub_tage int, v_tage int, antraege int)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth_employee_id();
  e employees;
  tag date;
  art leave_kind;
  jahr int;
  idx int;
  jahre int[] := '{}';
  ru numeric[] := '{}';
  rv numeric[] := '{}';
  tage date[] := '{}';
  arten leave_kind[] := '{}';
  i int;
  block_von date;
  block_bis date;
  block_art leave_kind;
  n_u int := 0;
  n_v int := 0;
  n_a int := 0;
  offen int := 0;
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

  -- Konten aller betroffenen Jahre bereitstellen und einlesen.
  for jahr in
    select distinct extract(year from d)::int
      from generate_series(p_start_date, p_end_date, '1 day') d
     order by 1
  loop
    perform ensure_leave_balance(me, jahr);
    jahre := jahre || jahr;
    ru := ru || coalesce(
      (select remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || coalesce(
      (select v_remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
  end loop;

  -- Erster Durchgang: je Tag entscheiden, noch nichts schreiben.
  for tag in select d::date from generate_series(p_start_date, p_end_date, '1 day') d loop
    continue when effective_shift_id(me, tag) is null;
    continue when exists (
      select 1 from leave_requests r
       where r.employee_id = me and r.status in ('approved', 'pending')
         and tag between r.start_date and r.end_date
    );

    idx := array_position(jahre, extract(year from tag)::int);

    if not e.shift_worker then
      art := 'urlaub';
    elsif is_premium_day(me, tag) then
      art := 'urlaub';           -- Zuschlag wird mitbezahlt
    else
      art := 'v_tag';            -- Urlaub sparen
    end if;

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

  -- Zweiter Durchgang: aufeinanderfolgende Tage gleicher Art bündeln.
  -- Ein Jahreswechsel trennt zusätzlich, damit jeder Antrag eindeutig
  -- zu einem Urlaubsjahr gehört.
  block_von := tage[1];
  block_bis := tage[1];
  block_art := arten[1];

  for i in 2 .. array_length(tage, 1) loop
    if arten[i] = block_art
       and tage[i] = block_bis + 1
       and extract(year from tage[i]) = extract(year from block_bis) then
      block_bis := tage[i];
    else
      insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days)
      values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0);
      n_a := n_a + 1;
      block_von := tage[i];
      block_bis := tage[i];
      block_art := arten[i];
    end if;
  end loop;

  insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days)
  values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0);
  n_a := n_a + 1;

  return query select n_u, n_v, n_a;
end;
$$;

revoke execute on function submit_leave_auto(date, date, text) from public, anon;
grant execute on function submit_leave_auto(date, date, text) to authenticated;

create or replace function preview_leave_auto(p_start_date date, p_end_date date)
returns table (tag date, art text, grund text)
language plpgsql security definer set search_path = public as $$
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
    rv := rv || coalesce(
      (select v_remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
  end loop;

  for d in select g::date from generate_series(p_start_date, p_end_date, '1 day') g loop
    continue when effective_shift_id(me, d) is null;
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

    if k = 'urlaub' and ru[idx] < 1 and rv[idx] >= 1 then
      k := 'v_tag'; warum := 'Urlaub aufgebraucht';
    elsif k = 'v_tag' and rv[idx] < 1 and ru[idx] >= 1 then
      k := 'urlaub'; warum := 'V-Tage aufgebraucht';
    end if;

    if k = 'urlaub' then
      if ru[idx] < 1 then
        return query select d, 'keins'::text, 'beide Konten leer'::text; continue;
      end if;
      ru[idx] := ru[idx] - 1;
    else
      if rv[idx] < 1 then
        return query select d, 'keins'::text, 'beide Konten leer'::text; continue;
      end if;
      rv[idx] := rv[idx] - 1;
    end if;

    return query select d, k::text, warum;
  end loop;
end;
$$;

revoke execute on function preview_leave_auto(date, date) from public, anon;
grant execute on function preview_leave_auto(date, date) to authenticated;
