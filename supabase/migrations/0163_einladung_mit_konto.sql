-- Einladen nur noch mit eigenem Konto: Die eingeladene Person öffnet den
-- Link, legt Spitzname und Passwort an und ist danach verbunden. Der Link
-- gilt 7 Tage und nur einmal. Bestehende Links ohne Konto bleiben gültig,
-- bis sie beendet werden – neue entstehen nicht mehr.

create or replace function public.verbindung_code_erstellen(p_person uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  zeichen constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
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
  for i in 1..6 loop
    code := code || substr(zeichen, 1 + floor(random() * length(zeichen))::int, 1);
  end loop;
  insert into kalender_verbindung_codes (code_hash, user_id, person_id, gueltig_bis)
  values (verbindung_code_hash(code), auth.uid(), p_person, bis);
  return jsonb_build_object('code', code, 'gueltig_bis', bis);
end;
$$;

-- Neue Einladung: Person (ohne Link) mit ihren Rechten und ein Code dazu.
create or replace function public.einladung_erstellen(p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  neu uuid;
  c jsonb;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Bitte einen Namen eingeben.';
  end if;
  insert into kalender_personen (owner_id, name, art, darf_eintragen, termine_sehen)
  values (auth.uid(), left(btrim(p_name), 40),
          case when p_art in ('partner', 'familie', 'freunde', 'kollegen') then p_art else 'partner' end,
          coalesce(p_darf_eintragen, false), coalesce(p_termine_sehen, false))
  returning id into neu;
  c := verbindung_code_erstellen(neu);
  return c || jsonb_build_object('person', neu);
end;
$$;

-- Offene Einladungen (Person und bis wann der Link gilt).
create or replace function public.meine_einladungen()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('person', c.person_id, 'bis', c.gueltig_bis))
      from kalender_verbindung_codes c
     where c.user_id = auth.uid() and c.person_id is not null and c.gueltig_bis > now()), '[]'::jsonb);
end;
$$;

-- Für die Einladungsseite ohne Anmeldung (nur über den Server, mit Bremse
-- je Adresse): gilt der Link, und wer lädt ein?
create or replace function public.einladung_vorschau(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  c kalender_verbindung_codes;
begin
  select * into c from kalender_verbindung_codes
   where code_hash = verbindung_code_hash(p_code) and gueltig_bis > now();
  if c.code_hash is null then
    return jsonb_build_object('gueltig', false);
  end if;
  return jsonb_build_object('gueltig', true, 'name', inhaber_vorname(c.user_id));
end;
$$;

revoke all on function public.einladung_erstellen(text, text, boolean, boolean) from public, anon;
revoke all on function public.meine_einladungen() from public, anon;
revoke all on function public.einladung_vorschau(text) from public, anon, authenticated;
grant execute on function public.einladung_erstellen(text, text, boolean, boolean) to authenticated;
grant execute on function public.meine_einladungen() to authenticated;
grant execute on function public.einladung_vorschau(text) to service_role;
