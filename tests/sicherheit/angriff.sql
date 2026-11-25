-- =============================================================================
-- Sicherheitstest: Angriffe auf die echte Datenbankstruktur
--
-- Läuft auf der Prüf-Datenbank (aufbau.sh), nie auf der Live-Datenbank.
--
-- Idee (Kanarienvogel): Firma A und die Privatperson P bekommen in JEDER Tabelle
-- Zeilen mit der Markierung „KANARIE“ in allen Textfeldern. Dann versuchen
-- Angreifer, an diese Daten zu kommen oder sie zu ändern:
--
--   anon      – nicht angemeldet
--   b_ma      – Mitarbeiter der fremden Firma B
--   b_admin   – Administration der fremden Firma B
--   q_privat  – reines Privatkonto
--   a_ma1     – Mitarbeiter derselben Firma A (Kollege) – darf vieles sehen,
--               aber keine vertraulichen Felder („GEHEIM“) und nichts Fremdes ändern
--
-- Jeder Angreifer probiert JEDE Tabelle (lesen, ändern, löschen, einfügen) und
-- JEDE Funktion, die er aufrufen darf – mit IDs aus Firma A als Argumenten.
-- Ein Fund ist:
--   * eine Markierung (KANARIE bzw. GEHEIM) oder eine ID von A/P in einer Antwort,
--   * eine Änderung an Daten, die dem Angreifer nicht gehören.
-- Alle Aufrufe laufen in Untertransaktionen und werden zurückgerollt.
-- =============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

drop schema if exists pruef cascade;
create schema pruef;

-- ---- Feste IDs ----------------------------------------------------------------
create table pruef.ids (name text primary key, id uuid not null);
insert into pruef.ids values
  ('firma_a',   'aaaaaaaa-0000-4000-8000-000000000001'),
  ('firma_b',   'bbbbbbbb-0000-4000-8000-000000000001'),
  ('a_admin',   'aaaaaaaa-0000-4000-8000-0000000000a1'),
  ('a_leiter',  'aaaaaaaa-0000-4000-8000-0000000000a2'),
  ('a_ma1',     'aaaaaaaa-0000-4000-8000-0000000000a3'),
  ('a_ma2',     'aaaaaaaa-0000-4000-8000-0000000000a4'),
  ('b_admin',   'bbbbbbbb-0000-4000-8000-0000000000b1'),
  ('b_ma',      'bbbbbbbb-0000-4000-8000-0000000000b2'),
  ('p_privat',  'cccccccc-0000-4000-8000-0000000000c1'),
  ('q_privat',  'dddddddd-0000-4000-8000-0000000000d1'),
  -- Mitarbeiter-IDs (employees.id) = Konto-ID mit anderer Endung
  ('e_a_admin', 'aaaaaaaa-0000-4000-8000-0000000e00a1'),
  ('e_a_leiter','aaaaaaaa-0000-4000-8000-0000000e00a2'),
  ('e_a_ma1',   'aaaaaaaa-0000-4000-8000-0000000e00a3'),
  ('e_a_ma2',   'aaaaaaaa-0000-4000-8000-0000000e00a4'),
  ('e_b_admin', 'bbbbbbbb-0000-4000-8000-0000000e00b1'),
  ('e_b_ma',    'bbbbbbbb-0000-4000-8000-0000000e00b2'),
  ('schicht_a', 'aaaaaaaa-0000-4000-8000-0000005c0001'),
  ('schicht_b', 'bbbbbbbb-0000-4000-8000-0000005c0001');
create function pruef.id(n text) returns uuid language sql stable as $$ select id from pruef.ids where name = n $$;

-- ---- Grunddaten (Trigger aus, damit nichts „nachgerechnet“ wird) ---------------
set session_replication_role = replica;

insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  (pruef.id('a_admin'),  'admin.kanarie@a.test',  now(), now()),
  (pruef.id('a_leiter'), 'leiter.kanarie@a.test', now(), now()),
  (pruef.id('a_ma1'),    'ma1.kanarie@a.test',    now(), now()),
  (pruef.id('a_ma2'),    'geheim.ma2@a.test',     now(), now()),
  (pruef.id('b_admin'),  'admin@b.test',          now(), now()),
  (pruef.id('b_ma'),     'ma@b.test',             now(), now()),
  (pruef.id('p_privat'), 'kanarie.privat@p.test', now(), now()),
  (pruef.id('q_privat'), 'q@q.test',              now(), now());

insert into public.companies (id, name, setup_completed_at, avv_accepted_at, terms_accepted_at, business_confirmed_at)
values (pruef.id('firma_a'), 'KANARIE Firma A', now(), now(), now(), now()),
       (pruef.id('firma_b'), 'BRAVO Firma B',   now(), now(), now(), now());
insert into public.company_settings (company_id) values (pruef.id('firma_a')), (pruef.id('firma_b'));

insert into public.shifts (id, company_id, name, short_name, start_time, end_time, weekdays)
values (pruef.id('schicht_a'), pruef.id('firma_a'), 'KANARIE Früh', 'F', '06:00', '14:00', '{1,2,3,4,5,6,7}'),
       (pruef.id('schicht_b'), pruef.id('firma_b'), 'BRAVO Früh',   'F', '06:00', '14:00', '{1,2,3,4,5,6,7}');

