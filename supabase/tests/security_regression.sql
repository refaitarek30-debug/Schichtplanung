-- Regressionstest: Mandantentrennung, Rechte, Registrierung, Datenschutz.
--
-- Läuft komplett in einer Transaktion und endet immer mit einem Rollback
-- (raise exception 'ROLLBACK: …' – die Meldung enthält das Protokoll).
-- Erwartung: die Meldung enthält nur "OK"-Zeilen und keine "FEHLER"-Zeile.
--
-- Ausführen:  psql "$DATABASE_URL" -f supabase/tests/security_regression.sql
--   oder über den SQL-Editor / MCP execute_sql.
--
-- Voraussetzung: die Live-Daten der Firma „Röhm“ (Admin, Schichtleitung,
-- Mitarbeiter). Die Test-IDs stehen unten; eine zweite Firma wird im Test
-- selbst angelegt.

do $test$
declare
  log text := '';
  admin_profile   uuid := '2a78e4d4-b093-4f55-a485-fd12fe9c1f56';
  leader_profile  uuid := '64e11b82-8147-4caf-add3-ca0b7b957645';
  worker_profile  uuid := '64f2c09b-f4c9-442b-a64f-7804134b263d';
  worker_employee uuid;
  roehm_company   uuid;
  ghost_user      uuid := gen_random_uuid();
  ghost_user2     uuid := gen_random_uuid();
  fremd_company   uuid;
  fremd_employee  uuid;
  n int;
  t text;
  ok boolean;
  v_rate1 boolean; v_rate2 boolean; v_rate3 boolean;
