-- Kalender mit Partner, Teil 2
--
-- * Partner kann auch „Urlaub“ eintragen (U).
-- * Beim Partner erscheint jede Abwesenheit des Inhabers als „Urlaub“ (U)
--   statt „Frei“ – Grund (Urlaub, V-Tag, krank …) bleibt verborgen.
-- * Termine liegen jetzt in der Datenbank (vorher nur im Browser), damit
--   Partner und Inhaber sie gemeinsam sehen:
--     - Termine des Partners sieht der Inhaber immer.
--     - Termine des Inhabers sieht der Partner nur, wenn der Inhaber das
--       bei der Einladung freigibt (termine_teilen).
-- * Einladen mit Auswahl, was geteilt wird.
--
-- Wie in 0138: keine Rechte auf die Tabellen, Zugriff nur über Funktionen.
--
-- Eingespielt am 14.10.2026 in Teilen (0139a–e); Inhalt identisch mit dieser Datei.

alter table public.kalender_partner_tage drop constraint kalender_partner_tage_schicht_check;
alter table public.kalender_partner_tage
  add constraint kalender_partner_tage_schicht_check check (schicht in ('F', 'S', 'N', 'T', 'U', 'X'));

alter table public.kalender_partner add column if not exists termine_teilen boolean not null default false;

create table if not exists public.kalender_termine (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  von_partner boolean not null default false,
  datum date not null,
  titel text not null default '' check (length(titel) <= 80),
  ganztaegig boolean not null default false,
  beginn time,
  ende time,
  wiederholung text not null default 'nie'
    check (wiederholung in ('nie', 'taeglich', 'woechentlich', 'monatlich')),
  notiz text not null default '' check (length(notiz) <= 500),
  ort text not null default '' check (length(ort) <= 120),
  geaendert_am timestamptz not null default now()
);
create index if not exists kalender_termine_owner on public.kalender_termine (owner_id);

alter table public.kalender_termine enable row level security;
revoke all on public.kalender_termine from anon, authenticated;

-- ---------------------------------------------------------------------
-- Tage: „U“ erlauben
-- ---------------------------------------------------------------------

create or replace function public.partner_tage_schreiben(
  p_owner uuid, p_von date, p_anzahl integer, p_schicht text
)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
begin
  if p_anzahl < 1 or p_anzahl > 31 then
    raise exception 'Zeitraum zu groß.';
  end if;
  if p_schicht is not null and p_schicht not in ('F', 'S', 'N', 'T', 'U', 'X') then
    raise exception 'Unbekannte Schicht.';
  end if;
  if p_schicht is null then
    delete from kalender_partner_tage
     where owner_id = p_owner and tag between p_von and p_von + (p_anzahl - 1);
  else
    insert into kalender_partner_tage (owner_id, tag, schicht)
    select p_owner, d::date, p_schicht
      from generate_series(p_von, p_von + (p_anzahl - 1), interval '1 day') d
    on conflict (owner_id, tag)
      do update set schicht = excluded.schicht, geaendert_am = now();
  end if;
