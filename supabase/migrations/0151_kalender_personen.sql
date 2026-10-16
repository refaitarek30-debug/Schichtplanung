-- =====================================================================
-- 0151 – Kalender mit mehreren Personen teilen
--
-- Bisher: genau ein Partner-Link je Konto (kalender_partner), die Tage des
-- Partners hingen am Inhaber (kalender_partner_tage).
--
-- Neu: beliebig viele Personen (höchstens 20) – Partner, Familie,
-- Freunde, Kollegen. Jede Person hat ihren eigenen Link und eigene Rechte:
--   * darf_eintragen – eigene Arbeitstage und Termine eintragen
--   * termine_sehen  – die Termine des Inhabers sehen
-- Tage und Termine einer Person hängen an der Person; wird sie entfernt,
-- verschwinden auch ihre Einträge.
--
-- Die bisherigen RPCs (partner_einladen, partner_kalender, …) bleiben
-- erhalten und arbeiten jetzt auf den neuen Tabellen – so funktionieren
-- alte Oberflächen und bestehende Links weiter.
-- =====================================================================

create table if not exists public.kalender_personen (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  art text not null default 'partner' check (art in ('partner', 'familie', 'freunde', 'kollegen')),
  darf_eintragen boolean not null default false,
  termine_sehen boolean not null default false,
  token_hash text unique,
  link_erstellt_am timestamptz,
  zuletzt_genutzt timestamptz,
  erstellt_am timestamptz not null default now()
);
create index if not exists kalender_personen_owner on public.kalender_personen (owner_id);

create table if not exists public.kalender_personen_tage (
  person_id uuid not null references public.kalender_personen (id) on delete cascade,
  tag date not null,
  schicht text not null check (schicht in ('F', 'S', 'N', 'T', 'U', 'X')),
  geaendert_am timestamptz not null default now(),
  primary key (person_id, tag)
);

alter table public.kalender_termine
  add column if not exists person_id uuid references public.kalender_personen (id) on delete cascade;

alter table public.kalender_personen enable row level security;
alter table public.kalender_personen_tage enable row level security;
revoke all on public.kalender_personen from anon, authenticated;
revoke all on public.kalender_personen_tage from anon, authenticated;

-- Höchstens 20 Personen je Konto.
create or replace function public.kalender_personen_grenze()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if (select count(*) from kalender_personen where owner_id = new.owner_id) >= 20 then
    raise exception 'Du kannst höchstens 20 Personen einladen.';
  end if;
  return new;
end;
$$;
drop trigger if exists kalender_personen_grenze on public.kalender_personen;
create trigger kalender_personen_grenze before insert on public.kalender_personen
  for each row execute function public.kalender_personen_grenze();

-- ---------------------------------------------------------------------
-- Übernahme: Partnertage, die es schon gibt, gehören jetzt zu „Partner“.
-- Aktive Partner-Links behalten ihren Schlüssel.
-- ---------------------------------------------------------------------
insert into public.kalender_personen (owner_id, name, art, darf_eintragen, termine_sehen, token_hash, link_erstellt_am, zuletzt_genutzt, erstellt_am)
select k.owner_id, 'Partner', 'partner', true, k.termine_teilen, k.token_hash, k.erstellt_am, k.zuletzt_genutzt, k.erstellt_am
  from public.kalender_partner k
 where k.beendet_am is null
   and not exists (select 1 from public.kalender_personen p where p.token_hash = k.token_hash);

insert into public.kalender_personen (owner_id, name, art, darf_eintragen)
select distinct t.owner_id, 'Partner', 'partner', true
  from public.kalender_partner_tage t
 where not exists (select 1 from public.kalender_personen p where p.owner_id = t.owner_id and p.art = 'partner');

insert into public.kalender_personen_tage (person_id, tag, schicht, geaendert_am)
select p.id, t.tag, t.schicht, t.geaendert_am
  from public.kalender_partner_tage t
  join lateral (select id from public.kalender_personen x
                 where x.owner_id = t.owner_id and x.art = 'partner'
                 order by x.erstellt_am limit 1) p on true
on conflict (person_id, tag) do nothing;

insert into public.kalender_personen (owner_id, name, art, darf_eintragen)
select distinct t.owner_id, 'Partner', 'partner', true
  from public.kalender_termine t
 where t.von_partner
   and not exists (select 1 from public.kalender_personen p where p.owner_id = t.owner_id and p.art = 'partner');

