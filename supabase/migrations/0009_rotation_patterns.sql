-- =============================================================
-- Phase 6 · Rollierende Schichtmuster (4-Schicht-Rotation)
--
-- Bisher: feste Zuordnung (employees.shift_id) + tagesgenaue Ausnahmen
-- (shift_assignments, Phase 5). Beides kennt kein "Frei" als eigenen
-- Zustand und kein wiederkehrendes Muster.
--
-- Neu: ein Rotationsmuster je Unternehmen, das als Kette von Blöcken
-- beschrieben wird ("2 Tage Früh, 2 Tage Spät, 3 Tage Nacht, 2 Tage Frei,
-- …") und sich nach der Summe aller Blöcke wiederholt. Mitarbeitende
-- hängen mit einem Versatz (rotation_offset_days) daran – so laufen
-- mehrere Teams dasselbe Muster zeitversetzt.
-- =============================================================

-- ---------------------------------------------------------------
-- 1) "Frei" als echter Zustand
--
-- shift_assignments.shift_id wird nullable: eine Zeile mit NULL bedeutet
-- ausdrücklich "an diesem Tag frei" und überschreibt damit auch ein
-- Rotationsmuster. Das ist etwas anderes als "keine Zeile vorhanden"
-- (= keine Ausnahme, Muster bzw. feste Zuordnung gilt).
-- ---------------------------------------------------------------

alter table shift_assignments alter column shift_id drop not null;

comment on column shift_assignments.shift_id is
  'NULL bedeutet ausdrücklich "frei an diesem Tag". Eine fehlende Zeile '
  'bedeutet dagegen "keine Ausnahme" – dann gilt das Rotationsmuster bzw. '
  'die feste Zuordnung employees.shift_id.';

-- ---------------------------------------------------------------
-- 2) Rotationsmuster
--
-- `steps` ist ein JSON-Array von Blöcken in der Reihenfolge des Zyklus:
--   [{"shift": "<shift-uuid>", "days": 2}, {"shift": null, "days": 2}, …]
-- `shift: null` = Freiblock. Die Zykluslänge ist die Summe aller `days`.
-- `anchor_date` ist der Tag, an dem Position 0 des Musters liegt.
-- ---------------------------------------------------------------

create table rotation_patterns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  anchor_date date not null,
  steps jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint steps_is_array check (jsonb_typeof(steps) = 'array'),
  constraint steps_not_empty check (jsonb_array_length(steps) > 0)
);

create trigger rotation_patterns_updated_at
  before update on rotation_patterns for each row execute function set_updated_at();

alter table employees
  add column if not exists rotation_pattern_id uuid references rotation_patterns (id) on delete set null,
  add column if not exists rotation_offset_days int not null default 0;

comment on column employees.rotation_offset_days is
  'Versatz in Tagen innerhalb des Rotationsmusters. Vier Teams im selben '
  '28-Tage-Muster laufen z. B. mit 0, 7, 14 und 21 Tagen Versatz.';

create index on employees (rotation_pattern_id);

-- Zykluslänge = Summe aller Blocktage.
create or replace function rotation_cycle_length(p_pattern_id uuid)
returns int language sql stable as $$
  select coalesce(sum((step ->> 'days')::int), 0)::int
  from rotation_patterns p,
       lateral jsonb_array_elements(p.steps) as step
  where p.id = p_pattern_id;
$$;

-- ---------------------------------------------------------------
-- 3) Welche Schicht sagt das Muster für diesen Tag?
--
-- Rückgabe NULL bedeutet "frei laut Muster". Ob überhaupt ein Muster
-- greift, klärt effective_shift_id() weiter unten – deshalb hier bewusst
-- keine Unterscheidung zwischen "frei" und "kein Muster".
-- ---------------------------------------------------------------

create or replace function rotation_shift_for(p_employee_id uuid, p_date date)
returns uuid language plpgsql stable as $$
declare
  emp employees;
  pat rotation_patterns;
  cycle int;
  pos int;
  acc int := 0;
  step jsonb;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.rotation_pattern_id is null then
    return null;
  end if;

  select * into pat from rotation_patterns
   where id = emp.rotation_pattern_id and active;
  if pat.id is null then
    return null;
  end if;

  cycle := rotation_cycle_length(pat.id);
  if cycle <= 0 then
    return null;
  end if;

  -- Modulo in PostgreSQL kann negativ werden (Datum vor dem Anker),
  -- deshalb einmal aufaddieren und erneut normalisieren.
  pos := (((p_date - pat.anchor_date - emp.rotation_offset_days) % cycle) + cycle) % cycle;

  for step in select * from jsonb_array_elements(pat.steps) loop
    acc := acc + (step ->> 'days')::int;
    if pos < acc then
      return nullif(step ->> 'shift', '')::uuid;
    end if;
  end loop;

  return null;
end;
$$;

-- ---------------------------------------------------------------
-- 4) effective_shift_id neu: Ausnahme > Muster > feste Zuordnung
--
-- Ersetzt die Fassung aus 0008. Wichtig ist die Unterscheidung zwischen
-- "Zeile vorhanden, shift_id NULL" (= ausdrücklich frei) und "keine
-- Zeile" (= nächste Ebene fragen) – das leistet coalesce() nicht, deshalb
-- jetzt mit FOUND statt verschachteltem coalesce.
-- ---------------------------------------------------------------

