-- =============================================================
-- Phase C · Einrichtungsassistent fuer neue Firmen
--
-- Bisher endete die Registrierung im Dashboard -- mit Standard-Feiertagen
-- aus Nordrhein-Westfalen, drei Schichten, keinem Schichtmuster und einem
-- einzigen Personalstammsatz. Was zu tun ist, stand nirgends; es verteilte
-- sich auf drei Verwaltungsseiten, die man erst finden muss.
--
-- Der Assistent fuehrt durch dieselben Funktionen, die es schon gibt
-- (set_company_state, save_rotation_pattern, createEmployee). Neu ist nur,
-- dass die Anwendung sich merkt, ob die Einrichtung durch ist.
-- =============================================================

alter table companies
  add column if not exists setup_completed_at timestamptz;

comment on column companies.setup_completed_at is
  'Zeitpunkt, zu dem der Einrichtungsassistent abgeschlossen wurde. Null = noch offen.';

-- Bestandsfirmen haben ihre Feiertage und ihr Schichtsystem von Hand
-- eingerichtet. Sie duerfen nicht nachtraeglich in den Assistenten
-- gezwungen werden -- deshalb gelten sie als fertig. Aufrufen koennen sie
-- ihn weiterhin selbst ueber die Einstellungen.
update companies set setup_completed_at = coalesce(setup_completed_at, created_at)
 where setup_completed_at is null;

-- ---------------------------------------------------------------
-- Was ist schon eingerichtet? Speist die Fortschrittsanzeige.
-- ---------------------------------------------------------------

create or replace function setup_state()
returns table (
  abgeschlossen_at timestamptz,
  bundesland text,
  feiertage bigint,
  muster_vorhanden boolean,
  gruppen bigint,
  mitarbeiter bigint,
  mitarbeiter_mit_gruppe bigint
)
language sql stable security definer set search_path = public as $$
  select
    c.setup_completed_at,
    (select s.state from company_settings s where s.company_id = c.id),
    (select count(*) from holidays h where h.company_id = c.id),
    exists (select 1 from rotation_patterns r where r.company_id = c.id and r.active),
    (select count(distinct e.rotation_team) from employees e
      where e.company_id = c.id and e.active and e.rotation_team is not null),
    (select count(*) from employees e where e.company_id = c.id and e.active),
    (select count(*) from employees e
      where e.company_id = c.id and e.active and e.rotation_team is not null)
  from companies c
  where c.id = auth_company_id() and is_admin();
$$;

revoke execute on function setup_state() from public, anon;
grant execute on function setup_state() to authenticated;

-- ---------------------------------------------------------------
-- Einrichtung abschliessen bzw. wieder oeffnen.
-- ---------------------------------------------------------------

create or replace function complete_setup(p_abgeschlossen boolean default true)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_zeit timestamptz;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf die Einrichtung abschließen.';
  end if;

  update companies
     set setup_completed_at = case when p_abgeschlossen then now() else null end
   where id = auth_company_id()
  returning setup_completed_at into v_zeit;

  return v_zeit;
end;
$$;

revoke execute on function complete_setup(boolean) from public, anon;
grant execute on function complete_setup(boolean) to authenticated;

-- ---------------------------------------------------------------
-- Schichtmuster: Anzahl der Rotationsgruppen ist jetzt waehlbar.
--
-- Bisher stand team_offset_days fest auf round(Zyklus / 4) -- vier Gruppen
-- waren damit stillschweigend vorausgesetzt. Ein Betrieb mit drei oder
-- zwei Gruppen bekam einen Versatz, der nicht zu seinem Modell passt.
--
-- Der Parameter kommt mit Vorgabewert 4 dazu, damit der bestehende
-- dreiargumentige Aufruf unveraendert weiterlaeuft.
-- ---------------------------------------------------------------

drop function if exists save_rotation_pattern(text, date, jsonb);

create or replace function save_rotation_pattern(
  p_name text,
  p_anchor_date date,
  p_blocks jsonb,
  p_teams int default 4
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid := auth_company_id();
  v_shift_f uuid; v_shift_s uuid; v_shift_n uuid;
  v_steps jsonb := '[]'::jsonb; v_block jsonb; v_cycle int := 0; v_pattern_id uuid; v_shift uuid;
  v_teams int := greatest(1, least(4, coalesce(p_teams, 4)));
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
$$;

revoke execute on function save_rotation_pattern(text, date, jsonb, int) from public, anon;
grant execute on function save_rotation_pattern(text, date, jsonb, int) to authenticated;
