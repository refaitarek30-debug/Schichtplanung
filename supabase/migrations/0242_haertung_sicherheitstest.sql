-- =============================================================
-- 0242 · Härtung nach dem automatischen Sicherheitstest (tests/sicherheit)
--
-- Der Test greift die echte Datenbankstruktur als „nicht angemeldet“, als fremde
-- Firma, als Privatkonto und als Kollege an (alle Tabellen, alle Funktionen).
-- Gefunden und hier behoben:
--
-- 1. gruppe_verlassen(): löschte eine Gruppe ohne Mitglieder, auch wenn der
--    Aufrufer gar nicht Mitglied war. Jetzt nur, wenn er selbst ausgetreten ist.
--
-- 2. Interne Hilfsfunktionen waren für angemeldete Personen direkt aufrufbar und
--    prüfen selbst keine Berechtigung (sie werden nur aus geprüften Funktionen
--    heraus benutzt). Mit der internen ID eines Mitarbeiters ließen sich so z. B.
--    V-Tage-Rest oder Schichtgruppe einer fremden Person abfragen. Recht entzogen.
--    Die App ruft keine davon direkt auf.
--
-- 3. Neue Funktionen sind ab jetzt standardmäßig NICHT mehr für anon/authenticated
--    aufrufbar („sicher als Voreinstellung“). Jede Funktion, die die App braucht,
--    bekommt ihr Recht ausdrücklich in ihrer Migration.
-- =============================================================

-- 1. Gruppe verlassen
create or replace function public.gruppe_verlassen(p_gruppe uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from kalender_gruppen_mitglieder where gruppe_id = p_gruppe and user_id = auth.uid();
  -- Nur wer wirklich Mitglied war, kann die (dann leere) Gruppe auflösen.
  if not found then
    return;
  end if;
  if not exists (select 1 from kalender_gruppen_mitglieder where gruppe_id = p_gruppe) then
    delete from kalender_gruppen where id = p_gruppe;
  end if;
end;
$$;

-- 2. Interne Hilfsfunktionen nur noch für die Datenbank selbst
revoke execute on function public.gruppe_am(uuid, date, rotation_team) from public, anon, authenticated;
revoke execute on function public.gruppe_versatz(uuid, rotation_team) from public, anon, authenticated;
revoke execute on function public.vj_kontingent(uuid, integer) from public, anon, authenticated;
revoke execute on function public.vj_rest(uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.set_af_stand(uuid, numeric, date) from public, anon, authenticated;
revoke execute on function public.shift_qualification_gaps(uuid, date, uuid) from public, anon, authenticated;
revoke execute on function public.employees_absent_on(date, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.termin_ausfaelle(uuid) from public, anon, authenticated;
revoke execute on function public.termin_serie_ab(uuid) from public, anon, authenticated;
revoke execute on function public.assign_shift(uuid, uuid, date) from public, anon, authenticated;
revoke execute on function public.rotation_shift_for(employees, date) from public, anon, authenticated;
revoke execute on function public.rotation_shift_for(uuid, date) from public, anon, authenticated;
revoke execute on function public.effective_shift_id(uuid, date) from public, anon, authenticated;

-- 3. Voreinstellung für künftige Funktionen: kein Recht für die API-Rollen
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
