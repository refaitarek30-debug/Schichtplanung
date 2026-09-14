-- =============================================================
-- Phase 15 · Schicht im Plan setzen räumt den Tag frei
--
-- assign_shift() hat bisher nur eine Zeile in shift_assignments
-- geschrieben. Ein genehmigter Urlaub oder V-Tag an demselben Tag blieb
-- dabei stehen – und weil shift_plan_grid() die Abwesenheit über die
-- Schicht legt, sah die Matrix danach exakt so aus wie vorher. Wer im
-- Plan ein "V" wieder auf die Schicht stellen wollte, klickte ins Leere:
-- gespeichert wurde, sichtbar wurde nichts.
--
-- Jemanden für einen Tag auf eine Schicht zu setzen heißt: an diesem Tag
-- wird gearbeitet. Also fällt der Urlaub, V-Tag bzw. die Abwesenheit für
-- genau diesen einen Tag weg – ein mehrtägiger Antrag drumherum bleibt
-- bestehen (das erledigt split_leave_request_day). Beides passiert in
-- einer Transaktion, damit nie der Urlaub verschwindet, ohne dass die
-- Schicht ankommt.
-- =============================================================

create or replace function plan_set_shift(
  p_employee_id uuid,
  p_date date,
  p_shift_id uuid          -- null = ausdrücklich frei
)
returns void language plpgsql security definer set search_path = public as $$
declare
  e employees;
  target_shift shifts;
  r leave_requests;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;

  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_shift_id is not null then
    select * into target_shift from shifts where id = p_shift_id;
    if target_shift.id is null then
      raise exception 'Schicht nicht gefunden.';
    end if;
    if target_shift.company_id is distinct from e.company_id then
      raise exception 'Mitarbeiter und Schicht gehören zu unterschiedlichen Unternehmen.';
    end if;
  end if;

  -- Urlaub und V-Tage dieses Tages herauslösen. Die Schleife greift nur
  -- mehrfach, falls sich Anträge überlappen; split_leave_request_day kürzt
  -- oder löscht den gefundenen Antrag, deckt ihn also nie erneut ab.
  loop
    select * into r
      from leave_requests
     where employee_id = p_employee_id
       and status in ('approved', 'pending')
       and p_date between start_date and end_date
     order by start_date
     limit 1;
    exit when r.id is null;
    perform split_leave_request_day(r, p_date, null);
  end loop;

  delete from absences where employee_id = p_employee_id and date = p_date;

  insert into shift_assignments (company_id, employee_id, shift_id, date)
  values (e.company_id, p_employee_id, p_shift_id, p_date)
  on conflict (employee_id, date) do update set shift_id = excluded.shift_id;
end;
$$;

revoke execute on function plan_set_shift(uuid, date, uuid) from public, anon;
grant execute on function plan_set_shift(uuid, date, uuid) to authenticated;
