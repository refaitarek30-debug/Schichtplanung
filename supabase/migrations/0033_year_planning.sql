-- =============================================================
-- Phase 13b · Das kommende Jahr sauber planen
--
-- PROBLEM: ensure_leave_balance() hat den Übertrag beim ersten Zugriff
-- eingefroren. Wer im September 2026 seinen Urlaub für 2027 plant, hat
-- damit einen Übertrag festgeschrieben, der auf dem Rest von September
-- beruht – jeder weitere Urlaub in 2026 hätte ihn verändert, die Zahl
-- für 2027 wäre aber stehen geblieben.
--
-- Jetzt wird der Übertrag so lange nachgerechnet, wie das Vorjahr noch
-- läuft. Erst wenn es vorbei ist, steht die Zahl fest. Der Anspruch
-- selbst wird für künftige Jahre ebenfalls nachgezogen, damit eine
-- Änderung am Personalstammsatz nicht nur im laufenden Jahr ankommt.
--
-- Am Verfall ändert sich nichts: übertragene Tage gelten bis zum 31.03.
-- =============================================================

create or replace function ensure_leave_balance(p_employee_id uuid, p_year int)
returns void language plpgsql security definer set search_path = public as $$
declare
  e employees;
  prev_u numeric(4, 1) := 0;
  prev_v numeric(4, 1) := 0;
  vorjahr_laeuft boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not is_leadership() and p_employee_id is distinct from auth_employee_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_year < 2020 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  -- Solange das Vorjahr noch läuft, ist der Übertrag vorläufig.
  vorjahr_laeuft := extract(year from current_date)::int <= p_year - 1;

  select greatest(remaining_days, 0), greatest(v_remaining_days, 0)
    into prev_u, prev_v
    from leave_balances_view
   where employee_id = p_employee_id and year = p_year - 1;

  if not exists (select 1 from leave_balances where employee_id = p_employee_id and year = p_year) then
    insert into leave_balances (
      company_id, employee_id, year, entitlement, carried_over, v_entitlement, v_carried_over
    )
    values (
      e.company_id, p_employee_id, p_year::smallint,
      e.vacation_days, coalesce(prev_u, 0), e.v_days, coalesce(prev_v, 0)
    )
    on conflict (employee_id, year) do nothing;
    return;
  end if;

  -- Zeile ist da. Nachziehen, solange sich noch etwas ändern kann.
  if vorjahr_laeuft then
    update leave_balances
       set carried_over = coalesce(prev_u, 0),
           v_carried_over = coalesce(prev_v, 0),
           entitlement = e.vacation_days,
           v_entitlement = e.v_days,
           updated_at = now()
     where employee_id = p_employee_id
       and year = p_year
       and (carried_over is distinct from coalesce(prev_u, 0)
         or v_carried_over is distinct from coalesce(prev_v, 0)
         or entitlement is distinct from e.vacation_days
         or v_entitlement is distinct from e.v_days);
  end if;
end;
$$;

revoke execute on function ensure_leave_balance(uuid, int) from public, anon;
grant execute on function ensure_leave_balance(uuid, int) to authenticated;

/**
 * Konten aller Mitarbeiter für die Führung – für "Mein Team".
 * RLS auf leave_balances gibt der Führung ohnehin Einblick; diese
 * Funktion legt fehlende Jahreszeilen zusätzlich gleich mit an.
 */
create or replace function team_leave_balances(p_year int default null)
returns table (
  employee_id uuid, rest numeric, anspruch numeric, v_rest numeric, v_anspruch numeric
)
language plpgsql security definer set search_path = public as $$
declare
  y int := coalesce(p_year, extract(year from current_date)::int);
  ziel uuid;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  for ziel in select id from employees where company_id = auth_company_id() and active loop
    perform ensure_leave_balance(ziel, y);
  end loop;

  return query
  select v.employee_id, v.remaining_days, v.entitlement + v.carried_over,
         v.v_remaining_days, v.v_entitlement + v.v_carried_over
    from leave_balances_view v
    join employees e on e.id = v.employee_id
   where e.company_id = auth_company_id() and e.active and v.year = y;
end;
$$;

revoke execute on function team_leave_balances(int) from public, anon;
grant execute on function team_leave_balances(int) to authenticated;
