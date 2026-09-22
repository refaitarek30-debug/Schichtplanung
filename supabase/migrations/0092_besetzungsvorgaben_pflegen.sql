-- Soll- und Mindestbesetzung pflegen, Zugeordnet richtig zaehlen.
--
-- Zwei getrennte Probleme, beide sichtbar als "0 / 0 / 0":
--
--   * Soll und Mindest stehen in shifts tatsaechlich auf 0. Dadurch greift
--     die ganze Besetzungspruefung ins Leere: staffing_for_day filtert auf
--     target_staff > 0, und check_leave_staffing_impact ebenso. Ohne Werte
--     kann keine Warnung entstehen.
--   * "Zugeordnet" wurde im Frontend als "Mitarbeiter mit genau dieser
--     Schicht" gezaehlt. Im Rotationsbetrieb hat niemand eine feste
--     Schicht -- alle rotieren. Die Zahl war deshalb immer 0.
--
-- Diese Migration aendert KEINE Werte. Sie gibt der Fuehrung nur die
-- Mittel, sie selbst zu setzen, und liefert die richtige Zahl fuer
-- "Zugeordnet". Welche Werte fachlich stimmen, weiss der Betrieb.

-- Setzen darf die Fuehrung. Die Tabellenrichtlinie auf shifts bleibt
-- unberuehrt (dort weiterhin nur Admin) -- geschrieben wird ausschliesslich
-- ueber diese Funktion, die genau ein Feldpaar anfasst und sonst nichts.
create or replace function public.set_shift_staffing(
  p_shift_id uuid,
  p_target int,
  p_minimum int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  v_vorher_target smallint;
  v_vorher_min smallint;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_target is null or p_minimum is null then
    raise exception 'Soll und Mindest müssen angegeben werden.';
  end if;
  if p_target < 0 or p_target > 999 or p_minimum < 0 or p_minimum > 999 then
    raise exception 'Bitte Werte zwischen 0 und 999 angeben.';
  end if;
  if p_minimum > p_target then
    raise exception 'Die Mindestbesetzung darf nicht über der Sollbesetzung liegen.';
  end if;

  select target_staff, minimum_staff into v_vorher_target, v_vorher_min
  from shifts where id = p_shift_id and company_id = v_firma;

  if v_vorher_target is null then
    raise exception 'Schicht nicht gefunden.';
  end if;

  update shifts
     set target_staff = p_target::smallint,
         minimum_staff = p_minimum::smallint,
         updated_at = now()
   where id = p_shift_id and company_id = v_firma;

  -- Besetzungsvorgaben steuern jede Urlaubsentscheidung. Wer sie aendert,
  -- soll nachvollziehbar sein.
  perform write_audit(
    v_firma, 'shift.staffing_changed', 'shifts', p_shift_id,
    jsonb_build_object(
      'soll_vorher', v_vorher_target, 'soll_nachher', p_target,
      'mindest_vorher', v_vorher_min, 'mindest_nachher', p_minimum
    )
  );
end;
$$;

revoke all on function public.set_shift_staffing(uuid, int, int) from public, anon;
grant execute on function public.set_shift_staffing(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Zugeordnet, Soll, Mindest je Schicht
-- ---------------------------------------------------------------------------
-- "Zugeordnet" ist die Zahl der Personen, die an diesem Tag laut Plan in
-- der Schicht stehen -- dieselbe Rechnung wie in staffing_snapshot, damit
-- die Uebersicht und die Warnungen nicht auseinanderlaufen koennen.
create or replace function public.shift_staffing_overview(p_date date default null)
returns table (
  shift_id uuid,
  shift_name text,
  short_name text,
  target int,
  minimum int,
  zugeordnet int,
  laeuft_heute boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  v_tag date := coalesce(p_date, current_date);
begin
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  return query
  select s.id, s.name, s.short_name,
         s.target_staff::int, s.minimum_staff::int,
         (select count(*)::int from employees e
           where e.active and e.company_id = v_firma
             and effective_shift_id(e.id, v_tag) = s.id),
         shift_runs_on(s, v_tag)
  from shifts s
  where s.company_id = v_firma and s.active
  order by s.start_time nulls last, s.name;
end;
$$;

revoke all on function public.shift_staffing_overview(date) from public, anon;
grant execute on function public.shift_staffing_overview(date) to authenticated;
