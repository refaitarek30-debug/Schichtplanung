-- =============================================================
-- Phase 14 · Urlaub direkt aus dem Schichtplan eintragen
--
-- Wenn Schichtleitung/Admin in der Matrix bei einem Mitarbeiter Urlaub
-- einträgt, soll das ein SOFORT GENEHMIGTER Urlaubsantrag sein – der
-- damit automatisch vom Urlaubskonto abgezogen wird (das übernimmt die
-- vorhandene leave_balances_view, die genehmigte Anträge gegenrechnet).
--
-- Kein neuer Abzugs-Mechanismus nötig: ein genehmigter leave_request wird
-- vom Konto bereits berücksichtigt. Wir legen ihn nur direkt mit
-- status='approved' an, statt den Umweg über pending + decide zu gehen.
-- Die Tagesberechnung (nur eingeplante Arbeitstage) läuft automatisch über
-- den bestehenden Trigger leave_requests_set_computed_days.
-- =============================================================

create or replace function set_leave_for_day(
  p_employee_id uuid,
  p_date date,
  p_mode text            -- 'urlaub' = genehmigten Urlaub setzen, 'clear' = entfernen
)
returns void language plpgsql security definer set search_path = public as $$
declare
  e employees;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;

  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_mode = 'clear' then
    -- Genehmigten Eintaggs-Urlaub an diesem Tag zurücknehmen.
    delete from leave_requests
    where employee_id = p_employee_id
      and start_date = p_date and end_date = p_date
      and status = 'approved';
    return;
  end if;

  -- Doppelte vermeiden: existiert schon ein Urlaub an dem Tag?
  if exists (
    select 1 from leave_requests
    where employee_id = p_employee_id
      and status in ('approved','pending')
      and p_date between start_date and end_date
  ) then
    return; -- schon vorhanden, nichts zu tun
  end if;

  -- Direkt genehmigt eintragen. Der Trigger berechnet requested_days
  -- (nur eingeplante Arbeitstage) selbst.
  insert into leave_requests (
    company_id, employee_id, start_date, end_date, status,
    reason, reviewed_by, reviewed_at
  )
  values (
    e.company_id, p_employee_id, p_date, p_date, 'approved',
    'Direkt im Schichtplan eingetragen', auth.uid(), now()
  );
end;
$$;

revoke execute on function set_leave_for_day(uuid, date, text) from public, anon;
grant execute on function set_leave_for_day(uuid, date, text) to authenticated;