insert into public.employees (id, company_id, first_name, last_name, email, phone, personnel_number, role, shift_id, rotation_team, entry_date)
values
  (pruef.id('e_a_admin'),  pruef.id('firma_a'), 'KANARIE', 'Admin',  'admin.kanarie@a.test',  null, null, 'admin',        pruef.id('schicht_a'), 'A', '2020-01-01'),
  (pruef.id('e_a_leiter'), pruef.id('firma_a'), 'KANARIE', 'Leiter', 'leiter.kanarie@a.test', null, null, 'shift_leader', pruef.id('schicht_a'), 'A', '2020-01-01'),
  (pruef.id('e_a_ma1'),    pruef.id('firma_a'), 'KANARIE', 'Eins',   'ma1.kanarie@a.test',    null, null, 'employee',     pruef.id('schicht_a'), 'A', '2020-01-01'),
  (pruef.id('e_a_ma2'),    pruef.id('firma_a'), 'KANARIE', 'Zwei',   'geheim.ma2@a.test', 'GEHEIM-Telefon', 'GEHEIM-PNR', 'employee', pruef.id('schicht_a'), 'A', '2020-01-01'),
  (pruef.id('e_b_admin'),  pruef.id('firma_b'), 'BRAVO',   'Admin',  'admin@b.test', null, null, 'admin',    pruef.id('schicht_b'), 'A', '2020-01-01'),
  (pruef.id('e_b_ma'),     pruef.id('firma_b'), 'BRAVO',   'MA',     'ma@b.test',    null, null, 'employee', pruef.id('schicht_b'), 'A', '2020-01-01');

insert into public.profiles (id, company_id, employee_id, first_name, last_name, email, role) values
  (pruef.id('a_admin'),  pruef.id('firma_a'), pruef.id('e_a_admin'),  'KANARIE', 'Admin',  'admin.kanarie@a.test',  'admin'),
  (pruef.id('a_leiter'), pruef.id('firma_a'), pruef.id('e_a_leiter'), 'KANARIE', 'Leiter', 'leiter.kanarie@a.test', 'shift_leader'),
  (pruef.id('a_ma1'),    pruef.id('firma_a'), pruef.id('e_a_ma1'),    'KANARIE', 'Eins',   'ma1.kanarie@a.test',    'employee'),
  (pruef.id('a_ma2'),    pruef.id('firma_a'), pruef.id('e_a_ma2'),    'KANARIE', 'Zwei',   'geheim.ma2@a.test',     'employee'),
  (pruef.id('b_admin'),  pruef.id('firma_b'), pruef.id('e_b_admin'),  'BRAVO',   'Admin',  'admin@b.test', 'admin'),
  (pruef.id('b_ma'),     pruef.id('firma_b'), pruef.id('e_b_ma'),     'BRAVO',   'MA',     'ma@b.test',    'employee');

insert into public.privat_konten (user_id, name, kontakt_email)
values (pruef.id('p_privat'), 'KANARIE Privat', 'kanarie.privat@p.test'),
       (pruef.id('q_privat'), 'Q Privat', 'q@q.test');

-- ---- Jede Tabelle füllen --------------------------------------------------------
-- Wer „besitzt“ eine Zeile? Spalten, die auf Firma, Mitarbeiter oder Konto zeigen.
create function pruef.spalten_art(tab text, spalte text) returns text language sql immutable as $$
  select case
    when spalte = 'company_id' or (tab = 'companies' and spalte = 'id') then 'firma'
    when spalte in ('employee_id', 'von_employee') or (tab = 'employees' and spalte = 'id') then 'mitarbeiter'
    when spalte in ('user_id', 'owner_id', 'a', 'b', 'erstellt_von', 'von_profile', 'actor_id')
         or (tab = 'profiles' and spalte = 'id') then 'konto'
    when spalte in ('shift_id', 'gegen_shift_id') then 'schicht'
    else null end
$$;

create table pruef.fuell_bericht (tabelle text primary key, ergebnis text);
create table pruef.opfer (tabelle text, zeile jsonb);

-- Legt eine Zeile in `tab` an, die `besitzer` gehört, mit `marke` in allen Textfeldern.
create function pruef.fuelle(tab text, firma uuid, mitarbeiter uuid, konto uuid, schicht uuid, marke text)
returns jsonb language plpgsql as $$
declare
  spalten text[] := '{}';
  werte text[] := '{}';
  fester jsonb := '{}';   -- Spalte -> fester Ersatzwert nach Prüfverletzung
  r record;
  w text;
  ergebnis jsonb;
  versuch int;
  kname text;
  kdef text;
  wort text;
