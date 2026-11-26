-- =============================================================
-- 0246 · Für verbundene Personen eintragen – Termine und Schichten
--
-- Jede Seite einer Verbindung entscheidet selbst:
--   *_darf      – die andere Person darf Termine bei mir eintragen, ändern
--                 und löschen (alle, die sie bei mir sehen darf)
--   *_schichten – die andere Person darf meine Schichten setzen und löschen
--                 (nur Privatkalender; Betriebsschichten kommen aus dem Plan)
--   *_melden    – ich bekomme eine Mitteilung, wenn sie etwas ändert
-- Gefragt wird vor dem Löschen in der App; hier wird nur geprüft.
-- =============================================================

alter table public.kalender_verbindungen
  add column if not exists a_schichten boolean not null default false,
  add column if not exists b_schichten boolean not null default false,
  add column if not exists a_melden boolean not null default true,
  add column if not exists b_melden boolean not null default true;

-- Darf p_schreiber die Schichten von p_inhaber setzen?
create or replace function public.verbunden_schichten_darf(p_inhaber uuid, p_schreiber uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select case when v.a = p_inhaber then v.a_schichten else v.b_schichten end
                     from kalender_verbindungen v
                    where v.a = least(p_inhaber, p_schreiber) and v.b = greatest(p_inhaber, p_schreiber)), false)
$$;
revoke all on function public.verbunden_schichten_darf(uuid, uuid) from public, anon, authenticated;

-- Will p_inhaber eine Mitteilung, wenn p_schreiber bei ihr etwas ändert?
create or replace function public.verbunden_melden(p_inhaber uuid, p_schreiber uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select case when v.a = p_inhaber then v.a_melden else v.b_melden end
                     from kalender_verbindungen v
                    where v.a = least(p_inhaber, p_schreiber) and v.b = greatest(p_inhaber, p_schreiber)), true)
$$;
revoke all on function public.verbunden_melden(uuid, uuid) from public, anon, authenticated;

-- Mitteilung an die Person, bei der eingetragen wurde (wenn sie das will).
create or replace function public._verbunden_mitteilen(p_inhaber uuid, p_titel text, p_text text, p_tag text, p_sammel text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not verbunden_melden(p_inhaber, auth.uid()) then
    return;
  end if;
  perform push_einreihen(p_inhaber, 'teilen',
    coalesce(nullif(inhaber_vorname(auth.uid()), ''), 'Jemand') || ' ' || p_titel,
    p_text, '/start', p_tag, p_sammel);
exception when others then
  null;
end;
$$;
revoke all on function public._verbunden_mitteilen(uuid, text, text, text, text) from public, anon, authenticated;

-- Neuer Termin von einer verbundenen Person: Mitteilung nur, wenn gewünscht.
create or replace function public.push_aus_termin_von_anderen()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  wer text;
  aktuell_user uuid;
  aktuell_person uuid;
begin
  begin
    if not new.von_partner then
      return null;
    end if;
    select t.von_user, t.person_id into aktuell_user, aktuell_person from kalender_termine t where t.id = new.id;
    if aktuell_user is not null then
      if not verbunden_melden(new.owner_id, aktuell_user) then
        return null;
      end if;
      wer := inhaber_vorname(aktuell_user);
    elsif aktuell_person is not null then
      select name into wer from kalender_personen where id = aktuell_person;
    end if;
    perform push_einreihen(new.owner_id, 'teilen',
      '🗓️ ' || coalesce(nullif(wer, ''), 'Jemand') || ' hat bei dir eingetragen',
      coalesce(nullif(new.titel, ''), 'Termin') || ' · ' || to_char(new.datum, 'DD.MM.')
        || case when new.beginn is not null then ' ' || to_char(new.beginn, 'HH24:MI') else '' end,
      '/start', 'termin-' || new.id::text, null);
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- ---- Verbindungen lesen und einstellen ------------------------------------------------

create or replace function public.meine_verbindungen()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', v.id,
             'partner', case when v.a = ich then v.b else v.a end,
             'name', inhaber_vorname(case when v.a = ich then v.b else v.a end),
             'art', case when v.a = ich then v.a_art else v.b_art end,
             'ichTermine', case when v.a = ich then v.a_termine else v.b_termine end,
             'ichDarf', case when v.a = ich then v.a_darf else v.b_darf end,
             'ichSchichten', case when v.a = ich then v.a_schichten else v.b_schichten end,
             'ichMelden', case when v.a = ich then v.a_melden else v.b_melden end,
             'erTermine', case when v.a = ich then v.b_termine else v.a_termine end,
             'erDarf', case when v.a = ich then v.b_darf else v.a_darf end,
             'erSchichten', (case when v.a = ich then v.b_schichten else v.a_schichten end)
                            and exists (select 1 from privat_konten k where k.user_id = case when v.a = ich then v.b else v.a end),
             'seit', v.erstellt_am) order by v.erstellt_am)
      from kalender_verbindungen v
     where v.a = ich or v.b = ich), '[]'::jsonb);
