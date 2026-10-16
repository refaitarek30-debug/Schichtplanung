-- Konten verbinden: Zwei Personen mit eigenem Kalender (privat oder Firma)
-- verbinden sich per Code, QR-Code oder Link. Beide sehen die Schichten des
-- anderen live; jede Seite stellt selbst ein, ob der andere ihre Termine
-- sieht und ob er Termine bei ihr eintragen darf.
--
-- War die Person vorher über einen Link eingeladen (kalender_personen),
-- wird sie übernommen: ihre über den Link eingetragenen Termine bleiben (als
-- von ihr eingetragen), ihre von Hand eingetragenen Schichten werden in ihr
-- eigenes Konto kopiert, wo dort noch nichts steht (nur Privatkonten – bei
-- einem Firmenkonto kommt der Plan aus dem Unternehmen). Der Link endet.

create table if not exists public.kalender_verbindungen (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references auth.users(id) on delete cascade,
  b uuid not null references auth.users(id) on delete cascade,
  -- Wie a die Person b nennt bzw. einordnet – und umgekehrt.
  a_art text not null default 'partner' check (a_art in ('partner', 'familie', 'freunde', 'kollegen')),
  b_art text not null default 'partner' check (b_art in ('partner', 'familie', 'freunde', 'kollegen')),
  -- a_termine: b sieht die Termine von a. a_darf: b darf bei a eintragen.
  a_termine boolean not null default false,
  a_darf boolean not null default false,
  b_termine boolean not null default false,
  b_darf boolean not null default false,
  erstellt_am timestamptz not null default now(),
  check (a < b),
  unique (a, b)
);
create index if not exists kalender_verbindungen_b on public.kalender_verbindungen (b);
alter table public.kalender_verbindungen enable row level security;
revoke all on public.kalender_verbindungen from anon, authenticated;

create table if not exists public.kalender_verbindung_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid references public.kalender_personen(id) on delete cascade,
  gueltig_bis timestamptz not null,
  erstellt_am timestamptz not null default now()
);
alter table public.kalender_verbindung_codes enable row level security;
revoke all on public.kalender_verbindung_codes from anon, authenticated;

create table if not exists public.kalender_code_versuche (
  user_id uuid not null references auth.users(id) on delete cascade,
  zeit timestamptz not null default now()
);
create index if not exists kalender_code_versuche_user on public.kalender_code_versuche (user_id, zeit);
alter table public.kalender_code_versuche enable row level security;
revoke all on public.kalender_code_versuche from anon, authenticated;

-- Wer einen Termin bei einer verbundenen Person eingetragen hat.
alter table public.kalender_termine
  add column if not exists von_user uuid references auth.users(id) on delete set null;

-- ---- Hilfen ------------------------------------------------------------------

create or replace function public.verbindung_code_hash(p_code text)
returns text language sql immutable set search_path to 'public' as $$
  select encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

-- Verbindung zwischen mir und p_partner (oder null).
create or replace function public.verbindung_mit(p_ich uuid, p_partner uuid)
returns public.kalender_verbindungen language sql stable security definer set search_path to 'public' as $$
  select * from kalender_verbindungen
   where a = least(p_ich, p_partner) and b = greatest(p_ich, p_partner)
$$;

-- Darf p_leser die Termine von p_inhaber sehen?
create or replace function public.verbunden_termine_sichtbar(p_inhaber uuid, p_leser uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select case when v.a = p_inhaber then v.a_termine else v.b_termine end
                     from kalender_verbindungen v
                    where v.a = least(p_inhaber, p_leser) and v.b = greatest(p_inhaber, p_leser)), false)
$$;

-- Darf p_schreiber bei p_inhaber eintragen?
create or replace function public.verbunden_darf(p_inhaber uuid, p_schreiber uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select case when v.a = p_inhaber then v.a_darf else v.b_darf end
                     from kalender_verbindungen v
                    where v.a = least(p_inhaber, p_schreiber) and v.b = greatest(p_inhaber, p_schreiber)), false)