end;
$$;
revoke all on function public.partner_tage_schreiben(uuid, date, integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Einladen mit Auswahl
-- ---------------------------------------------------------------------

/** Neuen Link erzeugen (alter endet). p_termine_teilen: eigene Termine zeigen. */
create or replace function public.partner_einladen(p_termine_teilen boolean)
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  ich uuid := auth.uid();
  schluessel text;
begin
  if ich is null or auth_employee_id() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update kalender_partner set beendet_am = now()
   where owner_id = ich and beendet_am is null;
  schluessel := encode(extensions.gen_random_bytes(24), 'hex');
  insert into kalender_partner (owner_id, token_hash, termine_teilen)
  values (ich, encode(extensions.digest(schluessel, 'sha256'), 'hex'), coalesce(p_termine_teilen, false));
  return schluessel;
end;
$$;

create or replace function public.partner_einladung_status()
returns table (aktiv boolean, erstellt_am timestamptz, zuletzt_genutzt timestamptz, termine_teilen boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select true, k.erstellt_am, k.zuletzt_genutzt, k.termine_teilen
    from kalender_partner k
   where k.owner_id = auth.uid() and k.beendet_am is null
$$;

create or replace function public.partner_termine_teilen(p_an boolean)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  update kalender_partner set termine_teilen = coalesce(p_an, false)
   where owner_id = auth.uid() and beendet_am is null
$$;

-- ---------------------------------------------------------------------
-- Termine
-- ---------------------------------------------------------------------

/** Intern: anlegen (p_id null) oder ändern. Partner darf nur Partnertermine ändern. */
create or replace function public.termin_schreiben(
  p_owner uuid, p_von_partner boolean, p_id uuid, p_datum date, p_titel text,
  p_ganztaegig boolean, p_beginn time, p_ende time, p_wiederholung text,
  p_notiz text, p_ort text
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  neu uuid;
begin
  if p_datum is null then
    raise exception 'Datum fehlt.';
  end if;
  if p_id is null then
    if (select count(*) from kalender_termine where owner_id = p_owner) >= 2000 then
      raise exception 'Zu viele Termine.';
    end if;
    insert into kalender_termine
      (owner_id, von_partner, datum, titel, ganztaegig, beginn, ende, wiederholung, notiz, ort)
    values
      (p_owner, p_von_partner, p_datum, left(coalesce(p_titel, ''), 80), coalesce(p_ganztaegig, false),
       p_beginn, p_ende, coalesce(p_wiederholung, 'nie'), left(coalesce(p_notiz, ''), 500), left(coalesce(p_ort, ''), 120))
    returning id into neu;
    return neu;
  end if;

  update kalender_termine
     set datum = p_datum, titel = left(coalesce(p_titel, ''), 80), ganztaegig = coalesce(p_ganztaegig, false),
         beginn = p_beginn, ende = p_ende, wiederholung = coalesce(p_wiederholung, 'nie'),
         notiz = left(coalesce(p_notiz, ''), 500), ort = left(coalesce(p_ort, ''), 120), geaendert_am = now()
   where id = p_id and owner_id = p_owner and (not p_von_partner or von_partner)
  returning id into neu;
  if neu is null then
    raise exception 'Termin nicht gefunden.';
  end if;
  return neu;
end;
$$;
revoke all on function public.termin_schreiben(uuid, boolean, uuid, date, text, boolean, time, time, text, text, text)
  from public, anon, authenticated;

/** Alle Termine im eigenen Kalender – eigene und die des Partners. */
create or replace function public.meine_termine()
returns table (
  id uuid, von_partner boolean, datum date, titel text, ganztaegig boolean,
  beginn text, ende text, wiederholung text, notiz text, ort text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select t.id, t.von_partner, t.datum, t.titel, t.ganztaegig,
           to_char(t.beginn, 'HH24:MI'), to_char(t.ende, 'HH24:MI'), t.wiederholung, t.notiz, t.ort
      from kalender_termine t
     where t.owner_id = auth.uid()
     order by t.datum;
end;
$$;

create or replace function public.termin_speichern(
  p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time, p_ende time,
  p_wiederholung text, p_notiz text, p_ort text
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or auth_employee_id() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return termin_schreiben(auth.uid(), false, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
end;
$$;

create or replace function public.termin_loeschen(p_id uuid)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  delete from kalender_termine where id = p_id and owner_id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Partner (Link)
-- ---------------------------------------------------------------------

/** Intern: löschen – p_nur_partner: nur Termine, die der Partner eingetragen hat. */
create or replace function public.termin_entfernen(p_owner uuid, p_id uuid, p_nur_partner boolean)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  delete from kalender_termine
   where id = p_id and owner_id = p_owner and (not p_nur_partner or von_partner)
$$;
revoke all on function public.termin_entfernen(uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public.partner_termin_speichern(
  p_token text, p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time,
  p_ende time, p_wiederholung text, p_notiz text, p_ort text
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  inhaber uuid := partner_inhaber(p_token);
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'P0002';
  end if;
  return termin_schreiben(inhaber, true, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
end;
$$;

create or replace function public.partner_termin_loeschen(p_token text, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  inhaber uuid := partner_inhaber(p_token);
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'P0002';
  end if;
  perform termin_entfernen(inhaber, p_id, true);
end;
$$;

/**
 * Wie in 0138, zusätzlich:
 *   - jede Abwesenheit des Inhabers als „U“ (Urlaub), Grund verborgen,
 *   - Termine: die des Partners immer, die des Inhabers nur bei Freigabe.
 */
create or replace function public.partner_kalender(p_token text, p_von date, p_tage integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  inhaber uuid := partner_inhaber(p_token);
  teilen boolean;
  firma uuid;
  vorname text;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  eigene jsonb;
  ergebnis jsonb;
  termine jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'P0002';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select p.company_id, p.first_name into firma, vorname from profiles p where p.id = inhaber;
  select k.termine_teilen into teilen from kalender_partner k where k.owner_id = inhaber and k.beendet_am is null;

  perform set_config('request.jwt.claims', json_build_object('sub', inhaber, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', inhaber::text, true);

  select jsonb_object_agg(
           g.day::text,
           case
             when g.absence_code is not null and g.absence_code = upper(g.absence_code) then 'U'
             when g.shift_code in ('F', 'S', 'N') then g.shift_code
             when g.shift_name is not null then 'T'
             else 'X'
           end)
    into eigene
    from shift_plan_grid(firma, p_von, p_tage) g
   where g.is_me;

  perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'vonPartner', t.von_partner, 'datum', t.datum, 'titel', t.titel,
           'ganztaegig', t.ganztaegig, 'von', coalesce(to_char(t.beginn, 'HH24:MI'), ''),
           'bis', coalesce(to_char(t.ende, 'HH24:MI'), ''), 'wiederholung', t.wiederholung,
           'notiz', t.notiz, 'ort', t.ort) order by t.datum), '[]'::jsonb)
    into termine
    from kalender_termine t
   where t.owner_id = inhaber
     and (t.von_partner or coalesce(teilen, false))
     and t.datum <= p_von + (p_tage - 1)
     and (t.wiederholung <> 'nie' or t.datum >= p_von);

  select jsonb_build_object(
           'name', vorname,
           'termineGeteilt', coalesce(teilen, false),
           'termine', termine,
           'tage', coalesce(jsonb_agg(jsonb_build_array(d::date, eigene ->> (d::date)::text, t.schicht) order by d), '[]'::jsonb))
    into ergebnis
    from generate_series(p_von, p_von + (p_tage - 1), interval '1 day') d
    left join kalender_partner_tage t on t.owner_id = inhaber and t.tag = d::date;

  update kalender_partner set zuletzt_genutzt = now()
   where owner_id = inhaber and beendet_am is null
     and (zuletzt_genutzt is null or zuletzt_genutzt < now() - interval '5 minutes');

  return ergebnis;
end;
$$;

revoke all on function public.partner_einladen(boolean) from public, anon;
revoke all on function public.partner_einladung_status() from public, anon;
revoke all on function public.partner_termine_teilen(boolean) from public, anon;
revoke all on function public.meine_termine() from public, anon;
revoke all on function public.termin_speichern(uuid, date, text, boolean, time, time, text, text, text) from public, anon;
revoke all on function public.termin_loeschen(uuid) from public, anon;
grant execute on function public.partner_einladen(boolean) to authenticated;
grant execute on function public.partner_einladung_status() to authenticated;
grant execute on function public.partner_termine_teilen(boolean) to authenticated;
grant execute on function public.meine_termine() to authenticated;
grant execute on function public.termin_speichern(uuid, date, text, boolean, time, time, text, text, text) to authenticated;
grant execute on function public.termin_loeschen(uuid) to authenticated;

revoke all on function public.partner_termin_speichern(text, uuid, date, text, boolean, time, time, text, text, text) from public;
revoke all on function public.partner_termin_loeschen(text, uuid) from public;
grant execute on function public.partner_termin_speichern(text, uuid, date, text, boolean, time, time, text, text, text) to anon, authenticated;
grant execute on function public.partner_termin_loeschen(text, uuid) to anon, authenticated;
