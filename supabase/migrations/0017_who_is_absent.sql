-- =============================================================
-- Phase 9 · "Wer fehlt heute?" – namentlich, für Führung
-- =============================================================

create or replace function who_is_absent(p_date date)
returns table (
  employee_id uuid,
  employee_name text,
  shift_name text,
  reason text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  -- Genehmigter Urlaub
  select e.id, e.first_name || ' ' || e.last_name,
         s.name, 'Urlaub'::text
  from leave_requests r
  join employees e on e.id = r.employee_id
  left join shifts s on s.id = effective_shift_id(e.id, p_date)
  where e.company_id = auth_company_id()
    and e.active
    and r.status = 'approved'
    and p_date between r.start_date and r.end_date

  union all

  -- Sonstige Abwesenheiten (Krankheit, Schulung, Sonstiges)
  select e.id, e.first_name || ' ' || e.last_name,
         s.name,
         case a.type
           when 'krank' then 'Krankheit'
           when 'schulung' then 'Schulung'
           else 'Sonstiges'
         end
  from absences a
  join employees e on e.id = a.employee_id
  left join shifts s on s.id = effective_shift_id(e.id, p_date)
  where e.company_id = auth_company_id()
    and e.active
    and a.date = p_date

  order by 2;
end;
$$;

revoke execute on function who_is_absent(date) from public, anon;
grant execute on function who_is_absent(date) to authenticated;