$$;

revoke all on function public.verbindung_code_hash(text) from public, anon, authenticated;
revoke all on function public.verbindung_mit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.verbunden_termine_sichtbar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.verbunden_darf(uuid, uuid) from public, anon, authenticated;

-- ---- Code erstellen, prüfen, annehmen ---------------------------------------------

-- Neuer Code (24 Stunden, einmal nutzbar). p_person: eine schon über
-- Link eingeladene Person, die mit ihrem Konto übernommen werden soll.
create or replace function public.verbindung_code_erstellen(p_person uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  zeichen constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  bis timestamptz := now() + interval '24 hours';
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

-- Prüft einen Code (mit Bremse gegen Durchprobieren). Gibt den Code-Datensatz
-- oder – bei falschem Code – einen leeren. Bewusst ohne Fehler: sonst würde
-- auch der gezählte Fehlversuch zurückgerollt.
create or replace function public.verbindung_code_lesen(p_code text)
returns public.kalender_verbindung_codes language plpgsql security definer set search_path to 'public' as $$
declare
  c kalender_verbindung_codes;
begin
  delete from kalender_code_versuche where user_id = auth.uid() and zeit < now() - interval '1 day';
  if (select count(*) from kalender_code_versuche
       where user_id = auth.uid() and zeit > now() - interval '1 hour') >= 15 then
    raise exception 'Zu viele Versuche. Bitte in einer Stunde noch einmal.';
  end if;
  select * into c from kalender_verbindung_codes
   where code_hash = verbindung_code_hash(p_code) and gueltig_bis > now();
  if c.code_hash is null then
    insert into kalender_code_versuche (user_id) values (auth.uid());
  end if;
  return c;
end;
$$;
revoke all on function public.verbindung_code_lesen(text) from public, anon, authenticated;

create or replace function public.verbindung_code_info(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  c kalender_verbindung_codes;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  c := verbindung_code_lesen(p_code);
  if c.code_hash is null then
    return jsonb_build_object('gueltig', false);
  end if;
  return jsonb_build_object(
    'gueltig', true,
    'name', inhaber_vorname(c.user_id),
    'eigener', c.user_id = auth.uid(),
    'schon', (verbindung_mit(auth.uid(), c.user_id)).id is not null,
    'uebernahme', c.person_id is not null);
end;
$$;

-- Kopiert die über den Link eingetragenen Schichten in ein Privatkonto,
-- wo dort noch nichts steht. Firmenkonten: nichts (Plan kommt vom Betrieb).
create or replace function public.person_tage_uebernehmen(p_person uuid, p_ziel uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  n integer := 0;
begin
  if not ist_privatkonto(p_ziel) then
    return 0;
  end if;
  insert into privat_tage (user_id, tag, ebene, schichtart_id)
  select p_ziel, t.tag, 1, s.id
    from kalender_personen_tage t
    cross join lateral (
      select x.id from privat_schichtarten x
       where x.user_id = p_ziel and privat_code(x.art, x.beginn) = t.schicht
       order by x.reihenfolge
       limit 1) s
   where t.person_id = p_person
     and not exists (select 1 from privat_tage d where d.user_id = p_ziel and d.tag = t.tag)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.person_tage_uebernehmen(uuid, uuid) from public, anon, authenticated;

create or replace function public.verbindung_annehmen(p_code text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  c kalender_verbindung_codes;
  ich uuid := auth.uid();
  p kalender_personen;
  v_a uuid;
  v_b uuid;
  neu uuid;
begin
  if not kalender_nutzer() then
    raise exception 'Du brauchst einen eigenen Kalender, um dich zu verbinden.';
  end if;
  c := verbindung_code_lesen(p_code);
  if c.code_hash is null then
    -- Falscher Code: kein Fehler (der Fehlversuch bleibt gezählt), die
    -- Oberfläche meldet es.
    return null;
  end if;
  if c.user_id = ich then
    raise exception 'Das ist dein eigener Code – schick ihn der anderen Person.';
  end if;
  if (verbindung_mit(ich, c.user_id)).id is not null then
    raise exception 'Ihr seid schon verbunden.';
  end if;
  if (select count(*) from kalender_verbindungen where a = ich or b = ich) >= 20 then
    raise exception 'Höchstens 20 verbundene Konten.';
  end if;

  if c.person_id is not null then
    select * into p from kalender_personen where id = c.person_id and owner_id = c.user_id;
  end if;

  v_a := least(ich, c.user_id);
  v_b := greatest(ich, c.user_id);
  insert into kalender_verbindungen (a, b, a_art, b_art, a_termine, a_darf, b_termine, b_darf)
  values (
    v_a, v_b,
    coalesce(p.art, 'partner'), coalesce(p.art, 'partner'),
    -- Die Rechte der einladenden Seite kommen von der bisherigen Person.
    case when v_a = c.user_id then coalesce(p.termine_sehen, false) else false end,
    case when v_a = c.user_id then coalesce(p.darf_eintragen, false) else false end,
    case when v_b = c.user_id then coalesce(p.termine_sehen, false) else false end,
    case when v_b = c.user_id then coalesce(p.darf_eintragen, false) else false end)
  returning id into neu;

  if p.id is not null then
    perform person_tage_uebernehmen(p.id, ich);
    -- Termine, die sie über den Link eingetragen hat, bleiben – als von ihr.
    update kalender_termine set von_user = ich, person_id = null
     where person_id = p.id and owner_id = c.user_id;
    delete from kalender_personen where id = p.id;
  end if;

  delete from kalender_verbindung_codes where code_hash = c.code_hash;
  return neu;
end;
$$;

-- ---- Verwalten -------------------------------------------------------------------

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
             'erTermine', case when v.a = ich then v.b_termine else v.a_termine end,
             'erDarf', case when v.a = ich then v.b_darf else v.a_darf end,
             'seit', v.erstellt_am) order by v.erstellt_am)
      from kalender_verbindungen v
     where v.a = ich or v.b = ich), '[]'::jsonb);
