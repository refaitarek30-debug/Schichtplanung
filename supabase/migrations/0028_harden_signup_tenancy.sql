-- =============================================================
-- Phase 12b · Mandantengrenze bei der Registrierung dichtmachen
--
-- LÜCKE: handle_new_user() hat company_id UND role einfach aus den
-- User-Metadaten übernommen. Diese Metadaten setzt der Client beim
-- Registrieren selbst – der Anmelde-Endpunkt von Supabase ist öffentlich
-- und der anon-Key steht im Browser. Damit konnte sich jeder ein zweites
-- Konto anlegen und darin  role = admin  und eine fremde company_id
-- angeben. Ein normaler Mitarbeiter kennt die company_id des eigenen
-- Unternehmens (sie steht in seiner Sitzung) und hätte sich so zum
-- Administrator machen können.
--
-- FIX: Die Metadaten sind nur noch ein Hinweis auf den Personalstammsatz.
-- Firma und Rolle kommen aus der Tabelle employees, und der Stammsatz
-- zählt nur, wenn seine hinterlegte E-Mail-Adresse mit der Adresse
-- übereinstimmt, mit der sich jemand anmeldet. Beides kann der Client
-- nicht fälschen: employees-Zeilen anlegen darf nur die Führung des
-- jeweiligen Unternehmens, und die E-Mail muss bestätigt werden.
-- =============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ziel employees;
begin
  if not (meta ? 'employee_id') then
    -- Keine Zuordnung mitgeschickt: kein Profil. Ohne Profil sieht die
    -- Anwendung niemanden und Row Level Security gibt nichts frei.
    return new;
  end if;

  select * into ziel
    from employees
   where id = nullif(meta ->> 'employee_id', '')::uuid
     and email is not null
     and lower(email) = lower(new.email);

  if ziel.id is null then
    return new;
  end if;

  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
  values (
    new.id,
    ziel.company_id,                       -- aus der Datenbank, nicht vom Client
    ziel.id,
    coalesce(nullif(meta ->> 'first_name', ''), ziel.first_name),
    coalesce(nullif(meta ->> 'last_name', ''),  ziel.last_name),
    new.email,
    ziel.role                              -- aus der Datenbank, nicht vom Client
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Ereignis-Trigger-Funktion: lässt sich ohnehin nicht sinnvoll direkt
-- aufrufen, hat aber nichts in der öffentlichen API zu suchen.
revoke execute on function rls_auto_enable() from public, anon, authenticated;
