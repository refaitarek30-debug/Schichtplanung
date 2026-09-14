-- ---------------------------------------------------------------
-- Urlaub fuer Mitarbeiter ohne Schichtzuordnung
--
-- preview_leave_auto() und submit_leave_auto() haben jeden Tag
-- uebersprungen, an dem effective_shift_id() null liefert. Wer keiner
-- Schicht und keinem Rotationsmuster zugeordnet ist -- Verwaltung,
-- Betriebsleitung und vor allem jeder frisch eingeladene Mitarbeiter,
-- der noch keine Schicht hat -- hatte damit *nie* einen Arbeitstag.
-- Das Formular meldete "In diesem Zeitraum hast du keinen eingeplanten
-- Arbeitstag" und der Knopf blieb grau: Urlaub war fuer diese Personen
-- gar nicht beantragbar.
--
-- calculate_leave_days_for_employee() kennt den Fall laengst und
-- rechnet dann Montag bis Freitag ohne Feiertage. Genau diese Regel
-- bekommt hier einen Namen und wird ueberall verwendet, damit Vorschau,
-- Einreichung und Tagesberechnung dieselbe Antwort geben.
-- ---------------------------------------------------------------

create or replace function is_planned_workday(p_employee_id uuid, p_date date)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then
    return false;
  end if;

  -- Schichtbetrieb: allein der Plan entscheidet. Feiertage sind hier
  -- bewusst Arbeitstage -- im durchlaufenden Betrieb wird an ihnen
  -- gearbeitet, deshalb sind sie spaeter auch Zuschlagstage.
  if e.shift_id is not null or e.rotation_pattern_id is not null then
    return effective_shift_id(p_employee_id, p_date) is not null;
  end if;

  -- Ohne Schicht: Montag bis Freitag, Feiertage frei. Dieselbe Regel wie
  -- in calculate_leave_days_for_employee().
  return extract(isodow from p_date) < 6
     and not exists (
       select 1 from holidays h
        where h.date = p_date
          and (h.company_id = e.company_id or h.company_id is null)
     );
end;
$$;

revoke execute on function is_planned_workday(uuid, date) from public, anon;
grant execute on function is_planned_workday(uuid, date) to authenticated;

-- ---------------------------------------------------------------
-- Vorschau der Automatik -- nur die Arbeitstagspruefung aendert sich.
-- ---------------------------------------------------------------

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

-- ---------------------------------------------------------------
-- Einreichen der Automatik -- gleiche Aenderung, damit Vorschau und
-- Ergebnis nicht auseinanderlaufen.
-- ---------------------------------------------------------------

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
    continue when not is_planned_workday(me, tag);
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

  -- Zweiter Durchgang: aufeinanderfolgende Tage gleicher Art buendeln.
  -- Ein Jahreswechsel trennt zusaetzlich, damit jeder Antrag eindeutig
  -- zu einem Urlaubsjahr gehoert.
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

-- ---------------------------------------------------------------
-- Empfehlung Urlaub vs. V-Tag: "Freier Tag" wurde bisher allein daran
-- festgemacht, dass keine Schicht hinterlegt ist. Fuer jemanden ohne
-- Schichtzuordnung war damit jeder Tag ein freier Tag.
-- ---------------------------------------------------------------

create or replace function suggest_leave_kind(p_employee_id uuid, p_date date)
returns table (kind text, grund text, u_rest numeric, v_rest numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  e employees; v_u numeric; v_v numeric;
  is_holiday boolean; is_sunday boolean; is_night boolean; sname text; lohnt boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  select remaining_days, v_remaining_days into v_u, v_v
  from leave_balances_view where employee_id = p_employee_id and year = extract(year from p_date);
  v_u := coalesce(v_u,0); v_v := coalesce(v_v,0);

  -- Kein Arbeitstag -> nichts nötig
  if not is_planned_workday(p_employee_id, p_date) then
    return query select 'keins'::text, 'Freier Tag – kostet keinen Urlaub'::text, v_u, v_v;
    return;
  end if;

  select exists(select 1 from holidays h where h.date = p_date
    and (h.company_id = e.company_id or h.company_id is null)) into is_holiday;
  is_sunday := extract(dow from p_date) = 0;
  select name into sname from shifts where id = effective_shift_id(p_employee_id, p_date);
  is_night := coalesce(sname ilike 'Nacht%', false);

  -- Ohne Schichtsystem gibt es keine Zuschlagstage und keine V-Tage.
  if not e.shift_worker then
    if v_u > 0 then
      return query select 'urlaub'::text, 'Kein Schichtsystem – der Tag kostet Urlaub'::text, v_u, v_v;
    else
      return query select 'keins'::text, 'Dein Urlaubskonto ist aufgebraucht'::text, v_u, v_v;
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
    return query select 'keins'::text, 'Beide Konten sind aufgebraucht'::text, v_u, v_v;
  end if;
end;
$$;

revoke execute on function suggest_leave_kind(uuid, date) from public, anon;
grant execute on function suggest_leave_kind(uuid, date) to authenticated;

-- ---------------------------------------------------------------
-- current_rotation_pattern() ist seit 0019 bei jedem Aufruf mit
-- "column reference id is ambiguous" abgebrochen: der Rueckgabespalte
-- id stand ein unqualifiziertes "select id from shifts" gegenueber.
-- Der Mustereditor hat den Fehler geschluckt und deshalb immer leer
-- geoeffnet, statt das vorhandene Muster zu zeigen.
-- ---------------------------------------------------------------

create or replace function current_rotation_pattern()
returns table (id uuid, name text, anchor_date date, blocks jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth_company_id() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select p.id, p.name, p.anchor_date,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'code', case
          when (step->>'shift') is null then 'FREI'
          when (step->>'shift')::uuid =
               (select s.id from shifts s where s.company_id = p.company_id and s.short_name = 'F' limit 1) then 'F'
          when (step->>'shift')::uuid =
               (select s.id from shifts s where s.company_id = p.company_id and s.short_name = 'S' limit 1) then 'S'
          when (step->>'shift')::uuid =
               (select s.id from shifts s where s.company_id = p.company_id and s.short_name = 'N' limit 1) then 'N'
          else 'FREI'
        end,
        'days', (step->>'days')::int
      ) order by ord
    ) filter (where step is not null), '[]'::jsonb)
  from rotation_patterns p
  left join lateral jsonb_array_elements(p.steps) with ordinality as t(step, ord) on true
  where p.company_id = auth_company_id() and p.active
  group by p.id, p.name, p.anchor_date;
end;
$$;

revoke execute on function current_rotation_pattern() from public, anon;
grant execute on function current_rotation_pattern() to authenticated;
