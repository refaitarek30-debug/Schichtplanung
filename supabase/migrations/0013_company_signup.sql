-- =============================================================
-- Phase 7 · Selbstständige Registrierung neuer Unternehmen
--
-- Bisher wurde jedes Unternehmen (samt erstem Admin) von Hand per SQL
-- angelegt. Diese Migration macht daraus einen echten Self-Signup:
-- ein Formular auf /registrieren legt Unternehmen + ersten Admin
-- gemeinsam an, ganz ohne Zugriff auf die Datenbank.
--
-- Ablauf:
--   1. Client ruft register_company() auf (anon erlaubt – einziger
--      bewusst öffentlicher Einstiegspunkt im ganzen Schema).
--   2. Die Funktion legt `companies` + `employees` (role='admin') an
--      und gibt beide IDs zurück.
--   3. Client ruft supabase.auth.signUp() mit company_id/employee_id
--      in den User-Metadaten auf.
--   4. Der bereits vorhandene Trigger handle_new_user() (aus 0001)
--      liest diese Metadaten und legt automatisch das passende
--      `profiles`-Profil an – unverändert, kein neuer Code nötig.
--
-- Mandantentrennung ist dadurch nicht gefährdet: register_company()
-- erzeugt nur eine völlig neue, leere company_id. Alle bestehenden
-- RLS-Policies (company_id = auth_company_id()) greifen für das neue
-- Unternehmen genauso wie für jedes andere.
-- =============================================================

create or replace function register_company(
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_email text
)
returns table (company_id uuid, employee_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid;
  v_employee_id uuid;
begin
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Bitte einen Unternehmensnamen angeben.';
  end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'Bitte Vor- und Nachnamen angeben.';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Bitte eine E-Mail-Adresse angeben.';
  end if;

  insert into companies (name) values (trim(p_company_name)) returning id into v_company_id;

  insert into employees (company_id, personnel_number, first_name, last_name, email, role, department)
  values (v_company_id, '10000', trim(p_first_name), trim(p_last_name), trim(p_email), 'admin', 'Verwaltung')
  returning id into v_employee_id;

  return query select v_company_id, v_employee_id;
end;
$$;

-- Bewusste Ausnahme: dies ist die EINZIGE Funktion im ganzen Schema,
-- die `anon` ausführen darf – der Einstiegspunkt für ein brandneues
-- Unternehmen, das noch gar keinen angemeldeten Benutzer hat.
grant execute on function register_company(text, text, text, text) to anon, authenticated;

-- RLS auf companies/employees bleibt unverändert (Lesen/Schreiben nach
-- Anmeldung weiterhin nur für das eigene Unternehmen). Der INSERT oben
-- läuft als SECURITY DEFINER und damit unabhängig von RLS – das ist
-- hier korrekt, weil vor der Registrierung naturgemäß noch kein
-- auth_company_id() existiert, gegen den geprüft werden könnte.