begin
  for versuch in 1..12 loop
    spalten := '{}'; werte := '{}';
    for r in
      select a.attname as n, a.atttypid, format_type(a.atttypid, a.atttypmod) as typ, a.attnotnull,
             ad.adbin is not null as hat_default, a.attidentity <> '' or a.attgenerated <> '' as auto,
             t.typtype, t.typcategory, t.typelem
        from pg_attribute a join pg_class c on c.oid = a.attrelid
        join pg_type t on t.oid = a.atttypid
        left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
       where c.relname = tab and c.relnamespace = 'public'::regnamespace and a.attnum > 0 and not a.attisdropped
       order by a.attnum
    loop
      continue when r.auto;
      if fester ? r.n then
        w := fester ->> r.n;
        continue when w = '##DEFAULT';
      else
        w := case pruef.spalten_art(tab, r.n)
               when 'firma' then quote_literal(firma)
               when 'mitarbeiter' then quote_literal(mitarbeiter)
               when 'konto' then quote_literal(konto)
               when 'schicht' then quote_literal(schicht)
               else null end;
        if w is null then
          w := case
            when r.n = 'farbe' then quote_literal('#2F5BEA')
            when r.n = 'kuerzel' then quote_literal(left(marke, 2))
            when r.n = 'code' then quote_literal(upper(left(marke, 5)) || 'XYZ')
            when r.n = 'endpoint' then quote_literal('https://push.test/' || marke)
            when r.n = 'pfad' then quote_literal(coalesce(konto::text, 'x') || '/' || marke)
            when r.n = 'steps' then quote_literal('[{"shift_id": null, "days": 7}]')
            when r.n = 'monat' then 'date_trunc(''month'', current_date)::date'
            when tab = 'kalender_verbindungen' and r.n = 'b' then quote_literal('ffffffff-ffff-4fff-8fff-ffffffffffff')
            when r.typtype = 'e' then quote_literal((select enumlabel from pg_enum where enumtypid = r.atttypid order by enumsortorder limit 1))
            when r.atttypid = 'uuid'::regtype then 'gen_random_uuid()'
            when r.atttypid in ('text'::regtype, 'varchar'::regtype) then quote_literal(marke || '_' || r.n)
            when r.atttypid in ('jsonb'::regtype, 'json'::regtype) then quote_literal(jsonb_build_object('m', marke)::text)
            when r.atttypid = 'text[]'::regtype then quote_literal(array[marke]::text)
            when r.typcategory = 'A' then quote_literal('{}')
            when r.atttypid = 'date'::regtype then 'current_date'
            when r.atttypid in ('timestamptz'::regtype, 'timestamp'::regtype) then 'now()'
            when r.atttypid = 'time'::regtype then quote_literal('08:00')
            when r.atttypid = 'interval'::regtype then quote_literal('1 day')
            when r.atttypid = 'bool'::regtype then 'false'
            when r.typcategory = 'N' then '1'
            when r.atttypid = 'bytea'::regtype then quote_literal('\x00')
            else null end;
          -- Spalten mit Standardwert ohne Text behalten ihren Standard (z. B. Status-Felder).
          if r.hat_default and r.atttypid not in ('text'::regtype, 'varchar'::regtype, 'jsonb'::regtype) then w := null; end if;
        end if;
      end if;
      if w is not null then
        spalten := spalten || quote_ident(r.n);
        werte := werte || (w || '::' || r.typ);
      end if;
    end loop;
    begin
      execute format('insert into public.%I (%s) values (%s) returning to_jsonb(%I.*)', tab,
                     array_to_string(spalten, ', '), array_to_string(werte, ', '), tab) into ergebnis;
      return ergebnis;
    exception
      when check_violation then
        get stacked diagnostics kname = constraint_name;
        select pg_get_constraintdef(k.oid) into kdef from pg_constraint k join pg_class c on c.oid = k.conrelid
         where c.relname = tab and k.conname = kname;
        -- Spalten der Bedingung typgerecht neu belegen; schon angepasste bleiben, sonst Standard/leer.
        wort := null;
        for r in select a.attname as n, a.attnum, a.atttypid, a.attnotnull, ad.adbin is not null as hat_default
                   from pg_attribute a join pg_class c on c.oid = a.attrelid
                   left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
                  where c.relname = tab and c.relnamespace = 'public'::regnamespace and a.attnum > 0
                    and kdef ~ ('\m' || a.attname || '\M') and not fester ? a.attname loop
          wort := 'neu';
          fester := fester || jsonb_build_object(r.n, case
            when r.atttypid in ('text'::regtype, 'varchar'::regtype) and substring(kdef from '''([^'']*)''') is not null
              then quote_literal(replace(replace(substring(kdef from '''([^'']*)'''), '%', ''), '^', ''))
            when r.hat_default or not r.attnotnull then '##DEFAULT'
            when r.atttypid in ('int2'::regtype, 'int4'::regtype, 'int8'::regtype, 'numeric'::regtype)
              then coalesce(substring(kdef from '(\d+)'), '1')
            when r.atttypid = 'time'::regtype then quote_literal(lpad((r.attnum + 6)::text, 2, '0') || ':00')
            when r.atttypid = 'uuid'::regtype then 'gen_random_uuid()'
            else quote_literal(marke || repeat('x', 40)) end);
        end loop;
        if wort is null then
          -- alles schon angepasst: freiwillige Spalten der Bedingung leer lassen
          for r in select a.attname as n from pg_attribute a join pg_class c on c.oid = a.attrelid
                    where c.relname = tab and c.relnamespace = 'public'::regnamespace and a.attnum > 0
                      and kdef ~ ('\m' || a.attname || '\M') and not a.attnotnull loop
            fester := fester || jsonb_build_object(r.n, '##DEFAULT');
          end loop;
        end if;
      when unique_violation then
        return null;  -- gibt es schon (z. B. eine Zeile je Firma)
      when others then
        insert into pruef.fuell_bericht values (tab, sqlerrm) on conflict (tabelle) do update set ergebnis = excluded.ergebnis;
        return null;
    end;
  end loop;
  insert into pruef.fuell_bericht values (tab, 'Prüfbedingungen nicht erfüllbar: ' || coalesce(kdef, '?'))
    on conflict (tabelle) do update set ergebnis = excluded.ergebnis;
  return null;
