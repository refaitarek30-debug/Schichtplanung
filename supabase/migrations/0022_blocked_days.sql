-- =============================================================
-- Phase 13 · Urlaubssperren im Schichtplan sichtbar machen
--
-- Liefert für einen Zeitraum alle Tage, an denen eine Urlaubssperre gilt,
-- samt Grund. So kann die Matrix diese Tage markieren.
-- =============================================================

create or replace function blocked_days(p_from date, p_to date)
returns table (day date, reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth_company_id() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  return query
  select gs.day::date, r.value ->> 'reason'
  from generate_series(p_from, p_to, interval '1 day') as gs(day)
  join staffing_rules r
    on r.company_id = auth_company_id()
    and r.key = 'urlaubssperre'
    and r.active
    and (r.value ->> 'start')::date <= gs.day::date
    and (r.value ->> 'end')::date >= gs.day::date
  group by gs.day::date, r.value ->> 'reason';
end;
$$;

revoke execute on function blocked_days(date, date) from public, anon;
grant execute on function blocked_days(date, date) to authenticated;
