-- =============================================================
-- Phase 6 · Beispielmuster: 4-Schicht-Rotation über 28 Tage
--
-- Bildet das real gefahrene Muster ab:
--   Schichtfolge  Früh → Spät → Nacht → Frei  (wiederholt sich)
--   Blocklängen   2 → 2 → 3 Tage              (wiederholt sich)
-- Weil 4 und 3 teilerfremd sind, ergeben sich 12 Blöcke = 28 Tage,
-- und jeder Schichttyp bekommt exakt 7 Tage pro Zyklus.
--
-- Vier Teams fahren dasselbe Muster mit 0/7/14/21 Tagen Versatz, damit an
-- jedem Tag alle drei Arbeitsschichten besetzt sind.
--
-- Voraussetzung: Schichten mit den Namen 'Frühschicht', 'Spätschicht' und
-- 'Nachtschicht' existieren im Unternehmen. Anpassen oder weglassen, wenn
-- die eigenen Schichten anders heißen.
-- =============================================================

do $$
declare
  target_company uuid;
  s_frueh uuid;
  s_spaet uuid;
  s_nacht uuid;
  pattern uuid;
begin
  -- Erstes Unternehmen nehmen; bei mehreren Mandanten hier gezielt setzen.
  select id into target_company from companies order by created_at limit 1;
  if target_company is null then
    raise notice 'Kein Unternehmen gefunden – Seed übersprungen.';
    return;
  end if;

  select id into s_frueh from shifts where company_id = target_company and name = 'Frühschicht';
  select id into s_spaet from shifts where company_id = target_company and name = 'Spätschicht';
  select id into s_nacht from shifts where company_id = target_company and name = 'Nachtschicht';

  if s_frueh is null or s_spaet is null or s_nacht is null then
    raise notice 'Früh-, Spät- oder Nachtschicht fehlt – Seed übersprungen.';
    return;
  end if;

  insert into rotation_patterns (company_id, name, anchor_date, steps)
  values (
    target_company,
    '4-Schicht-Rotation (28 Tage)',
    -- Ankertag: hier beginnt Position 0 des Musters (ein Frühschicht-Block).
    date '2026-12-28',
    jsonb_build_array(
      jsonb_build_object('shift', s_frueh, 'days', 2),
      jsonb_build_object('shift', s_spaet, 'days', 2),
      jsonb_build_object('shift', s_nacht, 'days', 3),
      jsonb_build_object('shift', null,    'days', 2),
      jsonb_build_object('shift', s_frueh, 'days', 2),
      jsonb_build_object('shift', s_spaet, 'days', 3),
      jsonb_build_object('shift', s_nacht, 'days', 2),
      jsonb_build_object('shift', null,    'days', 2),
      jsonb_build_object('shift', s_frueh, 'days', 3),
      jsonb_build_object('shift', s_spaet, 'days', 2),
      jsonb_build_object('shift', s_nacht, 'days', 2),
      jsonb_build_object('shift', null,    'days', 3)
    )
  )
  returning id into pattern;

  -- Aktive Mitarbeitende gleichmäßig auf vier Teams verteilen.
  -- Wer eine andere Aufteilung braucht, setzt rotation_offset_days einzeln.
  with numbered as (
    select id, (row_number() over (order by personnel_number, id) - 1) as n
    from employees
    where company_id = target_company and active
  )
  update employees e
  set rotation_pattern_id = pattern,
      rotation_offset_days = (numbered.n % 4) * 7
  from numbered
  where e.id = numbered.id;

  raise notice 'Rotationsmuster % angelegt, Zykluslänge % Tage.',
    pattern, rotation_cycle_length(pattern);
end $$;