end $$;

do $$
declare t text; z jsonb; hat_firma boolean; hat_konto boolean;
begin
  for t in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1 loop
    select bool_or(pruef.spalten_art(t, a.attname) in ('firma', 'mitarbeiter')),
           bool_or(pruef.spalten_art(t, a.attname) = 'konto')
      into hat_firma, hat_konto
      from pg_attribute a where a.attrelid = ('public.' || quote_ident(t))::regclass and a.attnum > 0 and not a.attisdropped;
    if not coalesce(hat_firma, false) and not coalesce(hat_konto, false) then
      perform pruef.fuelle(t, null, null, null, null, 'OEFFENTLICH');  -- für alle gedacht (z. B. Rechtstexte)
      continue;
    end if;
    -- Opfer: Firma A (Kollege a_ma2) bzw. Privatperson P; Gegenstück für die Angreifer B bzw. Q.
    z := pruef.fuelle(t, pruef.id('firma_a'), pruef.id('e_a_ma2'), pruef.id('a_ma2'), pruef.id('schicht_a'), 'KANARIE');
    if z is not null then insert into pruef.opfer values (t, z); end if;
    perform pruef.fuelle(t, pruef.id('firma_b'), pruef.id('e_b_ma'), pruef.id('b_ma'), pruef.id('schicht_b'), 'BRAVO');
    if coalesce(hat_konto, false) and not coalesce(hat_firma, false) then
      z := pruef.fuelle(t, null, null, pruef.id('p_privat'), null, 'KANARIE');
      if z is not null then insert into pruef.opfer values (t, z); end if;
      perform pruef.fuelle(t, null, null, pruef.id('q_privat'), null, 'BRAVO');
    end if;
  end loop;
end $$;

-- Vertrauliche Felder des Kollegen a_ma2 – für den Kollegen a_ma1 tabu.
update public.absences set note = 'GEHEIM-Krankheitsnotiz', type = 'krank' where employee_id = pruef.id('e_a_ma2');
update public.fehlzeiten set notiz = 'GEHEIM-Fehlzeit' where employee_id = pruef.id('e_a_ma2');
update public.leave_requests set reason = 'GEHEIM-Grund', rejection_reason = 'GEHEIM-Ablehnung' where employee_id = pruef.id('e_a_ma2');
update public.hinweise set text = 'GEHEIM-Hinweis' where employee_id = pruef.id('e_a_ma2');
update public.notifications set title = 'GEHEIM-Titel', body = 'GEHEIM-Text' where employee_id = pruef.id('e_a_ma2');
update public.personal_details set birth_date = '1911-11-11' where user_id = pruef.id('a_ma2');
update public.kalender_termine set titel = 'GEHEIM-Termin', notiz = 'GEHEIM-Notiz' where owner_id = pruef.id('a_ma2');
update public.kalender_todos set titel = 'GEHEIM-Todo' where owner_id = pruef.id('a_ma2');
update public.audit_logs set payload = '{"x":"GEHEIM-Protokoll"}' where company_id = pruef.id('firma_a');
update public.email_outbox set betreff = 'GEHEIM-Mail', text_teil = 'GEHEIM-Mail', html_teil = 'GEHEIM-Mail' where company_id = pruef.id('firma_a');
update public.push_abos set endpoint = 'https://push.test/GEHEIM-Endpunkt' where user_id = pruef.id('a_ma2');
update public.passwort_codes set code_hash = 'GEHEIM-Hash' where user_id = pruef.id('a_ma2');
update public.vertraute_geraete set token_hash = 'GEHEIM-Token' where user_id = pruef.id('a_ma2');
update public.kalender_personen set token_hash = 'GEHEIM-Token' where owner_id = pruef.id('a_ma2');
-- Datenschutz-Einstellung des Kollegen: nichts freigegeben.
update public.privacy_settings set absence_visibility = 'minimal', sickness_visibility = 'private', team_eigene = false, team_andere = false
 where user_id = pruef.id('a_ma2');

set session_replication_role = origin;

-- ---- Wer besitzt eine Zeile? -------------------------------------------------------
-- Prüfsumme aller Zeilen, die NICHT dem Angreifer gehören (je Tabelle).
create function pruef.fremd_bedingung(tab text, firma uuid, mitarbeiter uuid[], konten uuid[], firmenweit boolean) returns text
language plpgsql stable as $$
declare b text := ''; a record;
begin
  for a in select attname from pg_attribute where attrelid = ('public.' || quote_ident(tab))::regclass and attnum > 0 and not attisdropped loop
    case pruef.spalten_art(tab, a.attname)
      when 'firma' then if firma is not null then b := b || format(' or %I = %L', a.attname, firma); end if;
      when 'mitarbeiter' then b := b || format(' or %I = any (%L::uuid[])', a.attname, mitarbeiter);
      when 'konto' then b := b || format(' or %I = any (%L::uuid[])', a.attname, konten);
      else null;
    end case;
  end loop;
  return 'not coalesce(false' || b || ', false)';
end $$;

