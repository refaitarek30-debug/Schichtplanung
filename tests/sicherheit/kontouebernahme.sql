-- =============================================================================
-- Sicherheitstest, Teil 2: Versuche, ein fremdes Konto zu übernehmen
--
-- Läuft nach angriff.sql auf derselben Prüf-Datenbank (dieselben Testpersonen).
-- Je 10 Angriffe von der Betriebsseite und von der Privatseite. Jeder Angriff
-- hat ein Ziel (ein fremdes Konto) und eine Bedingung, die danach noch gelten muss.
-- Funktionen, die nur der Server aufruft (z. B. Passwort-Code einlösen), werden
-- so aufgerufen wie vom Server – mit den Eingaben des Angreifers.
-- =============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Zwei-Faktor für Leitung und Administration (wie im echten Betrieb Pflicht)
insert into auth.mfa_factors (user_id, factor_type, status)
values (pruef.id('a_leiter'), 'totp', 'verified'), (pruef.id('a_admin'), 'totp', 'verified');

-- Datei im Lohnzettel-Speicher der Privatperson P
insert into storage.buckets (id, name, public) values ('lohnzettel', 'lohnzettel', false) on conflict do nothing;
insert into storage.objects (bucket_id, name, owner) values ('lohnzettel', pruef.id('p_privat')::text || '/2026-10.pdf', pruef.id('p_privat'));

create table pruef.konto_test (seite text, nr int, angriff text, abgewehrt boolean, details text);

-- Befehl als bestimmte Person ausführen (Wirkung bleibt bestehen – wie im echten Leben).
create function pruef.als(wer text, befehl text, aal text default 'aal2') returns text language plpgsql as $$
declare r text; n bigint; i record; konto uuid; rolle text;
begin
  for i in select * from pruef.ids loop
    befehl := replace(befehl, format('pruef.id(%L)', i.name), quote_literal(i.id) || '::uuid');
  end loop;
  if wer = 'server' then rolle := 'service_role'; konto := null;
  elsif wer = 'anon' then rolle := 'anon'; konto := null;
  else rolle := 'authenticated'; konto := pruef.id(wer);
  end if;
  perform set_config('request.jwt.claims',
    case when konto is null then jsonb_build_object('role', rolle)::text
         else jsonb_build_object('sub', konto, 'role', rolle, 'aal', aal)::text end, true);
  execute format('set local role %I', rolle);
  begin
    if befehl ~* '^\s*select' then
      -- eine Spalte: nur der Wert; mehrere Spalten: als JSON
      execute 'select string_agg(case when (select count(*) from jsonb_object_keys(to_jsonb(x))) = 1
                 then (select value from jsonb_each_text(to_jsonb(x)) limit 1) else to_jsonb(x)::text end, '' | '')
               from (' || befehl || ') x' into r;
    else
      execute befehl;
      get diagnostics n = row_count;
      r := 'Zeilen: ' || n;
    end if;
  exception when others then r := 'abgelehnt: ' || sqlerrm;
  end;
  reset role;
  return coalesce(r, '(leer)');
end $$;

create function pruef.zufall() returns text language sql volatile as $$ select encode(extensions.gen_random_bytes(16), 'hex') $$;
create function pruef.code8() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 8)
$$;

create function pruef.melde(seite text, nr int, angriff text, abgewehrt boolean, details text) returns void language sql as $$
  insert into pruef.konto_test values (seite, nr, angriff, abgewehrt, left(details, 160));
  insert into pruef.fund select 'konto', 'Kontoübernahme', seite || ' ' || nr || ': ' || angriff, null, details where not abgewehrt;
$$;

