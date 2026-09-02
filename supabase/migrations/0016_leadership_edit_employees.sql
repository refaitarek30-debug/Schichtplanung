-- =============================================================
-- Phase 9 · Schichtleitung darf Mitarbeiterdaten bearbeiten
--
-- Bisher: nur Administration (Policy "Personaldaten verwaltet Admin",
-- FOR ALL). Neu: Schichtleitung darf bestehende Mitarbeitende ÄNDERN
-- (z. B. Schichtgruppe, Qualifikationen korrigieren) – aber weiterhin
-- KEINE neuen anlegen und KEINE löschen. Deshalb bewusst nur FOR UPDATE
-- statt FOR ALL.
--
-- Die Rollenvergabe selbst bleibt kritisch: eine Schichtleitung darf
-- niemandem (auch sich selbst nicht) die Admin-Rolle geben. Das erzwingt
-- der Trigger unten, weil eine RLS-Policy den ALTEN Wert einer Spalte
-- nicht mit dem NEUEN vergleichen kann.
-- =============================================================

create policy "Personaldaten aendert auch Schichtleitung" on employees
  for update using (
    company_id = auth_company_id() and auth_role() = 'shift_leader'
  )
  with check (
    company_id = auth_company_id() and auth_role() = 'shift_leader'
  );

create or replace function employees_guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Administration darf alles.
  if auth_role() = 'admin' then
    return new;
  end if;

  -- Schichtleitung darf die Rolle nicht verändern und niemanden zum
  -- Administrator machen.
  if auth_role() = 'shift_leader' and new.role is distinct from old.role then
    raise exception 'Nur die Administration darf Rollen vergeben.';
  end if;

  return new;
end;
$$;

drop trigger if exists employees_role_guard on employees;
create trigger employees_role_guard
  before update on employees
  for each row execute function employees_guard_role_change();
