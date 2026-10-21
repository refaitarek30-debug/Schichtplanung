-- Fünfte Rotationsgruppe E (z. B. 5-Schicht-Modelle). Bisher endete alles bei D.
-- Der Versatz je Gruppe ergibt sich weiter aus der Position im Alphabet mal dem
-- Abstand des Musters; save_rotation_pattern erlaubt jetzt bis zu fünf Gruppen.
alter type public.rotation_team add value if not exists 'E';

create or replace function public.employees_sync_rotation_offset()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  step int;
begin
  if new.rotation_team is null or new.rotation_pattern_id is null then
    new.rotation_offset_days := 0;
    return new;
  end if;

  select coalesce(team_offset_days, 7) into step
  from rotation_patterns where id = new.rotation_pattern_id;

  new.rotation_offset_days :=
    (array_position(array['A', 'B', 'C', 'D', 'E']::text[], new.rotation_team::text) - 1)
    * coalesce(step, 7);

  return new;
end;
$function$;

create or replace function public.save_rotation_pattern(p_name text, p_anchor_date date, p_blocks jsonb, p_teams integer default 4)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_company_id uuid := auth_company_id();
  v_shift_f uuid; v_shift_s uuid; v_shift_n uuid;
  v_steps jsonb := '[]'::jsonb; v_block jsonb; v_cycle int := 0; v_pattern_id uuid; v_shift uuid;
  v_teams int := greatest(1, least(5, coalesce(p_teams, 4)));
begin
  if not is_admin() then raise exception 'Nur die Administration darf das Schichtmuster festlegen.'; end if;
  if jsonb_typeof(p_blocks) is distinct from 'array' or jsonb_array_length(p_blocks) = 0 then
    raise exception 'Das Muster enthält keine Blöcke.'; end if;

  select id into v_shift_f from shifts where company_id = v_company_id and short_name = 'F' limit 1;
  select id into v_shift_s from shifts where company_id = v_company_id and short_name = 'S' limit 1;
  select id into v_shift_n from shifts where company_id = v_company_id and short_name = 'N' limit 1;

  for v_block in select * from jsonb_array_elements(p_blocks) loop
    if (v_block->>'days')::int < 1 then raise exception 'Jeder Block braucht mindestens einen Tag.'; end if;
    v_shift := case upper(v_block->>'code')
      when 'F' then v_shift_f when 'S' then v_shift_s when 'N' then v_shift_n else null end;
    v_steps := v_steps || jsonb_build_object('shift', v_shift, 'days', (v_block->>'days')::int);
    v_cycle := v_cycle + (v_block->>'days')::int;
  end loop;

  update rotation_patterns set active = false where company_id = v_company_id and active;

  insert into rotation_patterns (company_id, name, anchor_date, steps, team_offset_days, active)
  values (v_company_id, coalesce(nullif(trim(p_name), ''), 'Schichtmuster'), p_anchor_date,
          v_steps, greatest(1, round(v_cycle::numeric / v_teams)::int), true)
  returning id into v_pattern_id;
  return v_pattern_id;
end;
$function$;
