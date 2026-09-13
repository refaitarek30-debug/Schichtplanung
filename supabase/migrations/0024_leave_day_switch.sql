-- =============================================================
-- Phase 11a · Einen einzelnen Tag im Schichtplan umstellen
--
-- Bisher stieg set_leave_for_day() stillschweigend aus, sobald für den Tag
-- schon ein Antrag existierte. Deshalb ließ sich ein U nicht in ein V
-- ändern. Jetzt wird genau dieser eine Tag aus dem bestehenden Antrag
-- herausgelöst und neu angelegt; der Rest des Zeitraums bleibt bestehen.
-- =============================================================

create or replace function split_leave_request_day(
  r leave_requests,
  p_date date,
  p_kind leave_kind
)
returns void language plpgsql security definer set search_path = public as $$
declare
  head_from date := r.start_date;
  head_to   date := p_date - 1;
  tail_from date := p_date + 1;
  tail_to   date := r.end_date;
begin
  -- Teil VOR dem Tag: kürzen, wenn dort noch ein Arbeitstag liegt, sonst weg.
  if head_to >= head_from
     and calculate_leave_days_for_employee(r.employee_id, head_from, head_to, null) > 0 then
    update leave_requests
       set end_date = head_to, half_day_period = null
     where id = r.id;
  else
    delete from leave_requests where id = r.id;
  end if;

  -- Teil NACH dem Tag als eigener Antrag, gleiche Art und gleicher Status.
  if tail_to >= tail_from
     and calculate_leave_days_for_employee(r.employee_id, tail_from, tail_to, null) > 0 then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at, requested_days
    )
    values (
      r.company_id, r.employee_id, tail_from, tail_to, r.status, r.kind,
      r.reason, r.reviewed_by, r.reviewed_at, 0
    );
  end if;

  -- Der herausgelöste Tag in der gewünschten Art. p_kind null = entfernen.
  if p_kind is not null then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at, requested_days
    )
    values (
      r.company_id, r.employee_id, p_date, p_date, 'approved', p_kind,
      'Direkt im Schichtplan geändert', auth.uid(), now(), 0
    );
  end if;
end;
$$;

revoke execute on function split_leave_request_day(leave_requests, date, leave_kind)
  from public, anon, authenticated;

create or replace function set_leave_for_day(
  p_employee_id uuid,
  p_date date,
  p_mode text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  e employees;
  r leave_requests;
  target leave_kind;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  select * into r
    from leave_requests
   where employee_id = p_employee_id
     and status in ('approved', 'pending')
     and p_date between start_date and end_date
   order by start_date
   limit 1;

  if p_mode = 'clear' then
    if r.id is null then return; end if;
    perform split_leave_request_day(r, p_date, null);
    return;
  end if;

  target := case when p_mode = 'v_tag' then 'v_tag'::leave_kind else 'urlaub'::leave_kind end;

  if r.id is null then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at
    )
    values (
      e.company_id, p_employee_id, p_date, p_date, 'approved', target,
      'Direkt im Schichtplan eingetragen', auth.uid(), now()
    );
    return;
  end if;

  -- Schon die gewünschte Art: nichts zu tun.
  if r.kind = target then return; end if;

  perform split_leave_request_day(r, p_date, target);
end;
$$;

revoke execute on function set_leave_for_day(uuid, date, text) from public, anon;
grant execute on function set_leave_for_day(uuid, date, text) to authenticated;
