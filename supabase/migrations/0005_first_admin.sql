-- =============================================================
-- Phase 2 · Ersten Administrator einrichten
--
-- Ablauf:
--   1. In Supabase unter Authentication → Users den ersten Benutzer
--      anlegen ("Add user" → E-Mail und Passwort, "Auto Confirm" an).
--   2. Die E-Mail unten eintragen und dieses Skript ausführen.
--
-- Danach existiert ein Profil mit Rolle 'admin', das mit dem
-- Mitarbeiterstammsatz verknüpft ist. Alle weiteren Benutzer werden
-- über die Einladungsfunktion in der Anwendung angelegt.
-- =============================================================

do $$
declare
  admin_email text := 'admin@muster-produktion.de';   -- <-- anpassen
  company uuid   := '11111111-1111-1111-1111-111111111111';
  auth_user uuid;
  employee uuid;
begin
  select id into auth_user from auth.users where email = admin_email;
  if auth_user is null then
    raise exception 'Kein Auth-Benutzer mit der Adresse % gefunden.', admin_email;
  end if;

  select id into employee
  from employees
  where company_id = company and email = admin_email;

  if employee is null then
    insert into employees (company_id, personnel_number, first_name, last_name, email, role, department)
    values (company, '10000', 'Erster', 'Administrator', admin_email, 'admin', 'Personal')
    returning id into employee;
  end if;

  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
  values (auth_user, company, employee, 'Erster', 'Administrator', admin_email, 'admin')
  on conflict (id) do update
    set role = 'admin', company_id = excluded.company_id, employee_id = excluded.employee_id;
end $$;
