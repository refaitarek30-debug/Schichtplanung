-- V-Tage in Stunden: 1 V-Tag = 7,5 Std.
--
-- Fehlzeiten mit Abzug von den V-Tagen gehen jetzt 1:1 als Stunden vom
-- V-Konto ab: 2 Std. früher gegangen = −2 V-Std. = 2/7,5 = 0,27 V-Tage
-- (vorher 2/8). Das AF-Ansparen rechnet weiter mit der 8-Std.-Schicht
-- (0,82 × gearbeitete Std./8), daran ändert sich nichts.
--
-- Beim Anwenden waren noch keine Fehlzeiten eingetragen – bestehende
-- Konten ändern sich dadurch nicht.

create or replace view public.leave_balances_view
with (security_invoker = true)
as
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
        ), fehl AS (
         SELECT f.employee_id,
            EXTRACT(year FROM f.tag)::integer AS jahr,
            sum(f.stunden) AS stunden
           FROM fehlzeiten f
          WHERE f.abzug = 'v'
          GROUP BY f.employee_id, (EXTRACT(year FROM f.tag)::integer)
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
    COALESCE(c.v_used, 0::bigint)::numeric + COALESCE(round(fe.stunden / 7.5, 4), 0::numeric) AS v_used_days,
    COALESCE(c.v_pending, 0::bigint)::numeric AS v_pending_days,
    b.v_entitlement + b.v_carried_over + b.v_korrektur - COALESCE(c.v_used, 0::bigint)::numeric - COALESCE(round(fe.stunden / 7.5, 4), 0::numeric) - COALESCE(c.v_pending, 0::bigint)::numeric AS v_remaining_days,
    b.created_at,
    b.updated_at,
    b.v_korrektur,
    COALESCE(fe.stunden, 0::numeric) AS v_fehl_stunden
   FROM leave_balances b
     LEFT JOIN counted c ON c.employee_id = b.employee_id AND c.jahr = b.year
     LEFT JOIN fehl fe ON fe.employee_id = b.employee_id AND fe.jahr = b.year;

-- Mitteilung: Abzug in V-Stunden und V-Tagen.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.fehlzeit_speichern(uuid,date,text,numeric,text,text)'::regprocedure) into d;
  if position($x$to_char(p_stunden / 8, 'FM990.00')), '.', ',') || ' V-Tage'$x$ in d) = 0 then
    raise exception 'Muster für die Mitteilung nicht gefunden.';
  end if;
  d := replace(d,
    $x$replace(trim(to_char(p_stunden / 8, 'FM990.00')), '.', ',') || ' V-Tage'$x$,
    $x$replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',') || ' V-Std. ('
      || replace(trim(to_char(p_stunden / 7.5, 'FM990.00')), '.', ',') || ' V-Tage)'$x$);
  execute d;
end $do$;
