-- Lohnabrechnungen abschalten (10.11.2026).
--
-- Grund: Review vom 10.11.2026 (docs/review). Lohnabrechnungen können Angaben zu
-- Religion und Gesundheit enthalten (Art. 9 DSGVO). Bis Zugang der Führung zu
-- fremden Konten, Löschfristen, Datensicherung und Verträge geklärt sind, kann
-- niemand mehr etwas hochladen und niemand mehr einwilligen.
--
-- Bestehende Einträge (derzeit keine) bleiben les- und löschbar. Rückgängig:
-- Insert-Recht und Storage-Policy „Lohnzettel hochladen“ aus 0204 wieder anlegen
-- und die Sperre in lohnzettel_einwilligung() entfernen.

revoke insert on public.privat_lohnzettel from authenticated;
drop policy if exists "Lohnzettel hochladen" on storage.objects;

create or replace function public.lohnzettel_einwilligung(p_an boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from privat_konten where user_id = auth.uid()) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_an then
    raise exception 'Lohnabrechnungen sind vorübergehend abgeschaltet.';
  end if;
  if exists (select 1 from privat_lohnzettel where user_id = auth.uid()) then
    raise exception 'Bitte zuerst alle Lohnabrechnungen löschen.';
  end if;
  update privat_konten set lohnzettel_einwilligung = null where user_id = auth.uid();
end;
$$;
revoke execute on function public.lohnzettel_einwilligung(boolean) from public, anon;
grant execute on function public.lohnzettel_einwilligung(boolean) to authenticated;