end;
$$;

create or replace function public.verbindung_aendern(p_id uuid, p_art text, p_termine boolean, p_darf boolean)
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
         b_art = case when b = ich then p_art else b_art end,
         b_termine = case when b = ich then coalesce(p_termine, false) else b_termine end,
         b_darf = case when b = ich then coalesce(p_darf, false) else b_darf end
   where id = p_id and (a = ich or b = ich);
  if not found then
    raise exception 'Diese Verbindung gibt es nicht.';
  end if;
end;
$$;

create or replace function public.verbindung_beenden(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from kalender_verbindungen where id = p_id and (a = auth.uid() or b = auth.uid());
end;
$$;

-- ---- Lesen: Schichten und Termine der Verbundenen ---------------------------------

create or replace function public.verbundene_tage(p_von date, p_tage integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  v record;
  liste jsonb := '[]'::jsonb;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  for v in select case when x.a = ich then x.b else x.a end as partner
             from kalender_verbindungen x where x.a = ich or x.b = ich
  loop
    liste := liste || jsonb_build_array(jsonb_build_object(
      'id', v.partner, 'tage', kalender_codes(v.partner, p_von, p_tage)));
  end loop;
  return liste;
end;
$$;

-- Termine der Verbundenen, die sie mit mir teilen – und alles, was ich
-- selbst bei ihnen eingetragen habe. Keine Termine von Link-Gästen.
create or replace function public.verbundene_termine()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'inhaber', t.owner_id, 'von_user', t.von_user,
             'datum', t.datum, 'bis_datum', t.bis_datum, 'titel', t.titel, 'ganztaegig', t.ganztaegig,
             'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
             'wiederholung', t.wiederholung, 'notiz', t.notiz, 'ort', t.ort) order by t.datum)
      from kalender_termine t
      join kalender_verbindungen v
        on (v.a = ich and v.b = t.owner_id) or (v.b = ich and v.a = t.owner_id)
     where t.von_user = ich
        or (verbunden_termine_sichtbar(t.owner_id, ich) and not t.von_partner)), '[]'::jsonb);