begin
  select employee_id, company_id into worker_employee, roehm_company from profiles where id = worker_profile;

  -- 1. Rechte -------------------------------------------------------------
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon';
  log := log || case when n = 0 then 'OK   anon hat keine Tabellenrechte' else 'FEHLER anon hat ' || n || ' Tabellenrechte' end || E'\n';

  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES');
  log := log || case when n = 0 then 'OK   authenticated ohne TRUNCATE/TRIGGER/REFERENCES' else 'FEHLER authenticated hat ' || n || ' Sonderrechte' end || E'\n';

  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'audit_logs' and grantee in ('anon','authenticated')
     and privilege_type in ('INSERT','UPDATE','DELETE');
  log := log || case when n = 0 then 'OK   audit_logs nur lesbar' else 'FEHLER audit_logs schreibbar' end || E'\n';

  ok := not has_function_privilege('anon', 'public.register_company_for_user(uuid,text,text,text,boolean,boolean,text,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.register_company_for_user(uuid,text,text,text,boolean,boolean,text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.register_company_for_user(uuid,text,text,text,boolean,boolean,text,text,text)', 'EXECUTE');
  log := log || case when ok then 'OK   register_company_for_user nur service_role' else 'FEHLER register_company_for_user Rechte' end || E'\n';

  ok := not has_function_privilege('anon', 'public.rate_limit_hit(text,text,integer,integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.rate_limit_hit(text,text,integer,integer)', 'EXECUTE');
  log := log || case when ok then 'OK   rate_limit_hit nur service_role' else 'FEHLER rate_limit_hit Rechte' end || E'\n';

  -- 2. Rate-Limit ---------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  perform set_config('role', 'service_role', true);
  v_rate1 := public.rate_limit_hit('test', 'k-' || ghost_user, 2, 60);
  v_rate2 := public.rate_limit_hit('test', 'k-' || ghost_user, 2, 60);
  v_rate3 := public.rate_limit_hit('test', 'k-' || ghost_user, 2, 60);
  log := log || case when v_rate1 and v_rate2 and not v_rate3 then 'OK   Rate-Limit sperrt ab dem dritten Versuch' else 'FEHLER Rate-Limit ' || v_rate1 || v_rate2 || v_rate3 end || E'\n';

  -- 3. Registrierung: nur Dienstrolle, atomar, keine Übernahme --------------
  perform set_config('role', 'postgres', true);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
  values (ghost_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'test-registrierung-' || ghost_user || '@example.invalid', 'x', '{}'::jsonb, now(), now());

  select count(*) into n from profiles where id = ghost_user;
  log := log || case when n = 0 then 'OK   signUp ohne Zuordnung legt kein Profil an' else 'FEHLER Profil ohne Zuordnung' end || E'\n';

  -- als authenticated: verboten
  perform set_config('request.jwt.claims', json_build_object('sub', worker_profile, 'role','authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.register_company_for_user(ghost_user, 'Fremd', 'A', 'B', true, true, '1.0', '1.0', '1.0');
    log := log || 'FEHLER authenticated durfte register_company_for_user aufrufen' || E'\n';
  exception when others then
    log := log || 'OK   authenticated darf Registrierung nicht aufrufen' || E'\n';
  end;

  -- als service_role: ohne Bestätigungen scheitert es
  perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  perform set_config('role', 'service_role', true);
  begin
    perform public.register_company_for_user(ghost_user, 'Fremd GmbH', 'Erika', 'Muster', false, true, '1.0', '1.0', '1.0');
    log := log || 'FEHLER Registrierung ohne Nutzungsbedingungen' || E'\n';
  exception when others then
    log := log || 'OK   Registrierung ohne Zustimmung abgelehnt' || E'\n';
  end;
  begin
    perform public.register_company_for_user(ghost_user, 'Fremd GmbH', 'Erika', 'Muster', true, false, '1.0', '1.0', '1.0');
    log := log || 'FEHLER Registrierung ohne Unternehmensbestätigung' || E'\n';
  exception when others then
    log := log || 'OK   Registrierung ohne Unternehmensbestätigung abgelehnt' || E'\n';
  end;
  begin
    perform public.register_company_for_user(gen_random_uuid(), 'Fremd GmbH', 'Erika', 'Muster', true, true, '1.0', '1.0', '1.0');
    log := log || 'FEHLER Registrierung für unbekanntes Konto' || E'\n';
  exception when others then
    log := log || 'OK   unbekanntes Konto abgelehnt' || E'\n';
  end;

  select r.company_id, r.employee_id into fremd_company, fremd_employee
    from public.register_company_for_user(ghost_user, 'Fremd GmbH', 'Erika', 'Muster', true, true, '1.0', '1.0', '1.0') r;

  perform set_config('role', 'postgres', true);
  select count(*) into n from profiles where id = ghost_user and company_id = fremd_company and employee_id = fremd_employee and role = 'admin';
  log := log || case when n = 1 then 'OK   Firma, Stammsatz und Admin-Profil in einem Schritt' else 'FEHLER Profil fehlt' end || E'\n';

  select count(*) into n from shifts where company_id = fremd_company;
  log := log || case when n = 3 then 'OK   Standardschichten angelegt' else 'FEHLER Schichten: ' || n end || E'\n';

  select count(*) into n from companies where id = fremd_company and terms_accepted_at is not null and business_confirmed_at is not null and avv_accepted_at is not null and terms_version = '1.0';
  log := log || case when n = 1 then 'OK   Zustimmungsnachweis serverseitig gespeichert' else 'FEHLER Nachweis fehlt' end || E'\n';

  select count(*) into n from privacy_settings where user_id = ghost_user and absence_visibility = 'minimal' and sickness_visibility = 'private' and accepted_at is null;
  log := log || case when n = 1 then 'OK   Datenschutz-Voreinstellung: minimal/privat, noch nicht bestätigt' else 'FEHLER Privacy-Default' end || E'\n';

  perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  perform set_config('role', 'service_role', true);
  begin
    perform public.register_company_for_user(ghost_user, 'Zweite Firma', 'Erika', 'Muster', true, true, '1.0', '1.0', '1.0');
    log := log || 'FEHLER zweite Firma für dasselbe Konto' || E'\n';
  exception when others then
    log := log || 'OK   ein Konto kann nur eine Firma anlegen' || E'\n';
  end;

  -- 4. Mandantentrennung: Admin der Fremdfirma sieht/ändert nichts bei Röhm --
  perform set_config('request.jwt.claims', json_build_object('sub', ghost_user, 'role','authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from employees where company_id = roehm_company;
  log := log || case when n = 0 then 'OK   Fremd-Admin sieht keine Röhm-Mitarbeiter' else 'FEHLER Fremd-Admin sieht ' || n || ' Röhm-Mitarbeiter' end || E'\n';

  select count(*) into n from absences where company_id = roehm_company;
  log := log || case when n = 0 then 'OK   Fremd-Admin sieht keine Röhm-Abwesenheiten' else 'FEHLER Abwesenheiten sichtbar' end || E'\n';

  select count(*) into n from profiles where company_id = roehm_company;
  log := log || case when n = 0 then 'OK   Fremd-Admin sieht keine Röhm-Profile' else 'FEHLER Profile sichtbar' end || E'\n';

  select count(*) into n from audit_logs where company_id = roehm_company;
  log := log || case when n = 0 then 'OK   Fremd-Admin sieht kein Röhm-Protokoll' else 'FEHLER Protokoll sichtbar' end || E'\n';

  update employees set role = 'employee', active = false where id = worker_employee;
  get diagnostics n = row_count;
  log := log || case when n = 0 then 'OK   Fremd-Admin kann Röhm-Mitarbeiter nicht ändern' else 'FEHLER Röhm-Mitarbeiter geändert' end || E'\n';

  begin
    perform public.fehlzeit_speichern(worker_employee, current_date, 'frueher_gegangen', 1, null, 'v');
    log := log || 'FEHLER Fehlzeit für Röhm-Mitarbeiter durch Fremd-Admin' || E'\n';
  exception when others then
    log := log || 'OK   Fehlzeit über Firmengrenze abgelehnt' || E'\n';
  end;

  begin
    insert into leave_requests (company_id, employee_id, kind, start_date, end_date, requested_days, status)
    values (roehm_company, worker_employee, 'urlaub', current_date + 400, current_date + 400, 1, 'approved');
    log := log || 'FEHLER Antrag in fremder Firma angelegt' || E'\n';
  exception when others then
    log := log || 'OK   Antrag in fremder Firma abgelehnt' || E'\n';
  end;

  -- 5. Rollen: Mitarbeiter kann sich nicht hochstufen ------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', worker_profile, 'role','authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  begin
    update profiles set role = 'admin' where id = worker_profile;
    get diagnostics n = row_count;
    log := log || case when n = 0 then 'OK   Selbst-Hochstufung im Profil wirkungslos' else 'FEHLER Rolle im Profil geändert' end || E'\n';
  exception when others then
    log := log || 'OK   Selbst-Hochstufung im Profil abgelehnt' || E'\n';
  end;

  begin
    update employees set role = 'admin' where id = worker_employee;
    get diagnostics n = row_count;
    log := log || case when n = 0 then 'OK   Selbst-Hochstufung im Stammsatz wirkungslos' else 'FEHLER Rolle im Stammsatz geändert' end || E'\n';
  exception when others then
    log := log || 'OK   Selbst-Hochstufung im Stammsatz abgelehnt' || E'\n';
  end;

  begin
    update profiles set company_id = fremd_company where id = worker_profile;
    get diagnostics n = row_count;
    log := log || case when n = 0 then 'OK   Firmenwechsel im Profil wirkungslos' else 'FEHLER Firma im Profil geändert' end || E'\n';
  exception when others then
    log := log || 'OK   Firmenwechsel im Profil abgelehnt' || E'\n';
  end;

  select count(*) into n from absences where employee_id <> worker_employee;
  log := log || case when n = 0 then 'OK   Mitarbeiter sieht keine fremden Abwesenheitsdaten' else 'FEHLER Mitarbeiter sieht ' || n || ' fremde Abwesenheiten' end || E'\n';

  select count(*) into n from audit_logs;
  log := log || case when n = 0 then 'OK   Mitarbeiter sieht kein Protokoll' else 'FEHLER Protokoll für Mitarbeiter sichtbar' end || E'\n';

  begin
    perform public.fehlzeit_speichern(worker_employee, current_date, 'frueher_gegangen', 1, null, 'v');
    log := log || 'FEHLER Mitarbeiter durfte Fehlzeit eintragen' || E'\n';
  exception when others then
    log := log || 'OK   Mitarbeiter darf keine Fehlzeit eintragen' || E'\n';
  end;

  begin
    insert into audit_logs (company_id, action, entity) values (roehm_company, 'fake', 'x');
    log := log || 'FEHLER Protokoll direkt beschreibbar' || E'\n';
  exception when others then
    log := log || 'OK   Protokoll nicht direkt beschreibbar' || E'\n';
  end;

  begin
    perform 1 from email_outbox limit 1;
    insert into email_outbox (company_id, empfaenger, betreff, text_teil, html_teil, anlass) values (roehm_company, 'a@b.invalid', 's', 'b', 'b', 'test');
    log := log || 'FEHLER Postausgang beschreibbar' || E'\n';
  exception when others then
    log := log || 'OK   Postausgang nicht beschreibbar' || E'\n';
  end;

  -- 6. Datenschutz: Fassung kommt aus der Datenbank ---------------------------
  begin
    perform public.save_privacy_settings('minimal', 'private', true);
    select privacy_notice_version, accepted_at is not null into t, ok from privacy_settings where user_id = worker_profile;
    log := log || case when t = public.current_legal_version('datenschutz') and ok then 'OK   Kenntnisnahme speichert die aktuelle Fassung' else 'FEHLER Fassung ' || coalesce(t,'?') end || E'\n';
  exception when others then
    log := log || 'FEHLER save_privacy_settings: ' || sqlerrm || E'\n';
  end;

  perform set_config('role', 'postgres', true);
  update legal_versions set version = '9.9' where doc = 'datenschutz';
  perform set_config('request.jwt.claims', json_build_object('sub', worker_profile, 'role','authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.save_privacy_settings('minimal', 'private', true);
  select privacy_notice_version into t from privacy_settings where user_id = worker_profile;
  log := log || case when t = '9.9' then 'OK   neue Fassung wird bei erneuter Kenntnisnahme übernommen' else 'FEHLER neue Fassung: ' || coalesce(t,'?') end || E'\n';

  perform public.save_privacy_settings('shift', 'shift', false);
  select count(*) into n from privacy_settings where user_id = worker_profile and absence_granted_at is not null and sickness_granted_at is not null;
  log := log || case when n = 1 then 'OK   Freigabezeitpunkte gesetzt' else 'FEHLER granted_at' end || E'\n';
  perform public.save_privacy_settings('minimal', 'private', false);
  select count(*) into n from privacy_settings where user_id = worker_profile and absence_revoked_at is not null and sickness_revoked_at is not null;
  log := log || case when n = 1 then 'OK   Widerrufszeitpunkte gesetzt' else 'FEHLER revoked_at' end || E'\n';

  perform set_config('role', 'postgres', true);
  select count(*) into n from audit_logs
   where entity = 'privacy_settings' and entity_id = worker_profile
     and action = 'privacy.settings.changed'
     and payload::text !~* '(diagnos|grund|reason|notiz)';
  log := log || case when n >= 1 then 'OK   Datenschutz-Protokoll enthält nur Einstellungen' else 'FEHLER Datenschutz-Protokoll' end || E'\n';

  -- 7. Kommentare/Gesundheitsdaten: Führung darf lesen, Mitarbeiter fremde nicht --
  perform set_config('request.jwt.claims', json_build_object('sub', worker_profile, 'role','authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from fehlzeiten where employee_id <> worker_employee;
  log := log || case when n = 0 then 'OK   Mitarbeiter sieht keine fremden Fehlzeiten' else 'FEHLER fremde Fehlzeiten sichtbar' end || E'\n';

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  raise exception 'ROLLBACK: %', E'\n' || log;
end
$test$;

-- Teil 2 (nach Migration 0123): Konten werden nur bei Einladung verknüpft;
-- register_company() ist nicht mehr öffentlich.
do $test2$
declare
  log text := '';
  roehm_company uuid;
  emp uuid;
  u_self uuid := gen_random_uuid();
  u_inv uuid := gen_random_uuid();
  n int;
begin
  select company_id into roehm_company from profiles limit 1;

  log := log || case when not has_function_privilege('anon', 'public.register_company(text,text,text,text,boolean)', 'EXECUTE')
                      and not has_function_privilege('authenticated', 'public.register_company(text,text,text,text,boolean)', 'EXECUTE')
                     then 'OK   register_company nicht öffentlich' else 'FEHLER register_company öffentlich' end || E'\n';

  insert into employees (company_id, personnel_number, first_name, last_name, email, role, vacation_days, v_days)
  values (roehm_company, 'T-' || left(gen_random_uuid()::text, 8), 'Test', 'Einladung', 'einladung-test@example.invalid', 'employee', 0, 0)
  returning id into emp;

  -- Selbst-Signup mit passender Adresse und Mitarbeiter-ID: KEIN Profil
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
  values (u_self, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'einladung-test@example.invalid', 'x', jsonb_build_object('employee_id', emp), now(), now());
  select count(*) into n from profiles where id = u_self;
  log := log || case when n = 0 then 'OK   Selbst-Signup mit fremder Mitarbeiter-ID bekommt kein Profil' else 'FEHLER Selbst-Signup verknüpft' end || E'\n';

  -- Eingeladen, aber andere Adresse als im Stammsatz: kein Profil
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, invited_at, created_at, updated_at)
  values (u_inv, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'einladung-test@example.invalid-2', 'x', jsonb_build_object('employee_id', emp, 'role', 'admin', 'company_id', gen_random_uuid()), now(), now(), now());
  select count(*) into n from profiles where id = u_inv;
  log := log || case when n = 0 then 'OK   Eingeladenes Konto mit abweichender Adresse bekommt kein Profil' else 'FEHLER Adressabgleich fehlt' end || E'\n';
  delete from auth.users where id in (u_inv, u_self);

  -- Eingeladen mit passender Adresse: Profil, Rolle und Firma aus der Datenbank
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, invited_at, created_at, updated_at)
  values (u_inv, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'einladung-test@example.invalid', 'x', jsonb_build_object('employee_id', emp, 'role', 'admin', 'company_id', gen_random_uuid()), now(), now(), now());
  select count(*) into n from profiles where id = u_inv and role = 'employee' and company_id = roehm_company;
  log := log || case when n = 1 then 'OK   Einladung: Rolle und Firma kommen aus der Datenbank, nicht aus den Metadaten' else 'FEHLER Einladung' end || E'\n';

  raise exception 'ROLLBACK: %', E'\n' || log;
end
$test2$;
