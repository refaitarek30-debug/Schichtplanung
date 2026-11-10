-- Schreibrechte der Führung enger fassen (10.11.2026), Funde S-02 und S-03 aus docs/review/02-sicherheit.md.
--
-- 1) Die Schichtleitung bearbeitet nur noch Personen mit der Rolle „Mitarbeiter“ (dort weiter
--    alle Felder außer der Rolle). Administratoren und andere Schichtleitungen ändert nur die
--    Administration. Bisher konnte eine Schichtleitung z. B. einen Admin deaktivieren.
--    Die Sperre gilt für direkte Änderungen (Formular, Schnittstelle). Datenbank-Funktionen mit
--    eigener Rechteprüfung (eigene Stammdaten, Reihenfolge, Rotation, Konten) sind nicht betroffen:
--    Darin läuft die Änderung unter dem Eigentümer der Funktion, nicht unter „authenticated“.
--
-- 2) Die UPDATE-Regel „Fuehrung sieht offene Antraege“ auf leave_requests entfällt. Die App ändert
--    Anträge ausschließlich über decide_leave_request, antrag_zuruecknehmen und
--    split_leave_request_day (alle mit eigener Prüfung). Über die Regel konnte die Führung –
--    auch fremder Schichten – Anträge direkt ändern oder auf „offen“ zurücksetzen.

create or replace function public.employees_schichtleitung_grenze()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Nur direkte Änderungen über die Schnittstelle (Rolle „authenticated“) prüfen.
  if current_user = 'authenticated' and auth_role() = 'shift_leader' and old.role <> 'employee' then
    raise exception 'Personen mit Führungsrolle bearbeitet nur die Administration.';
  end if;
  return new;
end;
$$;
revoke execute on function public.employees_schichtleitung_grenze() from public, anon, authenticated;

drop trigger if exists employees_schichtleitung_grenze on public.employees;
create trigger employees_schichtleitung_grenze
  before update on public.employees
  for each row execute function public.employees_schichtleitung_grenze();

drop policy if exists "Fuehrung sieht offene Antraege" on public.leave_requests;