create table pruef.nebenwirkung (tabelle text primary key);
-- Protokolle und Zähler, die jede erlaubte Aktion nebenbei schreibt (nur für Kollegen-Test).
insert into pruef.nebenwirkung values ('notifications'), ('audit_logs'), ('aenderungszaehler'), ('email_outbox'),
  ('push_warteschlange'), ('rate_limit_hits'), ('plattform_protokoll'), ('protokoll_zugang'), ('erinnerung_gesendet'),
  ('anmelde_sperren'), ('kalender_code_versuche'), ('plattform_tageszahlen'), ('lohnzettel_aufraeumen');

create function pruef.stand(firma uuid, mitarbeiter uuid[], konten uuid[], ohne_nebenwirkung boolean) returns jsonb
language plpgsql as $$
declare t text; s text; erg jsonb := '{}';
begin
  for t in select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1 loop
    continue when ohne_nebenwirkung and exists (select 1 from pruef.nebenwirkung n where n.tabelle = t);
    -- Warteschlangen ohne Besitzer, die jede eigene Aktion füllt
    continue when t in ('lohnzettel_aufraeumen', 'rate_limit_hits');
    execute format('select md5(coalesce(string_agg(x::text, ''|'' order by x::text), '''')) from public.%I x where %s',
                   t, pruef.fremd_bedingung(t, firma, mitarbeiter, konten, not ohne_nebenwirkung)) into s;
    erg := erg || jsonb_build_object(t, s);
  end loop;
  return erg;
end $$;

create function pruef.unterschiede(vorher jsonb, nachher jsonb) returns text language sql immutable as $$
  select string_agg(k, ', ' order by k) from jsonb_object_keys(nachher) k where nachher ->> k is distinct from vorher ->> k
$$;

-- ---- Angreifer -------------------------------------------------------------------
create table pruef.angreifer (
  name text primary key, rolle text, konto uuid, firma uuid, mitarbeiter uuid,
  marken text[],            -- was in keiner Antwort auftauchen darf
  ohne_nebenwirkung boolean -- Kollegen-Test: Protokolle/Zähler zählen nicht als Änderung
);
insert into pruef.angreifer values
  ('anon',     'anon',          null,                 null,                null,                  '{KANARIE,BRAVO,GEHEIM,1911-11-11}', false),
  ('b_ma',     'authenticated', pruef.id('b_ma'),     pruef.id('firma_b'), pruef.id('e_b_ma'),    '{KANARIE,GEHEIM,1911-11-11}', false),
  ('b_admin',  'authenticated', pruef.id('b_admin'),  pruef.id('firma_b'), pruef.id('e_b_admin'), '{KANARIE,GEHEIM,1911-11-11}', false),
  ('q_privat', 'authenticated', pruef.id('q_privat'), null,                null,                  '{KANARIE,GEHEIM,1911-11-11}', false),
  ('a_ma1',    'authenticated', pruef.id('a_ma1'),    pruef.id('firma_a'), pruef.id('e_a_ma1'),   '{GEHEIM,1911-11-11}', true);

-- IDs von A/P, die in fremden Antworten nichts zu suchen haben (für Tabellen ohne Text).
create table pruef.opfer_ids (id uuid primary key);
insert into pruef.opfer_ids
  select distinct v::uuid from pruef.opfer o, jsonb_each_text(o.zeile) e(k, v)
   where v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict do nothing;

create table pruef.versuch (angreifer text, ziel text, ok boolean, fehler text);
create table pruef.fund (
  angreifer text, art text, ziel text, argumente text, beweis text
);

-- Aufrufe, die erwartungsgemäß etwas über den Angreifer selbst zurückgeben, sind kein Fund –
-- geprüft wird nur auf fremde Markierungen/IDs.
create function pruef.leck(a pruef.angreifer, antwort text, args text) returns text language plpgsql stable as $$
declare m text; i uuid;
begin
  if antwort is null then return null; end if;
  foreach m in array a.marken loop
    if position(m in antwort) > 0 then return m || ': ' || substring(antwort from greatest(1, position(m in antwort) - 60) for 160); end if;
  end loop;
  if a.name <> 'a_ma1' then
    for i in select id from pruef.opfer_ids loop
      if position(i::text in antwort) > 0 and position(i::text in coalesce(args, '')) = 0 then
        return 'fremde ID ' || i::text;
      end if;
    end loop;
  end if;
  return null;
end $$;

-- Argumente für eine Funktion bauen: UUIDs aus A/P, sonst harmlose Werte.
-- kandidat = '00000000-…' heißt: die eigenen IDs des Angreifers (prüft, ob trotzdem Fremdes mitkommt).
create function pruef.argument(typ oid, name text, kandidat uuid, a pruef.angreifer) returns text language plpgsql stable as $$
declare t text := format_type(typ, null); v text; eigen boolean := kandidat = '00000000-0000-0000-0000-000000000000';
begin
  v := case
    when typ = 'uuid'::regtype then case
      when name ~* 'company|firma' then quote_literal(case when eigen then a.firma else pruef.id('firma_a') end)
      when name ~* 'employee|mitarbeiter' then quote_literal(case when eigen then a.mitarbeiter else pruef.id('e_a_ma2') end)
      when name ~* 'user|konto|owner|profil' then quote_literal(case when eigen then a.konto else pruef.id('a_ma2') end)
      when eigen then quote_literal(coalesce(a.mitarbeiter, a.konto))
      else quote_literal(kandidat) end
    when typ = 'uuid[]'::regtype then quote_literal(array[kandidat]::text)
    when typ = 'date'::regtype then case when name ~* 'bis|to|ende|end' then 'current_date + 60' when name ~* 'von|from|start|ab' then 'current_date - 60' else 'current_date' end
    when typ in ('int4'::regtype, 'int2'::regtype, 'int8'::regtype) then case when name ~* 'jahr|year' then '2026' when name ~* 'tage|days|anzahl' then '60' else '1' end
    when typ = 'numeric'::regtype then '1'
    when typ = 'bool'::regtype then 'true'
    when typ in ('text'::regtype, 'varchar'::regtype) then quote_literal('angriff')
    when typ = 'text[]'::regtype then quote_literal('{}')
    when typ in ('jsonb'::regtype, 'json'::regtype) then quote_literal('{}')
    when typ = 'time'::regtype then quote_literal('08:00')
    when typ in ('timestamptz'::regtype, 'timestamp'::regtype) then 'now()'
    when (select typtype from pg_type where oid = typ) = 'e' then quote_literal((select enumlabel from pg_enum where enumtypid = typ order by enumsortorder limit 1))
    when (select typcategory from pg_type where oid = typ) = 'A' then quote_literal('{}')
    else 'null' end;
  -- in Klammern, damit z. B. "current_date + 60" nicht als "60::date" gelesen wird
  return '(' || v || ')::' || t;
end $$;

create function pruef.angreifen(wer text) returns void language plpgsql as $$
declare
  a pruef.angreifer;
  claims text;
  t text;
  f record;
  k uuid;
  args text;
  vorlage text;
  antwort text;
  vorher jsonb;
  nachher jsonb;
  diff text;
  l text;
  spalte text;
  kandidaten uuid[];
  zeile jsonb;
  -- Funde werden in Variablen gemerkt, weil die Untertransaktion danach zurückgerollt wird.
  f_art text; f_ziel text; f_args text; f_beweis text;
  eigene_ma uuid[];
  eigene_konten uuid[];
begin
  select * into a from pruef.angreifer where name = wer;
  -- Was dem Angreifer gehört: sein Konto und Mitarbeiter, bei fremden Angreifern die ganze eigene Firma.
  eigene_ma := array_remove(array[a.mitarbeiter], null);
  eigene_konten := array_remove(array[a.konto], null);
  if not a.ohne_nebenwirkung and a.firma is not null then
    eigene_ma := eigene_ma || array(select id from public.employees where company_id = a.firma);
    eigene_konten := eigene_konten || array(select id from public.profiles where company_id = a.firma);
  end if;
  claims := case when a.konto is null then '{"role":"anon"}'
                 else jsonb_build_object('sub', a.konto, 'role', 'authenticated', 'aal', 'aal2')::text end;
  vorher := pruef.stand(a.firma, eigene_ma, eigene_konten, a.ohne_nebenwirkung);

  -- 1. Tabellen direkt (wie über die REST-Schnittstelle): lesen, ändern, löschen, einfügen
  for t in select relname from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r', 'v') order by 1 loop
    select attname into spalte from pg_attribute where attrelid = ('public.' || quote_ident(t))::regclass and attnum = 1;
    foreach vorlage in array array['lesen', 'ändern', 'löschen', 'einfügen'] loop
      f_art := null;
      begin
        perform set_config('request.jwt.claims', claims, true);
        execute format('set local role %I', a.rolle);
        if vorlage = 'lesen' then
          execute format('select string_agg(x::text, '' | '') from public.%I x', t) into antwort;
        elsif vorlage = 'ändern' then
          execute format('with x as (update public.%I x set %I = %I returning x.*) select string_agg(x::text, '' | '') from x', t, spalte, spalte) into antwort;
        elsif vorlage = 'löschen' then
          execute format('with x as (delete from public.%I x returning x.*) select string_agg(x::text, '' | '') from x', t) into antwort;
        else
          select o.zeile into zeile from pruef.opfer o where o.tabelle = t limit 1;
          if zeile is null then raise exception using errcode = 'P0999'; end if;
          if jsonb_typeof(zeile -> 'id') = 'string' and zeile ->> 'id' ~ '^[0-9a-f-]{36}$' then
            zeile := zeile || jsonb_build_object('id', gen_random_uuid());
          end if;
          execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, %L)', t, t, zeile::text);
          antwort := null;
        end if;
        reset role;
        l := pruef.leck(a, antwort, null);
        if l is not null then f_art := 'Tabelle ' || vorlage || ' (Antwort)'; f_beweis := l; end if;
        nachher := pruef.stand(a.firma, eigene_ma, eigene_konten, a.ohne_nebenwirkung);
        diff := pruef.unterschiede(vorher, nachher);
        if diff is not null then f_art := 'Tabelle ' || vorlage || ' (Änderung)'; f_beweis := 'geändert: ' || diff; end if;
        raise exception using errcode = 'P0999';
      exception when others then null;
      end;
      if f_art is not null then insert into pruef.fund values (wer, f_art, t, null, f_beweis); end if;
    end loop;
  end loop;

  -- 2. Funktionen (wie über /rest/v1/rpc), mit IDs aus Firma A / von P als Argumenten
  select array_agg(distinct v) into kandidaten from (
    select (o.zeile ->> 'id')::uuid v from pruef.opfer o where o.zeile ->> 'id' ~ '^[0-9a-f-]{36}$'
    union select pruef.id('firma_a') union select pruef.id('e_a_ma2') union select pruef.id('a_ma2')
    union select pruef.id('p_privat') union select pruef.id('schicht_a')
    union select '00000000-0000-0000-0000-000000000000'::uuid) s;

  for f in
    select p.oid, p.proname, p.pronargs, p.proargtypes, coalesce(p.proargnames, '{}') as namen
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
       and has_function_privilege(a.rolle, p.oid, 'execute')
     order by p.proname
  loop
    foreach k in array (case when 'uuid'::regtype::oid = any (f.proargtypes::oid[]) or 'uuid[]'::regtype::oid = any (f.proargtypes::oid[])
                             then kandidaten else array[null::uuid] end) loop
      select string_agg(pruef.argument(f.proargtypes[i], coalesce(f.namen[i + 1], ''), k, a), ', ' order by i)
        into args from generate_series(0, f.pronargs - 1) i;
      f_art := null; l := null;
      begin
        perform set_config('request.jwt.claims', claims, true);
        perform set_config('statement_timeout', '4000', true);
        execute format('set local role %I', a.rolle);
        execute format('select string_agg(r::text, '' | '') from public.%I(%s) r', f.proname, coalesce(args, '')) into antwort;
        reset role;
        perform set_config('statement_timeout', '0', true);
        l := pruef.leck(a, antwort, args);
        if l is not null then f_art := 'Funktion liefert'; f_beweis := l; end if;
        nachher := pruef.stand(a.firma, eigene_ma, eigene_konten, a.ohne_nebenwirkung);
        diff := pruef.unterschiede(vorher, nachher);
        if diff is not null then f_art := coalesce(f_art || ' + ändert', 'Funktion ändert'); f_beweis := coalesce(f_beweis || ' / ', '') || 'geändert: ' || diff; end if;
        l := 'OK';
        raise exception using errcode = 'P0999';
      exception when others then
        if l is distinct from 'OK' then l := sqlerrm; end if;
      end;
      insert into pruef.versuch values (wer, f.proname, l = 'OK', case when l = 'OK' then null else left(l, 200) end);
      if f_art is not null then insert into pruef.fund values (wer, f_art, f.proname, args, f_beweis); end if;
    end loop;
  end loop;
end $$;

-- ---- Durchführen --------------------------------------------------------------------
\echo 'Nicht befüllbare Tabellen (werden nicht mitgeprüft):'
select tabelle, left(ergebnis, 110) from pruef.fuell_bericht order by 1;
\echo 'Opferzeilen je Tabelle:'
select count(distinct tabelle) as tabellen_mit_opferdaten, (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r') as tabellen from pruef.opfer;

select pruef.angreifen('anon');
select pruef.angreifen('b_ma');
select pruef.angreifen('b_admin');
select pruef.angreifen('q_privat');
select pruef.angreifen('a_ma1');


-- ---- Gezielte Prüfungen: Rechte ausweiten -----------------------------------------
-- Jede Zeile: wer versucht was – und eine Bedingung, die danach noch gelten muss.
create table pruef.ausweitung (wer text, versuch text, aktion text, muss_gelten text);
insert into pruef.ausweitung values
  ('a_ma1', 'macht sich selbst zum Admin (employees)',
   $q$update public.employees set role = 'admin' where id = pruef.id('e_a_ma1')$q$,
   $q$(select role from public.employees where id = pruef.id('e_a_ma1')) = 'employee'$q$),
  ('a_ma1', 'macht sich selbst zum Admin (profiles)',
   $q$update public.profiles set role = 'admin' where id = pruef.id('a_ma1')$q$,
   $q$(select role from public.profiles where id = pruef.id('a_ma1')) = 'employee'$q$),
  ('a_ma1', 'wechselt in fremde Firma',
   $q$update public.profiles set company_id = pruef.id('firma_b') where id = pruef.id('a_ma1')$q$,
   $q$(select company_id from public.profiles where id = pruef.id('a_ma1')) = pruef.id('firma_a')$q$),
  ('a_ma1', 'stellt Urlaubsantrag für Kollegen',
   $q$insert into public.leave_requests (company_id, employee_id, start_date, end_date, requested_days) values (pruef.id('firma_a'), pruef.id('e_a_ma2'), current_date + 30, current_date + 30, 1)$q$,
   $q$not exists (select 1 from public.leave_requests where employee_id = pruef.id('e_a_ma2') and start_date = current_date + 30)$q$),
  ('a_ma1', 'genehmigt eigenen Antrag',
   $q$update public.leave_requests set status = 'approved' where employee_id = pruef.id('e_a_ma1')$q$,
   $q$not exists (select 1 from public.leave_requests where employee_id = pruef.id('e_a_ma1') and status = 'approved')$q$),
  ('a_ma1', 'trägt sich als Betreiber ein',
   $q$insert into public.platform_admins (user_id) values (pruef.id('a_ma1'))$q$,
   $q$not exists (select 1 from public.platform_admins where user_id = pruef.id('a_ma1'))$q$),
  ('a_ma1', 'ändert Datenschutz-Einstellung des Kollegen',
   $q$update public.privacy_settings set team_eigene = true, absence_visibility = 'shift' where user_id = pruef.id('a_ma2')$q$,
   $q$(select team_eigene from public.privacy_settings where user_id = pruef.id('a_ma2')) is distinct from true$q$),
  ('a_ma1', 'trägt Schicht im Plan ein',
   $q$insert into public.shift_assignments (company_id, employee_id, shift_id, date) values (pruef.id('firma_a'), pruef.id('e_a_ma2'), null, current_date + 3)$q$,
   $q$not exists (select 1 from public.shift_assignments where employee_id = pruef.id('e_a_ma2') and date = current_date + 3)$q$),
  ('a_leiter', 'macht sich selbst zum Admin',
   $q$update public.employees set role = 'admin' where id = pruef.id('e_a_leiter')$q$,
   $q$(select role from public.employees where id = pruef.id('e_a_leiter')) = 'shift_leader'$q$),
  ('a_leiter', 'befördert Mitarbeiter zur Schichtleitung',
   $q$update public.employees set role = 'shift_leader' where id = pruef.id('e_a_ma1')$q$,
   $q$(select role from public.employees where id = pruef.id('e_a_ma1')) = 'employee'$q$),
  ('a_leiter', 'ändert Daten der Administration',
   $q$update public.employees set last_name = 'Geändert' where id = pruef.id('e_a_admin')$q$,
   $q$(select last_name from public.employees where id = pruef.id('e_a_admin')) = 'Admin'$q$),
  ('a_leiter', 'ändert Firmen-Einstellungen',
   $q$update public.company_settings set team_sichtbarkeit = 'alle' where company_id = pruef.id('firma_a')$q$,
   $q$(select team_sichtbarkeit from public.company_settings where company_id = pruef.id('firma_a')) = 'zustimmung'$q$),
  ('b_admin', 'holt Mitarbeiter aus Firma A herüber',
   $q$update public.employees set company_id = pruef.id('firma_b') where id = pruef.id('e_a_ma2')$q$,
   $q$(select company_id from public.employees where id = pruef.id('e_a_ma2')) = pruef.id('firma_a')$q$),
  ('b_admin', 'legt Profil in Firma A an',
   $q$insert into public.profiles (id, company_id, email, role) values (pruef.id('b_ma'), pruef.id('firma_a'), 'x@b.test', 'admin')$q$,
   $q$not exists (select 1 from public.profiles where id = pruef.id('b_ma') and company_id = pruef.id('firma_a'))$q$),
  ('b_admin', 'ändert Rolle in Firma A',
   $q$update public.profiles set role = 'admin' where id = pruef.id('a_ma1')$q$,
   $q$(select role from public.profiles where id = pruef.id('a_ma1')) = 'employee'$q$);

create table pruef.ausweitung_ergebnis (wer text, versuch text, abgewehrt_durch text);
create function pruef.ausweiten() returns void language plpgsql as $$
declare v pruef.ausweitung; ok boolean; claims text; fehler text; i record; aktion text;
begin
  for v in select * from pruef.ausweitung loop
    ok := null; fehler := null;
    -- IDs fest einsetzen: der Angreifer darf das Prüf-Schema nicht benutzen.
    aktion := v.aktion;
    for i in select * from pruef.ids loop
      aktion := replace(aktion, format('pruef.id(%L)', i.name), quote_literal(i.id) || '::uuid');
    end loop;
    claims := jsonb_build_object('sub', pruef.id(v.wer), 'role', 'authenticated', 'aal', 'aal2')::text;
    begin
      perform set_config('request.jwt.claims', claims, true);
      set local role authenticated;
      begin
        execute aktion;
      exception when others then fehler := sqlerrm;
      end;
      reset role;
      execute 'select ' || v.muss_gelten into ok;
      raise exception using errcode = 'P0999';
    exception when sqlstate 'P0999' then null;
    end;
    if ok is distinct from true then
      insert into pruef.fund values (v.wer, 'Rechte ausweiten', v.versuch, v.aktion, 'Versuch hatte Erfolg');
    end if;
    insert into pruef.ausweitung_ergebnis values (v.wer, v.versuch, coalesce(fehler, 'ohne Fehler, aber ohne Wirkung'));
  end loop;
end $$;
select pruef.ausweiten();
\echo 'Versuche, Rechte auszuweiten (und woran sie scheitern):'
select wer, versuch, left(abgewehrt_durch, 90) as abgewehrt_durch from pruef.ausweitung_ergebnis order by 1, 2;

\echo 'Abdeckung je Angreifer (Funktionen):'
select angreifer, count(distinct ziel) as funktionen, count(*) as aufrufe, count(*) filter (where ok) as liefen_durch,
       count(*) filter (where not ok) as abgelehnt
  from pruef.versuch group by 1 order by 1;
\echo 'Häufigste Ablehnungsgründe:'
select angreifer, regexp_replace(left(fehler, 70), '[0-9a-f-]{36}', '<id>', 'g') as grund, count(*)
  from pruef.versuch where not ok group by 1, 2 order by 3 desc limit 40;
\echo 'Funde:'
select distinct angreifer, art, ziel, left(beweis, 140) as beweis from pruef.fund order by angreifer, art, ziel;
