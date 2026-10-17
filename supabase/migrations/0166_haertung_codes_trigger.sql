-- Härtung nach der Sicherheitsprüfung (Oktober 2026).
--
-- 1. Verbindungs-/Einladungscodes aus kryptografischem Zufall statt random().
--    random() ist für Spiele gedacht, nicht für Zugangscodes. Nur Bytes
--    unter 248 (= 8 × 31) zählen, damit jedes Zeichen gleich wahrscheinlich ist.
-- 2. Trigger-Funktionen sind nicht direkt aufrufbar (Postgres verweigert das
--    ohnehin) – trotzdem kein EXECUTE für anon/authenticated. Trigger laufen
--    davon unberührt weiter.
-- 3. privat_code mit festem search_path (Hinweis des Supabase-Prüfers).

create or replace function public.verbindung_code_erstellen(p_person uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  zeichen constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  zufall int;
  -- Einladung an eine Person: 7 Tage (Link per Nachricht), sonst 24 Stunden.
  bis timestamptz := now() + case when p_person is null then interval '24 hours' else interval '7 days' end;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_person is not null and not exists (select 1 from kalender_personen where id = p_person and owner_id = auth.uid()) then
    raise exception 'Diese Person gibt es nicht.';
  end if;
  if (select count(*) from kalender_verbindungen where a = auth.uid() or b = auth.uid()) >= 20 then
    raise exception 'Höchstens 20 verbundene Konten.';
  end if;
  -- Abgelaufene weg, und je Person bzw. ohne Person nur der neueste Code.
  delete from kalender_verbindung_codes
   where user_id = auth.uid()
     and (gueltig_bis < now() or person_id is not distinct from p_person);
  while length(code) < 6 loop
    zufall := get_byte(extensions.gen_random_bytes(1), 0);
    if zufall < 248 then
      code := code || substr(zeichen, 1 + zufall % 31, 1);
    end if;
  end loop;
  insert into kalender_verbindung_codes (code_hash, user_id, person_id, gueltig_bis)
  values (verbindung_code_hash(code), auth.uid(), p_person, bis);
  return jsonb_build_object('code', code, 'gueltig_bis', bis);
end;
$function$;

revoke execute on function public.push_aus_verbindung() from public, anon, authenticated;
revoke execute on function public.push_aus_gruppenbeitritt() from public, anon, authenticated;
revoke execute on function public.push_aus_benachrichtigung() from public, anon, authenticated;
revoke execute on function public.push_aus_termin_von_anderen() from public, anon, authenticated;
revoke execute on function public.push_aus_planaenderung() from public, anon, authenticated;
revoke execute on function public.privat_schichtarten_grenze() from public, anon, authenticated;

alter function public.privat_code(text, time without time zone) set search_path to 'public';
