-- =============================================================
-- Phase 9 · Schichtgruppen A/B/C/D statt fester Schicht
--
-- Bisher: employees.shift_id = feste Schicht. Das passt nicht zum
-- Betrieb – im Rotationsbetrieb hat niemand eine feste Schicht, sondern
-- gehört zu einer Gruppe (A/B/C/D), die das gemeinsame Muster mit einem
-- Versatz durchläuft.
--
-- Neu: employees.rotation_team ('A'..'D'). Der bisher manuell gepflegte
-- rotation_offset_days wird daraus automatisch berechnet und ist damit
-- nicht mehr von Hand verstellbar (eine Fehlerquelle weniger).
-- shift_id bleibt als Feld bestehen – für Tagdienst/Verwaltung, also
-- Personen ohne Rotation.
-- =============================================================

-- ---------------------------------------------------------------
-- 1) Qualifikation umbenennen
-- ---------------------------------------------------------------

alter type qualification rename value 'labor_b_schein' to 'b_schein_verantwortlich';

-- ---------------------------------------------------------------
-- 2) Versatz je Gruppe konfigurierbar am Muster
--
-- Bei einem 28-Tage-Muster mit vier Gruppen sind das 7 Tage. Steht am
-- Muster, damit ein Betrieb mit anderem Rhythmus nicht auf 7 festgenagelt
-- ist.
-- ---------------------------------------------------------------

alter table rotation_patterns
  add column if not exists team_offset_days int not null default 7;

comment on column rotation_patterns.team_offset_days is
  'Versatz zwischen zwei benachbarten Schichtgruppen in Tagen. '
  'Bei 28-Tage-Zyklus und vier Gruppen: 7.';

-- ---------------------------------------------------------------
-- 3) Schichtgruppe am Mitarbeiter
-- ---------------------------------------------------------------

do $$ begin
  create type rotation_team as enum ('A', 'B', 'C', 'D');
exception when duplicate_object then null; end $$;

alter table employees
  add column if not exists rotation_team rotation_team;

comment on column employees.rotation_team is
  'Schichtgruppe im Rotationsbetrieb. Bestimmt zusammen mit dem Muster '
  'automatisch rotation_offset_days. NULL = keine Rotation (z. B. Tagdienst), '
  'dann gilt die feste Zuordnung shift_id.';

-- Versatz automatisch aus der Gruppe ableiten – nie mehr von Hand setzen.
create or replace function employees_sync_rotation_offset()
returns trigger language plpgsql security definer set search_path = public as $$
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
    (array_position(array['A', 'B', 'C', 'D']::text[], new.rotation_team::text) - 1)
    * coalesce(step, 7);

  return new;
end;
$$;

drop trigger if exists employees_rotation_offset on employees;
create trigger employees_rotation_offset
  before insert or update of rotation_team, rotation_pattern_id
  on employees
  for each row execute function employees_sync_rotation_offset();

-- Bestandsdaten: aus dem bisherigen Versatz die passende Gruppe ableiten.
update employees e
set rotation_team = (
  case (e.rotation_offset_days / nullif(coalesce(p.team_offset_days, 7), 0))
    when 0 then 'A' when 1 then 'B' when 2 then 'C' when 3 then 'D'
  end
)::rotation_team
from rotation_patterns p
where e.rotation_pattern_id = p.id
  and e.rotation_team is null;