end;
$$;

-- Alle eigenen Einstellungen einer Verbindung auf einmal.
create or replace function public.verbindung_einstellen(
  p_id uuid, p_art text, p_termine boolean, p_darf boolean, p_schichten boolean, p_melden boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
begin
  if p_art not in ('partner', 'familie', 'freunde', 'kollegen') then
    raise exception 'Diese Art gibt es nicht.';
  end if;
  update kalender_verbindungen
     set a_art = case when a = ich then p_art else a_art end,
         a_termine = case when a = ich then coalesce(p_termine, false) else a_termine end,
         a_darf = case when a = ich then coalesce(p_darf, false) else a_darf end,
         a_schichten = case when a = ich then coalesce(p_schichten, false) else a_schichten end,
         a_melden = case when a = ich then coalesce(p_melden, true) else a_melden end,
         b_art = case when b = ich then p_art else b_art end,
         b_termine = case when b = ich then coalesce(p_termine, false) else b_termine end,
         b_darf = case when b = ich then coalesce(p_darf, false) else b_darf end,
         b_schichten = case when b = ich then coalesce(p_schichten, false) else b_schichten end,
         b_melden = case when b = ich then coalesce(p_melden, true) else b_melden end
   where id = p_id and (a = ich or b = ich);
  if not found then
    raise exception 'Diese Verbindung gibt es nicht.';
  end if;
end;
$$;
revoke all on function public.verbindung_einstellen(uuid, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.verbindung_einstellen(uuid, text, boolean, boolean, boolean, boolean) to authenticated;

-- ---- Termine bei anderen: eintragen, ändern, löschen ------------------------------------

-- Darf ich diesen Termin der Person ändern oder löschen? Was ich selbst bei ihr
-- eingetragen habe – und ihre eigenen Termine, wenn ich sie sehen darf.
create or replace function public._verbunden_termin_erlaubt(p_id uuid, p_partner uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from kalender_termine t
     where t.id = p_id and t.owner_id = p_partner and t.owner_id <> auth.uid()
       and verbunden_darf(p_partner, auth.uid())
       and (t.von_user = auth.uid()
            or (not t.von_partner and verbunden_termine_sichtbar(p_partner, auth.uid()))))
$$;
revoke all on function public._verbunden_termin_erlaubt(uuid, uuid) from public, anon, authenticated;

create or replace function public.verbindung_termin_speichern(
  p_partner uuid, p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean,
  p_beginn time, p_ende time, p_wiederholung text, p_notiz text, p_ort text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  neu uuid;
  eigener boolean;
  bis date := case when coalesce(p_ganztaegig, false) and p_bis_datum > p_datum and p_bis_datum <= p_datum + 62 then p_bis_datum end;
begin
  if not kalender_nutzer() or not verbunden_darf(p_partner, ich) then
    raise exception 'Du darfst hier nichts eintragen.';
  end if;
  if p_id is null then
    neu := termin_schreiben(p_partner, true, null, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                            p_wiederholung, p_notiz, p_ort);
    update kalender_termine set von_user = ich, bis_datum = bis where id = neu;
    return neu;
  end if;
  if not _verbunden_termin_erlaubt(p_id, p_partner) then
    raise exception 'Diesen Termin kannst du nicht ändern.';
  end if;
  -- Ändern: wer ihn eingetragen hat, bleibt gleich.
  select von_partner into eigener from kalender_termine where id = p_id;
  update kalender_termine set bis_datum = null where id = p_id;
  neu := termin_schreiben(p_partner, eigener, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
  update kalender_termine set bis_datum = bis where id = neu;
  perform _verbunden_mitteilen(p_partner, 'hat einen Termin bei dir geändert',
    coalesce(nullif(p_titel, ''), 'Termin') || ' · ' || to_char(p_datum, 'DD.MM.')
      || case when p_beginn is not null and not coalesce(p_ganztaegig, false) then ' ' || to_char(p_beginn, 'HH24:MI') else '' end,
    'termin-' || neu::text, 'termin-aenderung-' || neu::text);
  return neu;
end;
$$;

create or replace function public.verbindung_termin_loeschen(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  t record;
begin
  select * into t from kalender_termine where id = p_id;
  if t.id is null or not _verbunden_termin_erlaubt(p_id, t.owner_id) then
    raise exception 'Diesen Termin kannst du nicht löschen.';
  end if;
  delete from kalender_termine where id = p_id;
  perform _verbunden_mitteilen(t.owner_id, 'hat einen Termin bei dir gelöscht',
    coalesce(nullif(t.titel, ''), 'Termin') || ' · ' || to_char(t.datum, 'DD.MM.'),
    'termin-' || p_id::text, null);
end;
$$;

-- ---- Schichten bei anderen (Privatkalender) ---------------------------------------------

-- Die Schichtarten der Person – zum Auswählen beim Eintragen.
create or replace function public.verbindung_schichtarten(p_partner uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() or not verbunden_schichten_darf(p_partner, auth.uid()) then
    raise exception 'Du darfst hier keine Schichten eintragen.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id, 'name', s.name, 'kuerzel', s.kuerzel, 'farbe', s.farbe, 'art', s.art,
             'beginn', to_char(s.beginn, 'HH24:MI'), 'ende', to_char(s.ende, 'HH24:MI'),
             'stunden', s.stunden, 'reihenfolge', s.reihenfolge) order by s.reihenfolge, s.name)
      from privat_schichtarten s where s.user_id = p_partner), '[]'::jsonb);
end;
$$;
revoke all on function public.verbindung_schichtarten(uuid) from public, anon;
grant execute on function public.verbindung_schichtarten(uuid) to authenticated;

-- Die eingetragenen Schichten der Person in einem Zeitraum (höchstens 62 Tage).
create or replace function public.verbindung_schichttage(p_partner uuid, p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() or not verbunden_schichten_darf(p_partner, auth.uid()) then
    raise exception 'Du darfst hier keine Schichten eintragen.';
  end if;
  if p_bis < p_von or p_bis > p_von + 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('tag', t.tag, 'ebene', t.ebene, 'art', t.schichtart_id) order by t.tag, t.ebene)
      from privat_tage t where t.user_id = p_partner and t.tag between p_von and p_bis), '[]'::jsonb);