-- ---- Betriebsseite ---------------------------------------------------------------
do $$
declare r text; code text; ergebnisse text := ''; i int; vorher text; ok boolean;
begin
  -- B1: Passwort-Code raten. Die Leitung hat für den Kollegen a_ma2 einen Code erzeugt;
  --     der Angreifer kennt dessen E-Mail und probiert 10 Codes.
  code := pruef.als('a_admin', $q$select public.passwort_code_fuer_mitarbeiter(pruef.id('e_a_ma2'))$q$);
  for i in 1..10 loop
    r := pruef.als('server', format($q$select public.passwort_code_einloesen('geheim.ma2@a.test', %L)$q$, pruef.code8()));
    ergebnisse := ergebnisse || coalesce(r::jsonb ->> 'status', r) || ' ';
  end loop;
  -- Danach selbst der richtige Code: muss gesperrt bleiben.
  r := pruef.als('server', format($q$select public.passwort_code_einloesen('geheim.ma2@a.test', %L)$q$, code));
  perform pruef.melde('Betrieb', 1, '10 Passwort-Codes für einen Kollegen raten',
    position('"ok"' in ergebnisse) = 0 and r::jsonb ->> 'status' = 'gesperrt',
    'Antworten: ' || ergebnisse || '/ danach richtiger Code: ' || r);

  -- B2: Fremde Firma erzeugt einen Passwort-Code für jemanden aus Firma A
  r := pruef.als('b_admin', $q$select public.passwort_code_fuer_mitarbeiter(pruef.id('e_a_ma1'))$q$);
  perform pruef.melde('Betrieb', 2, 'Admin einer fremden Firma erzeugt Passwort-Code', r like 'abgelehnt%', r);

  -- B3: Schichtleitung erzeugt einen Passwort-Code für die Administration
  r := pruef.als('a_leiter', $q$select public.passwort_code_fuer_mitarbeiter(pruef.id('e_a_admin'))$q$);
  perform pruef.melde('Betrieb', 3, 'Schichtleitung will Admin-Konto über Passwort-Code übernehmen', r like 'abgelehnt%', r);

  -- B4: Mitarbeiter erzeugt einen Passwort-Code für einen Kollegen
  r := pruef.als('a_ma1', $q$select public.passwort_code_fuer_mitarbeiter(pruef.id('e_a_ma2'))$q$);
  perform pruef.melde('Betrieb', 4, 'Mitarbeiter erzeugt Passwort-Code für Kollegen', r like 'abgelehnt%', r);

  -- B5: Schichtleitung schaltet die Zwei-Faktor-Anmeldung der Administration ab
  r := pruef.als('a_leiter', $q$select public.zwei_faktor_zuruecksetzen(pruef.id('e_a_admin'))$q$);
  select exists (select 1 from auth.mfa_factors where user_id = pruef.id('a_admin')) into ok;
  perform pruef.melde('Betrieb', 5, 'Schichtleitung setzt Zwei-Faktor der Administration zurück', ok, r);

  -- B6: Fremde Firma schaltet die Zwei-Faktor-Anmeldung der Schichtleitung von A ab
  r := pruef.als('b_admin', $q$select public.zwei_faktor_zuruecksetzen(pruef.id('e_a_leiter'))$q$);
  select exists (select 1 from auth.mfa_factors where user_id = pruef.id('a_leiter')) into ok;
  perform pruef.melde('Betrieb', 6, 'Admin einer fremden Firma setzt Zwei-Faktor zurück', ok, r);

  -- B7: Passwort der Schichtleitung erbeutet, aber kein Zwei-Faktor-Code (Stufe aal1)
  r := pruef.als('a_leiter', $q$select count(*) from public.employees$q$, 'aal1')
       || ' / ' || pruef.als('a_leiter', $q$select count(*) from public.leave_requests$q$, 'aal1')
       || ' / ' || pruef.als('a_leiter', $q$select public.auth_company_id()$q$, 'aal1');
  perform pruef.melde('Betrieb', 7, 'Mit Passwort, aber ohne Zwei-Faktor-Code an Firmendaten', r = '0 / 0 / (leer)', 'Mitarbeiter / Anträge / Firma: ' || r);

  -- B8: „Vertrautes Gerät“ fälschen, um den Zwei-Faktor-Code zu überspringen (10 Versuche)
  ergebnisse := '';
  for i in 1..10 loop
    r := pruef.als('server', format($q$select public.geraet_einloesen(pruef.id('a_leiter'), gen_random_uuid(), %L)$q$,
                                   encode(extensions.digest(pruef.zufall(), 'sha256'), 'hex')));
    ergebnisse := ergebnisse || r || ' ';
  end loop;
  r := pruef.als('a_leiter', $q$select public.geraet_merken(pruef.id('a_leiter'), 'x', 'Angreifer')$q$, 'aal1');
  perform pruef.melde('Betrieb', 8, '10 gefälschte Geräte-Merkzeichen + Gerät selbst eintragen',
    position('true' in ergebnisse) = 0 and r like 'abgelehnt%', 'Merkzeichen: ' || ergebnisse || '/ selbst eintragen: ' || r);

  -- B9: Beitritts-Code raten, um als Mitarbeiter in Firma A zu landen (16 Versuche:
  --     nach 15 Fehlversuchen pro Stunde ist Schluss, Migration 0243)
  ergebnisse := '';
  for i in 1..16 loop
    r := pruef.als('q_privat', format($q$select public.beitritt_annehmen(%L, true, true, true)$q$, pruef.code8()));
    ergebnisse := ergebnisse || case when r like '%Zu viele Versuche%' then 'gesperrt ' when r in ('false', 'f') then 'falsch '
                                     when r like 'abgelehnt%' then 'abgelehnt ' else r || ' ' end;
  end loop;
  select not exists (select 1 from public.profiles where id = pruef.id('q_privat')) into ok;
  perform pruef.melde('Betrieb', 9, '16 Beitritts-Codes raten (Sperre nach 15)', ok and ergebnisse like '%gesperrt %', ergebnisse);

  -- B10: Kollegen-Zugang „umhängen“ (eigenes Profil auf fremden Mitarbeiter zeigen lassen)
  r := pruef.als('a_ma1', $q$update public.profiles set employee_id = pruef.id('e_a_ma2') where id = pruef.id('a_ma1')$q$)
       || ' / ' || pruef.als('a_ma1', $q$select public.konto_zu_mitarbeiter(pruef.id('e_a_ma2'))$q$);
  select (select employee_id from public.profiles where id = pruef.id('a_ma1')) = pruef.id('e_a_ma1') into ok;
  perform pruef.melde('Betrieb', 10, 'Eigenes Konto auf den Kollegen umhängen', ok, r);
