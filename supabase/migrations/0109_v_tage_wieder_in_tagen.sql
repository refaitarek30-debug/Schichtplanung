-- V-Tage wieder schlicht in Tagen – mit Hinzufügen und Abziehen.
--
-- Das V-Stundenkonto aus 0106 (+0,75 Std. je Schicht, −7,5 Std. je V-Tag)
-- war im Alltag zu umständlich. V-Tage werden wieder wie vorher in Tagen
-- geführt:
--   Rest = Jahresanspruch + Übertrag + Korrektur − genommen − beantragt
-- Neu ist die Korrektur: Schichtleitung (eigene Schicht) und
-- Administration können in der Verwaltung Tage hinzufügen oder abziehen.
-- Jede Buchung steht mit altem und neuem Wert im Protokoll.
--
-- Das AF-Stundenkonto bleibt unverändert.

-- 1. Korrekturspalte ----------------------------------------------------------
alter table public.leave_balances
  add column if not exists v_korrektur numeric(6,1) not null default 0;

comment on column public.leave_balances.v_korrektur is
  'Von Hand hinzugefügte (+) oder abgezogene (−) V-Tage in diesem Jahr.';

-- 2. Kontenansicht: Korrektur zählt mit --------------------------------------
-- Unverändert bis auf v_remaining_days; v_korrektur kommt als letzte Spalte
-- dazu (bestehende Spalten behalten Name und Reihenfolge).
create or replace view public.leave_balances_view with (security_invoker = true) as
 WITH leave_days AS (
         SELECT DISTINCT r.employee_id,
            gs.day::date AS day,
            r.status,
            r.kind,
            EXTRACT(year FROM gs.day)::integer AS jahr
           FROM leave_requests r
             CROSS JOIN LATERAL generate_series(r.start_date::timestamp with time zone, r.end_date::timestamp with time zone, '1 day'::interval) gs(day)
          WHERE (r.status = ANY (ARRAY['approved'::leave_status, 'pending'::leave_status])) AND is_planned_workday(r.employee_id, gs.day::date)
        ), counted AS (
         SELECT leave_days.employee_id,
            leave_days.jahr,
            count(*) FILTER (WHERE leave_days.kind = 'urlaub'::leave_kind AND leave_days.status = 'approved'::leave_status AND leave_days.day < CURRENT_DATE) AS used_days,
            count(*) FILTER (WHERE leave_days.kind = 'urlaub'::leave_kind AND leave_days.status = 'approved'::leave_status AND leave_days.day >= CURRENT_DATE) AS planned_days,
            count(*) FILTER (WHERE leave_days.kind = 'urlaub'::leave_kind AND leave_days.status = 'pending'::leave_status) AS pending_days,
            count(*) FILTER (WHERE leave_days.kind = 'urlaub'::leave_kind AND leave_days.status = 'approved'::leave_status AND leave_days.day <= make_date(leave_days.jahr, 3, 31)) AS used_until_march,
            count(*) FILTER (WHERE leave_days.kind = 'v_tag'::leave_kind AND leave_days.status = 'approved'::leave_status) AS v_used,
            count(*) FILTER (WHERE leave_days.kind = 'v_tag'::leave_kind AND leave_days.status = 'pending'::leave_status) AS v_pending
           FROM leave_days
          GROUP BY leave_days.employee_id, leave_days.jahr
        )
 SELECT b.id,
    b.company_id,
    b.employee_id,
    b.year,
    b.entitlement,
        CASE
            WHEN CURRENT_DATE <= make_date(b.year::integer, 3, 31) THEN b.carried_over
            ELSE LEAST(b.carried_over, COALESCE(c.used_until_march, 0::bigint)::numeric)
        END AS carried_over,
    COALESCE(c.used_days, 0::bigint)::numeric AS used_days,
    COALESCE(c.planned_days, 0::bigint)::numeric AS planned_days,
    COALESCE(c.pending_days, 0::bigint)::numeric AS pending_days,
    b.entitlement +
        CASE
            WHEN CURRENT_DATE <= make_date(b.year::integer, 3, 31) THEN b.carried_over
            ELSE LEAST(b.carried_over, COALESCE(c.used_until_march, 0::bigint)::numeric)
        END - COALESCE(c.used_days, 0::bigint)::numeric - COALESCE(c.planned_days, 0::bigint)::numeric - COALESCE(c.pending_days, 0::bigint)::numeric AS remaining_days,
    b.v_entitlement,
    b.v_carried_over,
    COALESCE(c.v_used, 0::bigint)::numeric AS v_used_days,
    COALESCE(c.v_pending, 0::bigint)::numeric AS v_pending_days,
    b.v_entitlement + b.v_carried_over + b.v_korrektur - COALESCE(c.v_used, 0::bigint)::numeric - COALESCE(c.v_pending, 0::bigint)::numeric AS v_remaining_days,
    b.created_at,
    b.updated_at,
    b.v_korrektur
   FROM leave_balances b
     LEFT JOIN counted c ON c.employee_id = b.employee_id AND c.jahr = b.year;

-- 3. V-Rest nur noch aus dem Tageskonto --------------------------------------
create or replace function public.v_tage_rest(p_employee_id uuid, p_year integer)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  r numeric;
begin
  select v_remaining_days into r from leave_balances_view
   where employee_id = p_employee_id and year = p_year;
  return coalesce(r, 0);