end;
$$;
revoke all on function public.verbindung_schichttage(uuid, date, date) from public, anon;
grant execute on function public.verbindung_schichttage(uuid, date, date) to authenticated;

-- Eine Schicht der Person setzen (p_art) oder löschen (p_art leer).
create or replace function public.verbindung_schicht_setzen(p_partner uuid, p_tag date, p_ebene smallint, p_art uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  name text;
  vorher text;
begin
  if not kalender_nutzer() or not verbunden_schichten_darf(p_partner, auth.uid()) or p_partner = auth.uid() then
    raise exception 'Du darfst hier keine Schichten eintragen.';
  end if;
  if p_tag is null or p_ebene not in (1, 2, 3) then
    raise exception 'Ungültiger Tag.';
  end if;
  if not exists (select 1 from privat_konten where user_id = p_partner) then
    raise exception 'Diese Person hat keinen eigenen Schichtkalender.';
  end if;
  select s.name into vorher from privat_tage t join privat_schichtarten s on s.id = t.schichtart_id
   where t.user_id = p_partner and t.tag = p_tag and t.ebene = p_ebene;
  if p_art is null then
    delete from privat_tage where user_id = p_partner and tag = p_tag and ebene = p_ebene;
    if vorher is not null then
      perform _verbunden_mitteilen(p_partner, 'hat eine Schicht bei dir gelöscht',
        vorher || ' · ' || to_char(p_tag, 'DD.MM.'), null, 'schichten-' || auth.uid()::text);
    end if;
    return;
  end if;
  select s.name into name from privat_schichtarten s where s.id = p_art and s.user_id = p_partner;
  if name is null then
    raise exception 'Diese Schicht gibt es bei der Person nicht.';
  end if;
  insert into privat_tage (user_id, tag, ebene, schichtart_id)
  values (p_partner, p_tag, p_ebene, p_art)
  on conflict (user_id, tag, ebene) do update set schichtart_id = excluded.schichtart_id;
  perform _verbunden_mitteilen(p_partner, 'hat bei dir eingetragen',
    name || ' · ' || to_char(p_tag, 'DD.MM.'), null, 'schichten-' || auth.uid()::text);
end;
$$;
revoke all on function public.verbindung_schicht_setzen(uuid, date, smallint, uuid) from public, anon;
grant execute on function public.verbindung_schicht_setzen(uuid, date, smallint, uuid) to authenticated;