end $$;

-- ---- Privatseite ------------------------------------------------------------------
do $$
declare r text; ergebnisse text := ''; i int; ok boolean; vorher text;
begin
  -- P1: Partner-Link raten (ohne Anmeldung, 10 Versuche)
  for i in 1..10 loop
    r := pruef.als('anon', format($q$select * from public.partner_kalender(%L, current_date, 30)$q$, pruef.zufall()));
    ergebnisse := ergebnisse || case when r like 'abgelehnt%' or r = '(leer)' then 'nichts ' else 'TREFFER ' end;
  end loop;
  perform pruef.melde('Privat', 1, '10 Partner-Links raten (ohne Anmeldung)', position('TREFFER' in ergebnisse) = 0, ergebnisse);

  -- P2: Kalender-Abo-Link raten (ohne Anmeldung, 10 Versuche)
  ergebnisse := '';
  for i in 1..10 loop
    r := pruef.als('anon', format($q$select * from public.abo_plan(%L, current_date, 30)$q$, pruef.zufall()));
    ergebnisse := ergebnisse || case when r like 'abgelehnt%' or r = '(leer)' then 'nichts ' else 'TREFFER ' end;
  end loop;
  perform pruef.melde('Privat', 2, '10 Kalender-Abo-Links raten (ohne Anmeldung)', position('TREFFER' in ergebnisse) = 0, ergebnisse);

  -- P3: Verbindungscode raten, um P's Kalender zu sehen (10 Versuche)
  ergebnisse := '';
  for i in 1..10 loop
    r := pruef.als('q_privat', format($q$select public.verbindung_annehmen(%L)$q$, pruef.code8()));
    ergebnisse := ergebnisse || case when r like 'abgelehnt%' then 'gesperrt ' when r = '(leer)' then 'falsch ' else r || ' ' end;
  end loop;
  select not exists (select 1 from public.kalender_verbindungen where pruef.id('q_privat') in (a, b) and pruef.id('p_privat') in (a, b)) into ok;
  perform pruef.melde('Privat', 3, '10 Verbindungscodes raten', ok, ergebnisse);

  -- P4: Gruppen-Link raten (10 Versuche)
  ergebnisse := '';
  for i in 1..10 loop
    r := pruef.als('q_privat', format($q$select public.gruppe_beitreten(%L)$q$, pruef.zufall()));
    ergebnisse := ergebnisse || case when r like 'abgelehnt%' then 'nichts ' else 'TREFFER ' end;
  end loop;
  select not exists (select 1 from public.kalender_gruppen_mitglieder m join public.kalender_gruppen g on g.id = m.gruppe_id
                      where m.user_id = pruef.id('q_privat') and g.erstellt_von <> pruef.id('q_privat')) into ok;
  perform pruef.melde('Privat', 4, '10 Gruppen-Links raten', ok and position('TREFFER' in ergebnisse) = 0, ergebnisse);

  -- P5: Wiederherstellungs-E-Mail von P auf die eigene Adresse ändern
  r := pruef.als('q_privat', $q$update public.privat_konten set kontakt_email = 'angreifer@q.test' where user_id = pruef.id('p_privat')$q$);
  select (select kontakt_email from public.privat_konten where user_id = pruef.id('p_privat')) = 'kanarie.privat@p.test' into ok;
  perform pruef.melde('Privat', 5, 'Wiederherstellungs-E-Mail des Opfers ändern', ok, r);

  -- P6: An den Wiederherstellungs-Code von P kommen
  select string_agg(code_hash, ',') into vorher from public.passwort_codes where user_id = pruef.id('p_privat');
  r := pruef.als('q_privat', $q$select code_hash from public.passwort_codes where user_id = pruef.id('p_privat')$q$)
       || ' / ' || pruef.als('q_privat', $q$select public._passwort_code_setzen(pruef.id('p_privat'), 'selbst', null)$q$);
  select coalesce(string_agg(code_hash, ','), '') = coalesce(vorher, '') into ok from public.passwort_codes where user_id = pruef.id('p_privat');
  perform pruef.melde('Privat', 6, 'Wiederherstellungs-Code des Opfers lesen oder neu setzen', ok and r not like '%KANARIE%', r);

  -- P7: Lohnzettel von P aus dem Speicher holen
  r := pruef.als('q_privat', $q$select name from storage.objects where bucket_id = 'lohnzettel'$q$);
  perform pruef.melde('Privat', 7, 'Lohnzettel des Opfers aus dem Speicher holen', position(pruef.id('p_privat')::text in r) = 0, r);

  -- P8: Sich in P's Kalender als „Person“ eintragen (fremde Personen-ID)
  r := pruef.als('q_privat', format($q$select public.person_tage_setzen(%L, current_date, 3, 'F')$q$,
                 (select id from public.kalender_personen where owner_id = pruef.id('p_privat') limit 1)));
  select not exists (select 1 from public.kalender_personen_tage t join public.kalender_personen p on p.id = t.person_id
                      where p.owner_id = pruef.id('p_privat') and t.schicht = 'F' and t.tag = current_date) into ok;
  perform pruef.melde('Privat', 8, 'In den Kalender des Opfers eintragen', ok, r);

  -- P9: Privatkonto für eine fremde Konto-ID anlegen (Konto „besetzen“)
  r := pruef.als('q_privat', $q$select public.privat_konto_anlegen(pruef.id('a_ma1'), 'Übernommen', '2.44')$q$);
  select not exists (select 1 from public.privat_konten where user_id = pruef.id('a_ma1')) into ok;
  perform pruef.melde('Privat', 9, 'Privatkonto für eine fremde Person anlegen', ok, r);

  -- P10: Termine und To-dos des Opfers direkt löschen oder ändern
  r := pruef.als('q_privat', $q$delete from public.kalender_termine where owner_id = pruef.id('p_privat')$q$)
       || ' / ' || pruef.als('q_privat', $q$update public.kalender_todos set titel = 'weg' where owner_id = pruef.id('p_privat')$q$);
  select exists (select 1 from public.kalender_termine where owner_id = pruef.id('p_privat'))
     and not exists (select 1 from public.kalender_todos where owner_id = pruef.id('p_privat') and titel = 'weg') into ok;
  perform pruef.melde('Privat', 10, 'Termine/To-dos des Opfers löschen oder ändern', ok, r);
end $$;

\echo 'Versuche, ein fremdes Konto zu übernehmen:'
select seite, nr, angriff, case when abgewehrt then 'abgewehrt' else 'GELUNGEN' end as ergebnis, details
  from pruef.konto_test order by seite, nr;