create or replace function effective_shift_id(p_employee_id uuid, p_date date)
returns uuid language plpgsql stable as $$
declare
  assigned uuid;
  emp employees;
begin
  select shift_id into assigned from shift_assignments
   where employee_id = p_employee_id and date = p_date;
  if found then
    return assigned;              -- darf NULL sein = ausdrücklich frei
  end if;

  select * into emp from employees where id = p_employee_id;
  if emp.id is null then
    return null;
  end if;

  if emp.rotation_pattern_id is not null then
    return rotation_shift_for(p_employee_id, p_date);   -- NULL = frei laut Muster
  end if;

  return emp.shift_id;
end;
$$;

-- ---------------------------------------------------------------
-- 5) assign_shift: "frei" zulassen
--
-- p_shift_id NULL legt jetzt bewusst einen Freitag an, statt zu scheitern.
-- ---------------------------------------------------------------

create or replace function assign_shift(
  p_employee_id uuid,
  p_shift_id uuid,
  p_date date
)
returns shift_assignments language plpgsql security invoker as $$
declare
  result shift_assignments;
  emp employees;
  target_shift shifts;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_shift_id is not null then
    select * into target_shift from shifts where id = p_shift_id;
    if target_shift.id is null then
      raise exception 'Schicht nicht gefunden.';
    end if;
    if emp.company_id is distinct from target_shift.company_id then
      raise exception 'Mitarbeiter und Schicht gehören zu unterschiedlichen Unternehmen.';
    end if;
  end if;

  insert into shift_assignments (company_id, employee_id, shift_id, date)
  values (emp.company_id, p_employee_id, p_shift_id, p_date)
  on conflict (employee_id, date)
  do update set shift_id = excluded.shift_id
  returning * into result;

  return result;
end;
$$;

revoke execute on function assign_shift(uuid, uuid, date) from public;
grant execute on function assign_shift(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------
-- 6) Eigener Schichtplan (Mitarbeiteransicht)
--
-- Liefert für die angemeldete Person Tag für Tag die effektive Schicht –
-- inklusive Freitagen (shift_id NULL). Damit zeigt "Meine Schichten"
-- dieselbe Rotation, die auch in die Besetzungsrechnung eingeht, statt
-- wie bisher von einer festen Wochentagszuordnung auszugehen.
-- ---------------------------------------------------------------

create or replace function my_shift_plan(p_from date, p_days int)
returns table (
  date date,
  shift_id uuid,
  shift_name text,
  start_time time,
  end_time time,
  is_free boolean
) language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth_employee_id();
begin
  if me is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 120 then
    raise exception 'Zeitraum zu groß.';
  end if;

  return query
  select
    gs.day::date,
    s.id,
    s.name,
    s.start_time,
    s.end_time,
    (s.id is null)
  from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as gs(day)
  left join shifts s on s.id = effective_shift_id(me, gs.day::date)
  order by gs.day;
end;
$$;

revoke execute on function my_shift_plan(date, int) from public;
grant execute on function my_shift_plan(date, int) to authenticated;

-- ---------------------------------------------------------------
-- 7) Rotationsmuster lesen/verwalten
-- ---------------------------------------------------------------

alter table rotation_patterns enable row level security;

create policy "Rotationsmuster lesen" on rotation_patterns
  for select using (company_id = auth_company_id());

create policy "Rotationsmuster verwaltet Admin" on rotation_patterns
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

-- Vorschau eines Musters für einen Versatz – für die Verwaltungsansicht,
-- ohne dass dafür schon Mitarbeitende daran hängen müssen.
create or replace function rotation_preview(
  p_pattern_id uuid,
  p_offset_days int,
  p_from date,
  p_days int
)
returns table (date date, shift_id uuid, shift_name text, is_free boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  pat rotation_patterns;
  cycle int;
begin
  select * into pat from rotation_patterns where id = p_pattern_id;
  if pat.id is null or pat.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 120 then
    raise exception 'Zeitraum zu groß.';
  end if;

  cycle := rotation_cycle_length(pat.id);
  if cycle <= 0 then
    return;
  end if;

  return query
  with days as (
    select gs.day::date as d,
           ((((gs.day::date - pat.anchor_date - p_offset_days) % cycle) + cycle) % cycle) as pos
    from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as gs(day)
  ),
  blocks as (
    select
      nullif(step ->> 'shift', '')::uuid as sid,
      sum((step ->> 'days')::int) over (order by ord) as cum_end,
      sum((step ->> 'days')::int) over (order by ord) - (step ->> 'days')::int as cum_start
    from jsonb_array_elements(pat.steps) with ordinality as t(step, ord)
  )
  select d.d, b.sid, s.name, (b.sid is null)
  from days d
  join blocks b on d.pos >= b.cum_start and d.pos < b.cum_end
  left join shifts s on s.id = b.sid
  order by d.d;
end;
$$;

revoke execute on function rotation_preview(uuid, int, date, int) from public;
grant execute on function rotation_preview(uuid, int, date, int) to authenticated;