update public.kalender_termine t
   set person_id = (select x.id from public.kalender_personen x
                     where x.owner_id = t.owner_id and x.art = 'partner'
                     order by x.erstellt_am limit 1)
 where t.von_partner and t.person_id is null;

-- ---------------------------------------------------------------------
-- Hilfen
-- ---------------------------------------------------------------------

/** Person zum Schlüssel – nur wenn der Inhaber den Kalender noch nutzen darf. */
create or replace function public.person_zum_link(p_token text)
returns public.kalender_personen
language sql stable security definer set search_path to 'public' as $$
  select k.*
    from kalender_personen k
   where length(coalesce(p_token, '')) between 32 and 128
     and k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and (exists (select 1 from profiles p where p.id = k.owner_id and p.active and p.employee_id is not null)
          or ist_privatkonto(k.owner_id))
$$;
revoke all on function public.person_zum_link(text) from public, anon, authenticated;

/** Bisheriger Name, damit nichts bricht: Inhaber zum Schlüssel. */
create or replace function public.partner_inhaber(p_token text)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select (person_zum_link(p_token)).owner_id
$$;
revoke all on function public.partner_inhaber(text) from public, anon, authenticated;

/** Schichtkürzel des Inhabers je Tag (F/S/N/T/U/X) – Privat oder Firma. */
create or replace function public.kalender_codes(p_user uuid, p_von date, p_tage integer)
returns jsonb
language plpgsql volatile security definer set search_path to 'public' as $$
declare
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  codes jsonb;
begin
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  if ist_privatkonto(p_user) then
    select jsonb_object_agg(x.tag::text, x.code) into codes
      from (select distinct on (t.tag) t.tag, privat_code(s.art, s.beginn) as code
              from privat_tage t
              join privat_schichtarten s on s.id = t.schichtart_id
             where t.user_id = p_user and t.tag between p_von and p_von + (p_tage - 1)
             order by t.tag, t.ebene desc) x;
    return coalesce(codes, '{}'::jsonb);
  end if;

  select p.company_id into firma from profiles p where p.id = p_user and p.active and p.employee_id is not null;
  if firma is null then
    return '{}'::jsonb;
  end if;

  -- shift_plan_grid fragt nach „mir“: für diesen Aufruf die Kennung des
  -- Inhabers setzen und danach sofort zurückstellen.
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  begin
    select jsonb_object_agg(
             g.day::text,
             case
               when g.absence_code is not null and g.absence_code = upper(g.absence_code) then 'U'
               when g.shift_code in ('F', 'S', 'N') then g.shift_code
               when g.shift_name is not null then 'T'
               else 'X'
             end)
      into codes
      from shift_plan_grid(firma, p_von, p_tage) g
     where g.is_me;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  return coalesce(codes, '{}'::jsonb);
end;
$$;
revoke all on function public.kalender_codes(uuid, date, integer) from public, anon, authenticated;

create or replace function public.inhaber_vorname(p_user uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select split_part(btrim(k.name), ' ', 1) from privat_konten k where k.user_id = p_user),
    (select p.first_name from profiles p where p.id = p_user),
    '')
$$;
revoke all on function public.inhaber_vorname(uuid) from public, anon, authenticated;

create or replace function public.person_tage_schreiben(p_person uuid, p_von date, p_anzahl integer, p_schicht text)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
begin
  if p_anzahl < 1 or p_anzahl > 31 then
    raise exception 'Zeitraum zu groß.';
  end if;
  if p_schicht is not null and p_schicht not in ('F', 'S', 'N', 'T', 'U', 'X') then
    raise exception 'Unbekannte Schicht.';
  end if;
  if p_schicht is null then
    delete from kalender_personen_tage
     where person_id = p_person and tag between p_von and p_von + (p_anzahl - 1);
  else
    insert into kalender_personen_tage (person_id, tag, schicht)
    select p_person, d::date, p_schicht
      from generate_series(p_von, p_von + (p_anzahl - 1), interval '1 day') d
    on conflict (person_id, tag) do update set schicht = excluded.schicht, geaendert_am = now();
  end if;
