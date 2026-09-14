-- ---------------------------------------------------------------
-- Zwei Altlasten, die im Betrieb sichtbar sind.
--
-- 1) announcements: 0003 hat die Tabelle ohne die Spalten active und
--    updated_at angelegt. 0025 wollte sie mit beiden Spalten anlegen,
--    benutzt aber "create table if not exists" -- die Tabelle gab es da
--    schon, also passierte nichts. Die Anwendung fragt seither
--    "select ... active ... where active = true" ab und bekommt von
--    PostgREST 400 zurueck ("column announcements.active does not exist").
--    Folge: auf der Regeln-Seite erscheint "Die Daten konnten nicht
--    geladen werden.", auf dem Dashboard bleiben die Mitteilungen still
--    leer. In den letzten 24 Stunden allein 105 fehlgeschlagene Abrufe.
--    Der Trigger announcements_updated_at existiert ebenfalls schon und
--    haette jedes UPDATE mit "record new has no field updated_at"
--    abgebrochen -- Zurueckziehen einer Mitteilung war also auch kaputt.
--
-- 2) employees.role und profiles.role liefen auseinander. Geprueft wird
--    ueberall profiles.role (auth_role, is_admin, is_leadership), geaendert
--    wird in der Mitarbeiterverwaltung aber employees.role. Wer in der
--    Liste auf "Administrator" gestellt wurde, blieb deshalb ohne
--    Adminrechte -- die Oberflaeche zeigte eine Rolle, die es in der
--    Berechtigung nicht gab.
-- ---------------------------------------------------------------

-- --- 1) Mitteilungen ------------------------------------------------

alter table announcements add column if not exists active boolean not null default true;
alter table announcements add column if not exists updated_at timestamptz not null default now();

-- 0025 wollte level auf info/warn begrenzen. Vorher aufraeumen, damit die
-- Bedingung an bestehenden Zeilen nicht scheitert.
update announcements set level = 'info' where level not in ('info', 'warn');

alter table announcements drop constraint if exists announcements_level_check;
alter table announcements add constraint announcements_level_check
  check (level in ('info', 'warn'));

-- 0025 hat die Lese-Policy neu angelegt, die gleichlautende aus 0003 aber
-- stehen lassen. Zwei Policies mit identischer Bedingung sind harmlos,
-- aber irrefuehrend beim Nachlesen, wer was darf.
drop policy if exists "Mitteilungen lesen" on announcements;

-- --- 2) Rolle synchron halten ---------------------------------------

create or replace function employees_sync_profile_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    -- Rollen vergibt nur die Administration. Ohne angemeldeten Nutzer
    -- (Wartung per SQL, Seed-Daten) greift die Bremse bewusst nicht.
    if auth.uid() is not null and not is_admin() then
      raise exception 'Die Rolle darf nur die Administration ändern.';
    end if;

    update profiles
       set role = new.role
     where employee_id = new.id
       and company_id = new.company_id;
  end if;
  return new;
end;
$$;

drop trigger if exists employees_sync_profile_role on employees;
create trigger employees_sync_profile_role
  after update of role on employees
  for each row execute function employees_sync_profile_role();

-- Triggerfunktionen gehoeren nicht in die REST-Schnittstelle. Ohne diesen
-- Entzug meldet der Supabase-Linter sie zu Recht als SECURITY DEFINER-
-- Funktion, die jeder -- sogar anonym -- ueber /rest/v1/rpc aufrufen kann.
revoke execute on function employees_sync_profile_role() from public, anon, authenticated;
