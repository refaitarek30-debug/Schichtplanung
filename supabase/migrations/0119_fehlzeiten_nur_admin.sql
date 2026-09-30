-- Fehlzeiten vorerst nur für die Administration (Testphase).
--
-- Bisher durfte auch die Schichtleitung für die eigene Schicht Fehlzeiten
-- eintragen, löschen und die Liste sehen. Solange die Funktion getestet
-- wird, geht das nur für die Administration. Mitarbeiter sehen weiterhin
-- nur die eigenen Einträge (und bekommen die Mitteilung).
--
-- Zurück auf Schichtleitung: in den drei Funktionen und der Policy
-- is_admin() wieder durch is_leadership() ersetzen.

do $do$
declare
  d text;
  sig text;
begin
  foreach sig in array array[
    'public.fehlzeit_speichern(uuid,date,text,numeric,text,text)',
    'public.fehlzeit_loeschen(uuid)',
    'public.fehlzeiten_liste(date,date)'
  ] loop
    select pg_get_functiondef(sig::regprocedure) into d;
    if position('is_leadership()' in d) = 0 then
      raise exception 'is_leadership() in % nicht gefunden.', sig;
    end if;
    d := replace(d, 'is_leadership()', 'is_admin()');
    execute d;
  end loop;
end $do$;

drop policy if exists "Fehlzeiten lesen" on public.fehlzeiten;
create policy "Fehlzeiten lesen" on public.fehlzeiten
  for select to authenticated
  using (
    company_id = auth_company_id()
    and (is_admin() or employee_id = auth_employee_id())
  );