end;
$$;
revoke all on function public.person_tage_schreiben(uuid, date, integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Inhaber: Personen verwalten
-- ---------------------------------------------------------------------

create or replace function public.meine_personen()
returns table (id uuid, name text, art text, darf_eintragen boolean, termine_sehen boolean,
               link_aktiv boolean, link_erstellt_am timestamptz, zuletzt_genutzt timestamptz, erstellt_am timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select k.id, k.name, k.art, k.darf_eintragen, k.termine_sehen, k.token_hash is not null,
           k.link_erstellt_am, k.zuletzt_genutzt, k.erstellt_am
      from kalender_personen k
     where k.owner_id = auth.uid()
     order by case k.art when 'partner' then 0 when 'familie' then 1 when 'freunde' then 2 else 3 end, k.erstellt_am;
end;
$$;

create or replace function public.person_anlegen(p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  schluessel text := encode(extensions.gen_random_bytes(24), 'hex');
  neu uuid;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Bitte einen Namen eingeben.';
  end if;
  insert into kalender_personen (owner_id, name, art, darf_eintragen, termine_sehen, token_hash, link_erstellt_am)
  values (auth.uid(), left(btrim(p_name), 40), coalesce(p_art, 'partner'), coalesce(p_darf_eintragen, false),
          coalesce(p_termine_sehen, false), encode(extensions.digest(schluessel, 'sha256'), 'hex'), now())
  returning id into neu;
  return jsonb_build_object('id', neu, 'schluessel', schluessel);
end;
$$;

create or replace function public.person_aendern(p_id uuid, p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Bitte einen Namen eingeben.';
  end if;
  update kalender_personen
     set name = left(btrim(p_name), 40), art = coalesce(p_art, art),
         darf_eintragen = coalesce(p_darf_eintragen, darf_eintragen),
         termine_sehen = coalesce(p_termine_sehen, termine_sehen)
   where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'Diese Person gibt es nicht mehr.';
  end if;
end;
$$;

/** Neuer Link – der alte gilt danach nicht mehr. */
create or replace function public.person_link_neu(p_id uuid)
returns text language plpgsql volatile security definer set search_path to 'public' as $$
declare
  schluessel text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update kalender_personen
     set token_hash = encode(extensions.digest(schluessel, 'sha256'), 'hex'), link_erstellt_am = now(), zuletzt_genutzt = null
   where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'Diese Person gibt es nicht mehr.';
  end if;
  return schluessel;
end;
$$;

/** Link beenden – die Person und ihre Einträge bleiben. */
create or replace function public.person_link_beenden(p_id uuid)
returns void language sql volatile security definer set search_path to 'public' as $$
  update kalender_personen set token_hash = null where id = p_id and owner_id = auth.uid()
$$;

/** Person mit allen ihren Tagen und Terminen entfernen. */
create or replace function public.person_entfernen(p_id uuid)
returns void language sql volatile security definer set search_path to 'public' as $$
  delete from kalender_personen where id = p_id and owner_id = auth.uid()
$$;

/** Tage aller eigenen Personen (für die eigene Ansicht). */
create or replace function public.meine_personen_tage(p_von date, p_bis date)
returns table (person_id uuid, tag date, schicht text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_bis < p_von or p_bis - p_von > 400 then
    raise exception 'Zeitraum zu groß.';
  end if;
  return query
    select t.person_id, t.tag, t.schicht
      from kalender_personen_tage t
      join kalender_personen k on k.id = t.person_id
     where k.owner_id = auth.uid() and t.tag between p_von and p_bis
     order by t.tag;
end;
$$;

/** Inhaber trägt Tage einer Person selbst ein. */
create or replace function public.person_tage_setzen(p_id uuid, p_von date, p_anzahl integer, p_schicht text)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if not exists (select 1 from kalender_personen where id = p_id and owner_id = auth.uid()) then
    raise exception 'Diese Person gibt es nicht mehr.';
  end if;
  perform person_tage_schreiben(p_id, p_von, p_anzahl, p_schicht);
end;
$$;

-- Eigene Termine – jetzt mit der Person, die ihn eingetragen hat.
drop function if exists public.meine_termine();
create function public.meine_termine()
returns table (id uuid, von_partner boolean, person_id uuid, datum date, titel text, ganztaegig boolean,
               beginn text, ende text, wiederholung text, notiz text, ort text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select t.id, t.von_partner, t.person_id, t.datum, t.titel, t.ganztaegig,
           to_char(t.beginn, 'HH24:MI'), to_char(t.ende, 'HH24:MI'), t.wiederholung, t.notiz, t.ort
      from kalender_termine t
     where t.owner_id = auth.uid()
     order by t.datum;
end;
$$;

-- ---------------------------------------------------------------------
-- Eingeladene Person (ohne Konto, nur mit dem Link)
-- ---------------------------------------------------------------------

create or replace function public.partner_kalender(p_token text, p_von date, p_tage integer)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  person kalender_personen := person_zum_link(p_token);
  eigene jsonb;
  termine jsonb;
  ergebnis jsonb;
begin
  if person.id is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  eigene := kalender_codes(person.owner_id, p_von, p_tage);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'vonPartner', t.person_id is not null, 'datum', t.datum, 'titel', t.titel,
           'ganztaegig', t.ganztaegig, 'von', coalesce(to_char(t.beginn, 'HH24:MI'), ''),
           'bis', coalesce(to_char(t.ende, 'HH24:MI'), ''), 'wiederholung', t.wiederholung,
           'notiz', t.notiz, 'ort', t.ort) order by t.datum), '[]'::jsonb)
    into termine
    from kalender_termine t
   where t.owner_id = person.owner_id
     and ((t.person_id = person.id and person.darf_eintragen)
          or (not t.von_partner and person.termine_sehen))
     and t.datum <= p_von + (p_tage - 1)
     and (t.wiederholung <> 'nie' or t.datum >= p_von);

  select jsonb_build_object(
           'name', inhaber_vorname(person.owner_id),
           'gast', person.name,
           'darfEintragen', person.darf_eintragen,
           'termineGeteilt', person.termine_sehen,
           'termine', termine,
           'tage', coalesce(jsonb_agg(jsonb_build_array(d::date, eigene ->> (d::date)::text,
                                                         case when person.darf_eintragen then t.schicht end) order by d), '[]'::jsonb))
    into ergebnis
    from generate_series(p_von, p_von + (p_tage - 1), interval '1 day') d
    left join kalender_personen_tage t on t.person_id = person.id and t.tag = d::date;

  update kalender_personen set zuletzt_genutzt = now()
   where id = person.id and (zuletzt_genutzt is null or zuletzt_genutzt < now() - interval '5 minutes');

  return ergebnis;
end;
$$;

create or replace function public.partner_tage_setzen(p_token text, p_von date, p_anzahl integer, p_schicht text)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
declare
  person kalender_personen := person_zum_link(p_token);
begin
  if person.id is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if not person.darf_eintragen then
    raise exception 'Mit diesem Link kannst du nur ansehen.';
  end if;
  perform person_tage_schreiben(person.id, p_von, p_anzahl, p_schicht);
end;
$$;

create or replace function public.partner_termin_speichern(p_token text, p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean,
  p_beginn time, p_ende time, p_wiederholung text, p_notiz text, p_ort text)
returns uuid language plpgsql volatile security definer set search_path to 'public' as $$
declare
  person kalender_personen := person_zum_link(p_token);
  neu uuid;
begin
  if person.id is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if not person.darf_eintragen then
    raise exception 'Mit diesem Link kannst du nur ansehen.';
  end if;
  if p_id is not null and not exists (select 1 from kalender_termine where id = p_id and person_id = person.id) then
    raise exception 'Termin nicht gefunden.';
  end if;
  neu := termin_schreiben(person.owner_id, true, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
  update kalender_termine set person_id = person.id where id = neu and person_id is null;
  return neu;
end;
$$;

create or replace function public.partner_termin_loeschen(p_token text, p_id uuid)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
declare
  person kalender_personen := person_zum_link(p_token);
begin
  if person.id is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  delete from kalender_termine where id = p_id and owner_id = person.owner_id and person_id = person.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Bisherige Inhaber-RPCs (eine Person „Partner“) – für ältere Oberflächen.
-- ---------------------------------------------------------------------

create or replace function public.partner_person()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from kalender_personen where owner_id = auth.uid() and art = 'partner' order by erstellt_am limit 1
$$;
revoke all on function public.partner_person() from public, anon, authenticated;

create or replace function public.partner_einladen(p_termine_teilen boolean)
returns text language plpgsql volatile security definer set search_path to 'public' as $$
declare
  p uuid;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  p := partner_person();
  if p is null then
    return (person_anlegen('Partner', 'partner', true, coalesce(p_termine_teilen, false))) ->> 'schluessel';
  end if;
  update kalender_personen set termine_sehen = coalesce(p_termine_teilen, false), darf_eintragen = true where id = p;
  return person_link_neu(p);
end;
$$;

drop function if exists public.partner_einladung_status();
create function public.partner_einladung_status()
returns table (aktiv boolean, erstellt_am timestamptz, zuletzt_genutzt timestamptz, termine_teilen boolean)
language sql stable security definer set search_path to 'public' as $$
  select true, k.link_erstellt_am, k.zuletzt_genutzt, k.termine_sehen
    from kalender_personen k
   where k.id = partner_person() and k.token_hash is not null
$$;

create or replace function public.partner_link_beenden()
returns void language sql volatile security definer set search_path to 'public' as $$
  update kalender_personen set token_hash = null where owner_id = auth.uid() and art = 'partner'
$$;

create or replace function public.partner_termine_teilen(p_an boolean)
returns void language sql volatile security definer set search_path to 'public' as $$
  update kalender_personen set termine_sehen = coalesce(p_an, false) where id = partner_person()
$$;

create or replace function public.meine_partner_tage(p_von date, p_bis date)
returns table (tag date, schicht text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_bis < p_von or p_bis - p_von > 400 then
    raise exception 'Zeitraum zu groß.';
  end if;
  return query
    select t.tag, t.schicht from kalender_personen_tage t
     where t.person_id = partner_person() and t.tag between p_von and p_bis
     order by t.tag;
end;
$$;

create or replace function public.meine_partner_tage_setzen(p_von date, p_anzahl integer, p_schicht text)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
declare
  p uuid;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  p := partner_person();
  if p is null then
    insert into kalender_personen (owner_id, name, art, darf_eintragen) values (auth.uid(), 'Partner', 'partner', true)
    returning id into p;
  end if;
  perform person_tage_schreiben(p, p_von, p_anzahl, p_schicht);
end;
$$;

-- Die ganz alten Funktionen schrieben in die alte Tabelle.
drop function if exists public.partner_link_erstellen();
drop function if exists public.partner_link_status();
drop function if exists public.partner_tage_schreiben(uuid, date, integer, text);

-- Rechte
revoke all on function public.meine_personen() from public, anon;
revoke all on function public.person_anlegen(text, text, boolean, boolean) from public, anon;
revoke all on function public.person_aendern(uuid, text, text, boolean, boolean) from public, anon;
revoke all on function public.person_link_neu(uuid) from public, anon;
revoke all on function public.person_link_beenden(uuid) from public, anon;
revoke all on function public.person_entfernen(uuid) from public, anon;
revoke all on function public.meine_personen_tage(date, date) from public, anon;
revoke all on function public.person_tage_setzen(uuid, date, integer, text) from public, anon;
revoke all on function public.meine_termine() from public, anon;
revoke all on function public.partner_einladung_status() from public, anon;
grant execute on function public.meine_personen() to authenticated;
grant execute on function public.person_anlegen(text, text, boolean, boolean) to authenticated;
grant execute on function public.person_aendern(uuid, text, text, boolean, boolean) to authenticated;
grant execute on function public.person_link_neu(uuid) to authenticated;
grant execute on function public.person_link_beenden(uuid) to authenticated;
grant execute on function public.person_entfernen(uuid) to authenticated;
grant execute on function public.meine_personen_tage(date, date) to authenticated;
grant execute on function public.person_tage_setzen(uuid, date, integer, text) to authenticated;
grant execute on function public.meine_termine() to authenticated;
grant execute on function public.partner_einladung_status() to authenticated;

revoke all on function public.partner_kalender(text, date, integer) from public;
revoke all on function public.partner_tage_setzen(text, date, integer, text) from public;
revoke all on function public.partner_termin_speichern(text, uuid, date, text, boolean, time, time, text, text, text) from public;
revoke all on function public.partner_termin_loeschen(text, uuid) from public;
grant execute on function public.partner_kalender(text, date, integer) to anon, authenticated;
grant execute on function public.partner_tage_setzen(text, date, integer, text) to anon, authenticated;
grant execute on function public.partner_termin_speichern(text, uuid, date, text, boolean, time, time, text, text, text) to anon, authenticated;
grant execute on function public.partner_termin_loeschen(text, uuid) to anon, authenticated;
