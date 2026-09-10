-- =============================================================
-- Phase 11 · Neue Unternehmen startklar + Muster-Editor
--
-- Problem: Ein frisch registriertes Unternehmen hat keine Schichten und
-- kein Rotationsmuster. Dadurch kann der Admin keine Schichtgruppe sinnvoll
-- vergeben und niemand sieht einen Plan.
--
-- Lösung:
--   1. register_company() legt automatisch die drei Standardschichten an
--      (Früh/Spät/Nacht, 7 Tage/Woche). KEIN Muster – das gibt der Admin
--      selbst ein (ausdrücklicher Wunsch).
--   2. save_rotation_pattern() – der Admin baut das Muster über die
--      Oberfläche: eine Kette aus Früh/Spät/Nacht/Frei-Blöcken. Das System
--      setzt es als EIN Unternehmensmuster; die Gruppen A/B/C/D laufen
--      versetzt (team_offset_days).
--   3. apply_rotation_to_all() – ordnet das Muster allen Mitarbeitern mit
--      Schichtgruppe zu, damit eine Änderung nicht händisch nachgezogen
--      werden muss.
-- =============================================================

create or replace function register_company(
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_email text
)
returns table (company_id uuid, employee_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid;
  v_employee_id uuid;
begin
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Bitte einen Unternehmensnamen angeben.';
  end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'Bitte Vor- und Nachnamen angeben.';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Bitte eine E-Mail-Adresse angeben.';
  end if;

  insert into companies (name) values (trim(p_company_name)) returning id into v_company_id;

  insert into employees (company_id, personnel_number, first_name, last_name, email, role, department)
  values (v_company_id, '10000', trim(p_first_name), trim(p_last_name), trim(p_email), 'admin', 'Verwaltung')
  returning id into v_employee_id;

  -- Standardschichten: rund um die Uhr, alle sieben Tage. Zeiten und
  -- Besetzung kann der Admin später anpassen.
  insert into shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values
    (v_company_id, 'Frühschicht', 'F', '06:00', '14:00', '#F59E0B', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Spätschicht', 'S', '14:00', '22:00', '#16A34A', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Nachtschicht', 'N', '22:00', '06:00', '#2F5BEA', 1, 1, '{0,1,2,3,4,5,6}');

  return query select v_company_id, v_employee_id;
end;
$$;

grant execute on function register_company(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- Muster speichern. Der Admin übergibt die Blockkette als JSONB, z. B.
-- [{"code":"F","days":2},{"code":"S","days":2},{"code":"N","days":3},{"code":"FREI","days":2}]
-- Das wird in die interne Form [{"shift":<uuid|null>,"days":n}] übersetzt.
--
-- team_offset_days wird automatisch gesetzt: Zykluslänge / 4, damit die vier
-- Gruppen gleichmäßig über den Zyklus verteilt starten. Bei einem 9-Tage-
-- Zyklus (2+2+3+2) sind das z. B. 2 Tage Versatz je Gruppe.
-- ---------------------------------------------------------------

create or replace function save_rotation_pattern(
  p_name text,
  p_anchor_date date,
  p_blocks jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid := auth_company_id();
  v_shift_f uuid;
  v_shift_s uuid;
  v_shift_n uuid;
  v_steps jsonb := '[]'::jsonb;
  v_block jsonb;
  v_cycle int := 0;
  v_pattern_id uuid;
  v_shift uuid;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf das Schichtmuster festlegen.';
  end if;
  if jsonb_typeof(p_blocks) is distinct from 'array' or jsonb_array_length(p_blocks) = 0 then
    raise exception 'Das Muster enthält keine Blöcke.';
  end if;

  select id into v_shift_f from shifts where company_id = v_company_id and short_name = 'F' limit 1;
  select id into v_shift_s from shifts where company_id = v_company_id and short_name = 'S' limit 1;
  select id into v_shift_n from shifts where company_id = v_company_id and short_name = 'N' limit 1;

  for v_block in select * from jsonb_array_elements(p_blocks) loop
    if (v_block->>'days')::int < 1 then
      raise exception 'Jeder Block braucht mindestens einen Tag.';
    end if;
    v_shift := case upper(v_block->>'code')
      when 'F' then v_shift_f
      when 'S' then v_shift_s
      when 'N' then v_shift_n
      else null  -- FREI oder unbekannt = frei
    end;
    v_steps := v_steps || jsonb_build_object('shift', v_shift, 'days', (v_block->>'days')::int);
    v_cycle := v_cycle + (v_block->>'days')::int;
  end loop;

  -- Vorhandenes aktives Muster ersetzen (ein Muster je Unternehmen).
  update rotation_patterns set active = false
    where company_id = v_company_id and active;

  insert into rotation_patterns (company_id, name, anchor_date, steps, team_offset_days, active)
  values (
    v_company_id,
    coalesce(nullif(trim(p_name), ''), 'Schichtmuster'),
    p_anchor_date,
    v_steps,
    greatest(1, round(v_cycle::numeric / 4)::int),
    true
  )
  returning id into v_pattern_id;

  return v_pattern_id;
end;
$$;

revoke execute on function save_rotation_pattern(text, date, jsonb) from public, anon;
grant execute on function save_rotation_pattern(text, date, jsonb) to authenticated;

-- ---------------------------------------------------------------
-- Muster allen Mitarbeitern mit Schichtgruppe zuordnen.
-- ---------------------------------------------------------------

create or replace function apply_rotation_to_all()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid := auth_company_id();
  v_pattern_id uuid;
  v_count int;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf das Schichtmuster zuweisen.';
  end if;

  select id into v_pattern_id from rotation_patterns
    where company_id = v_company_id and active
    order by created_at desc limit 1;

  if v_pattern_id is null then
    raise exception 'Es ist noch kein Schichtmuster hinterlegt.';
  end if;

  update employees
    set rotation_pattern_id = v_pattern_id
    where company_id = v_company_id
      and rotation_team is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function apply_rotation_to_all() from public, anon;
grant execute on function apply_rotation_to_all() to authenticated;

-- ---------------------------------------------------------------
-- Aktuelles Muster lesen, um es im Editor vorzubelegen.
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
          when (step->>'shift')::uuid = (select id from shifts where company_id = p.company_id and short_name='F' limit 1) then 'F'
          when (step->>'shift')::uuid = (select id from shifts where company_id = p.company_id and short_name='S' limit 1) then 'S'
          when (step->>'shift')::uuid = (select id from shifts where company_id = p.company_id and short_name='N' limit 1) then 'N'
          else 'FREI'
        end,
        'days', (step->>'days')::int
      ) order by ord
    ), '[]'::jsonb)
  from rotation_patterns p
  left join lateral jsonb_array_elements(p.steps) with ordinality as t(step, ord) on true
  where p.company_id = auth_company_id() and p.active
  group by p.id, p.name, p.anchor_date;
end;
$$;

revoke execute on function current_rotation_pattern() from public, anon;
grant execute on function current_rotation_pattern() to authenticated;