end;
$function$;

-- 4. V-Stundenstände stilllegen ----------------------------------------------
-- Die eingetragenen Stände werden vorher ins Protokoll geschrieben, damit
-- nichts verloren geht.
insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
select e.company_id, null, 'stundenkonto.v.stillgelegt', 'employees', e.id,
       jsonb_build_object('vorher_ab', e.v_ab, 'vorher_stunden', e.v_start_stunden,
                          'grund', 'V-Tage werden wieder in Tagen geführt (0109)')
  from employees e
 where e.v_ab is not null;

update employees set v_ab = null, v_start_stunden = 0 where v_ab is not null;

-- Neue V-Stundenstände gibt es nicht mehr; AF bleibt wie gehabt.
create or replace function public.set_stundenstand(p_employee_id uuid, p_art text, p_stunden numeric, p_stichtag date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_firma uuid := auth_company_id();
  e employees;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_art = 'v' then
    raise exception 'V-Tage werden in Tagen geführt – bitte in der Verwaltung Tage hinzufügen oder abziehen.';
  end if;
  if p_art is distinct from 'af' then
    raise exception 'Unbekanntes Konto.';
  end if;
  select * into e from employees where id = p_employee_id and company_id = v_firma;
  if e.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if p_stichtag is not null then
    if p_stichtag < date '2000-01-01' or p_stichtag > current_date then
      raise exception 'Das Datum des Stands darf nicht in der Zukunft liegen.';
    end if;
    if p_stunden is null or p_stunden < -500 or p_stunden > 2000 then
      raise exception 'Bitte einen Stundenstand zwischen -500 und 2000 angeben.';
    end if;
  end if;

  update employees
     set af_ab = p_stichtag,
         af_start_stunden = case when p_stichtag is null then 0 else round(p_stunden, 2) end
   where id = p_employee_id;

  perform write_audit(v_firma, 'stundenkonto.af', 'employees', p_employee_id,
    jsonb_build_object(
      'vorher_ab', e.af_ab,
      'vorher_stunden', e.af_start_stunden,
      'nachher_ab', p_stichtag, 'nachher_stunden', p_stunden));
end;
$function$;

-- 5. Tage hinzufügen oder abziehen -------------------------------------------
-- p_tage > 0 fügt hinzu, < 0 zieht ab. Wer darf: dieselbe Regel wie beim
-- Genehmigen (Administration alle, Schichtleitung die eigene Schicht).
create or replace function public.v_tage_buchen(p_employee_id uuid, p_year integer, p_tage numeric, p_grund text default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  v_vorher numeric;
  v_rest numeric;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if not exists (select 1 from employees where id = p_employee_id and company_id = v_firma) then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not darf_urlaub_entscheiden(p_employee_id) then
    raise exception 'V-Tage ändern darfst du nur für deine eigene Schicht.';
  end if;
  if p_year is null or p_year < 2020 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  if p_tage is null or p_tage = 0 or abs(p_tage) > 100 or p_tage * 2 <> round(p_tage * 2) then
    raise exception 'Bitte eine Anzahl Tage angeben (z. B. 1, 2 oder 0,5 – höchstens 100).';
  end if;

  perform ensure_leave_balance(p_employee_id, p_year);

  select v_korrektur into v_vorher
    from leave_balances where employee_id = p_employee_id and year = p_year;
  if v_vorher is null then
    raise exception 'Für dieses Jahr gibt es noch kein Konto.';
  end if;

  update leave_balances
     set v_korrektur = v_korrektur + p_tage,
         updated_at = now()
   where employee_id = p_employee_id and year = p_year;

  select v_remaining_days into v_rest
    from leave_balances_view where employee_id = p_employee_id and year = p_year;

  perform write_audit(v_firma, 'v_tage.gebucht', 'leave_balances', p_employee_id,
    jsonb_build_object('jahr', p_year, 'tage', p_tage, 'grund', nullif(trim(p_grund), ''),
                       'korrektur_vorher', v_vorher, 'korrektur_nachher', v_vorher + p_tage,
                       'rest_nachher', v_rest));
  return v_rest;
end;
$$;

revoke all on function public.v_tage_buchen(uuid, integer, numeric, text) from public, anon;
grant execute on function public.v_tage_buchen(uuid, integer, numeric, text) to authenticated;

-- 6. Übersicht für die Verwaltung ---------------------------------------------
create or replace function public.v_tage_uebersicht(p_year integer)
returns table (
  employee_id uuid,
  anspruch numeric,
  uebertrag numeric,
  korrektur numeric,
  genommen numeric,
  beantragt numeric,
  rest numeric,
  darf_buchen boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id,
         coalesce(v.v_entitlement, e.v_days, 0),
         coalesce(v.v_carried_over, 0),
         coalesce(v.v_korrektur, 0),
         coalesce(v.v_used_days, 0),
         coalesce(v.v_pending_days, 0),
         coalesce(v.v_remaining_days, e.v_days, 0),
         darf_urlaub_entscheiden(e.id)
    from employees e
    left join leave_balances_view v on v.employee_id = e.id and v.year = p_year
   where e.company_id = auth_company_id()
     and e.active
     and is_leadership();
$$;

revoke all on function public.v_tage_uebersicht(integer) from public, anon;
grant execute on function public.v_tage_uebersicht(integer) to authenticated;