end;
$$;

-- Termin bei einer verbundenen Person eintragen oder eigenen dort ändern.
create or replace function public.verbindung_termin_speichern(
  p_partner uuid, p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean,
  p_beginn time, p_ende time, p_wiederholung text, p_notiz text, p_ort text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  neu uuid;
  bis date := case when coalesce(p_ganztaegig, false) and p_bis_datum > p_datum and p_bis_datum <= p_datum + 62 then p_bis_datum end;
begin
  if not kalender_nutzer() or not verbunden_darf(p_partner, ich) then
    raise exception 'Du darfst hier nichts eintragen.';
  end if;
  if p_id is not null then
    if not exists (select 1 from kalender_termine where id = p_id and owner_id = p_partner and von_user = ich) then
      raise exception 'Diesen Termin kannst du nicht ändern.';
    end if;
    update kalender_termine set bis_datum = null where id = p_id;
  end if;
  neu := termin_schreiben(p_partner, true, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
  update kalender_termine set von_user = ich, bis_datum = bis where id = neu;
  return neu;
end;
$$;

create or replace function public.verbindung_termin_loeschen(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from kalender_termine where id = p_id and von_user = auth.uid() and owner_id <> auth.uid();
end;
$$;

-- meine_termine: dazu, wer einen Termin eingetragen hat (verbundenes Konto).
drop function if exists public.meine_termine();
create function public.meine_termine()
returns table(id uuid, von_partner boolean, person_id uuid, von_user uuid, datum date, bis_datum date, titel text,
              ganztaegig boolean, beginn text, ende text, wiederholung text, notiz text, ort text, erinnerung text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select t.id, t.von_partner, t.person_id, t.von_user, t.datum, t.bis_datum, t.titel, t.ganztaegig,
           to_char(t.beginn, 'HH24:MI'), to_char(t.ende, 'HH24:MI'), t.wiederholung, t.notiz, t.ort, t.erinnerung
      from kalender_termine t
     where t.owner_id = auth.uid()
     order by t.datum;
end;
$$;

revoke all on function public.verbindung_code_erstellen(uuid) from public, anon;
revoke all on function public.verbindung_code_info(text) from public, anon;
revoke all on function public.verbindung_annehmen(text) from public, anon;
revoke all on function public.meine_verbindungen() from public, anon;
revoke all on function public.verbindung_aendern(uuid, text, boolean, boolean) from public, anon;
revoke all on function public.verbindung_beenden(uuid) from public, anon;
revoke all on function public.verbundene_tage(date, integer) from public, anon;
revoke all on function public.verbundene_termine() from public, anon;
revoke all on function public.verbindung_termin_speichern(uuid, uuid, date, date, text, boolean, time, time, text, text, text) from public, anon;
revoke all on function public.verbindung_termin_loeschen(uuid) from public, anon;
revoke all on function public.meine_termine() from public, anon;
grant execute on function public.verbindung_code_erstellen(uuid) to authenticated;
grant execute on function public.verbindung_code_info(text) to authenticated;
grant execute on function public.verbindung_annehmen(text) to authenticated;
grant execute on function public.meine_verbindungen() to authenticated;
grant execute on function public.verbindung_aendern(uuid, text, boolean, boolean) to authenticated;
grant execute on function public.verbindung_beenden(uuid) to authenticated;
grant execute on function public.verbundene_tage(date, integer) to authenticated;
grant execute on function public.verbundene_termine() to authenticated;
grant execute on function public.verbindung_termin_speichern(uuid, uuid, date, date, text, boolean, time, time, text, text, text) to authenticated;
grant execute on function public.verbindung_termin_loeschen(uuid) to authenticated;
grant execute on function public.meine_termine() to authenticated;
