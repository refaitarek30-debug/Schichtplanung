-- Aufbau der Live-Datenbank (nur Struktur, keine Daten), ausgelesen am 25.11.2026,
-- Stand bis Migration 0240. Neu erzeugen: siehe tests/sicherheit/README.md
set check_function_bodies = off;
-- ##TYPEN
create type public.absence_type as enum ('urlaub', 'krank', 'schulung', 'sonstiges', 'sonderurlaub', 'altersfreizeit', 'bildungsurlaub', 'berufsschule');
create type public.absence_visibility_level as enum ('minimal', 'shift');
create type public.app_role as enum ('employee', 'shift_leader', 'admin');
create type public.half_day_period as enum ('vormittag', 'nachmittag');
create type public.leave_kind as enum ('urlaub', 'v_tag', 'altersfreizeit', 'sonderurlaub', 'bildungsurlaub', 'gewerkschaftstag');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.qualification as enum ('labor', 'lager', 'messwarte', 'b_schein_verantwortlich', 'anlagenfahrer');
create type public.rotation_team as enum ('A', 'B', 'C', 'D', 'E');
create type public.sickness_visibility_level as enum ('private', 'shift');
create type public.staffing_status as enum ('ok', 'warn', 'critical');
-- ##TABELLEN
create table public.absences (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, date date not null, type absence_type not null, note text, created_at timestamp with time zone default now() not null);
create table public.aenderungszaehler (company_id uuid not null, bereich text not null, stand bigint default 0 not null, geaendert_am timestamp with time zone default now() not null);
create table public.age_leave_grants (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, year integer not null, confirmed_days numeric(4,1) default 0 not null, note text, confirmed_by uuid, confirmed_at timestamp with time zone default now() not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.anmelde_sperren (user_id uuid not null, fehlversuche integer default 0 not null, letzter_versuch timestamp with time zone default now() not null, gesperrt_am timestamp with time zone);
create table public.announcements (id uuid default gen_random_uuid() not null, company_id uuid not null, title text not null, body text not null, level text default 'info'::text not null, created_by uuid, created_at timestamp with time zone default now() not null, active boolean default true not null, updated_at timestamp with time zone default now() not null);
create table public.anzeige_einstellungen (user_id uuid not null, wochenende text default 'leicht'::text not null, plan_ansicht text default 'kompakt'::text not null, plan_eigene_farben boolean default false not null, geaendert_am timestamp with time zone default now() not null, einfuehrung_gesehen boolean default false not null);
create table public.audit_logs (id uuid default gen_random_uuid() not null, company_id uuid not null, actor_id uuid, action text not null, entity text not null, entity_id uuid, payload jsonb, created_at timestamp with time zone default now() not null);
create table public.betrieb_beitritte (code text not null, employee_id uuid not null, company_id uuid not null, erstellt_am timestamp with time zone default now() not null, gueltig_bis timestamp with time zone default (now() + '7 days'::interval) not null);
create table public.companies (id uuid default gen_random_uuid() not null, name text not null, logo_url text, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, avv_accepted_at timestamp with time zone, setup_completed_at timestamp with time zone, terms_accepted_at timestamp with time zone, terms_version text, avv_version text, privacy_notice_version text, business_confirmed_at timestamp with time zone, is_demo boolean default false not null, demo_expires_at timestamp with time zone, v_tag_name text default 'V-Tag'::text not null, v_tage_name text default 'V-Tage'::text not null, zeitausgleich boolean default true not null, geloescht_am timestamp with time zone);
create table public.company_settings (company_id uuid not null, notify_leave_email boolean default true not null, updated_at timestamp with time zone default now() not null, state text default 'NW'::text not null, work_on_holidays boolean default true not null, gruende_fuer_kollegen boolean default false not null, hinweis_standard text default 'schicht'::text not null, leitung_eigene_antraege boolean default false not null, team_sichtbarkeit text default 'zustimmung'::text not null);
create table public.demo_settings (id boolean default true not null, template_company_id uuid, max_active integer default 200 not null, lifetime interval default '24:00:00'::interval not null);
create table public.email_outbox (id uuid default gen_random_uuid() not null, company_id uuid not null, empfaenger text not null, betreff text not null, text_teil text not null, html_teil text not null, anlass text not null, related_id uuid, status text default 'offen'::text not null, versuche integer default 0 not null, letzter_fehler text, gesendet_at timestamp with time zone, created_at timestamp with time zone default now() not null);
create table public.employee_gruppenwechsel (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, ab date not null, von_team rotation_team, nach_team rotation_team not null, vollzogen_am timestamp with time zone, angelegt_von uuid default auth.uid(), angelegt_am timestamp with time zone default now() not null);
create table public.employee_qualifications (employee_id uuid not null, qualification_id uuid not null, created_at timestamp with time zone default now() not null);
create table public.employees (id uuid default gen_random_uuid() not null, company_id uuid not null, personnel_number text, first_name text not null, last_name text not null, email text, phone text, role app_role default 'employee'::app_role not null, department text, shift_id uuid, vacation_days numeric(4,1) default 0 not null, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, rotation_pattern_id uuid, rotation_offset_days integer default 0 not null, qualifications qualification[] default '{}'::qualification[] not null, rotation_team rotation_team, v_days numeric(4,1) default 0 not null, shift_worker boolean default true not null, sort_order integer, profile_confirmed_at timestamp with time zone, entry_date date, exit_date date, is_apprentice boolean default false not null, bildungsurlaub_erlaubt boolean default false not null, af_ab date, sonderurlaub_erlaubt boolean default false not null, af_start_stunden numeric(7,2) default 0 not null, v_ab date, v_start_stunden numeric(7,2) default 0 not null);
create table public.erinnerung_gesendet (art text not null, ref_id uuid not null, faellig_am timestamp with time zone not null, gesendet_am timestamp with time zone default now() not null);
create table public.fehlzeiten (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, tag date not null, art text not null, stunden numeric(4,2) not null, notiz text, erfasst_von uuid, created_at timestamp with time zone default now() not null, abzug text default 'v'::text not null);
create table public.funktionen (funktion text not null, fuer_alle boolean default false not null);
create table public.funktionen_zugang (funktion text not null, user_id uuid not null);
create table public.hinweise (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, von_profile uuid, von_name text default ''::text not null, text text not null, ziel text, push text default 'schicht'::text not null, push_ab timestamp with time zone, erstellt_am timestamp with time zone default now() not null, gelesen_am timestamp with time zone, zurueckgezogen_am timestamp with time zone, zeigen_ab timestamp with time zone);
create table public.holidays (id uuid default gen_random_uuid() not null, company_id uuid, date date not null, name text not null, region text default 'NW'::text not null, company_closure boolean default false not null);
create table public.kalender_abo (id uuid default gen_random_uuid() not null, user_id uuid not null, token_hash text not null, erstellt_am timestamp with time zone default now() not null, beendet_am timestamp with time zone, zuletzt_abgerufen timestamp with time zone);
create table public.kalender_code_versuche (user_id uuid not null, zeit timestamp with time zone default now() not null);
create table public.kalender_eigene_arten (id uuid default gen_random_uuid() not null, user_id uuid not null, name text not null, kuerzel text not null, farbe text not null, beginn time without time zone, ende time without time zone, reihenfolge integer default 0 not null, erstellt_am timestamp with time zone default now() not null);
create table public.kalender_eigene_tage (user_id uuid not null, tag date not null, art_id uuid not null);
create table public.kalender_farben (user_id uuid not null, schluessel text not null, farbe text not null);
create table public.kalender_gruppen (id uuid default gen_random_uuid() not null, name text not null, erstellt_von uuid, token_hash text, erstellt_am timestamp with time zone default now() not null);
create table public.kalender_gruppen_mitglieder (gruppe_id uuid not null, user_id uuid not null, beigetreten_am timestamp with time zone default now() not null);
create table public.kalender_partner (id uuid default gen_random_uuid() not null, owner_id uuid not null, token_hash text not null, erstellt_am timestamp with time zone default now() not null, beendet_am timestamp with time zone, zuletzt_genutzt timestamp with time zone, termine_teilen boolean default false not null);
create table public.kalender_partner_tage (owner_id uuid not null, tag date not null, schicht text not null, geaendert_am timestamp with time zone default now() not null);
create table public.kalender_personen (id uuid default gen_random_uuid() not null, owner_id uuid not null, name text not null, art text default 'partner'::text not null, darf_eintragen boolean default false not null, termine_sehen boolean default false not null, token_hash text, link_erstellt_am timestamp with time zone, zuletzt_genutzt timestamp with time zone, erstellt_am timestamp with time zone default now() not null);
create table public.kalender_personen_tage (person_id uuid not null, tag date not null, schicht text not null, geaendert_am timestamp with time zone default now() not null);
create table public.kalender_termin_ausnahmen (termin_id uuid not null, datum date not null, ab boolean default false not null);
create table public.kalender_termine (id uuid default gen_random_uuid() not null, owner_id uuid not null, von_partner boolean default false not null, datum date not null, titel text default ''::text not null, ganztaegig boolean default false not null, beginn time without time zone, ende time without time zone, wiederholung text default 'nie'::text not null, notiz text default ''::text not null, ort text default ''::text not null, geaendert_am timestamp with time zone default now() not null, person_id uuid, bis_datum date, erinnerung text, von_user uuid, nur_privat boolean default false not null);
create table public.kalender_todos (id uuid default gen_random_uuid() not null, owner_id uuid not null, titel text not null, datum date, uhrzeit time without time zone, erledigt boolean default false not null, erledigt_am timestamp with time zone, erstellt_am timestamp with time zone default now() not null, nur_privat boolean default false not null);
create table public.kalender_verbindung_codes (code_hash text not null, user_id uuid not null, person_id uuid, gueltig_bis timestamp with time zone not null, erstellt_am timestamp with time zone default now() not null);
create table public.kalender_verbindungen (id uuid default gen_random_uuid() not null, a uuid not null, b uuid not null, a_art text default 'partner'::text not null, b_art text default 'partner'::text not null, a_termine boolean default false not null, a_darf boolean default false not null, b_termine boolean default false not null, b_darf boolean default false not null, erstellt_am timestamp with time zone default now() not null);
create table public.kalender_vorlieben (user_id uuid not null, rollen text[] default '{}'::text[] not null, vorlagen jsonb default '[]'::jsonb not null, gefragt boolean default false not null, geaendert_am timestamp with time zone default now() not null);
create table public.konsole_tresor (id uuid default gen_random_uuid() not null, art text not null, daten text not null, datei_pfad text, groesse bigint, erstellt_von uuid, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.konsole_tresor_schluessel (id smallint default 1 not null, salz text not null, runden integer not null, schluessel text not null, geaendert_von uuid, updated_at timestamp with time zone default now() not null);
create table public.leave_balances (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, year smallint not null, entitlement numeric(4,1) default 0 not null, carried_over numeric(4,1) default 0 not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, v_entitlement numeric(4,1) default 0 not null, v_carried_over numeric(4,1) default 0 not null, v_korrektur numeric(6,1) default 0 not null);
create table public.leave_requests (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, start_date date not null, end_date date not null, half_day boolean default false not null, requested_days numeric(4,1) not null, reason text, status leave_status default 'pending'::leave_status not null, reviewed_by uuid, reviewed_at timestamp with time zone, rejection_reason text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, half_day_period half_day_period, kind leave_kind default 'urlaub'::leave_kind not null, request_group_id uuid, withdrawn_at timestamp with time zone, withdrawn_by uuid, withdrawal_reason text, v_jahresplanung boolean);
create table public.legal_versions (doc text not null, version text not null, valid_from date default CURRENT_DATE not null);
create table public.lohnzettel_aufraeumen (pfad text not null, seit timestamp with time zone default now() not null);
create table public.notifications (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, type text not null, title text not null, body text not null, related_entity text, related_id uuid, read_at timestamp with time zone, created_at timestamp with time zone default now() not null);
create table public.passwort_codes (user_id uuid not null, code_hash text not null, art text not null, erstellt_von uuid, erstellt_am timestamp with time zone default now() not null, gueltig_bis timestamp with time zone, fehlversuche integer default 0 not null, gesperrt_bis timestamp with time zone);
create table public.personal_details (user_id uuid not null, company_id uuid not null, birth_date date, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, birth_date_bestaetigt boolean default true not null);
create table public.plan_kommentare (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, tag date not null, text text not null, autor_id uuid, autor_name text default ''::text not null, created_at timestamp with time zone default now() not null);
create table public.platform_admins (user_id uuid not null, notiz text, created_at timestamp with time zone default now() not null, nur_lesen boolean default false not null);
create table public.plattform_protokoll (id bigint generated always as identity not null, am timestamp with time zone default now() not null, aktion text not null, art text not null, wer uuid);
create table public.plattform_tageszahlen (tag date not null, konten integer not null, privat integer not null, aktiv_7 integer not null, aktiv_30 integer not null, privat_aktiv_7 integer not null);
create table public.privacy_settings (user_id uuid not null, company_id uuid not null, absence_visibility absence_visibility_level default 'minimal'::absence_visibility_level not null, sickness_visibility sickness_visibility_level default 'private'::sickness_visibility_level not null, privacy_notice_version text default '1.0'::text not null, accepted_at timestamp with time zone, updated_at timestamp with time zone default now() not null, absence_revoked_at timestamp with time zone, sickness_revoked_at timestamp with time zone, absence_granted_at timestamp with time zone, sickness_granted_at timestamp with time zone, team_eigene boolean, team_andere boolean, team_gefragt_am timestamp with time zone, push_ohne_inhalt boolean default false not null);
create table public.privat_konten (user_id uuid not null, name text not null, bundesland text default 'NW'::text not null, feiertage_zeigen boolean default true not null, wochenstunden numeric(4,1), datenschutz_version text, erstellt_am timestamp with time zone default now() not null, kontakt_email text, neuigkeiten_gesehen timestamp with time zone default now(), lohnzettel_einwilligung timestamp with time zone);
create table public.privat_lohnzettel (id uuid default gen_random_uuid() not null, user_id uuid not null, monat date not null, titel text default ''::text not null, pfad text not null, typ text not null, groesse integer not null, erstellt_am timestamp with time zone default now() not null);
create table public.privat_schichtarten (id uuid default gen_random_uuid() not null, user_id uuid not null, name text not null, kuerzel text not null, farbe text not null, art text default 'arbeit'::text not null, beginn time without time zone, ende time without time zone, stunden numeric(4,2) default 0 not null, reihenfolge integer default 0 not null, erstellt_am timestamp with time zone default now() not null);
create table public.privat_tag_zeiten (user_id uuid not null, tag date not null, schichtart_id uuid not null, beginn time without time zone not null, ende time without time zone not null);
create table public.privat_tage (user_id uuid not null, tag date not null, schichtart_id uuid not null, ebene smallint default 1 not null);
create table public.privat_umfrage (user_id uuid not null, quelle text, zufriedenheit smallint, verbesserung text, uebersprungen boolean default false not null, erstellt_am timestamp with time zone default now() not null);
create table public.profiles (id uuid not null, company_id uuid not null, employee_id uuid, first_name text default ''::text not null, last_name text default ''::text not null, email text not null, role app_role default 'employee'::app_role not null, avatar_url text, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, hidden_dashboard_tiles text[] default '{}'::text[] not null, start_seite text, start_ansicht text default 'kompakt'::text not null, neuigkeiten_gesehen timestamp with time zone default now(), austritt_uebernommen_am timestamp with time zone, inaktiv_geprueft_am timestamp with time zone);
create table public.protokoll_zugang (user_id uuid not null, company_id uuid not null, created_at timestamp with time zone default now() not null);
create table public.push_abos (id uuid default gen_random_uuid() not null, user_id uuid not null, endpoint text not null, p256dh text not null, auth text not null, geraet text default ''::text not null, erstellt_am timestamp with time zone default now() not null);
create table public.push_vorlieben (user_id uuid not null, aus text[] default '{}'::text[] not null);
create table public.push_warteschlange (id bigint generated always as identity not null, user_id uuid not null, art text not null, titel text not null, text text default ''::text not null, url text default '/start'::text not null, tag text, sammel text, anzahl integer default 1 not null, erstellt_am timestamp with time zone default now() not null, gesendet_am timestamp with time zone, senden_ab timestamp with time zone);
create table public.qualifications (id uuid default gen_random_uuid() not null, company_id uuid not null, key text not null, label text not null, active boolean default true not null, sort_order integer, created_at timestamp with time zone default now() not null);
create table public.rate_limit_hits (id bigint generated always as identity not null, bucket text not null, key_hash text not null, hit_at timestamp with time zone default now() not null);
create table public.replacement_requests (id uuid default gen_random_uuid() not null, company_id uuid not null, date date not null, shift_id uuid not null, qualification_id uuid, absent_employee_id uuid, asked_employee_id uuid not null, status text default 'offen'::text not null, note text, requested_by uuid, requested_at timestamp with time zone default now() not null, answered_at timestamp with time zone, answer_note text, assigned_at timestamp with time zone);
create table public.rotation_patterns (id uuid default gen_random_uuid() not null, company_id uuid not null, name text not null, anchor_date date not null, steps jsonb not null, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, team_offset_days integer default 7 not null);
create table public.schicht_tausch (id uuid default gen_random_uuid() not null, company_id uuid not null, von_employee uuid not null, tag date not null, shift_id uuid, notiz text, status text default 'offen'::text not null, uebernehmer uuid, gegen_tag date, gegen_shift_id uuid, angefragt_am timestamp with time zone, entschieden_von uuid, entschieden_am timestamp with time zone, erstellt_am timestamp with time zone default now() not null);
create table public.school_holidays (id uuid default gen_random_uuid() not null, company_id uuid, region text not null, name text not null, start_date date not null, end_date date not null, created_at timestamp with time zone default now() not null);
create table public.shift_assignments (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, shift_id uuid, date date not null, created_at timestamp with time zone default now() not null);
create table public.shift_qualification_needs (id uuid default gen_random_uuid() not null, company_id uuid not null, shift_id uuid not null, qualification_id uuid not null, minimum smallint default 1 not null, created_at timestamp with time zone default now() not null);
create table public.shifts (id uuid default gen_random_uuid() not null, company_id uuid not null, name text not null, short_name text not null, start_time time without time zone not null, end_time time without time zone not null, color text default '#2F5BEA'::text, minimum_staff smallint default 0 not null, target_staff smallint default 0 not null, weekdays smallint[] default '{1,2,3,4,5}'::smallint[] not null, active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.staffing_rules (id uuid default gen_random_uuid() not null, company_id uuid not null, shift_id uuid, key text not null, value jsonb not null, active boolean default true not null, created_at timestamp with time zone default now() not null);
create table public.training_assignments (id uuid default gen_random_uuid() not null, company_id uuid not null, employee_id uuid not null, start_date date not null, end_date date not null, area text not null, shift_id uuid, note text, status text default 'geplant'::text not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.vertraute_geraete (id uuid default gen_random_uuid() not null, user_id uuid not null, token_hash text not null, geraet text, erstellt_am timestamp with time zone default now() not null, zuletzt_am timestamp with time zone default now() not null, bis timestamp with time zone not null);
create table public.vertraute_sitzungen (session_id uuid not null, user_id uuid not null, geraet_id uuid not null, erstellt_am timestamp with time zone default now() not null);
-- ##FUNKTIONEN
CREATE OR REPLACE FUNCTION public._beitritt_code(p_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public._eigene_eintraege_nach_privat(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a record;
  neu uuid;
  t record;
  frei smallint;
begin
  for a in select * from kalender_eigene_arten where user_id = p_user order by reihenfolge, erstellt_am loop
    insert into privat_schichtarten (user_id, name, kuerzel, farbe, art, beginn, ende, stunden, reihenfolge)
    values (
      p_user, a.name, a.kuerzel, a.farbe, 'arbeit', a.beginn, a.ende,
      case when a.beginn is not null and a.ende is not null
           then least(24, round((extract(epoch from (a.ende - a.beginn)) / 3600
                                 + case when a.ende <= a.beginn then 24 else 0 end)::numeric, 2))
           else 0 end,
      100 + a.reihenfolge)
    returning id into neu;
    for t in select tag from kalender_eigene_tage where user_id = p_user and art_id = a.id loop
      select min(x)::smallint into frei
        from generate_series(1, 3) x
       where not exists (select 1 from privat_tage pt where pt.user_id = p_user and pt.tag = t.tag and pt.ebene = x);
      if frei is not null then
        insert into privat_tage (user_id, tag, ebene, schichtart_id) values (p_user, t.tag, frei, neu);
      end if;
    end loop;
  end loop;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public._passwort_code_hash(p_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public._passwort_code_neu()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  zeichen constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(10);
  code text := '';
begin
  for i in 0..9 loop
    code := code || substr(zeichen, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public._passwort_code_setzen(p_user uuid, p_art text, p_dauer interval)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  code text := _passwort_code_neu();
begin
  insert into passwort_codes (user_id, code_hash, art, erstellt_von, erstellt_am, gueltig_bis, fehlversuche, gesperrt_bis)
  values (p_user, _passwort_code_hash(code), p_art, auth.uid(), now(), case when p_dauer is null then null else now() + p_dauer end, 0, null)
  on conflict (user_id) do update
    set code_hash = excluded.code_hash, art = excluded.art, erstellt_von = excluded.erstellt_von,
        erstellt_am = now(), gueltig_bis = excluded.gueltig_bis, fehlversuche = 0, gesperrt_bis = null;
  return code;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public._privat_konto_sicherstellen(p_user uuid, p_name text, p_version text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from privat_konten where user_id = p_user) then
    return false;
  end if;
  insert into privat_konten (user_id, name, datenschutz_version)
  values (p_user, left(coalesce(nullif(btrim(p_name), ''), 'Ich'), 80), p_version);
  if not exists (select 1 from privat_schichtarten where user_id = p_user) then
    insert into privat_schichtarten (user_id, name, kuerzel, farbe, art, beginn, ende, stunden, reihenfolge) values
      (p_user, 'Früh',   'F', '#F5A524', 'arbeit', '06:00', '14:00', 8, 1),
      (p_user, 'Spät',   'S', '#22A06B', 'arbeit', '14:00', '22:00', 8, 2),
      (p_user, 'Nacht',  'N', '#2F6FDE', 'arbeit', '22:00', '06:00', 8, 3),
      (p_user, 'Frei',   'X', '#E5484D', 'frei',   null,    null,    0, 4),
      (p_user, 'Urlaub', 'U', '#9B59D0', 'urlaub', null,    null,    8, 5),
      (p_user, 'Krank',  'K', '#F76B15', 'krank',  null,    null,    8, 6);
  end if;
  update privat_schichtarten s
     set farbe = f.farbe
    from kalender_farben f
   where s.user_id = p_user
     and f.user_id = p_user
     and f.farbe ~ '^#[0-9a-fA-F]{6}$'
     and f.schluessel = case s.kuerzel
                          when 'F' then 'schicht:F' when 'S' then 'schicht:S' when 'N' then 'schicht:N'
                          when 'X' then 'frei' when 'U' then 'abw:U' when 'K' then 'abw:K'
                        end;
  return true;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.abo_beenden()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update kalender_abo set beendet_am = now() where user_id = auth.uid() and beendet_am is null
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.abo_erstellen()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich uuid := auth.uid();
  schluessel text;
begin
  if ich is null or not kalender_nutzer() or not abo_frei(ich) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update kalender_abo set beendet_am = now() where user_id = ich and beendet_am is null;
  schluessel := encode(extensions.gen_random_bytes(24), 'hex');
  insert into kalender_abo (user_id, token_hash)
  values (ich, encode(extensions.digest(schluessel, 'sha256'), 'hex'));
  return schluessel;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.abo_frei(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ist_privatkonto(p_user) or funktion_frei(p_user, 'kalender_abo')
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.abo_inhaber(p_token text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.user_id
    from kalender_abo a
   where a.beendet_am is null
     and length(coalesce(p_token, '')) between 32 and 128
     and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and (exists (select 1 from profiles p where p.id = a.user_id and p.active and p.employee_id is not null)
          or ist_privatkonto(a.user_id))
     and abo_frei(a.user_id)
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.abo_plan(p_token text, p_von date, p_tage integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inhaber uuid := abo_inhaber(p_token);
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  ergebnis jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  if nur_privatkonto(inhaber) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'tag', t.tag,
             'art', case s.art when 'urlaub' then 'urlaub' when 'krank' then 'abwesend' else 'schicht' end,
             'name', s.name,
             'von', to_char(s.beginn, 'HH24:MI'),
             'bis', to_char(s.ende, 'HH24:MI')) order by t.tag, t.ebene), '[]'::jsonb)
      into ergebnis
      from privat_tage t
      join privat_schichtarten s on s.id = t.schichtart_id
     where t.user_id = inhaber and s.art <> 'frei'
       and t.tag between p_von and p_von + (p_tage - 1);
  else
    select p.company_id into firma from profiles p where p.id = inhaber;

    perform set_config('request.jwt.claims', json_build_object('sub', inhaber, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    perform set_config('request.jwt.claim.sub', inhaber::text, true);

    select coalesce(jsonb_agg(z.j order by z.tag, z.reihe), '[]'::jsonb)
      into ergebnis
      from (
        select g.day as tag, 1 as reihe, jsonb_build_object(
                 'tag', g.day,
                 'art', case
                          when g.absence_code is not null and g.absence_code = upper(g.absence_code) then
                            case when g.absence_code = 'FB' then 'schulung'
                                 when g.absence_code in ('U', 'V', 'AF', 'SU', 'BU', 'G') then 'urlaub'
                                 else 'abwesend' end
                          else 'schicht' end,
                 'name', g.shift_name,
                 'von', to_char(s.start_time, 'HH24:MI'),
                 'bis', to_char(s.end_time, 'HH24:MI')) as j
          from shift_plan_grid(firma, p_von, p_tage) g
          left join lateral (select sh.start_time, sh.end_time from shifts sh
                              where sh.company_id = firma and sh.name = g.shift_name limit 1) s on true
         where g.is_me
           and (g.shift_name is not null
                or (g.absence_code is not null and g.absence_code = upper(g.absence_code)))
        union all
        select e.tag, 2, jsonb_build_object(
                 'tag', e.tag,
                 'art', 'eigen',
                 'name', a.name,
                 'von', to_char(a.beginn, 'HH24:MI'),
                 'bis', to_char(a.ende, 'HH24:MI'))
          from kalender_eigene_tage e
          join kalender_eigene_arten a on a.user_id = e.user_id and a.id = e.art_id
         where e.user_id = inhaber
           and e.tag between p_von and p_von + (p_tage - 1)
      ) z;

    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  end if;

  update kalender_abo set zuletzt_abgerufen = now()
   where user_id = inhaber and beendet_am is null
     and (zuletzt_abgerufen is null or zuletzt_abgerufen < now() - interval '5 minutes');

  return ergebnis;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.abo_status()
 RETURNS TABLE(aktiv boolean, erstellt_am timestamp with time zone, zuletzt_abgerufen timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select true, a.erstellt_am, a.zuletzt_abgerufen
    from kalender_abo a
   where a.user_id = auth.uid() and a.beendet_am is null and abo_frei(auth.uid())
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.abo_termine(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inhaber uuid := abo_inhaber(p_token);
  ergebnis jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'datum', t.datum,
           'bis', t.bis_datum,
           'titel', t.titel,
           'ganztaegig', t.ganztaegig,
           'beginn', to_char(t.beginn, 'HH24:MI'),
           'ende', to_char(t.ende, 'HH24:MI'),
           'wiederholung', t.wiederholung,
           'notiz', t.notiz,
           'ort', t.ort,
           'ausfaelle', to_jsonb(termin_ausfaelle(t.id)), 'serie_ab', termin_serie_ab(t.id)) order by t.datum), '[]'::jsonb)
    into ergebnis
    from (select * from kalender_termine k
           where k.owner_id = inhaber and not k.von_partner
             and (coalesce(k.bis_datum, k.datum) >= public.heute() - 60 or k.wiederholung <> 'nie')
           order by k.datum desc
           limit 500) t;

  return ergebnis;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.absence_report(p_year integer, p_month integer DEFAULT NULL::integer)
 RETURNS TABLE(employee_id uuid, name text, rotation_team text, monat integer, soll_tage integer, anwesend_tage integer, krank_tage integer, urlaub_tage integer, v_tage integer, sonderurlaub_tage integer, altersfreizeit_tage integer, bildungsurlaub_tage integer, gewerkschaftstag_tage integer, seminar_tage integer, sonstige_tage integer, ausfall_tage integer, soll_stunden numeric, anwesend_stunden numeric, krank_stunden numeric, ausfall_stunden numeric, ausfallquote numeric, gesundheitsrate numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  von date;
  bis date;
  stunden numeric;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Auswertungen sehen.';
  end if;
  if p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  if p_month is not null and (p_month < 1 or p_month > 12) then
    raise exception 'Ungültiger Monat.';
  end if;

  von := make_date(p_year, coalesce(p_month, 1), 1);
  bis := case when p_month is null
              then make_date(p_year, 12, 31)
              else (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
         end;

  stunden := company_rule_number('stunden_pro_arbeitstag', 'stunden', 8);

  return query
  with arbeitstage as (
    select
      e.id as emp,
      e.first_name || ' ' || e.last_name as voller_name,
      e.rotation_team::text as team,
      d::date as tag,
      extract(month from d)::int as m
    from employees e
    cross join generate_series(von, bis, interval '1 day') d
    where e.company_id = firma
      and e.active
      and is_planned_workday(e.id, d::date)
  ),
  -- Genau eine Kategorie je Tag. Erfasste Abwesenheit sticht Urlaub;
  -- ein genehmigter Urlaubstag, an dem jemand krankgemeldet ist, zaehlt
  -- als Kranktag und nicht doppelt.
  eingeteilt as (
    select
      a.emp, a.voller_name, a.team, a.m,
      coalesce(
        (select ab.type::text from absences ab
          where ab.employee_id = a.emp and ab.date = a.tag
          order by case ab.type::text
                     when 'krank' then 1
                     when 'sonderurlaub' then 2
                     when 'altersfreizeit' then 3
                     when 'bildungsurlaub' then 4
                     when 'schulung' then 5
                     else 6 end
          limit 1),
        -- Seit den neuen Antragsarten steht die Art direkt im Antrag.
        -- Vorher wurde alles ausser 'v_tag' als Urlaub gezaehlt -- ein
        -- Sonderurlaub waere damit als Urlaub in der Auswertung gelandet.
        (select r.kind::text
           from leave_requests r
          where r.employee_id = a.emp
            and r.status = 'approved'
            and a.tag between r.start_date and r.end_date
          limit 1),
        'anwesend'
      ) as art
    from arbeitstage a
  ),
  gezaehlt as (
    select
      g.emp, g.voller_name, g.team, g.m,
      count(*)::int as soll,
      count(*) filter (where g.art = 'anwesend')::int       as anwesend,
      count(*) filter (where g.art = 'krank')::int          as krank,
      count(*) filter (where g.art = 'urlaub')::int         as urlaub,
      count(*) filter (where g.art = 'v_tag')::int          as v,
      count(*) filter (where g.art = 'sonderurlaub')::int   as su,
      count(*) filter (where g.art = 'altersfreizeit')::int as af,
      count(*) filter (where g.art = 'bildungsurlaub')::int as bu,
      count(*) filter (where g.art = 'gewerkschaftstag')::int as gt,
      count(*) filter (where g.art = 'schulung')::int       as seminar,
      count(*) filter (where g.art = 'sonstiges')::int      as sonstige
    from eingeteilt g
    group by g.emp, g.voller_name, g.team, g.m
  )
  select
    z.emp, z.voller_name, z.team, z.m,
    z.soll, z.anwesend, z.krank, z.urlaub, z.v, z.su, z.af, z.bu, z.gt,
    z.seminar, z.sonstige,
    -- Ausfall ist der ungeplante Teil: Krankheit und Sonstiges. Urlaub,
    -- V-Tage, Sonderurlaub, Altersfreizeit, Bildungsurlaub und
    -- Gewerkschaftstag sind geplante Abwesenheiten und keine Ausfaelle.
    (z.krank + z.sonstige) as ausfall,
    round(z.soll * stunden, 1),
    -- Seminar zaehlt als Anwesenheit: die Person arbeitet, nur woanders.
    round((z.anwesend + z.seminar) * stunden, 1),
    round(z.krank * stunden, 1),
    round((z.krank + z.sonstige) * stunden, 1),
    case when (z.anwesend + z.seminar + z.krank + z.sonstige) = 0 then null
         else round(100.0 * (z.krank + z.sonstige)
                    / (z.anwesend + z.seminar + z.krank + z.sonstige), 1)
    end,
    case when (z.anwesend + z.seminar + z.krank + z.sonstige) = 0 then null
         else round(100.0 * (z.anwesend + z.seminar)
                    / (z.anwesend + z.seminar + z.krank + z.sonstige), 1)
    end
  from gezaehlt z
  order by z.team nulls last, z.voller_name, z.m;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.absence_report_anonym(p_year integer, p_month integer DEFAULT NULL::integer)
 RETURNS TABLE(gruppe text, aufgeteilt boolean, personen integer, monat integer, soll_tage integer, anwesend_tage integer, krank_tage integer, urlaub_tage integer, v_tage integer, sonderurlaub_tage integer, altersfreizeit_tage integer, bildungsurlaub_tage integer, gewerkschaftstag_tage integer, seminar_tage integer, sonstige_tage integer, ausfall_tage integer, soll_stunden numeric, anwesend_stunden numeric, krank_stunden numeric, ausfall_stunden numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  mindest constant integer := 5;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Auswertungen sehen.';
  end if;

  return query
  with z as (
    select * from public.absence_report(p_year, p_month)
  ),
  je_schicht as (
    select coalesce(z.rotation_team, 'TS') as schicht, count(distinct z.employee_id) as n
      from z group by 1
  ),
  lage as (
    select (select count(distinct z.employee_id) from z) as alle,
           coalesce((select min(s.n) from je_schicht s), 0) >= mindest as teilbar
  )
  select
    case when l.teilbar then coalesce(z.rotation_team, 'TS') else 'alle' end,
    l.teilbar,
    count(distinct z.employee_id)::integer,
    z.monat,
    sum(z.soll_tage)::integer,
    sum(z.anwesend_tage)::integer,
    sum(z.krank_tage)::integer,
    sum(z.urlaub_tage)::integer,
    sum(z.v_tage)::integer,
    sum(z.sonderurlaub_tage)::integer,
    sum(z.altersfreizeit_tage)::integer,
    sum(z.bildungsurlaub_tage)::integer,
    sum(z.gewerkschaftstag_tage)::integer,
    sum(z.seminar_tage)::integer,
    sum(z.sonstige_tage)::integer,
    sum(z.ausfall_tage)::integer,
    sum(z.soll_stunden),
    sum(z.anwesend_stunden),
    sum(z.krank_stunden),
    sum(z.ausfall_stunden)
  from z cross join lage l
  where l.alle >= mindest
  group by 1, 2, z.monat;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.absences_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  z absences;
begin
  if tg_op = 'DELETE' then z := old; else z := new; end if;
  perform protokoll_schreiben(
    z.company_id,
    case tg_op when 'INSERT' then 'absence.created' when 'UPDATE' then 'absence.updated' else 'absence.deleted' end,
    'absences',
    z.id,
    jsonb_build_object(
      'employee_id', z.employee_id,
      'tag', z.date,
      'art', case when z.type::text = 'krank' then null else z.type::text end
    )
  );
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.absences_guard_medical_text()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.type = 'krank' and nullif(trim(new.note), '') is not null then
    raise exception 'Bei Krankheit werden keine medizinischen Angaben oder Freitexte erfasst.';
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.aenderung_zaehlen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid;
begin
  if tg_op = 'DELETE' then
    firma := old.company_id;
  else
    firma := new.company_id;
  end if;
  if firma is null then
    return null;
  end if;
  insert into aenderungszaehler as z (company_id, bereich, stand, geaendert_am)
  values (firma, tg_argv[0], 1, now())
  on conflict (company_id, bereich)
  do update set stand = z.stand + 1, geaendert_am = now();
  if tg_op = 'UPDATE' and old.company_id is distinct from new.company_id and old.company_id is not null then
    insert into aenderungszaehler as z (company_id, bereich, stand, geaendert_am)
    values (old.company_id, tg_argv[0], 1, now())
    on conflict (company_id, bereich)
    do update set stand = z.stand + 1, geaendert_am = now();
  end if;
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.aenderungsstand()
 RETURNS TABLE(antraege text, abwesenheiten text, plan text, benachrichtigungen text, mitteilungen text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  ich uuid := auth_employee_id();
begin
  if firma is null then
    return;
  end if;

  return query
  select
    coalesce((select z.stand::text from aenderungszaehler z where z.company_id = firma and z.bereich = 'antraege'), '0'),
    coalesce((select z.stand::text from aenderungszaehler z where z.company_id = firma and z.bereich = 'abwesenheiten'), '0'),
    coalesce((select z.stand::text from aenderungszaehler z where z.company_id = firma and z.bereich = 'plan'), '0'),
    md5(coalesce((select string_agg(n.id::text || ':' || n.xmin::text, ',' order by n.id)
                     from notifications n
                    where n.employee_id = ich), '')),
    coalesce((select z.stand::text from aenderungszaehler z where z.company_id = firma and z.bereich = 'mitteilungen'), '0');
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.af_genommen_jahr(p_year integer)
 RETURNS TABLE(employee_id uuid, tage integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with personen as (
    select e.id
      from employees e
     where e.company_id = auth_company_id()
       and (is_leadership() or e.id = auth_employee_id())
  ), tage as (
    select a.employee_id, a.date as tag
      from absences a
      join personen p on p.id = a.employee_id
     where a.type::text = 'altersfreizeit'
       and extract(year from a.date) = p_year
       and a.date < public.heute()
    union
    select r.employee_id, gs.day::date
      from leave_requests r
      join personen p on p.id = r.employee_id
      cross join lateral generate_series(r.start_date, r.end_date, interval '1 day') gs(day)
     where r.kind = 'altersfreizeit'
       and r.status = 'approved'
       and extract(year from gs.day) = p_year
       and gs.day::date < public.heute()
       and is_planned_workday(r.employee_id, gs.day::date)
  )
  select p.id, count(t.tag)::integer
    from personen p
    left join tage t on t.employee_id = p.id
   group by p.id;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.af_konto(p_employee_id uuid, p_ohne_antrag uuid DEFAULT NULL::uuid)
 RETURNS TABLE(freigeschaltet_ab date, start_stunden numeric, arbeitstage integer, stunden_angespart numeric, genommen numeric, beantragt numeric, verplant numeric, stand_stunden numeric, verfuegbar numeric, rest_stunden numeric, tage_erworben numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select k.stichtag, k.start_stunden, k.arbeitstage, k.angespart, k.genommen, k.beantragt,
         k.verplant, k.stand_heute, k.noch_moeglich, k.rest_stunden,
         greatest(k.noch_moeglich, 0) + k.genommen + k.verplant
    from stundenkonto(p_employee_id, 'af', p_ohne_antrag) k;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.af_uebersicht()
 RETURNS TABLE(employee_id uuid, employee_name text, rotation_team text, birth_date date, alter_heute integer, hat_profil boolean, af_ab date, af_start numeric, af_arbeitstage integer, af_angespart numeric, af_genommen numeric, af_verplant numeric, af_stand numeric, af_moeglich numeric, v_ab date, v_start numeric, v_arbeitstage integer, v_angespart numeric, v_genommen numeric, v_verplant numeric, v_stand numeric, v_moeglich numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id,
         e.first_name || ' ' || e.last_name,
         e.rotation_team::text,
         pd.birth_date,
         case when pd.birth_date is null then null
              else extract(year from age(public.heute(), pd.birth_date))::int end,
         p.id is not null,
         a.stichtag, a.start_stunden, a.arbeitstage, a.angespart, a.genommen, a.verplant,
         a.stand_heute, a.noch_moeglich,
         v.stichtag, v.start_stunden, v.arbeitstage, v.angespart, v.genommen, v.verplant,
         v.stand_heute, v.noch_moeglich
    from employees e
    left join profiles p on p.employee_id = e.id and p.company_id = v_firma
    left join personal_details pd on pd.user_id = p.id and pd.company_id = v_firma
    cross join lateral stundenkonto(e.id, 'af') a
    cross join lateral stundenkonto(e.id, 'v') v
   where e.company_id = v_firma
     and e.active
   order by e.last_name, e.first_name;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.age_leave_hinweis(p_birth_date date, p_year integer)
 RETURNS TABLE(alter_im_jahr integer, moeglich boolean, vorschlag_tage numeric)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select
    case when p_birth_date is null then null
         else (p_year - extract(year from p_birth_date))::int end,
    case when p_birth_date is null then false
         else (p_year - extract(year from p_birth_date)) >= 50 end,
    case when p_birth_date is null then 0::numeric
         when (p_year - extract(year from p_birth_date)) >= 50 then 10::numeric
         else 0::numeric end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.age_leave_overview(p_year integer)
 RETURNS TABLE(employee_id uuid, employee_name text, rotation_team text, birth_date date, alter_im_jahr integer, automatisch_moeglich boolean, vorschlag_tage numeric, bestaetigt boolean, bestaetigte_tage numeric, bestaetigt_von text, bestaetigt_am timestamp with time zone, notiz text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  return query
  select
    e.id,
    e.first_name || ' ' || e.last_name,
    e.rotation_team::text,
    pd.birth_date,
    h.alter_im_jahr,
    h.moeglich,
    h.vorschlag_tage,
    (g.id is not null),
    coalesce(g.confirmed_days, 0),
    case when g.confirmed_by is null then null
         else bp.first_name || ' ' || bp.last_name end,
    g.confirmed_at,
    g.note
  from public.employees e
  left join public.profiles p
    on p.employee_id = e.id and p.company_id = v_firma
  left join public.personal_details pd
    on pd.user_id = p.id and pd.company_id = v_firma
  left join public.age_leave_grants g
    on g.employee_id = e.id and g.year = p_year and g.company_id = v_firma
  left join public.profiles bp
    on bp.id = g.confirmed_by and bp.company_id = v_firma
  cross join lateral public.age_leave_hinweis(pd.birth_date, p_year) h
  where e.company_id = v_firma
    and e.active
  order by h.moeglich desc nulls last, e.last_name, e.first_name;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.anmelde_sperre_dauerhaft(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from profiles p where p.id = p_user and p.active);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.anmeldesperre_aufheben(p_employee uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Zugänge freischalten.' using errcode = '42501';
  end if;
  select id into v_user from profiles where employee_id = p_employee and company_id = auth_company_id();
  if v_user is null then
    raise exception 'Person nicht gefunden.' using errcode = 'P0002';
  end if;
  delete from anmelde_sperren where user_id = v_user;
  perform protokoll_schreiben(auth_company_id(), 'zugang.freigeschaltet', 'profiles', v_user, jsonb_build_object('employee_id', p_employee));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.anmeldung_erfolgreich(p_user uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from anmelde_sperren where user_id = p_user and gesperrt_am is null;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.anmeldung_fehlversuch(p_email text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select anmeldung_fehlversuch_konto(
    (select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1));
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.anmeldung_fehlversuch_konto(p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v anmelde_sperren;
  v_firma uuid;
begin
  if p_user is null then
    return false;
  end if;

  insert into anmelde_sperren as s (user_id, fehlversuche, letzter_versuch)
  values (p_user, 1, now())
  on conflict (user_id) do update set
    -- Neu zählen: letzter Fehlversuch älter als 24 Stunden, oder eine
    -- abgelaufene Privat-Sperre (15 Minuten).
    fehlversuche = case
      when s.letzter_versuch < now() - interval '24 hours'
        or (s.gesperrt_am is not null and s.gesperrt_am <= now() - interval '15 minutes'
            and not anmelde_sperre_dauerhaft(s.user_id))
      then 1 else s.fehlversuche + 1 end,
    gesperrt_am = case
      when s.gesperrt_am is not null and s.gesperrt_am <= now() - interval '15 minutes'
        and not anmelde_sperre_dauerhaft(s.user_id)
      then null else s.gesperrt_am end,
    letzter_versuch = now()
  returning * into v;

  if v.gesperrt_am is null and v.fehlversuche >= 5 then
    update anmelde_sperren set gesperrt_am = now() where user_id = p_user;
    select company_id into v_firma from profiles where id = p_user and active;
    if v_firma is not null then
      perform protokoll_schreiben(v_firma, 'anmeldung.gesperrt', 'profiles', p_user, '{}'::jsonb);
    end if;
    return true;
  end if;

  return v.gesperrt_am is not null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.anmeldung_gesperrt(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select exists (
    select 1
      from auth.users u
      join anmelde_sperren s on s.user_id = u.id
     where lower(u.email) = lower(trim(p_email))
       and s.gesperrt_am is not null
       and (s.gesperrt_am > now() - interval '15 minutes' or anmelde_sperre_dauerhaft(u.id)));
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.answer_replacement_request(p_request_id uuid, p_annehmen boolean, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r replacement_requests;
  person text;
  schicht_name text;
begin
  select * into r from replacement_requests where id = p_request_id;
  if r.id is null or r.company_id is distinct from auth_company_id() then
    raise exception 'Anfrage nicht gefunden.';
  end if;
  if r.asked_employee_id is distinct from auth_employee_id() then
    raise exception 'Diese Anfrage richtet sich an jemand anderen.';
  end if;
  if r.status <> 'offen' then
    raise exception 'Diese Anfrage ist bereits beantwortet.';
  end if;

  update replacement_requests
     set status = case when p_annehmen then 'angenommen' else 'abgelehnt' end,
         answered_at = now(),
         answer_note = nullif(trim(p_note), '')
   where id = p_request_id;

  select e.first_name || ' ' || e.last_name into person
    from employees e where e.id = r.asked_employee_id;
  select s.name into schicht_name from shifts s where s.id = r.shift_id;

  if r.requested_by is not null then
    insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
    values (
      r.company_id, r.requested_by,
      case when p_annehmen then 'replacement_accepted' else 'replacement_declined' end,
      person || ' hat ' || case when p_annehmen then 'zugesagt' else 'abgelehnt' end,
      person || ' hat die Anfrage für die ' || coalesce(schicht_name, 'Schicht')
        || ' am ' || to_char(r.date, 'DD.MM.YYYY') || ' '
        || case when p_annehmen then 'angenommen.' else 'abgelehnt.' end
        || case when p_annehmen
                then ' Eingeplant ist damit noch niemand – das geschieht erst mit der Bestätigung.'
                else ' Du kannst die nächste geeignete Person anfragen.' end,
      'replacement_request', r.id
    );
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.antrag_zuruecknehmen(p_request_id uuid, p_grund text DEFAULT NULL::text)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r leave_requests;
  result leave_requests;
  v_gruppe uuid;
  eigener boolean;
  v_von date;
  v_bis date;
  v_genehmigt boolean;
  v_begonnen boolean;
  arten text;
  v_anzahl int;
  heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  select * into r
    from leave_requests
   where id = p_request_id and company_id = auth_company_id();
  if r.id is null then
    raise exception 'Der Antrag wurde nicht gefunden.';
  end if;
  if r.status not in ('pending', 'approved') then
    raise exception 'Dieser Antrag ist bereits erledigt und lässt sich nicht mehr zurücknehmen.';
  end if;

  eigener := r.employee_id = auth_employee_id();
  if not eigener and not darf_urlaub_entscheiden(r.employee_id) then
    raise exception 'Zurücknehmen darfst du nur eigene Anträge oder Anträge deiner eigenen Schicht.';
  end if;

  v_gruppe := coalesce(r.request_group_id, r.id);

  select min(x.start_date), max(x.end_date),
         bool_or(x.status = 'approved'),
         bool_or(x.status = 'approved' and x.start_date <= heute),
         string_agg(distinct leave_kind_label(x.kind), ' und ')
    into v_von, v_bis, v_genehmigt, v_begonnen, arten
    from leave_requests x
   where coalesce(x.request_group_id, x.id) = v_gruppe
     and x.company_id = r.company_id
     and x.status = r.status;

  if v_von is null then
    raise exception 'Dieser Antrag ist bereits erledigt und lässt sich nicht mehr zurücknehmen.';
  end if;
  if v_begonnen then
    if eigener then
      raise exception 'Dieser Zeitraum hat bereits begonnen und lässt sich nicht mehr selbst zurücknehmen. Bitte an die Schichtleitung wenden.';
    end if;
    raise exception 'Dieser Zeitraum hat bereits begonnen. Einzelne Tage lassen sich im Schichtplan entfernen.';
  end if;

  update leave_requests
     set status = 'withdrawn',
         withdrawn_at = now(),
         withdrawn_by = auth.uid(),
         withdrawal_reason = nullif(trim(coalesce(p_grund, '')), '')
   where coalesce(request_group_id, id) = v_gruppe
     and company_id = r.company_id
     and status = r.status;

  get diagnostics v_anzahl = row_count;
  if v_anzahl = 0 then
    raise exception 'Dieser Antrag ist bereits erledigt und lässt sich nicht mehr zurücknehmen.';
  end if;

  select * into result from leave_requests where id = p_request_id;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    r.company_id, auth.uid(), 'leave.withdrawn', 'leave_requests', r.id,
    jsonb_build_object(
      'gruppe', v_gruppe, 'zeilen', v_anzahl, 'von', v_von, 'bis', v_bis,
      'war_genehmigt', v_genehmigt, 'selbst', eigener,
      'grund', nullif(trim(coalesce(p_grund, '')), '')
    )
  );

  perform benachrichtige_ruecknahme(r.id, r.employee_id, arten, v_von, v_bis, v_genehmigt, p_grund);

  return result;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.apply_rotation_to_all()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_company_id uuid := auth_company_id(); v_pattern_id uuid; v_count int;
begin
  if not is_admin() then raise exception 'Nur die Administration darf das Schichtmuster zuweisen.'; end if;
  select id into v_pattern_id from rotation_patterns where company_id = v_company_id and active
    order by created_at desc limit 1;
  if v_pattern_id is null then raise exception 'Es ist noch kein Schichtmuster hinterlegt.'; end if;
  update employees set rotation_pattern_id = v_pattern_id
    where company_id = v_company_id and rotation_team is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.approve_safe_leave_requests()
 RETURNS TABLE(genehmigt integer, uebersprungen integer, geprueft integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_genehmigt int := 0;
  v_uebersprungen int := 0;
  v_geprueft int := 0;
  k record;
  e record;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  for k in select * from sammelgenehmigung_kandidaten(null) loop
    v_geprueft := v_geprueft + 1;
    select * into e from sicher_genehmigen(k.antrag_id);
    if e.ergebnis = 'genehmigt' then
      v_genehmigt := v_genehmigt + 1;
    else
      v_uebersprungen := v_uebersprungen + 1;
    end if;
  end loop;
  return query select v_genehmigt, v_uebersprungen, v_geprueft;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.assign_shift(p_employee_id uuid, p_shift_id uuid, p_date date)
 RETURNS shift_assignments
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  result shift_assignments;
  emp employees;
  target_shift shifts;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_shift_id is not null then
    select * into target_shift from shifts where id = p_shift_id;
    if target_shift.id is null then
      raise exception 'Schicht nicht gefunden.';
    end if;
    if emp.company_id is distinct from target_shift.company_id then
      raise exception 'Mitarbeiter und Schicht gehoeren zu unterschiedlichen Unternehmen.';
    end if;
  end if;

  insert into shift_assignments (company_id, employee_id, shift_id, date)
  values (emp.company_id, p_employee_id, p_shift_id, p_date)
  on conflict (employee_id, date)
  do update set shift_id = excluded.shift_id
  returning * into result;

  return result;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.austritt_stand()
 RETURNS TABLE(ausgetreten boolean, firma text, hat_privat boolean, erledigt boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select not p.active,
         c.name,
         exists (select 1 from privat_konten k where k.user_id = p.id),
         p.austritt_uebernommen_am is not null
    from profiles p
    left join companies c on c.id = p.company_id
   where p.id = auth.uid()
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.austritte_vollziehen()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  heute date := (now() at time zone 'Europe/Berlin')::date;
  n int := 0;
  r record;
begin
  for r in
    select p.id, p.company_id, p.role, e.id as employee_id, e.exit_date
      from profiles p
      join employees e on e.id = p.employee_id and e.company_id = p.company_id
     where p.active
       and e.exit_date is not null
       and e.exit_date < heute
  loop
    if r.role = 'admin' and not exists (
      select 1 from profiles q
       where q.company_id = r.company_id and q.active and q.role = 'admin' and q.id <> r.id
    ) then
      continue;
    end if;

    update profiles set active = false where id = r.id and active;
    if found then
      insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
      values (r.company_id, null, 'mitarbeiter.austritt', 'employees', r.employee_id,
              jsonb_build_object('employee_id', r.employee_id, 'austritt', r.exit_date, 'automatisch', true));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.auth_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select company_id from profiles where id = auth.uid() and active and zugang_ok();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.auth_employee_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select employee_id from profiles where id = auth.uid() and active and zugang_ok();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.auth_role()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from profiles where id = auth.uid() and active and zugang_ok();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.beitritt_annehmen(p_code text, p_termine boolean, p_todos boolean, p_schichten boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich uuid := auth.uid();
  b betrieb_beitritte;
  e employees;
  vorher profiles;
  u auth.users;
  art record;
  neu uuid;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  select * into b from betrieb_beitritte where code = _beitritt_code(p_code) and gueltig_bis > now() for update;
  if b.code is null then
    raise exception 'Dieser Code ist ungültig oder abgelaufen. Bitte frag im Betrieb nach einem neuen.';
  end if;
  if exists (select 1 from profiles where id = ich) then
    raise exception 'Dein Konto gehört bereits zu einem Betrieb.';
  end if;
  select * into e from employees where id = b.employee_id and company_id = b.company_id;
  if e.id is null or not e.active then
    raise exception 'Diese Einladung gilt nicht mehr. Bitte frag im Betrieb nach.';
  end if;
  if exists (select 1 from companies c where c.id = b.company_id and (c.is_demo or c.geloescht_am is not null)) then
    raise exception 'Diese Einladung gilt nicht mehr. Bitte frag im Betrieb nach.';
  end if;

  -- Für diese Person gibt es schon einen Zugang aus der Einladung per Link? Ist er
  -- nie benutzt worden, tritt das bestehende Konto an seine Stelle.
  select * into vorher from profiles where employee_id = e.id;
  if vorher.id is not null then
    select * into u from auth.users where id = vorher.id;
    if u.last_sign_in_at is not null then
      raise exception 'Für diese Person gibt es schon einen Zugang. Bitte frag im Betrieb nach.';
    end if;
    delete from auth.users where id = vorher.id;
    delete from profiles where id = vorher.id;
  end if;

  select * into u from auth.users where id = ich;
  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role, start_ansicht, neuigkeiten_gesehen)
  values (ich, e.company_id, e.id, e.first_name, e.last_name,
          coalesce(nullif(e.email, ''), u.email), e.role, 'kompakt', now());

  -- Nicht übernommen: bleibt nur im Privatbereich.
  if not coalesce(p_termine, true) then
    update kalender_termine set nur_privat = true where owner_id = ich;
  end if;
  if not coalesce(p_todos, true) then
    update kalender_todos set nur_privat = true where owner_id = ich;
  end if;
  -- Eigene Schichten ab heute als eigene Einträge in den Betriebskalender (je Tag die erste).
  if coalesce(p_schichten, false) then
    for art in
      select distinct s.* from privat_schichtarten s
        join privat_tage t on t.user_id = ich and t.schichtart_id = s.id and t.tag >= public.heute()
       where s.user_id = ich and s.art = 'arbeit'
    loop
      insert into kalender_eigene_arten (user_id, name, kuerzel, farbe, beginn, ende, reihenfolge)
      values (ich, art.name, art.kuerzel, art.farbe, art.beginn, art.ende, art.reihenfolge)
      returning id into neu;
      insert into kalender_eigene_tage (user_id, tag, art_id)
      select ich, t.tag, neu from privat_tage t
       where t.user_id = ich and t.schichtart_id = art.id and t.tag >= public.heute()
      on conflict (user_id, tag) do nothing;
    end loop;
  end if;

  delete from betrieb_beitritte where employee_id = e.id;
  perform write_audit(e.company_id, 'zugang.beitritt', 'employees', e.id, '{}'::jsonb);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.beitritt_code_anlegen(p_employee_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  zeichen constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  neu text;
  firma uuid;
begin
  select company_id into firma from employees where id = p_employee_id;
  if firma is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  delete from betrieb_beitritte where employee_id = p_employee_id or gueltig_bis < now();
  loop
    b := extensions.gen_random_bytes(8);
    neu := '';
    for i in 0..7 loop
      neu := neu || substr(zeichen, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from betrieb_beitritte where code = neu);
  end loop;
  insert into betrieb_beitritte (code, employee_id, company_id) values (neu, p_employee_id, firma);
  return neu;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.beitritt_vorschau(p_code text)
 RETURNS TABLE(firma text, name text, termine integer, todos integer, eigene_schichten integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b betrieb_beitritte;
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  select * into b from betrieb_beitritte where code = _beitritt_code(p_code) and gueltig_bis > now();
  if b.code is null then
    raise exception 'Dieser Code ist ungültig oder abgelaufen. Bitte frag im Betrieb nach einem neuen.';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Dein Konto gehört bereits zu einem Betrieb.';
  end if;
  return query
    select c.name,
           btrim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')),
           (select count(*)::int from kalender_termine t where t.owner_id = auth.uid() and not t.von_partner and t.person_id is null),
           (select count(*)::int from kalender_todos t where t.owner_id = auth.uid() and not t.erledigt),
           (select count(*)::int from privat_tage t where t.user_id = auth.uid() and t.tag >= public.heute())
      from companies c, employees e
     where c.id = b.company_id and e.id = b.employee_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.benachrichtige_ruecknahme(p_request_id uuid, p_employee_id uuid, p_arten text, p_von date, p_bis date, p_war_genehmigt boolean, p_grund text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid;
  person text;
  wer text;
  rolle text;
  zeitraum text;
  zeitpunkt text;
begin
  select e.company_id, e.first_name || ' ' || e.last_name
    into firma, person
    from employees e where e.id = p_employee_id;
  if firma is null then
    return;
  end if;

  zeitraum := case
    when p_von = p_bis then 'am ' || to_char(p_von, 'DD.MM.YYYY')
    else 'vom ' || to_char(p_von, 'DD.MM.YYYY') || ' bis ' || to_char(p_bis, 'DD.MM.YYYY')
  end;
  zeitpunkt := to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI "Uhr"');

  if auth_employee_id() is not distinct from p_employee_id then
    insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
    select firma, f.employee_id, 'leave_withdrawn',
           case when p_war_genehmigt
                then p_arten || ' zurückgenommen'
                else 'Antrag zurückgezogen: ' || p_arten end,
           case when p_war_genehmigt
                then format('%s hat %s %s zurückgenommen (am %s) und steht an %s wieder im Plan.',
                            person, p_arten, zeitraum, zeitpunkt,
                            case when p_von = p_bis then 'diesem Tag' else 'diesen Tagen' end)
                else format('%s hat den Antrag auf %s %s zurückgezogen (am %s).',
                            person, p_arten, zeitraum, zeitpunkt) end,
           'leave_requests', p_request_id
      from zustaendige_fuehrung(p_employee_id) f;
  else
    select p.first_name || ' ' || p.last_name,
           case p.role when 'admin' then 'Administration' when 'shift_leader' then 'Schichtleitung' else null end
      into wer, rolle
      from profiles p where p.id = auth.uid();

    insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
    values (
      firma, p_employee_id, 'leave_withdrawn',
      p_arten || ' zurückgenommen',
      format('Dein %sAntrag auf %s %s wurde von %s zurückgenommen (am %s).%s%s',
             case when p_war_genehmigt then 'genehmigter ' else '' end,
             p_arten, zeitraum,
             coalesce(nullif(trim(coalesce(wer, '')), '') || coalesce(' (' || rolle || ')', ''), 'der Schichtleitung'),
             zeitpunkt,
             case when p_war_genehmigt
                  then case when p_von = p_bis then ' Du bist an diesem Tag wieder eingeplant.'
                            else ' Du bist an diesen Tagen wieder eingeplant.' end
                  else '' end,
             coalesce(' Grund: ' || nullif(trim(p_grund), ''), '')),
      'leave_requests', p_request_id
    );
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.berufsschule_selbst(p_von date, p_bis date, p_wochentage integer[] DEFAULT NULL::integer[], p_entfernen boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  v_count int := 0;
  d date;
begin
  select * into e from employees where id = auth_employee_id();
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Kein Mitarbeiterkonto.';
  end if;
  if not coalesce(e.is_apprentice, false) then
    raise exception 'Berufsschule tragen nur Auszubildende selbst ein.';
  end if;
  if p_von is null or p_bis is null or p_bis < p_von then
    raise exception 'Bitte Beginn und Ende angeben.';
  end if;
  if p_bis - p_von > 366 then
    raise exception 'Der Zeitraum ist zu lang.';
  end if;

  if p_entfernen then
    delete from absences a
     where a.employee_id = e.id
       and a.type::text = 'berufsschule'
       and a.date between p_von and p_bis
       and (p_wochentage is null or extract(isodow from a.date)::int = any(p_wochentage));
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  for d in select g::date from generate_series(p_von, p_bis, '1 day') g loop
    continue when p_wochentage is not null and not (extract(isodow from d)::int = any(p_wochentage));
    continue when not is_employed_on(e, d);
    insert into absences (company_id, employee_id, date, type, note)
    values (e.company_id, e.id, d, 'berufsschule'::absence_type, null)
    on conflict (employee_id, date, type) do nothing;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.blocked_days(p_from date, p_to date)
 RETURNS TABLE(day date, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth_company_id() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Zeitraum ungültig.'; end if;
  return query
  select gs.day::date, r.value ->> 'reason'
  from generate_series(p_from, p_to, interval '1 day') as gs(day)
  join staffing_rules r on r.company_id = auth_company_id()
    and r.key = 'urlaubssperre' and r.active
    and (r.value ->> 'start')::date <= gs.day::date
    and (r.value ->> 'end')::date >= gs.day::date
  group by gs.day::date, r.value ->> 'reason';
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.calculate_leave_days(p_company_id uuid, p_start_date date, p_end_date date, p_half_day_period half_day_period)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  workdays int;
begin
  select count(*) into workdays
  from generate_series(p_start_date, p_end_date, interval '1 day') as day
  where extract(isodow from day) < 6
    and not exists (
      select 1 from holidays h
      where h.date = day::date
        and (h.company_id = p_company_id or h.company_id is null)
    );

  if p_half_day_period is not null and workdays = 1 then
    return 0.5;
  end if;

  return workdays::numeric(4, 1);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.calculate_leave_days_for_employee(p_employee_id uuid, p_start_date date, p_end_date date, p_half_day_period half_day_period)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  emp employees;
  d date;
  s shifts;
  day_shift uuid;
  counted int := 0;
begin
  select * into emp
    from employees
   where id = p_employee_id
     and company_id = auth_company_id();

  if emp.id is null then
    return 0;
  end if;

  if p_end_date < p_start_date or p_end_date - p_start_date > 366 then
    raise exception 'Ungültiger Zeitraum.';
  end if;

  if not emp.shift_worker
     or (emp.shift_id is null and emp.rotation_pattern_id is null) then
    select count(*) into counted
      from generate_series(p_start_date, p_end_date, interval '1 day') as day
     where extract(isodow from day) < 6
       and is_employed_on(p_employee_id, day::date)
       and not exists (
         select 1
           from holidays h
          where h.date = day::date
            and (h.company_id = emp.company_id or h.company_id is null)
       );
  else
    d := p_start_date;
    while d <= p_end_date loop
      day_shift := effective_shift_id(p_employee_id, d);
      if day_shift is not null then
        select * into s
          from shifts
         where id = day_shift
           and company_id = emp.company_id;
        if s.id is not null and schicht_laeuft_fuer(p_employee_id, d, s) then
          counted := counted + 1;
        end if;
      end if;
      d := d + 1;
    end loop;
  end if;

  if p_half_day_period is not null and counted = 1 then
    return 0.5;
  end if;

  return counted::numeric(4,1);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.check_leave_staffing_impact(p_employee_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(date date, present integer, target smallint, minimum smallint, status staffing_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees; s shifts; d date; day_shift uuid;
  planned int; absent int; adjusted_present int; already_counted boolean;
  zaehlt boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  zaehlt := zaehlt_zur_besetzung(e);

  d := p_start_date;
  while d <= p_end_date loop
    day_shift := effective_shift_id(p_employee_id, d);
    if day_shift is not null then
      select * into s from shifts where id = day_shift;
      if s.id is not null and s.target_staff > 0 and schicht_laeuft_fuer(p_employee_id, d, s) then
        select count(*) into planned from employees emp
        where emp.active and emp.company_id = e.company_id
          and zaehlt_zur_besetzung(emp)
          and effective_shift_id(emp.id, d) = day_shift;
        select count(*) into absent from employees emp
        where emp.active and emp.company_id = e.company_id
          and zaehlt_zur_besetzung(emp)
          and effective_shift_id(emp.id, d) = day_shift
          and emp.id in (select employee_id from employees_absent_on(d, true));
        select exists(select 1 from employees_absent_on(d, true) a where a.employee_id = p_employee_id)
          into already_counted;
        adjusted_present := planned - absent
          - case when already_counted or not zaehlt then 0 else 1 end;
        return query select d, adjusted_present, s.target_staff, s.minimum_staff,
          case when adjusted_present < s.minimum_staff then 'critical'::staffing_status
               when adjusted_present < s.target_staff then 'warn'::staffing_status
               else 'ok'::staffing_status end;
      end if;
    end if;
    d := d + 1;
  end loop;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.companies_ensure_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into company_settings (company_id) values (new.id) on conflict (company_id) do nothing;
  return new;
end; $function$
;
-- @@
CREATE OR REPLACE FUNCTION public.company_qualifications()
 RETURNS TABLE(id uuid, key text, label text, active boolean, sort_order integer, anzahl bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select q.id, q.key, q.label, q.active, q.sort_order,
         (select count(*) from employee_qualifications eq
           join employees e on e.id = eq.employee_id
          where eq.qualification_id = q.id and e.active)
    from qualifications q
   where q.company_id = auth_company_id()
   order by q.sort_order nulls last, q.label;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.company_rule_number(p_key text, p_field text, p_default numeric, p_shift_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select (r.value ->> p_field)::numeric
       from staffing_rules r
      where r.company_id = auth_company_id()
        and r.key = p_key
        and r.active
        and (r.shift_id = p_shift_id or r.shift_id is null)
      order by r.shift_id nulls last
      limit 1),
    p_default
  );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.complete_setup(p_abgeschlossen boolean DEFAULT true)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_zeit timestamptz;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf die Einrichtung abschließen.';
  end if;

  update companies
     set setup_completed_at = case when p_abgeschlossen then now() else null end
   where id = auth_company_id()
  returning setup_completed_at into v_zeit;

  return v_zeit;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.confirm_age_leave(p_employee_id uuid, p_year integer, p_days numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  v_vorher numeric;
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;
  -- Mandant der Zielperson pruefen, nicht dem Aufruf glauben.
  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.company_id = v_firma
  ) then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  if p_days is null or p_days < 0 or p_days > 60 then
    raise exception 'Bitte eine Tageszahl zwischen 0 und 60 angeben.';
  end if;

  select confirmed_days into v_vorher
  from public.age_leave_grants
  where employee_id = p_employee_id and year = p_year;

  insert into public.age_leave_grants
    (company_id, employee_id, year, confirmed_days, note, confirmed_by, confirmed_at, updated_at)
  values
    (v_firma, p_employee_id, p_year, p_days, nullif(btrim(coalesce(p_note, '')), ''),
     auth.uid(), now(), now())
  on conflict (employee_id, year) do update
    set confirmed_days = excluded.confirmed_days,
        note           = excluded.note,
        confirmed_by   = excluded.confirmed_by,
        confirmed_at   = now(),
        updated_at     = now();

  -- Nachvollziehbar: wer hat wann von welchem auf welchen Wert gestellt.
  perform write_audit(
    v_firma,
    case when v_vorher is null then 'age_leave.confirmed' else 'age_leave.changed' end,
    'age_leave_grants',
    p_employee_id,
    jsonb_build_object('jahr', p_year, 'vorher', v_vorher, 'nachher', p_days)
  );
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.confirm_replacement(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r replacement_requests;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;

  select * into r from replacement_requests where id = p_request_id;
  if r.id is null or r.company_id is distinct from auth_company_id() then
    raise exception 'Anfrage nicht gefunden.';
  end if;
  if r.status <> 'angenommen' then
    raise exception 'Erst nach einer Zusage lässt sich die Besetzung setzen.';
  end if;

  perform plan_set_shift(r.asked_employee_id, r.date, r.shift_id);

  update replacement_requests set assigned_at = now() where id = p_request_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.create_absence_range(p_employee_id uuid, p_from date, p_to date, p_type absence_type, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  v_count int := 0;
  d date;
  r leave_requests;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen Abwesenheiten erfassen.';
  end if;

  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_from is null or p_to is null then
    raise exception 'Bitte Beginn und Ende angeben.';
  end if;
  if p_to < p_from then
    raise exception 'Das Ende darf nicht vor dem Beginn liegen.';
  end if;
  if p_to - p_from > 365 then
    raise exception 'Der Zeitraum ist zu lang.';
  end if;

  for d in select g::date from generate_series(p_from, p_to, '1 day') g loop
    if p_type::text in ('schulung', 'berufsschule') then
      -- Schulung und Berufsschule: auch freie Tage, solange die Person beschäftigt ist.
      continue when not is_employed_on(e, d);
    else
      continue when not is_planned_workday(p_employee_id, d);
    end if;

    if p_type = 'krank' then
      loop
        select * into r
          from leave_requests
         where employee_id = p_employee_id
           and status in ('approved', 'pending')
           and d between start_date and end_date
         order by start_date
         limit 1;
        exit when r.id is null;
        perform split_leave_request_day(r, d, null);
      end loop;
    end if;

    insert into absences (company_id, employee_id, date, type, note)
    values (e.company_id, p_employee_id, d, p_type, nullif(trim(p_note), ''))
    on conflict (employee_id, date, type) do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  if v_count = 0 then
    if p_type::text in ('schulung', 'berufsschule') then
      raise exception 'In diesem Zeitraum ist schon alles eingetragen oder die Person ist nicht beschäftigt.';
    end if;
    raise exception 'In diesem Zeitraum gibt es keinen eingeplanten Arbeitstag ohne bestehenden Eintrag.';
  end if;

  return v_count;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.current_legal_version(p_doc text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select version from public.legal_versions where doc = p_doc
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.current_rotation_pattern()
 RETURNS TABLE(id uuid, name text, anchor_date date, blocks jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth_company_id() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select p.id, p.name, p.anchor_date,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'code', case
          when (step->>'shift') is null then 'FREI'
          when (step->>'shift')::uuid =
               (select s.id from shifts s where s.company_id = p.company_id and s.short_name = 'F' limit 1) then 'F'
          when (step->>'shift')::uuid =
               (select s.id from shifts s where s.company_id = p.company_id and s.short_name = 'S' limit 1) then 'S'
          when (step->>'shift')::uuid =
               (select s.id from shifts s where s.company_id = p.company_id and s.short_name = 'N' limit 1) then 'N'
          else 'FREI'
        end,
        'days', (step->>'days')::int
      ) order by ord
    ) filter (where step is not null), '[]'::jsonb)
  from rotation_patterns p
  left join lateral jsonb_array_elements(p.steps) with ordinality as t(step, ord) on true
  where p.company_id = auth_company_id() and p.active
  group by p.id, p.name, p.anchor_date;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.darf_protokoll()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.protokoll_umfang() is not null;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.darf_urlaub_entscheiden(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich employees;
  ziel employees;
begin
  select * into ziel from employees where id = p_employee_id;
  if ziel.id is null or ziel.company_id is distinct from auth_company_id() then
    return false;
  end if;
  if is_admin() then
    return true;
  end if;
  if auth_role() is distinct from 'shift_leader' then
    return false;
  end if;
  select * into ich from employees where id = auth_employee_id();
  if ich.id is null then
    return false;
  end if;
  -- Eigene Anträge: nur wenn das Unternehmen es erlaubt, sonst entscheidet die Administration.
  if ich.id = ziel.id then
    return leitung_eigene_antraege_erlaubt();
  end if;
  if ich.rotation_team is not null then
    return ziel.rotation_team = ich.rotation_team;
  end if;
  return ziel.rotation_team is null and ich.shift_id is not null and ziel.shift_id = ich.shift_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.decide_leave_request(p_request_id uuid, p_decision leave_status, p_rejection_reason text DEFAULT NULL::text, p_trotz_unterbesetzung boolean DEFAULT false)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result leave_requests;
  v_firma uuid := auth_company_id();
  v_gruppe uuid;
  v_anzahl int;
  fehlend text;
  arten text;
  v_von date;
  v_bis date;
  v_unterbesetzt date[] := '{}';
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Ungueltige Entscheidung.';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_rejection_reason), '') = '' then
    raise exception 'Fuer eine Ablehnung ist eine Begruendung erforderlich.';
  end if;
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;

  select coalesce(r.request_group_id, r.id) into v_gruppe
  from leave_requests r
  where r.id = p_request_id and r.company_id = v_firma;

  if v_gruppe is null then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  if not darf_urlaub_entscheiden((select r.employee_id from leave_requests r where r.id = p_request_id)) then
    if (select r.employee_id from leave_requests r where r.id = p_request_id) = auth_employee_id() then
      raise exception 'Über deine eigenen Anträge entscheidet die Administration.';
    end if;
    raise exception 'Du darfst nur Anträge deiner eigenen Schicht entscheiden.';
  end if;

  if p_decision = 'approved' then
    -- Genehmigungen im selben Unternehmen nacheinander prüfen.
    perform pg_advisory_xact_lock(hashtextextended('genehmigung:' || v_firma::text, 0));

    select string_agg(distinct x.konto, ' und ') into fehlend
    from (
      select 'Urlaubstage' as konto
      from leave_requests r
      join leave_balances_view v
        on v.employee_id = r.employee_id
       and v.year = extract(year from r.start_date)
      where coalesce(r.request_group_id, r.id) = v_gruppe
        and r.status = 'pending'
        and r.kind = 'urlaub'
        and v.remaining_days < 0
    ) x;

    if fehlend is not null then
      raise exception 'Fuer diesen Antrag stehen nicht genuegend % zur Verfuegung.', fehlend;
    end if;

    v_unterbesetzt := unterbesetzte_tage(v_gruppe);
    if cardinality(v_unterbesetzt) > 0 and not coalesce(p_trotz_unterbesetzung, false) then
      raise exception using
        errcode = 'SN001',
        message = 'UNTERBESETZT:' || array_to_string(
          array(select to_char(t, 'DD.MM.YYYY') from unnest(v_unterbesetzt) t order by t), ', ');
    end if;
  end if;

  update leave_requests
  set status = p_decision,
      rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where coalesce(request_group_id, id) = v_gruppe
    and company_id = v_firma
    and status = 'pending';

  get diagnostics v_anzahl = row_count;
  if v_anzahl = 0 then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  select * into result from leave_requests where id = p_request_id;

  select min(start_date), max(end_date),
         string_agg(distinct leave_kind_label(kind), ' und ')
    into v_von, v_bis, arten
  from leave_requests
  where coalesce(request_group_id, id) = v_gruppe and company_id = v_firma;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    result.company_id, auth.uid(),
    case when p_decision = 'approved' then 'leave.approved' else 'leave.rejected' end,
    'leave_requests', result.id,
    jsonb_build_object(
      'reason', p_rejection_reason,
      'kind', result.kind,
      'gruppe', v_gruppe,
      'zeilen', v_anzahl,
      'von', v_von,
      'bis', v_bis
    ) || case when cardinality(v_unterbesetzt) > 0
              then jsonb_build_object('trotz_unterbesetzung', true, 'unterbesetzt_tage', to_jsonb(v_unterbesetzt))
              else '{}'::jsonb end
  );

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    result.company_id, e.id,
    case when p_decision = 'approved' then 'leave_approved' else 'leave_rejected' end,
    arten || case when p_decision = 'approved' then ' genehmigt' else ' abgelehnt' end,
    case when v_von = v_bis
         then to_char(v_von, 'DD.MM.YYYY')
         else to_char(v_von, 'DD.MM.YYYY') || ' bis ' || to_char(v_bis, 'DD.MM.YYYY') end
    || case when p_decision = 'approved'
            then ': genehmigt.'
            else ': abgelehnt. ' || coalesce(p_rejection_reason, '') end,
    'leave_requests', result.id
  from employees e where e.id = result.employee_id;

  return result;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.delete_training_assignment(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;
  delete from training_assignments where id = p_id and company_id = auth_company_id();
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.demo_cleanup()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  t text;
  pass int;
  n int := 0;
begin
  for c in
    select id from companies where is_demo and demo_expires_at < now() order by demo_expires_at limit 100
  loop
    delete from auth.users u where u.id in (select p.id from profiles p where p.company_id = c.id);

    for pass in 1..4 loop
      for t in
        select col.table_name
          from information_schema.columns col
          join information_schema.tables tab
            on tab.table_schema = col.table_schema and tab.table_name = col.table_name and tab.table_type = 'BASE TABLE'
         where col.table_schema = 'public' and col.column_name = 'company_id' and col.table_name <> 'companies'
      loop
        begin
          execute format('delete from public.%I where company_id = $1', t) using c.id;
        exception when others then
          null;
        end;
      end loop;
    end loop;

    delete from companies where id = c.id and is_demo;
    n := n + 1;
  end loop;

  delete from auth.users u
   where u.email like 'demo-%@example.com'
     and u.created_at < now() - interval '1 hour'
     and not exists (select 1 from profiles p where p.id = u.id);

  return n;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.demo_create(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cfg demo_settings;
  tmpl companies;
  v_company uuid;
  v_admin_emp uuid;
  v_email text;
  v_delta int;
  v_claims text;
  m_shift jsonb := '{}';
  m_qual jsonb := '{}';
  m_pat jsonb := '{}';
  m_emp jsonb := '{}';
  r record;
  v_new uuid;
  jahr int := extract(year from public.heute())::int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Nicht erlaubt.';
  end if;

  select * into cfg from demo_settings where id;
  select * into tmpl from companies where id = cfg.template_company_id;
  if tmpl.id is null then
    raise exception 'Die Live-Demo ist gerade nicht verfügbar.';
  end if;

  if (select count(*) from companies where is_demo and demo_expires_at > now()) >= cfg.max_active then
    raise exception 'Gerade sind sehr viele Demos aktiv. Bitte versuche es später erneut.';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'Konto nicht gefunden.';
  end if;
  if exists (select 1 from profiles where id = p_user_id) then
    raise exception 'Zu diesem Konto gehört bereits ein Unternehmen.';
  end if;

  v_delta := ((public.heute() - tmpl.created_at::date) / 7) * 7;

  perform set_config('schichtplan.sammelantrag', 'an', true);

  insert into companies (name, is_demo, demo_expires_at, setup_completed_at, active)
  values (tmpl.name || ' (Demo)', true, now() + cfg.lifetime, now(), true)
  returning id into v_company;

  update company_settings cs
     set state = t.state,
         work_on_holidays = t.work_on_holidays,
         gruende_fuer_kollegen = t.gruende_fuer_kollegen,
         notify_leave_email = false
    from company_settings t
   where cs.company_id = v_company and t.company_id = tmpl.id;

  for r in select * from shifts where company_id = tmpl.id loop
    insert into shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays, active)
    values (v_company, r.name, r.short_name, r.start_time, r.end_time, r.color, r.minimum_staff, r.target_staff, r.weekdays, r.active)
    returning id into v_new;
    m_shift := m_shift || jsonb_build_object(r.id::text, v_new);
  end loop;

  for r in select * from qualifications where company_id = tmpl.id loop
    insert into qualifications (company_id, key, label, active, sort_order)
    values (v_company, r.key, r.label, r.active, r.sort_order)
    returning id into v_new;
    m_qual := m_qual || jsonb_build_object(r.id::text, v_new);
  end loop;

  for r in select * from rotation_patterns where company_id = tmpl.id loop
    insert into rotation_patterns (company_id, name, anchor_date, steps, active, team_offset_days)
    values (
      v_company, r.name, r.anchor_date,
      coalesce((
        select jsonb_agg(
                 case when s ->> 'shift' is null then s
                      else jsonb_set(s, '{shift}', coalesce(m_shift -> (s ->> 'shift'), 'null'::jsonb)) end
                 order by o)
          from jsonb_array_elements(r.steps) with ordinality as e(s, o)
      ), '[]'::jsonb),
      r.active, r.team_offset_days)
    returning id into v_new;
    m_pat := m_pat || jsonb_build_object(r.id::text, v_new);
  end loop;

  for r in select * from employees where company_id = tmpl.id loop
    insert into employees (
      company_id, personnel_number, first_name, last_name, email, phone, role, department,
      shift_id, vacation_days, active, rotation_pattern_id, qualifications, rotation_team,
      v_days, shift_worker, sort_order, profile_confirmed_at, entry_date, exit_date,
      is_apprentice, bildungsurlaub_erlaubt, af_ab, sonderurlaub_erlaubt, af_start_stunden,
      v_ab, v_start_stunden
    ) values (
      v_company, r.personnel_number, r.first_name, r.last_name, null, null, r.role, r.department,
      (m_shift ->> r.shift_id::text)::uuid, r.vacation_days, r.active,
      (m_pat ->> r.rotation_pattern_id::text)::uuid, r.qualifications, r.rotation_team,
      r.v_days, r.shift_worker, r.sort_order, r.profile_confirmed_at, r.entry_date, r.exit_date,
      r.is_apprentice, r.bildungsurlaub_erlaubt, r.af_ab, r.sonderurlaub_erlaubt, r.af_start_stunden,
      r.v_ab, r.v_start_stunden
    )
    returning id into v_new;
    m_emp := m_emp || jsonb_build_object(r.id::text, v_new);
  end loop;

  insert into employee_qualifications (employee_id, qualification_id)
  select (m_emp ->> eq.employee_id::text)::uuid, (m_qual ->> eq.qualification_id::text)::uuid
    from employee_qualifications eq
    join employees e on e.id = eq.employee_id and e.company_id = tmpl.id
  on conflict do nothing;

  insert into shift_qualification_needs (company_id, shift_id, qualification_id, minimum)
  select v_company, (m_shift ->> n.shift_id::text)::uuid, (m_qual ->> n.qualification_id::text)::uuid, n.minimum
    from shift_qualification_needs n where n.company_id = tmpl.id
  on conflict do nothing;

  insert into leave_balances (company_id, employee_id, year, entitlement, carried_over, v_entitlement, v_carried_over, v_korrektur)
  select v_company, (m_emp ->> b.employee_id::text)::uuid, b.year, b.entitlement, b.carried_over,
         b.v_entitlement, b.v_carried_over, b.v_korrektur
    from leave_balances b where b.company_id = tmpl.id
  on conflict (employee_id, year) do update
     set entitlement = excluded.entitlement,
         carried_over = excluded.carried_over,
         v_entitlement = excluded.v_entitlement,
         v_carried_over = excluded.v_carried_over,
         v_korrektur = excluded.v_korrektur;

  perform ensure_holidays(v_company, jahr, false);
  perform ensure_holidays(v_company, jahr + 1, false);

  insert into employees (company_id, personnel_number, first_name, last_name, role, vacation_days, v_days,
                         shift_worker, profile_confirmed_at)
  values (v_company, 'DEMO', 'Demo', 'Administration', 'admin', 0, 0, false, now())
  returning id into v_admin_emp;

  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
  values (p_user_id, v_company, v_admin_emp, 'Demo', 'Administration', v_email, 'admin');

  update privacy_settings
     set accepted_at = now(),
         privacy_notice_version = coalesce(current_legal_version('datenschutz'), privacy_notice_version)
   where user_id = p_user_id;

  v_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);

  for r in select * from leave_requests where company_id = tmpl.id and status in ('approved', 'pending', 'rejected') loop
    begin
      insert into leave_requests (
        company_id, employee_id, start_date, end_date, half_day, requested_days, reason, status,
        reviewed_at, rejection_reason, half_day_period, kind
      ) values (
        v_company, (m_emp ->> r.employee_id::text)::uuid, r.start_date + v_delta, r.end_date + v_delta,
        r.half_day, r.requested_days, r.reason, r.status,
        case when r.reviewed_at is null then null else r.reviewed_at + make_interval(days => v_delta) end,
        r.rejection_reason, r.half_day_period, r.kind
      );
    exception when others then
      null;
    end;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);

  insert into absences (company_id, employee_id, date, type, note)
  select v_company, (m_emp ->> a.employee_id::text)::uuid, a.date + v_delta, a.type,
         case when a.type = 'krank' then null else a.note end
    from absences a where a.company_id = tmpl.id
  on conflict do nothing;

  insert into shift_assignments (company_id, employee_id, shift_id, date)
  select v_company, (m_emp ->> s.employee_id::text)::uuid, (m_shift ->> s.shift_id::text)::uuid, s.date + v_delta
    from shift_assignments s where s.company_id = tmpl.id
  on conflict do nothing;

  insert into announcements (company_id, title, body, level, active)
  select v_company, a.title, a.body, a.level, a.active
    from announcements a where a.company_id = tmpl.id;

  insert into staffing_rules (company_id, shift_id, key, value, active)
  select v_company, (m_shift ->> s.shift_id::text)::uuid, s.key,
         case when s.key = 'urlaubssperre' and s.value ? 'start' and s.value ? 'end'
              then s.value
                   || jsonb_build_object('start', ((s.value ->> 'start')::date + v_delta)::text)
                   || jsonb_build_object('end', ((s.value ->> 'end')::date + v_delta)::text)
              else s.value end,
         s.active
    from staffing_rules s where s.company_id = tmpl.id
  on conflict do nothing;

  return v_company;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.demo_seed_pending(p_company uuid, p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  k int := 0;
  n int := 0;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if auth.role() <> 'service_role' then
    raise exception 'Nicht erlaubt.';
  end if;
  if not exists (
    select 1 from companies c join profiles p on p.company_id = c.id
     where c.id = p_company and c.is_demo and p.id = p_user
  ) then
    raise exception 'Keine Demo.';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('schichtplan.sammelantrag', 'an', true);

  for r in
    select e.id from employees e
     where e.company_id = p_company and e.active and e.shift_worker and e.role = 'employee'
     order by e.rotation_team, e.last_name
     limit 6
  loop
    begin
      insert into leave_requests (company_id, employee_id, start_date, end_date, status, kind)
      values (p_company, r.id, public.heute() + 14 + k * 4, public.heute() + 18 + k * 4, 'pending', 'urlaub');
      n := n + 1;
    exception when others then
      null;
    end;
    k := k + 1;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return n;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.discard_unclaimed_company(p_company_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_treffer int;
begin
  delete from companies c
   where c.id = p_company_id
     and not exists (select 1 from profiles p where p.company_id = c.id)
     and c.created_at > now() - interval '15 minutes';

  get diagnostics v_treffer = row_count;
  return v_treffer > 0;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.easter_sunday(p_year integer)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  a int; b int; c int; d int; e int; f int; g int;
  h int; i int; k int; l int; m int; monat int; tag int;
begin
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  monat := (h + l - 7 * m + 114) / 31;
  tag := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_year, monat, tag);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.effective_shift_id(p_employee_id uuid, p_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  assigned uuid;
  emp employees;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then return null; end if;

  if not is_employed_on(emp, p_date) then
    return null;
  end if;

  select shift_id into assigned from shift_assignments
   where employee_id = p_employee_id and date = p_date;
  if found then
    return assigned;
  end if;

  if emp.shift_worker and emp.rotation_pattern_id is not null then
    return rotation_shift_for(emp, p_date);
  end if;

  return emp.shift_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.einladung_erstellen(p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.einladung_vorschau(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.email_outbox_skip_demo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from companies c where c.id = new.company_id and c.is_demo) then
    return null;
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.email_outbox_status()
 RETURNS TABLE(offen bigint, gesendet bigint, fehler bigint, letzter_versand timestamp with time zone, letzter_fehler text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    count(*) filter (where o.status = 'offen'),
    count(*) filter (where o.status = 'gesendet'),
    count(*) filter (where o.status = 'fehler'),
    max(o.gesendet_at),
    (select o2.letzter_fehler from email_outbox o2
      where o2.company_id = auth_company_id() and o2.status = 'fehler'
      order by o2.created_at desc limit 1)
  from email_outbox o
  where o.company_id = auth_company_id() and is_admin();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_absent_on(p_date date, p_include_pending boolean DEFAULT false, p_include_request_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(employee_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select employee_id from absences where date = p_date
  union
  select employee_id from leave_requests
  where p_date between start_date and end_date
    and (
      status = 'approved'
      or (p_include_pending and status = 'pending')
      or id = p_include_request_id
    );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_audit_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    perform public.write_audit(new.company_id, 'role.changed', 'employees', new.id, null);
  end if;
  if tg_op = 'UPDATE' and new.active is distinct from old.active then
    perform public.write_audit(
      new.company_id,
      case when new.active then 'employee.reactivated' else 'employee.deactivated' end,
      'employees',
      new.id,
      null
    );
  end if;
  if tg_op = 'UPDATE' and new.* is distinct from old.* then
    perform public.write_audit(new.company_id, 'employee.updated', 'employees', new.id, null);
  end if;
  if tg_op = 'INSERT' then
    perform public.write_audit(new.company_id, 'employee.created', 'employees', new.id, null);
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_austritt_zurueck()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.exit_date is distinct from old.exit_date
     and new.active
     and (new.exit_date is null or new.exit_date >= (now() at time zone 'Europe/Berlin')::date)
  then
    update profiles
       set active = true,
           austritt_uebernommen_am = null
     where employee_id = new.id
       and company_id = new.company_id
       and not active;
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_ensure_leave_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into leave_balances (company_id, employee_id, year, entitlement, carried_over, v_entitlement)
  values (new.company_id, new.id, extract(year from public.heute())::smallint,
          new.vacation_days, 0, new.v_days)
  on conflict (employee_id, year) do nothing;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_guard_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth_role() = 'admin' then
    return new;
  end if;

  if auth_role() = 'shift_leader' and new.role is distinct from old.role then
    raise exception 'Nur die Administration darf Rollen vergeben.';
  end if;

  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_schichtleitung_grenze()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- Nur direkte Änderungen über die Schnittstelle (Rolle „authenticated“) prüfen.
  if current_user = 'authenticated' and auth_role() = 'shift_leader' and old.role <> 'employee' then
    raise exception 'Personen mit Führungsrolle bearbeitet nur die Administration.';
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_sync_entitlement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.vacation_days is distinct from old.vacation_days
     or new.v_days is distinct from old.v_days then
    insert into leave_balances (company_id, employee_id, year, entitlement, carried_over, v_entitlement)
    values (new.company_id, new.id, extract(year from public.heute())::smallint,
            new.vacation_days, 0, new.v_days)
    on conflict (employee_id, year)
      do update set entitlement = excluded.entitlement,
                    v_entitlement = excluded.v_entitlement,
                    updated_at = now();
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_sync_profile_active()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.active is distinct from old.active then
    if not new.active and exists (
      select 1 from profiles p where p.id = auth.uid() and p.employee_id = new.id
    ) then
      raise exception 'Du kannst dich nicht selbst deaktivieren.';
    end if;
    -- Wieder aktiviert: ein späterer Austritt fragt erneut nach.
    update profiles
       set active = new.active,
           austritt_uebernommen_am = case when new.active then null else austritt_uebernommen_am end
     where employee_id = new.id
       and company_id = new.company_id;
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_sync_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not is_admin() then
      raise exception 'Die Rolle darf nur die Administration ändern.';
    end if;

    update profiles
       set role = new.role
     where employee_id = new.id
       and company_id = new.company_id;
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.employees_sync_rotation_offset()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  step int;
begin
  if new.rotation_team is null or new.rotation_pattern_id is null then
    new.rotation_offset_days := 0;
    return new;
  end if;

  select coalesce(team_offset_days, 7) into step
  from rotation_patterns where id = new.rotation_pattern_id;

  new.rotation_offset_days :=
    (array_position(array['A', 'B', 'C', 'D', 'E']::text[], new.rotation_team::text) - 1)
    * coalesce(step, 7);

  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.ensure_holidays(p_company_id uuid, p_year integer, p_replace boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  bl text;
  n int;
  meine_firma uuid := auth_company_id();
begin
  if auth.uid() is not null then
    if meine_firma is null then
      -- Registrierung: das Unternehmen ist eben erst entstanden und gehört
      -- noch niemandem. Alles andere ist tabu.
      if not exists (
        select 1 from companies c
         where c.id = p_company_id
           and c.created_at > now() - interval '15 minutes'
           and not exists (select 1 from profiles p where p.company_id = c.id)
      ) then
        raise exception 'Du hast keine Berechtigung für diesen Bereich.';
      end if;
    elsif p_company_id is distinct from meine_firma then
      raise exception 'Du hast keine Berechtigung für diesen Bereich.';
    elsif p_replace and not is_admin() then
      raise exception 'Nur die Administration darf die Feiertage neu erzeugen.';
    end if;
  end if;

  if p_year < 2020 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  select coalesce(s.state, 'NW') into bl
    from company_settings s where s.company_id = p_company_id;
  bl := coalesce(bl, 'NW');

  if p_replace then
    -- Betriebsruhe bleibt stehen, die ist von Hand gepflegt.
    delete from holidays
     where company_id = p_company_id
       and extract(year from date) = p_year
       and not company_closure;
  end if;

  with neu as (
    insert into holidays (company_id, date, name, region)
    select p_company_id, h.tag, h.bezeichnung, bl
      from german_holidays(p_year, bl) h
    on conflict (company_id, date) do nothing
    returning 1
  )
  select count(*) into n from neu;

  return n;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.ensure_leave_balance(p_employee_id uuid, p_year integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  prev_u numeric(4, 1) := 0;
  prev_v numeric(4, 1) := 0;
  vorjahr_laeuft boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not is_leadership() and p_employee_id is distinct from auth_employee_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_year < 2020 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  -- Solange das Vorjahr noch laeuft, ist der Uebertrag vorlaeufig.
  vorjahr_laeuft := extract(year from public.heute())::int <= p_year - 1;

  select greatest(remaining_days, 0), greatest(v_remaining_days, 0)
    into prev_u, prev_v
    from leave_balances_view
   where employee_id = p_employee_id and year = p_year - 1;

  if not exists (select 1 from leave_balances where employee_id = p_employee_id and year = p_year) then
    insert into leave_balances (
      company_id, employee_id, year, entitlement, carried_over, v_entitlement, v_carried_over
    )
    values (
      e.company_id, p_employee_id, p_year::smallint,
      e.vacation_days, coalesce(prev_u, 0), e.v_days, coalesce(prev_v, 0)
    )
    on conflict (employee_id, year) do nothing;
    return;
  end if;

  -- Zeile ist da. Nachziehen, solange sich noch etwas aendern kann.
  if vorjahr_laeuft then
    update leave_balances
       set carried_over = coalesce(prev_u, 0),
           v_carried_over = coalesce(prev_v, 0),
           entitlement = e.vacation_days,
           v_entitlement = e.v_days,
           updated_at = now()
     where employee_id = p_employee_id
       and year = p_year
       and (carried_over is distinct from coalesce(prev_u, 0)
         or v_carried_over is distinct from coalesce(prev_v, 0)
         or entitlement is distinct from e.vacation_days
         or v_entitlement is distinct from e.v_days);
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.ensure_leave_balances_for_year(p_year integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  target uuid;
  n int := 0;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration duerfen das.';
  end if;
  for target in
    select id from employees where company_id = auth_company_id() and active
  loop
    perform ensure_leave_balance(target, p_year);
    n := n + 1;
  end loop;
  return n;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.ensure_personal_details()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.personal_details (user_id, company_id)
  values (new.id, new.company_id)
  on conflict (user_id) do update set company_id = excluded.company_id;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.ensure_privacy_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.privacy_settings (user_id, company_id)
  values (new.id, new.company_id)
  on conflict (user_id) do update set company_id = excluded.company_id;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.enthaelt_gesundheitsangabe(p_text text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(p_text, '') ~* (
    '\m(krank\w*|arzt\w*|ärzt\w*|zahnarzt\w*|hausarzt\w*|facharzt\w*|diagnose\w*|therapie\w*|operation\w*|'
    || 'krankenhaus\w*|klinik\w*|reha\w*|kur|schwanger\w*|attest\w*|depression\w*|burn-?out|psych\w*|'
    || 'physio\w*|chemo\w*|krebs\w*|infektion\w*|corona|covid\w*|grippe\w*|op|au-bescheinigung\w*)\M'
  );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.entscheidbare_mitarbeiter()
 RETURNS TABLE(employee_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.id
    from employees e
   where e.company_id = auth_company_id()
     and is_leadership()
     and darf_urlaub_entscheiden(e.id);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.erinnerungen_anstossen()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  geheimnis text;
begin
  if not exists (
    select 1 from erinnerungen_im_fenster() f
     where exists (select 1 from push_abos p where p.user_id = f.user_id)
  ) and not exists (select 1 from push_warteschlange
                     where gesendet_am is null and (senden_ab is null or senden_ab <= now()))
    and not exists (select 1 from lohnzettel_aufraeumen) then
    return;
  end if;
  select decrypted_secret into geheimnis from vault.decrypted_secrets where name = 'erinnerung_geheimnis';
  if geheimnis is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://ready-flame.vercel.app/api/erinnerungen',
    headers := jsonb_build_object('content-type', 'application/json', 'x-erinnerung', geheimnis),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.erinnerungen_im_fenster()
 RETURNS TABLE(user_id uuid, art text, ref_id uuid, titel text, datum date, beginn text, ganztaegig boolean, faellig_am timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with tage as (
    select d::date as d from generate_series(public.heute() - 1, public.heute() + 3, interval '1 day') d
  ),
  termine as (
    select t.owner_id, t.id, t.titel, x.d, t.beginn, t.ganztaegig,
           (case t.erinnerung
              when 'm10' then (x.d + t.beginn) - interval '10 minutes'
              when 'h1' then (x.d + t.beginn) - interval '1 hour'
              when 'd1' then (x.d + t.beginn) - interval '1 day'
              when 'morgens8' then x.d + time '08:00'
              when 'vortag18' then (x.d - 1) + time '18:00'
              when 'tag8' then x.d + time '08:00'
              when 'd2' then (x.d - 2) + time '08:00'
            end) at time zone 'Europe/Berlin' as faellig
      from kalender_termine t
      join tage x on x.d >= t.datum
     where t.erinnerung is not null
       and (t.ganztaegig or t.beginn is not null or t.erinnerung in ('morgens8', 'vortag18', 'tag8', 'd2'))
       and not exists (select 1 from kalender_termin_ausnahmen a
                        where a.termin_id = t.id and (a.datum = x.d or (a.ab and a.datum <= x.d)))
       and case t.wiederholung
             when 'taeglich' then true
             when 'woechentlich' then (x.d - t.datum) % 7 = 0
             when 'monatlich' then extract(day from x.d) = extract(day from t.datum)
             when 'jaehrlich' then extract(month from x.d) = extract(month from t.datum)
                               and extract(day from x.d) = extract(day from t.datum)
             else x.d = t.datum
           end
  ),
  todos as (
    select o.owner_id, o.id, o.titel, o.datum, o.uhrzeit,
           (o.datum + o.uhrzeit) at time zone 'Europe/Berlin' as faellig
      from kalender_todos o
     where not o.erledigt and o.uhrzeit is not null
       and o.datum between public.heute() - 1 and public.heute() + 1
  ),
  alle as (
    select owner_id, 'termin'::text as art, id, titel, d as datum, to_char(beginn, 'HH24:MI') as beginn, ganztaegig, faellig from termine
    union all
    select owner_id, 'todo', id, titel, datum, to_char(uhrzeit, 'HH24:MI'), false, faellig from todos
  )
  select a.owner_id, a.art, a.id, a.titel, a.datum, a.beginn, a.ganztaegig, a.faellig
    from alle a
   where a.faellig between now() - interval '15 minutes' and now() + interval '30 seconds'
     and not exists (select 1 from erinnerung_gesendet g
                      where g.art = a.art and g.ref_id = a.id and g.faellig_am = a.faellig);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.faellige_erinnerungen()
 RETURNS TABLE(user_id uuid, art text, ref_id uuid, titel text, datum date, beginn text, ganztaegig boolean, faellig_am timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from erinnerung_gesendet where erinnerung_gesendet.faellig_am < now() - interval '3 days';
  return query
    with f as (select * from erinnerungen_im_fenster()),
    neu as (
      insert into erinnerung_gesendet (art, ref_id, faellig_am)
      select f.art, f.ref_id, f.faellig_am from f
      on conflict do nothing
      returning erinnerung_gesendet.art, erinnerung_gesendet.ref_id, erinnerung_gesendet.faellig_am
    )
    select f.user_id, f.art, f.ref_id, f.titel, f.datum, f.beginn, f.ganztaegig, f.faellig_am
      from f join neu on neu.art = f.art and neu.ref_id = f.ref_id and neu.faellig_am = f.faellig_am
     where exists (select 1 from push_abos p where p.user_id = f.user_id);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.fehlzeit_loeschen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  f fehlzeiten;
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into f from fehlzeiten where id = p_id and company_id = auth_company_id();
  if f.id is null then
    raise exception 'Eintrag nicht gefunden.';
  end if;
  if not darf_urlaub_entscheiden(f.employee_id) then
    raise exception 'Du darfst nur Fehlzeiten deiner eigenen Schicht löschen.';
  end if;
  delete from fehlzeiten where id = p_id;
  perform write_audit(f.company_id, 'fehlzeit.geloescht', 'fehlzeiten', f.id,
    jsonb_build_object('employee_id', f.employee_id, 'tag', f.tag, 'art', f.art, 'stunden', f.stunden));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.fehlzeit_speichern(p_employee_id uuid, p_tag date, p_art text, p_stunden numeric, p_notiz text DEFAULT NULL::text, p_abzug text DEFAULT 'v'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  andere numeric;
  neu uuid;
  art_text text;
  abzug_text text;
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Diese Person gehört nicht zu deinem Unternehmen.';
  end if;
  if not darf_urlaub_entscheiden(p_employee_id) then
    raise exception 'Du darfst nur Fehlzeiten deiner eigenen Schicht eintragen.';
  end if;
  if p_art not in ('frueher_gegangen', 'spaeter_gekommen') then
    raise exception 'Ungültige Art.';
  end if;
  if coalesce(p_abzug, '') not in ('v', 'af') then
    raise exception 'Ungültiger Abzug.';
  end if;
  if p_abzug = 'af' and (e.af_ab is null) then
    raise exception '% % hat kein AF-Stundenkonto – bitte von den V-Tagen abziehen.', e.first_name, e.last_name;
  end if;
  if p_stunden is null or p_stunden <= 0 or p_stunden >= 8 or p_stunden * 4 <> floor(p_stunden * 4) then
    raise exception 'Bitte Stunden in Viertelstunden zwischen 0,25 und 7,75 angeben.';
  end if;
  if p_tag is null then
    raise exception 'Bitte einen Tag angeben.';
  end if;
  if p_abzug = 'af' and p_tag <= e.af_ab then
    raise exception 'Der Tag liegt vor dem Stichtag des AF-Kontos (%).', to_char(e.af_ab, 'DD.MM.YYYY');
  end if;
  if not is_planned_workday(p_employee_id, p_tag) then
    raise exception '% % hat am % keine Schicht.', e.first_name, e.last_name, to_char(p_tag, 'DD.MM.YYYY');
  end if;
  if exists (select 1 from absences a where a.employee_id = p_employee_id and a.date = p_tag)
     or exists (select 1 from leave_requests r
                 where r.employee_id = p_employee_id
                   and r.status in ('approved', 'pending')
                   and p_tag between r.start_date and r.end_date) then
    raise exception '% % ist am % ohnehin abwesend (Urlaub, V-Tag, Krank o. Ä.).',
      e.first_name, e.last_name, to_char(p_tag, 'DD.MM.YYYY');
  end if;

  select coalesce(sum(f.stunden), 0) into andere
    from fehlzeiten f
   where f.employee_id = p_employee_id and f.tag = p_tag and f.art <> p_art;
  if andere + p_stunden >= 8 then
    raise exception 'Zusammen fehlen dann 8 Stunden oder mehr – dafür bitte einen ganzen V-Tag eintragen.';
  end if;

  insert into fehlzeiten (company_id, employee_id, tag, art, stunden, notiz, erfasst_von, abzug)
  values (e.company_id, p_employee_id, p_tag, p_art, p_stunden, nullif(btrim(p_notiz), ''), auth.uid(), p_abzug)
  on conflict (employee_id, tag, art)
  do update set stunden = excluded.stunden, notiz = excluded.notiz,
                erfasst_von = excluded.erfasst_von, abzug = excluded.abzug, created_at = now()
  returning id into neu;

  perform ensure_leave_balance(p_employee_id, extract(year from p_tag)::int);

  perform write_audit(e.company_id, 'fehlzeit.gespeichert', 'fehlzeiten', neu,
    jsonb_build_object('employee_id', p_employee_id, 'tag', p_tag, 'art', p_art,
                       'stunden', p_stunden, 'abzug', p_abzug));

  art_text := case when p_art = 'frueher_gegangen' then 'früher gegangen' else 'später gekommen' end;
  abzug_text := case when p_abzug = 'af'
    then replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',') || ' AF-Stunden'
    else replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',') || ' V-Std. ('
      || replace(trim(to_char(p_stunden / 7.5, 'FM990.00')), '.', ',') || ' V-Tage)' end;
  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (
    e.company_id, p_employee_id, 'fehlzeit',
    'Fehlzeit eingetragen',
    to_char(p_tag, 'DD.MM.YYYY') || ': ' || replace(trim(to_char(p_stunden, 'FM990.00')), '.', ',')
      || ' Std. ' || art_text || '. Abgezogen: ' || abzug_text || '.',
    'fehlzeiten', neu
  );

  return neu;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.fehlzeiten_liste(p_von date, p_bis date)
 RETURNS TABLE(id uuid, employee_id uuid, employee_name text, rotation_team text, tag date, art text, stunden numeric, notiz text, darf_aendern boolean, abzug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select f.id, f.employee_id, e.first_name || ' ' || e.last_name, e.rotation_team::text,
         f.tag, f.art, f.stunden, f.notiz, darf_urlaub_entscheiden(f.employee_id), f.abzug
    from fehlzeiten f
    join employees e on e.id = f.employee_id
   where f.company_id = auth_company_id()
     and is_admin()
     and f.tag between p_von and p_bis
   order by f.tag desc, e.last_name, e.first_name;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.firma_endgueltig_loeschen(p_company uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t text;
  pass int;
begin
  if not exists (select 1 from companies c where c.id = p_company and not c.is_demo and c.geloescht_am is not null) then
    raise exception 'Nur Firmen im Papierkorb können endgültig gelöscht werden.';
  end if;
  if exists (select 1 from profiles p join platform_admins a on a.user_id = p.id where p.company_id = p_company) then
    raise exception 'Diese Firma enthält ein Betreiber-Konto und kann nicht gelöscht werden.';
  end if;

  -- Zugänge mitsamt ihren persönlichen Einträgen (hängen am Konto)
  delete from auth.users u where u.id in (select p.id from profiles p where p.company_id = p_company);

  -- Reste mit Firmenkennung, falls etwas nicht automatisch mitgeht
  for pass in 1..4 loop
    for t in
      select col.table_name
        from information_schema.columns col
        join information_schema.tables tab
          on tab.table_schema = col.table_schema and tab.table_name = col.table_name and tab.table_type = 'BASE TABLE'
       where col.table_schema = 'public' and col.column_name = 'company_id' and col.table_name <> 'companies'
    loop
      begin
        execute format('delete from public.%I where company_id = $1', t) using p_company;
      exception when others then
        null;
      end;
    end loop;
  end loop;

  delete from companies where id = p_company;
  insert into plattform_protokoll (aktion, art) values ('endgueltig', 'firma');
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.freitext_ohne_gesundheit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  feld text;
  neu text;
  alt text;
begin
  foreach feld in array tg_argv loop
    neu := to_jsonb(new) ->> feld;
    alt := case when tg_op = 'UPDATE' then to_jsonb(old) ->> feld end;
    if neu is distinct from alt and enthaelt_gesundheitsangabe(neu) then
      raise exception 'Bitte keine Gesundheitsangaben (z. B. Arzt, Krankheit, Therapie) in Kommentare schreiben. Für Krankheit gibt es die Abwesenheit „krank“ ohne Text.';
    end if;
  end loop;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.funktion_frei(p_user uuid, p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select f.fuer_alle from funktionen f where f.funktion = p_name), false)
      or exists (select 1 from funktionen_zugang z where z.funktion = p_name and z.user_id = p_user)
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.geburtsdaten_offen()
 RETURNS TABLE(employee_id uuid, name text, birth_date date, geaendert_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  select e.id, e.first_name || ' ' || e.last_name, pd.birth_date, pd.updated_at
    from personal_details pd
    join profiles p on p.id = pd.user_id and p.company_id = pd.company_id
    join employees e on e.id = p.employee_id and e.company_id = pd.company_id
   where pd.company_id = auth_company_id()
     and pd.birth_date is not null
     and not pd.birth_date_bestaetigt
     and e.active
   order by pd.updated_at;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.geburtsdatum_bestaetigen(p_employee_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  v_user uuid;
  v_datum date;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf das Geburtsdatum bestätigen.';
  end if;
  select p.id into v_user from profiles p where p.employee_id = p_employee_id and p.company_id = v_firma;
  if v_user is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  update personal_details set birth_date_bestaetigt = true
   where user_id = v_user and company_id = v_firma and birth_date is not null
   returning birth_date into v_datum;
  if v_datum is null then
    raise exception 'Es ist kein Geburtsdatum hinterlegt.';
  end if;
  perform write_audit(v_firma, 'personal_details.birth_date_bestaetigt', 'employees', p_employee_id,
    jsonb_build_object('datum', v_datum));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.geburtsdatum_von(p_employee_id uuid)
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select pd.birth_date
    from profiles p
    join personal_details pd on pd.user_id = p.id and pd.company_id = p.company_id
   where p.employee_id = p_employee_id
     and pd.birth_date_bestaetigt
   limit 1;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.geraet_einloesen(p_user uuid, p_session uuid, p_token_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_geraet uuid;
begin
  delete from vertraute_geraete
   where user_id = p_user and (bis <= now() or zuletzt_am <= now() - interval '7 days');
  select id into v_geraet from vertraute_geraete
   where user_id = p_user and token_hash = p_token_hash;
  if v_geraet is null or p_session is null then
    return false;
  end if;
  update vertraute_geraete set zuletzt_am = now() where id = v_geraet;
  insert into vertraute_sitzungen (session_id, user_id, geraet_id)
  values (p_session, p_user, v_geraet)
  on conflict (session_id) do nothing;
  return true;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.geraet_merken(p_user uuid, p_token_hash text, p_geraet text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into vertraute_geraete (user_id, token_hash, geraet, bis)
  values (p_user, p_token_hash, left(p_geraet, 80), now() + interval '30 days');
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.german_holidays(p_year integer, p_state text)
 RETURNS TABLE(tag date, bezeichnung text)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  ostern date := easter_sunday(p_year);
  bl text := upper(coalesce(p_state, 'NW'));
begin
  -- Bundesweit
  return query values
    (make_date(p_year, 1, 1),   'Neujahr'),
    (ostern - 2,                'Karfreitag'),
    (ostern + 1,                'Ostermontag'),
    (make_date(p_year, 5, 1),   'Tag der Arbeit'),
    (ostern + 39,               'Christi Himmelfahrt'),
    (ostern + 50,               'Pfingstmontag'),
    (make_date(p_year, 10, 3),  'Tag der Deutschen Einheit'),
    (make_date(p_year, 12, 25), '1. Weihnachtstag'),
    (make_date(p_year, 12, 26), '2. Weihnachtstag');

  if bl in ('BW', 'BY', 'ST') then
    return query values (make_date(p_year, 1, 6), 'Heilige Drei Könige');
  end if;

  if bl in ('BE', 'MV') then
    return query values (make_date(p_year, 3, 8), 'Internationaler Frauentag');
  end if;

  if bl = 'BB' then
    return query values (ostern, 'Ostersonntag'), (ostern + 49, 'Pfingstsonntag');
  end if;

  if bl in ('BW', 'BY', 'HE', 'NW', 'RP', 'SL') then
    return query values (ostern + 60, 'Fronleichnam');
  end if;

  if bl = 'SL' then
    return query values (make_date(p_year, 8, 15), 'Mariä Himmelfahrt');
  end if;

  if bl = 'TH' then
    return query values (make_date(p_year, 9, 20), 'Weltkindertag');
  end if;

  if bl in ('BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH') then
    return query values (make_date(p_year, 10, 31), 'Reformationstag');
  end if;

  if bl in ('BW', 'BY', 'NW', 'RP', 'SL') then
    return query values (make_date(p_year, 11, 1), 'Allerheiligen');
  end if;

  if bl = 'SN' then
    -- Buss- und Bettag: der Mittwoch vor dem 23. November.
    return query
      select d::date, 'Buß- und Bettag'::text
        from generate_series(make_date(p_year, 11, 16), make_date(p_year, 11, 22), '1 day') d
       where extract(dow from d) = 3;
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.get_company_rules()
 RETURNS TABLE(work_on_holidays boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(s.work_on_holidays, true)
  from company_settings s where s.company_id = auth_company_id();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.get_notification_settings()
 RETURNS TABLE(notify_leave_email boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(s.notify_leave_email, true) from company_settings s where s.company_id = auth_company_id();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruende_fuer_kollegen_erlaubt()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select cs.gruende_fuer_kollegen from company_settings cs where cs.company_id = auth_company_id()),
    false);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_am(p_employee_id uuid, p_tag date, p_jetzt rotation_team)
 RETURNS rotation_team
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select w.nach_team from employee_gruppenwechsel w
      where w.employee_id = p_employee_id and w.ab <= p_tag order by w.ab desc limit 1),
    (select w.von_team from employee_gruppenwechsel w
      where w.employee_id = p_employee_id and w.ab > p_tag order by w.ab asc limit 1),
    p_jetzt);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_beitreten(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g uuid := gruppe_zum_link(p_token);
begin
  if g is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if not kalender_nutzer() then
    raise exception 'Zum Beitreten brauchst du einen eigenen Schichtkalender.';
  end if;
  insert into kalender_gruppen_mitglieder (gruppe_id, user_id) values (g, auth.uid())
  on conflict do nothing;
  return g;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_erstellen(p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  schluessel text := encode(extensions.gen_random_bytes(24), 'hex');
  neu uuid;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Bitte einen Namen für die Gruppe eingeben.';
  end if;
  insert into kalender_gruppen (name, erstellt_von, token_hash)
  values (left(btrim(p_name), 40), auth.uid(), encode(extensions.digest(schluessel, 'sha256'), 'hex'))
  returning id into neu;
  insert into kalender_gruppen_mitglieder (gruppe_id, user_id) values (neu, auth.uid());
  return jsonb_build_object('id', neu, 'schluessel', schluessel);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_info(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g uuid := gruppe_zum_link(p_token);
begin
  if g is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  return (select jsonb_build_object(
            'id', k.id,
            'name', k.name,
            'mitglieder', (select count(*) from kalender_gruppen_mitglieder x where x.gruppe_id = k.id),
            'dabei', ist_gruppenmitglied(k.id),
            'darf', kalender_nutzer())
            from kalender_gruppen k where k.id = g);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_link_neu(p_gruppe uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  schluessel text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not ist_gruppenmitglied(p_gruppe) then
    raise exception 'Du bist nicht in dieser Gruppe.';
  end if;
  update kalender_gruppen set token_hash = encode(extensions.digest(schluessel, 'sha256'), 'hex') where id = p_gruppe;
  return schluessel;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_tage(p_gruppe uuid, p_von date, p_tage integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m record;
  liste jsonb := '[]'::jsonb;
begin
  if not ist_gruppenmitglied(p_gruppe) then
    raise exception 'Du bist nicht in dieser Gruppe.';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  for m in
    select x.user_id, x.user_id = auth.uid() as ich from kalender_gruppen_mitglieder x
     where x.gruppe_id = p_gruppe
     order by x.user_id = auth.uid() desc, x.beigetreten_am
  loop
    liste := liste || jsonb_build_array(jsonb_build_object(
      'id', m.user_id,
      'name', inhaber_vorname(m.user_id),
      'ich', m.ich,
      'tage', kalender_codes(m.user_id, p_von, p_tage),
      'farben', kalender_farben_codes(m.user_id)));
  end loop;
  return liste;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_verlassen(p_gruppe uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from kalender_gruppen_mitglieder where gruppe_id = p_gruppe and user_id = auth.uid();
  if not exists (select 1 from kalender_gruppen_mitglieder where gruppe_id = p_gruppe) then
    delete from kalender_gruppen where id = p_gruppe;
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_versatz(p_pattern_id uuid, p_team rotation_team)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when p_team is null then 0 else
    (array_position(array['A', 'B', 'C', 'D', 'E']::text[], p_team::text) - 1)
    * coalesce((select team_offset_days from rotation_patterns where id = p_pattern_id), 7) end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppe_zum_link(p_token text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select g.id from kalender_gruppen g
   where length(coalesce(p_token, '')) between 32 and 128
     and g.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppenwechsel_loeschen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  w employee_gruppenwechsel;
begin
  select * into w from employee_gruppenwechsel where id = p_id;
  if w.id is null or w.company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if w.vollzogen_am is not null then
    raise exception 'Dieser Wechsel ist schon vollzogen. Plane stattdessen einen neuen Wechsel zurück.';
  end if;
  delete from employee_gruppenwechsel where id = p_id;
  -- Der nächste Wechsel beginnt wieder in der Gruppe davor.
  update employee_gruppenwechsel x set von_team = w.von_team
   where x.employee_id = w.employee_id
     and x.ab = (select min(y.ab) from employee_gruppenwechsel y where y.employee_id = w.employee_id and y.ab > w.ab);
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (w.company_id, auth.uid(), 'employee.gruppenwechsel_gestrichen', 'employees', w.employee_id,
          jsonb_build_object('ab', w.ab, 'nach', w.nach_team));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppenwechsel_planen(p_employee_id uuid, p_ab date, p_nach_team rotation_team)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  v_id uuid;
  v_von rotation_team;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_ab is null or p_nach_team is null then
    raise exception 'Bitte Datum und neue Gruppe angeben.';
  end if;
  v_von := gruppe_am(p_employee_id, p_ab - 1, e.rotation_team);
  if v_von is not distinct from p_nach_team then
    raise exception 'Die Person ist an dem Tag schon in Gruppe %.', p_nach_team;
  end if;
  insert into employee_gruppenwechsel (company_id, employee_id, ab, von_team, nach_team)
  values (e.company_id, p_employee_id, p_ab, v_von, p_nach_team)
  on conflict (employee_id, ab) do update set nach_team = excluded.nach_team, von_team = excluded.von_team, vollzogen_am = null
  returning id into v_id;
  -- Spätere Wechsel beginnen jetzt in der neuen Gruppe.
  update employee_gruppenwechsel w set von_team = p_nach_team
   where w.employee_id = p_employee_id
     and w.ab = (select min(x.ab) from employee_gruppenwechsel x where x.employee_id = p_employee_id and x.ab > p_ab);
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (e.company_id, auth.uid(), 'employee.gruppenwechsel_geplant', 'employees', p_employee_id,
          jsonb_build_object('ab', p_ab, 'von', v_von, 'nach', p_nach_team));
  if p_ab <= heute() then
    perform gruppenwechsel_vollziehen();
  end if;
  return v_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.gruppenwechsel_vollziehen()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n integer := 0;
  w record;
begin
  for w in
    select distinct on (x.employee_id) x.id, x.employee_id, x.nach_team
      from employee_gruppenwechsel x
     where x.ab <= heute() and x.vollzogen_am is null
     order by x.employee_id, x.ab desc
  loop
    update employees set rotation_team = w.nach_team where id = w.employee_id;
    update employee_gruppenwechsel set vollzogen_am = now()
     where employee_id = w.employee_id and ab <= heute() and vollzogen_am is null;
    n := n + 1;
  end loop;
  return n;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.invited_at is not null then
    perform public.profil_aus_einladung(new.id);
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.hat_funktion(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null
     and (funktion_frei(auth.uid(), p_name) or (p_name = 'kalender_abo' and ist_privatkonto(auth.uid())))
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.heute()
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select (now() at time zone 'Europe/Berlin')::date;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.hinweis_gelesen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update hinweise set gelesen_am = now()
   where id = p_id and employee_id = auth_employee_id() and gelesen_am is null;
  if found then
    -- Schon gelesen: die geplante Mitteilung aufs Handy ist überflüssig.
    delete from push_warteschlange where tag = 'hinweis-' || p_id::text and gesendet_am is null;
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.hinweis_senden(p_empfaenger uuid[], p_text text, p_ziel text DEFAULT NULL::text, p_push text DEFAULT 'schicht'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich profiles;
  emp employees;
  neu hinweise;
  konto uuid;
  ab timestamptz;
  anzahl integer := 0;
  text_sauber text := btrim(coalesce(p_text, ''));
begin
  select * into ich from profiles where id = auth.uid() and active;
  if ich.id is null or ich.role not in ('shift_leader', 'admin') then
    raise exception 'Nur Schichtleitung oder Administration dürfen Hinweise schicken.';
  end if;
  if text_sauber = '' then
    raise exception 'Bitte einen Text eingeben.';
  end if;
  if char_length(text_sauber) > 300 then
    raise exception 'Der Hinweis darf höchstens 300 Zeichen lang sein.';
  end if;
  if p_ziel is not null and p_ziel not in ('/urlaub', '/meine-schichten', '/kalender', '/start') then
    raise exception 'Ungültiges Ziel.';
  end if;
  if coalesce(p_push, 'schicht') not in ('schicht', 'sofort', 'aus') then
    raise exception 'Ungültige Auswahl für die Mitteilung.';
  end if;
  if p_empfaenger is null or cardinality(p_empfaenger) = 0 then
    raise exception 'Bitte mindestens eine Person auswählen.';
  end if;
  if cardinality(p_empfaenger) > 200 then
    raise exception 'Höchstens 200 Personen auf einmal.';
  end if;

  delete from hinweise where company_id = ich.company_id and erstellt_am < now() - interval '90 days';

  for emp in select * from employees
              where id = any(p_empfaenger) and company_id = ich.company_id and active loop
    ab := case coalesce(p_push, 'schicht')
            when 'sofort' then now()
            when 'schicht' then naechste_arbeitszeit(emp.id)
            else null end;
    insert into hinweise (company_id, employee_id, von_profile, von_name, text, ziel, push, push_ab, zeigen_ab)
    values (ich.company_id, emp.id, ich.id,
            concat_ws(' ', ich.first_name, ich.last_name),
            text_sauber, p_ziel, coalesce(p_push, 'schicht'), ab,
            case when coalesce(p_push, 'schicht') = 'schicht' then ab end)
    returning * into neu;
    anzahl := anzahl + 1;

    if ab is not null then
      konto := konto_zu_mitarbeiter(emp.id);
      if konto is not null and exists (select 1 from push_abos where user_id = konto) then
        insert into push_warteschlange (user_id, art, titel, text, url, tag, senden_ab)
        values (konto, 'antraege', '💬 Hinweis von ' || coalesce(nullif(neu.von_name, ''), 'deiner Schichtleitung'),
                left(text_sauber, 300), coalesce(p_ziel, '/start'), 'hinweis-' || neu.id::text, ab);
      end if;
    end if;
  end loop;

  if anzahl = 0 then
    raise exception 'Keine der ausgewählten Personen gehört zu deinem Betrieb.';
  end if;
  return anzahl;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.hinweis_standard()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select cs.hinweis_standard from company_settings cs where cs.company_id = auth_company_id()), 'schicht')
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.hinweis_zurueckziehen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update hinweise set zurueckgezogen_am = now()
   where id = p_id and company_id = auth_company_id() and zurueckgezogen_am is null;
  if found then
    delete from push_warteschlange where tag = 'hinweis-' || p_id::text and gesendet_am is null;
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.hinweise_gesendet(p_limit integer DEFAULT 30)
 RETURNS TABLE(id uuid, employee_id uuid, empfaenger text, text text, ziel text, push text, push_ab timestamp with time zone, push_gesendet boolean, von_name text, erstellt_am timestamp with time zone, gelesen_am timestamp with time zone, zurueckgezogen_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  -- push_gesendet und gelesen_am bleiben in der Rückgabe (gleiche Form), sind
  -- aber immer leer: niemand in der Leitung sieht das Leseverhalten.
  return query
    select h.id, h.employee_id, concat_ws(' ', e.first_name, e.last_name), h.text, h.ziel, h.push, h.push_ab,
           false, h.von_name, h.erstellt_am, null::timestamptz, h.zurueckgezogen_am
      from hinweise h join employees e on e.id = h.employee_id
     where h.company_id = auth_company_id()
     order by h.erstellt_am desc
     limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.inaktiv_erledigt(p_employee_id uuid, p_abmelden boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  ziel uuid;
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select p.id into ziel from public.profiles p where p.employee_id = p_employee_id and p.company_id = firma limit 1;
  if ziel is null then
    raise exception 'Diese Person gibt es in deinem Betrieb nicht.';
  end if;
  if ziel = auth.uid() then
    raise exception 'Dich selbst kannst du hier nicht abmelden.';
  end if;
  if p_abmelden then
    delete from auth.refresh_tokens where user_id = ziel::text;
    delete from auth.sessions where user_id = ziel;
  end if;
  update public.profiles set inaktiv_geprueft_am = now() where id = ziel;
  perform public.write_audit(firma, case when p_abmelden then 'konto.abgemeldet' else 'konto.inaktiv_geprueft' end, 'profiles', ziel, null);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.inaktive_konten()
 RETURNS TABLE(employee_id uuid, name text, zuletzt timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  with akt as (
    select p.employee_id as emp, p.inaktiv_geprueft_am as geprueft,
           greatest(u.last_sign_in_at,
                    (select max(coalesce(s.refreshed_at, s.updated_at::timestamp, s.created_at::timestamp))::timestamptz
                       from auth.sessions s where s.user_id = p.id)) as zuletzt
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.company_id = firma and p.active and p.employee_id is not null and p.id <> auth.uid()
  )
  select a.emp, e.first_name || ' ' || e.last_name, a.zuletzt
    from akt a
    join public.employees e on e.id = a.emp
   where e.active
     and a.zuletzt is not null
     and a.zuletzt < now() - interval '6 months'
     and (a.geprueft is null or a.geprueft < a.zuletzt)
   order by a.zuletzt;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.inhaber_vorname(p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select split_part(btrim(k.name), ' ', 1) from privat_konten k where k.user_id = p_user),
    (select p.first_name from profiles p where p.id = p_user),
    '')
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ select auth_role() = 'admin'; $function$
;
-- @@
CREATE OR REPLACE FUNCTION public.is_employed_on(p_employee_id uuid, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select is_employed_on(e, p_date)
       from employees e
      where e.id = p_employee_id
        and e.company_id = auth_company_id()),
    false
  );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.is_employed_on(e employees, p_date date)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select (e.entry_date is null or p_date >= e.entry_date)
     and (e.exit_date  is null or p_date <= e.exit_date);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.is_leadership()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select auth_role() in ('shift_leader', 'admin');
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.is_planned_workday(p_employee_id uuid, p_date date)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
begin
  select * into e
    from employees
   where id = p_employee_id
     and company_id = auth_company_id();

  if e.id is null then
    return false;
  end if;

  if not is_employed_on(e, p_date) then
    return false;
  end if;

  if e.shift_worker and (e.shift_id is not null or e.rotation_pattern_id is not null) then
    return effective_shift_id(p_employee_id, p_date) is not null;
  end if;

  return extract(isodow from p_date) < 6
     and not exists (
       select 1 from holidays h
        where h.date = p_date
          and (h.company_id = e.company_id or h.company_id is null)
     );
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from platform_admins a where a.user_id = p_user_id);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.is_premium_day(p_employee_id uuid, p_date date)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  sname text;
begin
  select * into e
    from employees
   where id = p_employee_id
     and company_id = auth_company_id();

  if e.id is null then return false; end if;

  if extract(dow from p_date) = 0 then return true; end if;

  if exists (
    select 1 from holidays h
     where h.date = p_date
       and (h.company_id = e.company_id or h.company_id is null)
  ) then
    return true;
  end if;

  select s.name into sname
    from shifts s
   where s.id = effective_shift_id(p_employee_id, p_date)
     and s.company_id = e.company_id;

  return coalesce(sname ilike 'Nacht%', false);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.ist_gruppenmitglied(p_gruppe uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from kalender_gruppen_mitglieder where gruppe_id = p_gruppe and user_id = auth.uid())
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.ist_privatkonto(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_user is not null and exists (select 1 from privat_konten where user_id = p_user)
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.kalender_codes(p_user uuid, p_von date, p_tage integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  codes jsonb;
begin
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  if nur_privatkonto(p_user) then
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

  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  begin
    if auth_company_id() is distinct from firma then
      codes := '{}'::jsonb;
    else
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
    end if;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  return coalesce(codes, '{}'::jsonb);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.kalender_eigene_grenze()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_table_name = 'kalender_eigene_arten'
     and (select count(*) from kalender_eigene_arten where user_id = new.user_id) >= 30 then
    raise exception 'Höchstens 30 eigene Einträge.';
  end if;
  if tg_table_name = 'kalender_farben'
     and (select count(*) from kalender_farben where user_id = new.user_id) >= 60 then
    raise exception 'Zu viele Farben gespeichert.';
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.kalender_farben_codes(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  erg jsonb;
begin
  if nur_privatkonto(p_user) then
    select jsonb_object_agg(x.code, x.farbe) into erg
      from (select distinct on (privat_code(s.art, s.beginn)) privat_code(s.art, s.beginn) as code, s.farbe
              from privat_schichtarten s
             where s.user_id = p_user
             order by privat_code(s.art, s.beginn), s.reihenfolge) x;
  else
    select jsonb_object_agg(x.code, x.farbe) into erg
      from (select case f.schluessel
                     when 'schicht:F' then 'F' when 'schicht:S' then 'S' when 'schicht:N' then 'N'
                     when 'abw:U' then 'U' when 'frei' then 'X' end as code, f.farbe
              from kalender_farben f
             where f.user_id = p_user
               and f.schluessel in ('schicht:F', 'schicht:S', 'schicht:N', 'abw:U', 'frei')) x;
  end if;
  return coalesce(erg, '{}'::jsonb);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.kalender_gruppen_grenze()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if (select count(*) from kalender_gruppen_mitglieder where gruppe_id = new.gruppe_id) >= 20 then
    raise exception 'Diese Gruppe ist voll (höchstens 20 Personen).';
  end if;
  if (select count(*) from kalender_gruppen_mitglieder where user_id = new.user_id) >= 10 then
    raise exception 'Du bist schon in 10 Gruppen.';
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.kalender_nutzer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and (auth_employee_id() is not null or ist_privatkonto(auth.uid()))
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.kalender_personen_grenze()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if (select count(*) from kalender_personen where owner_id = new.owner_id) >= 20 then
    raise exception 'Du kannst höchstens 20 Personen einladen.';
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.konto_uebernommen(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select coalesce(
    (select nullif(u.encrypted_password, '') is not null from auth.users u where u.id = p_user),
    false
  );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.konto_zu_mitarbeiter(p_employee uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id from profiles p where p.employee_id = p_employee and p.active order by p.id limit 1
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_block_for_range(p_company_id uuid, p_shift_id uuid, p_start_date date, p_end_date date)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select r.value ->> 'reason'
  from staffing_rules r
  where r.company_id = p_company_id
    and r.key = 'urlaubssperre'
    and r.active
    and (r.shift_id is null or r.shift_id = p_shift_id)
    and (r.value ->> 'start')::date <= p_end_date
    and (r.value ->> 'end')::date >= p_start_date
  order by (r.shift_id is not null) desc
  limit 1;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_kind_code(p_kind leave_kind, p_genehmigt boolean)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case p_kind
    when 'urlaub'           then case when p_genehmigt then 'U'  else 'u'  end
    when 'v_tag'            then case when p_genehmigt then 'V'  else 'v'  end
    when 'altersfreizeit'   then case when p_genehmigt then 'AF' else 'af' end
    when 'sonderurlaub'     then case when p_genehmigt then 'SU' else 'su' end
    when 'bildungsurlaub'   then case when p_genehmigt then 'BU' else 'bu' end
    when 'gewerkschaftstag' then case when p_genehmigt then 'G'  else 'g'  end
  end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_kind_kontingent(p_employee_id uuid, p_kind leave_kind, p_year integer, p_ohne_antrag uuid DEFAULT NULL::uuid)
 RETURNS TABLE(anspruch numeric, verbraucht numeric, rest numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_anspruch numeric;
  v_verbraucht numeric;
  k record;
  geb date;
begin
  if p_kind in ('urlaub', 'v_tag') then
    raise exception 'Für Urlaub und V-Tage gilt das Urlaubskonto, nicht diese Funktion.';
  end if;

  if p_kind = 'altersfreizeit' then
    select * into k from af_konto(p_employee_id, p_ohne_antrag);
    return query select k.tage_erworben, k.genommen + k.beantragt, k.verfuegbar;
    return;
  end if;

  if p_kind = 'sonderurlaub' then
    geb := geburtsdatum_von(p_employee_id);
    if geb is not null and p_year - extract(year from geb)::int >= 56 then
      v_anspruch := company_rule_number('sonderurlaub_ab_55_tage', 'tage', 4);
    elsif coalesce((select e.sonderurlaub_erlaubt from employees e where e.id = p_employee_id), false) then
      v_anspruch := company_rule_number('sonderurlaub_tage_jahr', 'tage', 0);
    else
      v_anspruch := 0;
    end if;
  else
    v_anspruch := company_rule_number(p_kind::text || '_tage_jahr', 'tage', 0);
  end if;

  select count(*) into v_verbraucht
  from public.leave_requests r
  cross join lateral generate_series(r.start_date, r.end_date, interval '1 day') d
  where r.employee_id = p_employee_id
    and r.kind = p_kind
    and r.status in ('approved', 'pending')
    and r.id is distinct from p_ohne_antrag
    and extract(year from d)::int = p_year
    and is_planned_workday(p_employee_id, d::date);

  return query select v_anspruch, coalesce(v_verbraucht, 0), v_anspruch - coalesce(v_verbraucht, 0);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_kind_label(p_kind leave_kind)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case p_kind
    when 'urlaub'           then 'Urlaub'
    when 'v_tag'            then 'V-Tag'
    when 'altersfreizeit'   then 'Altersfreizeit'
    when 'sonderurlaub'     then 'Sonderurlaub'
    when 'bildungsurlaub'   then 'Bildungsurlaub'
    when 'gewerkschaftstag' then 'Gewerkschaftstag'
  end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_qualification_block_reason(p_employee_id uuid, p_start_date date, p_end_date date)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  emp employees;
  d date;
  s shifts;
  l record;
  luecken text[] := '{}';
  genannt text[] := '{}';
  quali text;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then
    return null;
  end if;
  if emp.company_id is distinct from auth_company_id()
     or (p_employee_id is distinct from auth_employee_id() and not is_leadership()) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 400 then
    return null;
  end if;

  d := p_start_date;
  while d <= p_end_date loop
    select sh.* into s
      from shifts sh
     where sh.id = effective_shift_id(p_employee_id, d)
       and sh.company_id = emp.company_id;

    if s.id is not null and shift_runs_on(s, d) then
      for l in
        select m.label, m.rang, m.benoetigt, o.besetzt as ohne_besetzt
          from public.qualifikation_besetzung(s.id, d, null, false, p_employee_id) m
          join public.qualifikation_besetzung(s.id, d, p_employee_id, false, null) o
            on o.qualification_id = m.qualification_id
         where o.fehlt > m.fehlt
         order by m.rang nulls last, m.label
      loop
        luecken := luecken || format('%s %s (%s benötigt, ohne dich %s)',
                                     to_char(d, 'DD.MM.YYYY'), s.name, l.benoetigt, l.ohne_besetzt);
        if not (l.label = any(genannt)) then
          genannt := genannt || l.label;
        end if;
      end loop;
    end if;

    d := d + 1;
  end loop;

  if cardinality(luecken) = 0 then
    return null;
  end if;

  select string_agg(q.label, ' und ' order by q.sort_order nulls last, q.label)
    into quali
    from qualifications q
   where q.company_id = emp.company_id and q.label = any(genannt);

  return format('Antrag nicht möglich – sonst ist nicht genug %s da: %s%s.',
                quali,
                array_to_string(luecken[1:3], '; '),
                case when cardinality(luecken) > 3
                     then format(' und an %s weiteren Tagen', cardinality(luecken) - 3)
                     else '' end);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_requests_check_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  block_reason text;
  emp employees;
begin
  select * into emp from employees where id = new.employee_id;
  -- Azubis zählen nicht zur Besetzung – für sie gilt keine Urlaubssperre.
  if coalesce(emp.is_apprentice, false) then
    return new;
  end if;
  select leave_block_for_range(new.company_id, emp.shift_id, new.start_date, new.end_date)
    into block_reason;
  if block_reason is not null then
    raise exception 'Für diesen Zeitraum gilt eine Urlaubssperre: %. Bei Fragen wende dich bitte an deine Schichtleitung.', rtrim(block_reason, '. ');
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_requests_check_kontingent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  jahr int;
  tage_im_jahr numeric;
  tage_gesamt numeric;
  v_rest numeric;
  v_anspruch numeric;
  bezeichnung text;
  darf boolean;
begin
  if new.kind in ('urlaub', 'v_tag') then
    return new;
  end if;
  if new.status not in ('pending', 'approved') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.kind = old.kind
     and new.start_date = old.start_date
     and new.end_date = old.end_date
     and new.status = old.status then
    return new;
  end if;

  bezeichnung := case new.kind
    when 'altersfreizeit'   then 'Altersfreizeit'
    when 'sonderurlaub'     then 'Sonderurlaub'
    when 'bildungsurlaub'   then 'Bildungsurlaub'
    when 'gewerkschaftstag' then 'Gewerkschaftstag'
    else new.kind::text end;

  if new.kind = 'bildungsurlaub' then
    select e.bildungsurlaub_erlaubt into darf from public.employees e where e.id = new.employee_id;
    if not coalesce(darf, false) then
      raise exception 'Bildungsurlaub ist für diese Person nicht freigegeben. Der Haken dafür steht in der Verwaltung.';
    end if;
  end if;

  if new.kind = 'altersfreizeit' then
    if (select e.af_ab from public.employees e where e.id = new.employee_id) is null then
      raise exception 'Altersfreizeit ist für diese Person nicht freigeschaltet – es ist noch kein Stundenstand eingetragen.';
    end if;
    select count(*) into tage_gesamt
      from generate_series(new.start_date, new.end_date, interval '1 day') d
     where is_planned_workday(new.employee_id, d::date);
    if tage_gesamt = 0 then
      return new;
    end if;
    select k.rest into v_rest
      from public.leave_kind_kontingent(new.employee_id, new.kind, extract(year from new.start_date)::int, new.id) k;
    if tage_gesamt > v_rest then
      raise exception 'Altersfreizeit: % Tag(e) beantragt, aber nur % Tag(e) verfügbar (je Tag 8 Stunden).',
        tage_gesamt::text, greatest(v_rest, 0)::text;
    end if;
    return new;
  end if;

  for jahr in
    select distinct extract(year from d)::int
    from generate_series(new.start_date, new.end_date, interval '1 day') d
    order by 1
  loop
    select count(*) into tage_im_jahr
    from generate_series(new.start_date, new.end_date, interval '1 day') d
    where extract(year from d)::int = jahr
      and is_planned_workday(new.employee_id, d::date);

    continue when tage_im_jahr = 0;

    select k.anspruch, k.rest into v_anspruch, v_rest
    from public.leave_kind_kontingent(new.employee_id, new.kind, jahr, new.id) k;

    if v_anspruch <= 0 then
      if new.kind = 'sonderurlaub' then
        raise exception 'Sonderurlaub gibt es ab dem Jahr nach dem 55. Geburtstag (4 Tage im Jahr). Für % besteht kein Anspruch.', jahr;
      end if;
      raise exception 'Für % sind im Jahr % keine Tage vorgesehen.', bezeichnung, jahr;
    end if;

    if tage_im_jahr > v_rest then
      raise exception '% im Jahr %: % Tag(e) beantragt, aber nur noch % von % Tag(en) übrig.',
        bezeichnung, jahr, tage_im_jahr::text, v_rest::text, v_anspruch::text;
    end if;
  end loop;

  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_requests_check_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  kollision leave_requests;
begin
  if new.status not in ('approved', 'pending') then
    return new;
  end if;

  -- Gleichzeitige Anträge derselben Person nacheinander prüfen (bis zum Ende der Transaktion).
  perform pg_advisory_xact_lock(hashtextextended('urlaub:' || new.employee_id::text, 0));

  select * into kollision
  from leave_requests r
  where r.employee_id = new.employee_id
    and r.id is distinct from new.id
    and r.status in ('approved', 'pending')
    and r.start_date <= new.end_date
    and r.end_date >= new.start_date
    and not (
      new.start_date = new.end_date
      and r.start_date = r.end_date
      and new.half_day_period is not null
      and r.half_day_period is not null
      and r.half_day_period is distinct from new.half_day_period
    )
  order by r.start_date
  limit 1;

  if kollision.id is not null then
    raise exception 'Für % bis % liegt bereits ein Antrag vor (% bis %, %). Bitte zuerst den bestehenden Antrag zurückziehen.',
      to_char(new.start_date, 'DD.MM.YYYY'),
      to_char(new.end_date, 'DD.MM.YYYY'),
      to_char(kollision.start_date, 'DD.MM.YYYY'),
      to_char(kollision.end_date, 'DD.MM.YYYY'),
      case kollision.status::text when 'approved' then 'genehmigt' else 'offen' end;
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_requests_check_qualifikation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  grund text;
begin
  if new.status <> 'pending' or new.employee_id is distinct from auth_employee_id() then
    return new;
  end if;

  grund := public.leave_qualification_block_reason(new.employee_id, new.start_date, new.end_date);
  if grund is not null then
    raise exception '%', grund;
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_requests_notify_leadership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  antragsteller text;
  firma text;
  zeitraum text;
  tage text;
  art text;
  per_mail boolean;
  gruppe rotation_team;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  -- Sammeleinreichung: der Hinweis kommt gebuendelt aus submit_leave_auto.
  if coalesce(current_setting('schichtplan.sammelantrag', true), '') = 'an' then
    return new;
  end if;

  select e.first_name || ' ' || e.last_name, e.rotation_team
    into antragsteller, gruppe
    from employees e where e.id = new.employee_id;

  art := leave_kind_label(new.kind);

  perform notify_leave_submitted(
    new.company_id, new.employee_id, new.id, antragsteller, gruppe,
    art, new.start_date, new.end_date, new.requested_days, new.reason
  );

  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_requests_ruecknahme_konsistent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.status is distinct from 'withdrawn' then
    new.withdrawn_at := null;
    new.withdrawn_by := null;
    new.withdrawal_reason := null;
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_requests_set_computed_days()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.end_date < new.start_date then
    raise exception 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  end if;

  new.requested_days := calculate_leave_days_for_employee(
    new.employee_id, new.start_date, new.end_date, new.half_day_period
  );
  new.half_day := new.half_day_period is not null;

  if new.requested_days <= 0 then
    raise exception 'In diesem Zeitraum hast du keinen eingeplanten Arbeitstag.';
  end if;

  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_requests_vj_setzen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.kind is distinct from 'v_tag' or extract(year from new.start_date) < 2027 then
    new.v_jahresplanung := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.kind = 'v_tag' and old.v_jahresplanung is not null
     and new.v_jahresplanung is null then
    new.v_jahresplanung := old.v_jahresplanung;
  end if;
  if new.v_jahresplanung is null then
    new.v_jahresplanung :=
      vj_rest(new.employee_id, extract(year from new.start_date)::int, new.id) >= coalesce(new.requested_days, 1);
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leave_staffing_detail(p_employee_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(tag date, shift_name text, present integer, target integer, minimum integer, status staffing_status, luecken jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  return query
  select i.date,
         s.name,
         i.present,
         i.target::int,
         i.minimum::int,
         i.status,
         coalesce(
           (select jsonb_agg(jsonb_build_object('label', m.label, 'fehlt', o.fehlt - m.fehlt)
                             order by m.rang nulls last, m.label)
              from public.qualifikation_besetzung(
                     effective_shift_id(p_employee_id, i.date), i.date, null, true, p_employee_id) m
              join public.qualifikation_besetzung(
                     effective_shift_id(p_employee_id, i.date), i.date, p_employee_id, true, null) o
                on o.qualification_id = m.qualification_id
             where o.fehlt > m.fehlt),
           '[]'::jsonb)
  from public.check_leave_staffing_impact(p_employee_id, p_start_date, p_end_date) i
  left join shifts s on s.id = effective_shift_id(p_employee_id, i.date)
  order by i.date;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.leitung_eigene_antraege_erlaubt()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select cs.leitung_eigene_antraege from company_settings cs where cs.company_id = auth_company_id()),
    false);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.lohnzettel_einwilligung(p_an boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.mail_versand_anstossen()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    begin
      -- Nichts im Postausgang: keinen Aufruf auslösen.
      if not exists (select 1 from email_outbox where status = 'offen' and versuche < 5) then
        return;
      end if;
      perform net.http_post(
        url := 'https://ehmphogahhqytscdwtla.supabase.co/functions/v1/mail-versand',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer OEFFENTLICHER_ANON_SCHLUESSEL'),
        body := '{}'::jsonb
      );
    end;
    $function$
;
-- @@
CREATE OR REPLACE FUNCTION public.mein_naechster_urlaub()
 RETURNS TABLE(von date, bis date, tage numeric, kalendertage integer, arten text[], offen boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  heute date := public.heute();
  r record;
  b_von date;
  b_bis date;
  b_tage numeric := 0;
  b_arten text[] := '{}';
  b_offen boolean := false;
  e_von date;
  e_bis date;
  luecke_frei boolean;
begin
  if me is null then
    return;
  end if;

  for r in
    select x.start_date, x.end_date, x.tage, x.art, x.status
      from (
        select lr.start_date, lr.end_date, lr.requested_days as tage,
               lr.kind::text as art, lr.status
          from leave_requests lr
         where lr.employee_id = me
           and lr.status in ('approved', 'pending')
           and lr.end_date >= heute - 62
        union all
        select a.date, a.date, 1::numeric, a.type::text, 'approved'::leave_status
          from absences a
         where a.employee_id = me
           and a.type in ('sonderurlaub', 'altersfreizeit', 'bildungsurlaub')
           and a.date >= heute - 62
           and not exists (select 1 from leave_requests lr
                            where lr.employee_id = me
                              and lr.status in ('approved', 'pending')
                              and a.date between lr.start_date and lr.end_date)
      ) x
     order by x.start_date
  loop
    if b_von is not null and r.start_date > b_bis + 1 then
      select not exists (
        select 1 from generate_series(b_bis + 1, r.start_date - 1, interval '1 day') g
         where is_planned_workday(me, g::date)
      ) into luecke_frei;

      if not luecke_frei then
        e_von := b_von;
        while e_von > b_von - 7 and not is_planned_workday(me, e_von - 1) loop
          e_von := e_von - 1;
        end loop;
        e_bis := b_bis;
        while e_bis < b_bis + 7 and not is_planned_workday(me, e_bis + 1) loop
          e_bis := e_bis + 1;
        end loop;
        if e_bis >= heute then
          return query select e_von, e_bis, b_tage, (e_bis - e_von + 1)::int, b_arten, b_offen;
          return;
        end if;
        b_von := null;
        b_tage := 0;
        b_arten := '{}';
        b_offen := false;
      end if;
    end if;

    if b_von is null then
      b_von := r.start_date;
      b_bis := r.end_date;
    else
      b_bis := greatest(b_bis, r.end_date);
    end if;
    b_tage := b_tage + coalesce(r.tage, 0);
    if not (r.art = any(b_arten)) then
      b_arten := b_arten || r.art;
    end if;
    b_offen := b_offen or r.status = 'pending';
  end loop;

  if b_von is null then
    return;
  end if;

  e_von := b_von;
  while e_von > b_von - 7 and not is_planned_workday(me, e_von - 1) loop
    e_von := e_von - 1;
  end loop;
  e_bis := b_bis;
  while e_bis < b_bis + 7 and not is_planned_workday(me, e_bis + 1) loop
    e_bis := e_bis + 1;
  end loop;

  if e_bis >= heute then
    return query select e_von, e_bis, b_tage, (e_bis - e_von + 1)::int, b_arten, b_offen;
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.mein_wiederherstellungscode()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or not exists (select 1 from auth.users where id = auth.uid()) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return _passwort_code_setzen(auth.uid(), 'privat', null);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.mein_wiederherstellungscode_stand()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select erstellt_am from passwort_codes
   where user_id = auth.uid() and art = 'privat' and (gueltig_bis is null or gueltig_bis > now())
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.mein_zugang_gesperrt()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from anmelde_sperren s
     where s.user_id = auth.uid() and s.gesperrt_am is not null
       and (s.gesperrt_am > now() - interval '15 minutes' or anmelde_sperre_dauerhaft(s.user_id)));
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_betriebsschichten(p_von date, p_bis date)
 RETURNS TABLE(tag date, name text, kuerzel text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  ab date := p_von;
  n int;
begin
  if firma is null or auth_employee_id() is null or p_von is null or p_bis is null then
    return;
  end if;
  if p_bis < p_von or p_bis - p_von > 400 then
    raise exception 'Zeitraum zu groß.';
  end if;
  while ab <= p_bis loop
    n := least(62, p_bis - ab + 1);
    return query
      select g.day,
             coalesce(g.shift_name, 'Frei'),
             case when g.shift_name is null then 'FREI' else g.shift_code end
        from shift_plan_grid(firma, ab, n) g
       where g.is_me
         and (g.absence_code is null or g.absence_code <> upper(g.absence_code));
    ab := ab + n;
  end loop;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_daten()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_emp uuid;
  v_firma uuid;
  v jsonb;
begin
  if v_uid is null then
    raise exception 'Bitte anmelden.' using errcode = '42501';
  end if;
  -- Ohne bestätigten zweiten Faktor oder bei Sperre: keine Herausgabe.
  if not zugang_ok() then
    raise exception 'Bitte zuerst vollständig anmelden.' using errcode = '42501';
  end if;

  select employee_id, company_id into v_emp, v_firma from profiles where id = v_uid;

  v := jsonb_build_object(
    'erstellt_am', now(),
    'hinweis', 'Kopie deiner bei ShiftNexo gespeicherten Daten (Art. 15 und 20 DSGVO). Zeiten in UTC.',
    'konto', (select jsonb_build_object(
                'id', u.id, 'email', u.email, 'angelegt_am', u.created_at,
                'letzte_anmeldung', u.last_sign_in_at, 'email_bestaetigt_am', u.email_confirmed_at,
                'zwei_faktor', (select coalesce(jsonb_agg(jsonb_build_object(
                    'art', f.factor_type, 'status', f.status, 'eingerichtet_am', f.created_at)), '[]'::jsonb)
                  from auth.mfa_factors f where f.user_id = u.id))
              from auth.users u where u.id = v_uid),
    'anmelde_sperre', (select to_jsonb(s) - 'user_id' from anmelde_sperren s where s.user_id = v_uid),

    -- Betrieb
    'profil', (select to_jsonb(p) from profiles p where p.id = v_uid),
    'firma', (select jsonb_build_object('id', c.id, 'name', c.name) from companies c where c.id = v_firma),
    'stammdaten', (select to_jsonb(e) from employees e where e.id = v_emp),
    'geburtsdatum', (select to_jsonb(d) - 'user_id' - 'company_id' from personal_details d where d.user_id = v_uid),
    'datenschutz_einstellungen', (select to_jsonb(x) - 'user_id' from privacy_settings x where x.user_id = v_uid),
    'anzeige_einstellungen', (select to_jsonb(x) - 'user_id' from anzeige_einstellungen x where x.user_id = v_uid),
    'qualifikationen', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id') from employee_qualifications x where x.employee_id = v_emp), '[]'::jsonb),
    'schichtplan', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id' order by x.date) from shift_assignments x where x.employee_id = v_emp), '[]'::jsonb),
    'urlaubsantraege', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from leave_requests x where x.employee_id = v_emp), '[]'::jsonb),
    'abwesenheiten', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from absences x where x.employee_id = v_emp), '[]'::jsonb),
    'urlaubskonten', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from leave_balances x where x.employee_id = v_emp), '[]'::jsonb),
    'altersfreizeit', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from age_leave_grants x where x.employee_id = v_emp), '[]'::jsonb),
    'fehlzeiten', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from fehlzeiten x where x.employee_id = v_emp), '[]'::jsonb),
    'ausbildung', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from training_assignments x where x.employee_id = v_emp), '[]'::jsonb),
    'plan_kommentare', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id' - 'autor_id') from plan_kommentare x where x.employee_id = v_emp), '[]'::jsonb),
    'vertretungsanfragen', coalesce((select jsonb_agg(to_jsonb(x) - 'company_id') from replacement_requests x
                                     where x.absent_employee_id = v_emp or x.asked_employee_id = v_emp), '[]'::jsonb),
    'benachrichtigungen', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id') from notifications x where x.employee_id = v_emp), '[]'::jsonb),
    'hinweise_an_mich', coalesce((select jsonb_agg(to_jsonb(x) - 'employee_id' - 'company_id' - 'von_profile') from hinweise x where x.employee_id = v_emp), '[]'::jsonb),
    'aenderungsprotokoll', coalesce((
      select jsonb_agg(jsonb_build_object(
               'zeit', l.created_at, 'aktion', l.action, 'bereich', l.entity,
               'von_mir', l.actor_id = v_uid, 'details', l.payload) order by l.created_at)
        from audit_logs l
       where l.company_id = v_firma
         and (l.actor_id = v_uid
              or l.entity_id in (v_uid, v_emp)
              or (v_emp is not null and l.payload ->> 'employee_id' = v_emp::text))), '[]'::jsonb),

    -- Privatbereich und Mein Kalender
    'privat_konto', (select to_jsonb(x) - 'user_id' from privat_konten x where x.user_id = v_uid),
    'privat_schichtarten', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from privat_schichtarten x where x.user_id = v_uid), '[]'::jsonb),
    'privat_tage', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.tag) from privat_tage x where x.user_id = v_uid), '[]'::jsonb),
    'privat_tag_zeiten', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from privat_tag_zeiten x where x.user_id = v_uid), '[]'::jsonb),
    'privat_umfrage', (select to_jsonb(x) - 'user_id' from privat_umfrage x where x.user_id = v_uid),
    'lohnabrechnungen', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'pfad') from privat_lohnzettel x where x.user_id = v_uid), '[]'::jsonb),
    'kalender_termine', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id' order by x.datum) from kalender_termine x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_termin_ausnahmen', coalesce((select jsonb_agg(to_jsonb(a)) from kalender_termin_ausnahmen a
                                          join kalender_termine t on t.id = a.termin_id where t.owner_id = v_uid), '[]'::jsonb),
    'kalender_todos', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id') from kalender_todos x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_eigene_tage', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from kalender_eigene_tage x where x.user_id = v_uid), '[]'::jsonb),
    'kalender_eigene_arten', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from kalender_eigene_arten x where x.user_id = v_uid), '[]'::jsonb),
    'kalender_farben', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from kalender_farben x where x.user_id = v_uid), '[]'::jsonb),
    'kalender_vorlieben', (select to_jsonb(x) - 'user_id' from kalender_vorlieben x where x.user_id = v_uid),
    'kalender_personen', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id') from kalender_personen x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_personen_tage', coalesce((select jsonb_agg(to_jsonb(t)) from kalender_personen_tage t
                                       join kalender_personen p on p.id = t.person_id where p.owner_id = v_uid), '[]'::jsonb),
    'kalender_partner_links', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id' - 'token_hash') from kalender_partner x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_partner_tage', coalesce((select jsonb_agg(to_jsonb(x) - 'owner_id') from kalender_partner_tage x where x.owner_id = v_uid), '[]'::jsonb),
    'kalender_verbindungen', coalesce((select jsonb_agg(to_jsonb(x)) from kalender_verbindungen x where v_uid in (x.a, x.b)), '[]'::jsonb),
    'kalender_gruppen', coalesce((select jsonb_agg(jsonb_build_object('name', g.name, 'beigetreten_am', m.beigetreten_am,
                                    'selbst_erstellt', g.erstellt_von = v_uid))
                                  from kalender_gruppen_mitglieder m join kalender_gruppen g on g.id = m.gruppe_id
                                 where m.user_id = v_uid), '[]'::jsonb),
    'kalender_abo', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'token_hash') from kalender_abo x where x.user_id = v_uid), '[]'::jsonb),

    -- Handy-Mitteilungen (ohne die technischen Schlüssel)
    'handy_mitteilungen_geraete', coalesce((select jsonb_agg(jsonb_build_object('geraet', x.geraet, 'erstellt_am', x.erstellt_am))
                                           from push_abos x where x.user_id = v_uid), '[]'::jsonb),
    'handy_mitteilungen_einstellungen', (select to_jsonb(x) - 'user_id' from push_vorlieben x where x.user_id = v_uid),
    'vertraute_geraete', coalesce((select jsonb_agg(jsonb_build_object('geraet', g.geraet, 'erstellt_am', g.erstellt_am,
                                    'zuletzt_am', g.zuletzt_am, 'gueltig_bis', g.bis))
                                  from vertraute_geraete g where g.user_id = v_uid), '[]'::jsonb)
  );

  return v;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_einladungen()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('person', c.person_id, 'bis', c.gueltig_bis))
      from kalender_verbindung_codes c
     where c.user_id = auth.uid() and c.person_id is not null and c.gueltig_bis > now()), '[]'::jsonb);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_geraete_vergessen()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from vertraute_geraete where user_id = auth.uid();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_gruppen()
 RETURNS TABLE(id uuid, name text, mitglieder integer, von_mir boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select g.id, g.name,
           (select count(*)::int from kalender_gruppen_mitglieder x where x.gruppe_id = g.id),
           g.erstellt_von = auth.uid()
      from kalender_gruppen g
      join kalender_gruppen_mitglieder m on m.gruppe_id = g.id and m.user_id = auth.uid()
     order by m.beigetreten_am;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_gruppen_tage(p_von date, p_tage integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m record;
  ich uuid := auth.uid();
  liste jsonb := '[]'::jsonb;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  for m in
    select x.user_id, jsonb_agg(x.gruppe_id) as gruppen
      from kalender_gruppen_mitglieder x
      join kalender_gruppen_mitglieder meine on meine.gruppe_id = x.gruppe_id and meine.user_id = ich
     where x.user_id <> ich
     group by x.user_id
  loop
    liste := liste || jsonb_build_array(jsonb_build_object(
      'id', m.user_id,
      'name', inhaber_vorname(m.user_id),
      'gruppen', m.gruppen,
      'tage', kalender_codes(m.user_id, p_von, p_tage),
      'farben', kalender_farben_codes(m.user_id)));
  end loop;
  return liste;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_hinweise()
 RETURNS TABLE(id uuid, text text, ziel text, von_name text, erstellt_am timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select h.id, h.text, h.ziel, h.von_name, h.erstellt_am
    from hinweise h
   where h.employee_id = auth_employee_id()
     and h.gelesen_am is null and h.zurueckgezogen_am is null
     and (h.zeigen_ab is null or h.zeigen_ab <= now())
   order by h.erstellt_am
   limit 10
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_partner_tage(p_von date, p_bis date)
 RETURNS TABLE(tag date, schicht text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_partner_tage_setzen(p_von date, p_anzahl integer, p_schicht text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_personen()
 RETURNS TABLE(id uuid, name text, art text, darf_eintragen boolean, termine_sehen boolean, link_aktiv boolean, link_erstellt_am timestamp with time zone, zuletzt_genutzt timestamp with time zone, erstellt_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_personen_tage(p_von date, p_bis date)
 RETURNS TABLE(person_id uuid, tag date, schicht text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_push_vorlieben()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select aus from push_vorlieben where user_id = auth.uid()), '{}')
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_stammdaten_setzen(p_personalnummer text, p_abteilung text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_emp uuid := auth_employee_id();
  v_firma uuid := auth_company_id();
  v_nr text := nullif(btrim(coalesce(p_personalnummer, '')), '');
  v_ab text := nullif(btrim(coalesce(p_abteilung, '')), '');
  alt employees;
begin
  if v_emp is null or v_firma is null then
    raise exception 'Dein Zugang ist keiner Person im Betrieb zugeordnet.';
  end if;
  if char_length(coalesce(v_nr, '')) > 30 then
    raise exception 'Die Personalnummer darf höchstens 30 Zeichen lang sein.';
  end if;
  if char_length(coalesce(v_ab, '')) > 80 then
    raise exception 'Die Abteilung darf höchstens 80 Zeichen lang sein.';
  end if;
  select * into alt from employees where id = v_emp and company_id = v_firma;
  if alt.id is null then
    raise exception 'Dein Zugang ist keiner Person im Betrieb zugeordnet.';
  end if;
  if v_nr is not null and exists (
    select 1 from employees where company_id = v_firma and personnel_number = v_nr and id <> v_emp
  ) then
    raise exception 'Diese Personalnummer ist im Betrieb schon vergeben. Bitte wende dich an die Administration.';
  end if;
  if alt.personnel_number is not distinct from v_nr and alt.department is not distinct from v_ab then
    return;
  end if;
  update employees set personnel_number = v_nr, department = v_ab where id = v_emp;
  perform write_audit(v_firma, 'stammdaten.selbst', 'employees', v_emp,
    jsonb_build_object(
      'personalnummer_vorher', alt.personnel_number, 'personalnummer_nachher', v_nr,
      'abteilung_vorher', alt.department, 'abteilung_nachher', v_ab));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_statistik_tage(p_jahr integer)
 RETURNS TABLE(tag date, schicht text, kuerzel text, abwesenheit text, stunden numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  ab date;
  bis date;
  n int;
  std numeric;
begin
  if firma is null or auth_employee_id() is null then
    return;
  end if;
  if p_jahr is null or p_jahr < 2000 or p_jahr > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  ab := make_date(p_jahr, 1, 1);
  bis := make_date(p_jahr, 12, 31);
  std := company_rule_number('stunden_pro_arbeitstag', 'stunden', 8);
  while ab <= bis loop
    n := least(62, bis - ab + 1);
    return query
      select g.day,
             g.shift_name,
             g.shift_code,
             -- nur genehmigte Abwesenheiten (Großbuchstaben); beantragte zählen nicht
             case when g.absence_code is not null and g.absence_code = upper(g.absence_code) then g.absence_code end,
             std
        from shift_plan_grid(firma, ab, n) g
       where g.is_me;
    ab := ab + n;
  end loop;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_termine()
 RETURNS TABLE(id uuid, von_partner boolean, person_id uuid, von_user uuid, datum date, bis_datum date, titel text, ganztaegig boolean, beginn text, ende text, wiederholung text, notiz text, ort text, erinnerung text, ausfaelle date[], serie_ab date, nur_privat boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select t.id, t.von_partner, t.person_id, t.von_user, t.datum, t.bis_datum, t.titel, t.ganztaegig,
           to_char(t.beginn, 'HH24:MI'), to_char(t.ende, 'HH24:MI'), t.wiederholung, t.notiz, t.ort, t.erinnerung,
           termin_ausfaelle(t.id), termin_serie_ab(t.id), t.nur_privat
      from kalender_termine t
     where t.owner_id = auth.uid()
     order by t.datum;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_todos()
 RETURNS TABLE(id uuid, titel text, datum date, uhrzeit text, erledigt boolean, erledigt_am timestamp with time zone, nur_privat boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  -- Erledigtes nur noch 14 Tage lang.
  return query
    select t.id, t.titel, t.datum, to_char(t.uhrzeit, 'HH24:MI'), t.erledigt, t.erledigt_am, t.nur_privat
      from kalender_todos t
     where t.owner_id = auth.uid()
       and (not t.erledigt or t.erledigt_am > now() - interval '14 days')
     order by t.erledigt, t.datum nulls last, t.uhrzeit nulls last, t.erstellt_am;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_verbindungen()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.meine_vorlieben()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v kalender_vorlieben;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into v from kalender_vorlieben where user_id = auth.uid();
  return jsonb_build_object(
    'rollen', coalesce(to_jsonb(v.rollen), '[]'::jsonb),
    'vorlagen', coalesce(v.vorlagen, '[]'::jsonb),
    'gefragt', coalesce(v.gefragt, false));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.mitarbeiter_endgueltig_loeschen(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  e employees;
  zugaenge uuid[];
  mit_privat uuid[];
  antraege uuid[];
  n_zugang int := 0;
  z uuid;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Personen löschen.';
  end if;

  select * into e from employees
   where id = p_employee_id and company_id = v_firma
   for update;
  if e.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if e.active then
    raise exception 'Bitte die Person zuerst deaktivieren. Erst danach lässt sie sich endgültig löschen.';
  end if;

  select coalesce(array_agg(p.id), '{}') into zugaenge
    from profiles p
   where p.company_id = v_firma
     and (p.employee_id = e.id
          or (p.employee_id is null and e.email is not null
              and lower(p.email) = lower(e.email)));

  if auth.uid() = any(zugaenge) then
    raise exception 'Du kannst dich nicht selbst löschen.';
  end if;

  -- Wer einen Privatbereich hat, behält Login und Privatbereich. Eigene Einträge
  -- gehen vorher dorthin, falls das beim Austritt noch nicht geschehen ist.
  select coalesce(array_agg(k.user_id), '{}') into mit_privat
    from privat_konten k where k.user_id = any(zugaenge);
  foreach z in array mit_privat loop
    if (select austritt_uebernommen_am is null from profiles where id = z) then
      perform _eigene_eintraege_nach_privat(z);
    end if;
  end loop;

  select coalesce(array_agg(r.id), '{}') into antraege
    from leave_requests r where r.employee_id = e.id;

  delete from notifications n
   where n.company_id = v_firma and n.related_id = any(antraege);
  delete from email_outbox o
   where o.company_id = v_firma
     and (o.related_id = any(antraege)
          or (e.email is not null and lower(o.empfaenger) = lower(e.email)));

  delete from replacement_requests
   where company_id = v_firma and absent_employee_id = e.id;

  delete from employees where id = e.id;

  delete from auth.users u where u.id = any(zugaenge) and not (u.id = any(mit_privat));
  get diagnostics n_zugang = row_count;
  -- Betriebsdaten am Login, der bleibt.
  delete from personal_details where user_id = any(mit_privat);
  delete from privacy_settings where user_id = any(mit_privat);
  delete from profiles where id = any(zugaenge);

  perform write_audit(v_firma, 'employee.deleted', 'employees', e.id,
                      jsonb_build_object('vollstaendig', true, 'zugaenge', n_zugang));

  return jsonb_build_object('zugaenge', n_zugang);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_af_konto()
 RETURNS TABLE(freigeschaltet_ab date, start_stunden numeric, arbeitstage integer, stunden_angespart numeric, genommen numeric, beantragt numeric, verplant numeric, stand_stunden numeric, verfuegbar numeric, rest_stunden numeric, tage_erworben numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  return query select * from af_konto(me);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_age_leave(p_year integer)
 RETURNS TABLE(alter_im_jahr integer, automatisch_moeglich boolean, vorschlag_tage numeric, bestaetigt boolean, bestaetigte_tage numeric, bestaetigt_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ich uuid := auth_employee_id();
  v_firma uuid := auth_company_id();
  v_gebdat date;
begin
  if v_ich is null or v_firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  select pd.birth_date into v_gebdat
  from public.personal_details pd
  where pd.user_id = auth.uid() and pd.company_id = v_firma;

  return query
  select h.alter_im_jahr, h.moeglich, h.vorschlag_tage,
         (g.id is not null), coalesce(g.confirmed_days, 0), g.confirmed_at
  from public.age_leave_hinweis(v_gebdat, p_year) h
  left join public.age_leave_grants g
    on g.employee_id = v_ich and g.year = p_year and g.company_id = v_firma;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_leave_balance(p_year integer DEFAULT NULL::integer)
 RETURNS TABLE(jahr integer, anspruch numeric, uebertrag numeric, genommen numeric, verplant numeric, beantragt numeric, rest numeric, v_anspruch numeric, v_uebertrag numeric, v_genommen numeric, v_beantragt numeric, v_rest numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  y int := coalesce(p_year, extract(year from public.heute())::int);
begin
  if me is null then return; end if;
  perform ensure_leave_balance(me, y);

  return query
  select v.year::int, v.entitlement, v.carried_over, v.used_days,
         v.planned_days, v.pending_days, v.remaining_days,
         v.v_entitlement, v.v_carried_over, v.v_used_days,
         v.v_pending_days, v.v_remaining_days
    from leave_balances_view v
   where v.employee_id = me and v.year = y;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_leave_kind_quotas(p_year integer)
 RETURNS TABLE(kind leave_kind, anspruch numeric, verbraucht numeric, rest numeric, erlaubt boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  e employees;
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  select * into e from public.employees where id = me;

  return query
  select a.art,
         k.anspruch, k.verbraucht, k.rest,
         (k.anspruch > 0
          and (a.art <> 'bildungsurlaub' or coalesce(e.bildungsurlaub_erlaubt, false))
          and (a.art <> 'altersfreizeit' or e.af_ab is not null)) as erlaubt
  from (values
    ('altersfreizeit'::leave_kind),
    ('sonderurlaub'::leave_kind),
    ('bildungsurlaub'::leave_kind),
    ('gewerkschaftstag'::leave_kind)
  ) as a(art)
  cross join lateral public.leave_kind_kontingent(me, a.art, p_year) k;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_leave_reviewers()
 RETURNS TABLE(request_id uuid, reviewer_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, p.first_name || ' ' || p.last_name
    from leave_requests r
    join profiles p on p.id = r.reviewed_by
   where r.employee_id = auth_employee_id()
     and r.company_id = auth_company_id()
     and r.reviewed_by is not null;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_leave_withdrawers()
 RETURNS TABLE(request_id uuid, withdrawer_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, p.first_name || ' ' || p.last_name
    from leave_requests r
    join profiles p on p.id = r.withdrawn_by
   where r.employee_id = auth_employee_id()
     and r.company_id = auth_company_id()
     and r.withdrawn_by is not null;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_shift_leave(p_from date, p_to date)
 RETURNS TABLE(employee_id uuid, employee_name text, start_date date, end_date date, status leave_status, is_me boolean, reason_visible boolean, kind leave_kind)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  meine_firma uuid := auth_company_id();
  fuehrung boolean := is_leadership();
  freigabe boolean := gruende_fuer_kollegen_erlaubt();
  my_shift uuid;
  my_pattern uuid;
begin
  if me is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  select e.shift_id, e.rotation_pattern_id into my_shift, my_pattern
  from employees e where e.id = me;

  return query
  with roh as (
    select
      r.employee_id as emp_id,
      e.first_name || ' ' || e.last_name as emp_name,
      r.start_date as von,
      r.end_date as bis,
      r.status as stand,
      (r.employee_id = me) as ich,
      e.last_name as nachname,
      r.kind as art,
      public.team_sicht(r.employee_id) as frei,
      case
        when r.employee_id = me then true
        when fuehrung then true
        when not freigabe then false
        else exists (
          select 1
          from public.profiles sp
          join public.privacy_settings ps on ps.user_id = sp.id
          where sp.employee_id = r.employee_id
            and sp.company_id = meine_firma
            and ps.company_id = meine_firma
            and ps.absence_visibility = 'shift'
        )
      end as grund
    from leave_requests r
    join employees e on e.id = r.employee_id
    where e.company_id = meine_firma
      and e.active
      and r.status in ('approved', 'pending')
      and r.start_date <= p_to
      and r.end_date >= p_from
      and (
        (my_shift is not null and e.shift_id = my_shift)
        or (my_pattern is not null and e.rotation_pattern_id = my_pattern)
        or r.employee_id = me
      )
  ),
  sichtbar as (
    select roh.*, (roh.grund and roh.frei) as grund_sichtbar from roh
  )
  select case when frei then emp_id else md5(me::text || ':' || emp_id::text)::uuid end,
         case when frei then emp_name end,
         von, bis, stand, ich, grund_sichtbar,
         case when grund_sichtbar then art else null end
  from sichtbar
  where grund_sichtbar or stand = 'approved'
  order by von, (not frei), case when frei then nachname end;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_shift_plan(p_from date, p_days integer)
 RETURNS TABLE(date date, shift_id uuid, shift_name text, start_time time without time zone, end_time time without time zone, is_free boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
begin
  if me is null then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 120 then
    raise exception 'Zeitraum zu gross.';
  end if;

  return query
  select gs.day::date, s.id, s.name, s.start_time, s.end_time, (s.id is null)
  from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as gs(day)
  left join shifts s on s.id = effective_shift_id(me, gs.day::date)
  order by gs.day;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.my_v_konto()
 RETURNS TABLE(stichtag date, start_stunden numeric, arbeitstage integer, angespart numeric, genommen numeric, beantragt numeric, verplant numeric, stand_heute numeric, noch_moeglich numeric, rest_stunden numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  return query
  select k.stichtag, k.start_stunden, k.arbeitstage, k.angespart, k.genommen, k.beantragt,
         k.verplant, k.stand_heute, k.noch_moeglich, k.rest_stunden
    from stundenkonto(me, 'v') k;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.naechste_arbeitszeit(p_employee uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  jetzt timestamptz := now();
  heute date := (now() at time zone 'Europe/Berlin')::date;
  d date;
  sid uuid;
  s shifts;
  beginn timestamptz;
  ende timestamptz;
  gefunden boolean := false;
begin
  for i in -1..14 loop
    d := heute + i;
    sid := effective_shift_id(p_employee, d);
    continue when sid is null;
    gefunden := true;
    select * into s from shifts where id = sid;
    continue when s.id is null or s.start_time is null or s.end_time is null;
    continue when not schicht_laeuft_fuer(p_employee, d, s);
    continue when exists (select 1 from leave_requests l
                           where l.employee_id = p_employee and l.status = 'approved'
                             and d between l.start_date and l.end_date);
    continue when exists (select 1 from absences a where a.employee_id = p_employee and a.date = d);
    beginn := (d + s.start_time) at time zone 'Europe/Berlin';
    ende := (d + s.end_time) at time zone 'Europe/Berlin';
    if ende <= beginn then
      ende := ende + interval '1 day';
    end if;
    if jetzt >= beginn and jetzt < ende then
      return jetzt;
    end if;
    if beginn > jetzt then
      return beginn + interval '15 minutes';
    end if;
  end loop;

  if gefunden then
    -- Schichten, aber keine passende in den nächsten 14 Tagen: beim Öffnen reicht.
    return null;
  end if;

  -- Ohne Schichtplan: Werktage 8–16 Uhr.
  for i in 0..7 loop
    d := heute + i;
    continue when extract(isodow from d) > 5;
    beginn := (d + time '08:00') at time zone 'Europe/Berlin';
    ende := (d + time '16:00') at time zone 'Europe/Berlin';
    if jetzt >= beginn and jetzt < ende then
      return jetzt;
    end if;
    if beginn > jetzt then
      return beginn;
    end if;
  end loop;
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.notify_leave_submitted(p_company_id uuid, p_employee_id uuid, p_request_id uuid, p_antragsteller text, p_gruppe rotation_team, p_art text, p_von date, p_bis date, p_tage numeric, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  zeitraum text;
  per_mail boolean;
begin
  zeitraum := case
    when p_von = p_bis then to_char(p_von, 'DD.MM.YYYY')
    else to_char(p_von, 'DD.MM.YYYY') || ' bis ' || to_char(p_bis, 'DD.MM.YYYY')
  end;

  -- Glocke in der App: nur an die Zuständigen.
  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    p_company_id, p.employee_id,
    'leave_submitted', 'Neuer Antrag: ' || p_art,
    p_antragsteller || ' hat ' || p_art || ' beantragt: ' || zeitraum || '.',
    'leave_requests', p_request_id
  from profiles p
  join employees pe on pe.id = p.employee_id
  where p.company_id = p_company_id
    and p.active
    and p.employee_id is distinct from p_employee_id
    and (
      p.role = 'admin'
      or (p.role = 'shift_leader'
          and (p_gruppe is null or pe.rotation_team is null or pe.rotation_team = p_gruppe))
    );

  select coalesce(s.notify_leave_email, true) into per_mail
    from company_settings s where s.company_id = p_company_id;
  if not coalesce(per_mail, true) then
    return;
  end if;

  -- Mail: nur ein Hinweis, keine Inhalte.
  insert into email_outbox (company_id, empfaenger, betreff, text_teil, html_teil, anlass, related_id)
  select
    p_company_id,
    p.email,
    'Neuer Antrag in ShiftNexo',
    'Hallo,' || chr(10) || chr(10) ||
      'in ShiftNexo wartet ein neuer Antrag auf deine Entscheidung.' || chr(10) ||
      'Bitte öffne die App: https://shiftnexo.de/urlaub' || chr(10) || chr(10) ||
      'Aus Datenschutzgründen stehen keine Einzelheiten in dieser E-Mail.',
    '<p>Hallo,</p>' ||
      '<p>in ShiftNexo wartet ein neuer Antrag auf deine Entscheidung.</p>' ||
      '<p><a href="https://shiftnexo.de/urlaub">ShiftNexo öffnen</a></p>' ||
      '<p style="color:#6b7280;font-size:12px">Aus Datenschutzgründen stehen keine Einzelheiten in dieser E-Mail.</p>',
    'urlaubsantrag',
    p_request_id
  from profiles p
  join employees pe on pe.id = p.employee_id
  where p.company_id = p_company_id
    and p.active
    and p.email is not null
    and p.email <> ''
    and p.employee_id is distinct from p_employee_id
    and (
      p.role = 'admin'
      or (p.role = 'shift_leader'
          and (p_gruppe is null or pe.rotation_team is null or pe.rotation_team = p_gruppe))
    );
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.nur_privatkonto(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ist_privatkonto(p_user)
     and not exists (select 1 from profiles p where p.id = p_user and p.active and p.employee_id is not null)
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.papierkorb_leeren()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  n int := 0;
begin
  for c in select id from companies where not is_demo and geloescht_am < now() - interval '14 days' limit 20 loop
    begin
      perform firma_endgueltig_loeschen(c.id);
      n := n + 1;
    exception when others then
      null;
    end;
  end loop;
  return n;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_einladen(p_termine_teilen boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_einladung_status()
 RETURNS TABLE(aktiv boolean, erstellt_am timestamp with time zone, zuletzt_genutzt timestamp with time zone, termine_teilen boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select true, k.link_erstellt_am, k.zuletzt_genutzt, k.termine_sehen
    from kalender_personen k
   where k.id = partner_person() and k.token_hash is not null
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_inhaber(p_token text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (person_zum_link(p_token)).owner_id
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_kalender(p_token text, p_von date, p_tage integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
           'notiz', t.notiz, 'ort', t.ort,
           'ausfaelle', to_jsonb(termin_ausfaelle(t.id)), 'serieAb', termin_serie_ab(t.id)) order by t.datum), '[]'::jsonb)
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
           'farben', kalender_farben_codes(person.owner_id),
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_link_beenden()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update kalender_personen set token_hash = null where owner_id = auth.uid() and art = 'partner'
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_person()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from kalender_personen where owner_id = auth.uid() and art = 'partner' order by erstellt_am limit 1
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_tage_setzen(p_token text, p_von date, p_anzahl integer, p_schicht text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_termin_loeschen(p_token text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  person kalender_personen := person_zum_link(p_token);
begin
  if person.id is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  delete from kalender_termine where id = p_id and owner_id = person.owner_id and person_id = person.id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_termin_speichern(p_token text, p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.partner_termine_teilen(p_an boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update kalender_personen set termine_sehen = coalesce(p_an, false) where id = partner_person()
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.passwort_code_einloesen(p_email text, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  ziel uuid;
  z passwort_codes%rowtype;
  versuche integer;
begin
  select id into ziel from auth.users where lower(email) = lower(btrim(p_email));
  if ziel is null then
    return jsonb_build_object('status', 'falsch');
  end if;
  -- Zeile sperren, damit zwei gleichzeitige Versuche nicht beide durchrutschen.
  update passwort_codes set fehlversuche = fehlversuche where user_id = ziel returning * into z;
  if z.user_id is null or (z.gueltig_bis is not null and z.gueltig_bis <= now()) then
    return jsonb_build_object('status', 'falsch');
  end if;
  if z.gesperrt_bis is not null and z.gesperrt_bis > now() then
    return jsonb_build_object('status', 'gesperrt');
  end if;
  if z.code_hash <> _passwort_code_hash(p_code) then
    versuche := z.fehlversuche + 1;
    if versuche >= 5 then
      update passwort_codes set fehlversuche = 0, gesperrt_bis = now() + interval '15 minutes' where user_id = ziel;
      return jsonb_build_object('status', 'gesperrt');
    end if;
    update passwort_codes set fehlversuche = versuche where user_id = ziel;
    return jsonb_build_object('status', 'falsch');
  end if;
  -- Eingelöst: der Code gilt nie wieder (kein Hash passt auf „-“).
  update passwort_codes set code_hash = '-', gueltig_bis = now(), fehlversuche = 0 where user_id = ziel;
  return jsonb_build_object('status', 'ok', 'user_id', ziel);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.passwort_code_fuer_mitarbeiter(p_employee uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich_rolle app_role;
  ich_firma uuid;
  ziel_rolle app_role;
  ziel_firma uuid;
  ziel_user uuid;
begin
  select role, company_id into ich_rolle, ich_firma
  from profiles where id = auth.uid() and active;
  if ich_rolle is null or ich_rolle not in ('admin', 'shift_leader') then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  select role, company_id into ziel_rolle, ziel_firma from employees where id = p_employee;
  if ziel_firma is null or ziel_firma <> ich_firma then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if ich_rolle = 'shift_leader' and ziel_rolle <> 'employee' then
    raise exception 'Für Schichtleitung und Administration erzeugt nur die Administration einen Code.';
  end if;

  select id into ziel_user from profiles where employee_id = p_employee and company_id = ich_firma;
  if ziel_user is null then
    raise exception 'Diese Person hat noch keinen Zugang. Lade sie zuerst ein.';
  end if;
  if ziel_user = auth.uid() then
    raise exception 'Dein eigenes Passwort änderst du im Profil.';
  end if;

  -- Konten mit Privatbereich: nie ein Code von der Führung (dort liegen private Daten).
  if ist_privatkonto(ziel_user) and konto_uebernommen(ziel_user) then
    raise exception 'Diese Person nutzt auch den Privatbereich. Dafür gibt es keinen Code von der Verwaltung. Sie nimmt ihren eigenen Wiederherstellungs-Code (Profil bzw. „Mehr“); ohne Code hilft der Support.';
  end if;

  perform write_audit(ich_firma, 'zugang.code', 'employees', p_employee, '{}'::jsonb);

  -- Die Person erfährt es: Benachrichtigung in der App (sichtbar, sobald sie sich anmeldet).
  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (ich_firma, p_employee, 'zugang_code', 'Passwort-Code für dein Konto erzeugt',
          'Die Verwaltung hat am ' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI')
          || ' einen Einmal-Code zum Zurücksetzen deines Passworts erzeugt. Dein eigener Wiederherstellungs-Code gilt dadurch nicht mehr. Warst du das nicht? Ändere dein Passwort und melde dich bei der Administration.',
          'employees', p_employee);

  return _passwort_code_setzen(ziel_user, 'leitung', interval '24 hours');
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_aendern(p_id uuid, p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_anlegen(p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_entfernen(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from kalender_personen where id = p_id and owner_id = auth.uid()
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_link_beenden(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update kalender_personen set token_hash = null where id = p_id and owner_id = auth.uid()
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_link_neu(p_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_tage_schreiben(p_person uuid, p_von date, p_anzahl integer, p_schicht text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_tage_setzen(p_id uuid, p_von date, p_anzahl integer, p_schicht text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if not exists (select 1 from kalender_personen where id = p_id and owner_id = auth.uid()) then
    raise exception 'Diese Person gibt es nicht mehr.';
  end if;
  perform person_tage_schreiben(p_id, p_von, p_anzahl, p_schicht);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_tage_uebernehmen(p_person uuid, p_ziel uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.person_zum_link(p_token text)
 RETURNS kalender_personen
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select k.*
    from kalender_personen k
   where length(coalesce(p_token, '')) between 32 and 128
     and k.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and (exists (select 1 from profiles p where p.id = k.owner_id and p.active and p.employee_id is not null)
          or ist_privatkonto(k.owner_id))
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.personal_details_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin boolean;
  v_emp uuid;
begin
  if auth.uid() is null then
    return new;
  end if;
  v_admin := is_admin() and new.company_id = auth_company_id();
  if not v_admin then
    if new.user_id is distinct from auth.uid()
       or new.company_id is distinct from auth_company_id() then
      raise exception 'Du darfst nur deine eigenen persönlichen Angaben ändern.';
    end if;
    if tg_op = 'INSERT' then
      new.birth_date_bestaetigt := new.birth_date is null;
    elsif new.birth_date is distinct from old.birth_date then
      new.birth_date_bestaetigt := new.birth_date is null;
      select employee_id into v_emp from profiles where id = new.user_id;
      perform write_audit(new.company_id, 'personal_details.birth_date_selbst', 'employees', v_emp,
        jsonb_build_object('vorher', old.birth_date, 'nachher', new.birth_date));
    else
      new.birth_date_bestaetigt := old.birth_date_bestaetigt;
    end if;
  elsif tg_op = 'INSERT' or new.birth_date is distinct from old.birth_date then
    new.birth_date_bestaetigt := true;
  end if;
  new.updated_at := now();
  if new.birth_date is not null and new.birth_date > public.heute() then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
  end if;
  if new.birth_date is not null and new.birth_date < public.heute() - interval '120 years' then
    raise exception 'Bitte ein gültiges Geburtsdatum eingeben.';
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.plan_kommentar_vorbereiten()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  name text;
begin
  if firma is null or auth.uid() is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  if not exists (
    select 1 from employees e where e.id = new.employee_id and e.company_id = firma
  ) then
    raise exception 'Diese Person gehört nicht zu deinem Unternehmen.';
  end if;

  select btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
    into name
    from profiles p
   where p.id = auth.uid();

  new.company_id := firma;
  new.autor_id := auth.uid();
  new.autor_name := coalesce(nullif(name, ''), 'Unbekannt');
  new.text := btrim(new.text);
  new.created_at := now();
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.plan_set_shift(p_employee_id uuid, p_date date, p_shift_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  target_shift shifts;
  r leave_requests;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;

  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_shift_id is not null then
    select * into target_shift from shifts where id = p_shift_id;
    if target_shift.id is null then
      raise exception 'Schicht nicht gefunden.';
    end if;
    if target_shift.company_id is distinct from e.company_id then
      raise exception 'Mitarbeiter und Schicht gehören zu unterschiedlichen Unternehmen.';
    end if;
  end if;

  loop
    select * into r
      from leave_requests
     where employee_id = p_employee_id
       and status in ('approved', 'pending')
       and p_date between start_date and end_date
     order by start_date
     limit 1;
    exit when r.id is null;
    perform split_leave_request_day(r, p_date, null);
  end loop;

  delete from absences where employee_id = p_employee_id and date = p_date;

  insert into shift_assignments (company_id, employee_id, shift_id, date)
  values (e.company_id, p_employee_id, p_shift_id, p_date)
  on conflict (employee_id, date) do update set shift_id = excluded.shift_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_darf_aendern(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from platform_admins a where a.user_id = p_user_id and not a.nur_lesen);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_dashboard(p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  with echte as (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at
      from auth.users u
     where not exists (
       select 1 from profiles p join companies c on c.id = p.company_id
        where p.id = u.id and c.is_demo)
  ),
  neu as (
    select e.email, e.created_at, e.last_sign_in_at, e.email_confirmed_at is not null as bestaetigt,
           case when k.user_id is not null and p.id is not null then 'beide'
                when k.user_id is not null then 'privat'
                when p.id is not null then 'firma'
                else 'ohne' end as art,
           c.name as firma
      from echte e
      left join privat_konten k on k.user_id = e.id
      left join profiles p on p.id = e.id
      left join companies c on c.id = p.company_id
     order by e.created_at desc
     limit greatest(1, least(coalesce(p_limit, 30), 200))
  )
  select jsonb_build_object(
    'konten', (select count(*) from echte),
    'neu_heute', (select count(*) from echte where created_at >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'),
    'neu_7', (select count(*) from echte where created_at >= now() - interval '7 days'),
    'neu_30', (select count(*) from echte where created_at >= now() - interval '30 days'),
    'privat', (select count(*) from privat_konten k join echte e on e.id = k.user_id),
    'firma', (select count(*) from profiles p join echte e on e.id = p.id),
    'beide', (select count(*) from privat_konten k join profiles p on p.id = k.user_id join echte e on e.id = k.user_id),
    'angemeldet_24h', (select count(*) from echte where last_sign_in_at >= now() - interval '24 hours'),
    'angemeldet_7', (select count(*) from echte where last_sign_in_at >= now() - interval '7 days'),
    'neu', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from neu n), '[]'::jsonb),
    'summen', jsonb_build_object(
      'firmen', (select count(*) from companies where not is_demo),
      'mitarbeiter', (select count(*) from employees e join companies c on c.id = e.company_id where e.active and not c.is_demo),
      'plan_eintraege', (select count(*) from shift_assignments a join companies c on c.id = a.company_id where not c.is_demo),
      'urlaubsantraege', (select count(*) from leave_requests r join companies c on c.id = r.company_id where not c.is_demo),
      'offene_antraege', (select count(*) from leave_requests r join companies c on c.id = r.company_id where r.status = 'pending' and not c.is_demo),
      'privat_tage', (select count(*) from privat_tage),
      'eigene_tage', (select count(*) from kalender_eigene_tage),
      'termine', (select count(*) from kalender_termine),
      'todos', (select count(*) from kalender_todos),
      'personen', (select count(*) from kalender_personen),
      'verbindungen', (select count(*) from kalender_verbindungen),
      'gruppen', (select count(*) from kalender_gruppen)
    )
  );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_notfall_merken()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into plattform_protokoll (aktion, art) values ('notfallzugang', 'geoeffnet');
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_notfall_zugriffe()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(z.am order by z.am desc), '[]'::jsonb)
    from (select am from plattform_protokoll where aktion = 'notfallzugang' order by am desc limit 20) z;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_nutzer_id(p_email text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_nutzung()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v jsonb;
begin
  insert into plattform_tageszahlen (tag, konten, privat, aktiv_7, aktiv_30, privat_aktiv_7)
  select v_heute,
         count(*),
         count(*) filter (where rein_privat),
         count(*) filter (where last_sign_in_at >= now() - interval '7 days'),
         count(*) filter (where last_sign_in_at >= now() - interval '30 days'),
         count(*) filter (where rein_privat and last_sign_in_at >= now() - interval '7 days')
    from (
      select u.last_sign_in_at,
             exists (select 1 from privat_konten k where k.user_id = u.id)
               and not exists (select 1 from profiles p where p.id = u.id) as rein_privat
        from auth.users u
       where not exists (
         select 1 from profiles p join companies c on c.id = p.company_id
          where p.id = u.id and c.is_demo)
    ) e
  on conflict (tag) do update
     set konten = excluded.konten, privat = excluded.privat, aktiv_7 = excluded.aktiv_7,
         aktiv_30 = excluded.aktiv_30, privat_aktiv_7 = excluded.privat_aktiv_7;

  with echte as (
    select u.id, u.created_at, u.last_sign_in_at,
           exists (select 1 from profiles p where p.id = u.id) as betrieb
      from auth.users u
     where not exists (
       select 1 from profiles p join companies c on c.id = p.company_id
        where p.id = u.id and c.is_demo)
  ),
  pr as (
    select e.id, e.created_at, e.last_sign_in_at
      from echte e join privat_konten k on k.user_id = e.id
     where not e.betrieb
  ),
  wochen as (
    select g::date as woche,
           (select count(*) from echte e where not e.betrieb
              and date_trunc('week', e.created_at at time zone 'Europe/Berlin') = g) as privat,
           (select count(*) from echte e where e.betrieb
              and date_trunc('week', e.created_at at time zone 'Europe/Berlin') = g) as betrieb
      from generate_series(
             date_trunc('week', now() at time zone 'Europe/Berlin') - interval '11 weeks',
             date_trunc('week', now() at time zone 'Europe/Berlin'),
             interval '1 week') g
  )
  select jsonb_build_object(
    'wochen', (select jsonb_agg(to_jsonb(w) order by w.woche) from wochen w),
    'verlauf', coalesce((select jsonb_agg(to_jsonb(t) order by t.tag)
                           from plattform_tageszahlen t where t.tag >= v_heute - 60), '[]'::jsonb),
    'privat', jsonb_build_object(
      'konten', (select count(*) from pr),
      'aktiv_7', (select count(*) from pr where last_sign_in_at >= now() - interval '7 days'),
      'aktiv_30', (select count(*) from pr where last_sign_in_at >= now() - interval '30 days'),
      'mit_schichten', (select count(*) from pr where exists (
          select 1 from privat_tage t where t.user_id = pr.id and t.tag >= v_heute - 30)),
      'plant_voraus', (select count(*) from pr where exists (
          select 1 from privat_tage t where t.user_id = pr.id and t.tag > v_heute)),
      'wiederkehr_basis', (select count(*) from pr where created_at <= now() - interval '14 days'),
      'wiederkehr', (select count(*) from pr where created_at <= now() - interval '14 days'
                       and last_sign_in_at >= created_at + interval '7 days'),
      'funktionen', jsonb_build_object(
        'schichtarten', (select count(*) from pr where exists (select 1 from privat_schichtarten s where s.user_id = pr.id)),
        'termine', (select count(*) from pr where exists (select 1 from kalender_termine t where t.owner_id = pr.id)),
        'todos', (select count(*) from pr where exists (select 1 from kalender_todos t where t.owner_id = pr.id)),
        'teilen', (select count(*) from pr where exists (select 1 from kalender_verbindungen v where v.a = pr.id or v.b = pr.id)
                     or exists (select 1 from kalender_personen kp where kp.owner_id = pr.id)),
        'kalender_abo', (select count(*) from pr where exists (select 1 from kalender_abo a where a.user_id = pr.id and a.beendet_am is null)),
        'push', (select count(*) from pr where exists (select 1 from push_abos a where a.user_id = pr.id))
      )
    ),
    'technik', jsonb_build_object(
      'push_gesendet_24h', (select count(*) from push_warteschlange where gesendet_am >= now() - interval '24 hours'),
      'push_haengt', (select count(*) from push_warteschlange
                       where gesendet_am is null and coalesce(senden_ab, erstellt_am) < now() - interval '1 hour'),
      'mail_fehler_7', (select count(*) from email_outbox
                         where letzter_fehler is not null and gesendet_at is null and created_at >= now() - interval '7 days')
    )
  ) into v;
  return v;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_overview()
 RETURNS TABLE(company_id uuid, name text, angelegt_am timestamp with time zone, aktiv boolean, avv_akzeptiert_am timestamp with time zone, einrichtung_fertig_am timestamp with time zone, mitarbeiter_aktiv bigint, zugaenge bigint, letzte_aktivitaet timestamp with time zone, urlaubsantraege bigint, offene_antraege bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.id,
    c.name,
    c.created_at,
    c.active,
    c.avv_accepted_at,
    c.setup_completed_at,
    (select count(*) from employees e where e.company_id = c.id and e.active),
    (select count(*) from profiles p where p.company_id = c.id and p.active),
    (select max(u.last_sign_in_at) from profiles p
       join auth.users u on u.id = p.id
      where p.company_id = c.id),
    (select count(*) from leave_requests r where r.company_id = c.id),
    (select count(*) from leave_requests r where r.company_id = c.id and r.status = 'pending')
  from companies c where not c.is_demo
  order by c.created_at;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_protokoll_liste(p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('am', z.am, 'aktion', z.aktion, 'art', z.art, 'wer', z.email) order by z.am desc), '[]'::jsonb)
    from (
      select p.am, p.aktion, p.art, u.email
        from plattform_protokoll p
        left join auth.users u on u.id = p.wer
       order by p.am desc
       limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) z;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_sperren()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'email', u.email,
           'seit', s.gesperrt_am,
           'firma', c.name)
         order by s.gesperrt_am desc), '[]'::jsonb)
    from anmelde_sperren s
    join auth.users u on u.id = s.user_id
    left join profiles p on p.id = s.user_id and p.active
    left join companies c on c.id = p.company_id
   where s.gesperrt_am is not null
     and (s.gesperrt_am > now() - interval '15 minutes' or p.id is not null);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_team()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', a.user_id,
           'email', u.email,
           'nur_lesen', a.nur_lesen,
           'notiz', a.notiz,
           'seit', a.created_at,
           'zuletzt', u.last_sign_in_at,
           'zwei_faktor', exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified')
         ) order by a.created_at), '[]'::jsonb)
    from platform_admins a
    join auth.users u on u.id = a.user_id;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_umfrage()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with b as (select * from privat_umfrage where not uebersprungen)
  select jsonb_build_object(
    'antworten', (select count(*) from b),
    'uebersprungen', (select count(*) from privat_umfrage where uebersprungen),
    'durchschnitt', (select round(avg(zufriedenheit)::numeric, 1) from b where zufriedenheit is not null),
    'zufriedenheit', coalesce((select jsonb_object_agg(zufriedenheit, n) from (
        select zufriedenheit, count(*) n from b where zufriedenheit is not null group by 1) z), '{}'::jsonb),
    'quellen', coalesce((select jsonb_object_agg(quelle, n) from (
        select quelle, count(*) n from b where quelle is not null group by 1) q), '{}'::jsonb),
    'texte', coalesce((select jsonb_agg(jsonb_build_object(
        'text', t.verbesserung, 'zufriedenheit', t.zufriedenheit, 'tag', (t.erstellt_am at time zone 'Europe/Berlin')::date)
        order by t.erstellt_am desc)
      from (select * from b where verbesserung is not null order by erstellt_am desc limit 100) t), '[]'::jsonb)
  );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.platform_zugang(p_email text, p_aktion text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    return false;
  end if;
  if p_aktion = 'entsperren' then
    delete from anmelde_sperren where user_id = v_user;
  elsif p_aktion = 'zwei_faktor' then
    delete from auth.mfa_factors where user_id = v_user;
    delete from vertraute_geraete where user_id = v_user;
  else
    raise exception 'Unbekannte Aktion.' using errcode = '22023';
  end if;
  return true;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.plattform_firma_papierkorb(p_company uuid, p_in boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not exists (select 1 from companies c where c.id = p_company and not c.is_demo) then
    raise exception 'Firma nicht gefunden.';
  end if;
  if p_in and exists (select 1 from profiles p join platform_admins a on a.user_id = p.id where p.company_id = p_company) then
    raise exception 'Diese Firma enthält ein Betreiber-Konto und kann nicht gelöscht werden.';
  end if;

  update companies set geloescht_am = case when p_in then now() else null end where id = p_company;
  update auth.users u
     set banned_until = case when p_in then 'infinity'::timestamptz else null end
   where u.id in (select p.id from profiles p where p.company_id = p_company);

  insert into plattform_protokoll (aktion, art) values (case when p_in then 'papierkorb' else 'zurueckgeholt' end, 'firma');
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.plattform_loeschliste()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select jsonb_build_object(
    'firmen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'angelegt_am', c.created_at,
        'geloescht_am', c.geloescht_am,
        'endgueltig_am', c.geloescht_am + interval '14 days',
        'mitarbeiter', (select count(*) from employees e where e.company_id = c.id),
        'zugaenge', (select count(*) from profiles p where p.company_id = c.id),
        'plan_eintraege', (select count(*) from shift_assignments s where s.company_id = c.id),
        'urlaubsantraege', (select count(*) from leave_requests r where r.company_id = c.id),
        'betreiber', exists (select 1 from profiles p join platform_admins a on a.user_id = p.id where p.company_id = c.id)
      ) order by c.geloescht_am nulls first, c.created_at)
      from companies c where not c.is_demo
    ), '[]'::jsonb),
    'privat', coalesce((
      select jsonb_agg(x order by x->>'erstellt_am' desc) from (
        select jsonb_build_object(
          'user_id', k.user_id,
          'name', k.name,
          'erstellt_am', k.erstellt_am,
          'letzter_login', u.last_sign_in_at,
          'betreiber', exists (select 1 from platform_admins a where a.user_id = k.user_id)
        ) x
        from privat_konten k join auth.users u on u.id = k.user_id
        order by k.erstellt_am desc limit 500
      ) t
    ), '[]'::jsonb)
  );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.plattform_passwort_code(p_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  ziel uuid;
begin
  select u.id into ziel from auth.users u
   where lower(u.email) = lower(btrim(p_email)) and ist_privatkonto(u.id);
  if ziel is null then
    select k.user_id into ziel from privat_konten k
     where lower(k.kontakt_email) = lower(btrim(p_email))
     limit 1;
  end if;
  if ziel is null then
    raise exception 'Kein Privatkonto mit diesem Spitznamen oder dieser Adresse.';
  end if;
  return _passwort_code_setzen(ziel, 'support', interval '24 hours');
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.preview_leave_auto(p_start_date date, p_end_date date)
 RETURNS TABLE(tag date, art text, grund text, vj boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  e employees;
  d date;
  k leave_kind;
  warum text;
  jahr int;
  idx int;
  jahre int[] := '{}';
  ru numeric[] := '{}';
  rv numeric[] := '{}';
  rvj numeric[] := '{}';
  ist_vj boolean;
begin
  if me is null then return; end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 366 then return; end if;

  select * into e from employees where id = me;

  for jahr in
    select distinct extract(year from g)::int
      from generate_series(p_start_date, p_end_date, '1 day') g
     order by 1
  loop
    perform ensure_leave_balance(me, jahr);
    jahre := jahre || jahr;
    ru := ru || coalesce(
      (select remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || v_tage_rest(me, jahr);
    rvj := rvj || case when jahr >= 2027 then vj_rest(me, jahr) else 0 end;
  end loop;

  for d in select g::date from generate_series(p_start_date, p_end_date, '1 day') g loop
    continue when not is_planned_workday(me, d);
    continue when exists (
      select 1 from leave_requests r
       where r.employee_id = me and r.status in ('approved', 'pending')
         and d between r.start_date and r.end_date
    );

    idx := array_position(jahre, extract(year from d)::int);

    if not e.shift_worker then
      k := 'urlaub'; warum := 'kein Schichtsystem';
    elsif exists (select 1 from holidays h where h.date = d
                    and (h.company_id = e.company_id or h.company_id is null)) then
      k := 'urlaub'; warum := 'Feiertag';
    elsif extract(dow from d) = 0 then
      k := 'urlaub'; warum := 'Sonntag';
    elsif (select s.name from shifts s where s.id = effective_shift_id(me, d)) ilike 'Nacht%' then
      k := 'urlaub'; warum := 'Nachtschicht';
    else
      k := 'v_tag'; warum := 'kein Zuschlagstag';
    end if;

    if k = 'urlaub' and ru[idx] < 1 then
      k := 'v_tag';
      warum := case when rv[idx] >= 1 then 'Urlaub aufgebraucht' else 'Konten leer – V-Tag ins Minus' end;
    elsif k = 'v_tag' and rv[idx] < 1 and ru[idx] >= 1 then
      k := 'urlaub'; warum := 'V-Tage aufgebraucht';
    elsif k = 'v_tag' and rv[idx] < 1 then
      warum := 'Konten leer – V-Tag ins Minus';
    end if;

    ist_vj := null;
    if k = 'urlaub' then
      ru[idx] := ru[idx] - 1;
    else
      rv[idx] := rv[idx] - 1;
      if extract(year from d) >= 2027 then
        ist_vj := rvj[idx] >= 1;
        if ist_vj then rvj[idx] := rvj[idx] - 1;
        else warum := warum || ' · VJ aufgebraucht'; end if;
      end if;
    end if;

    return query select d, k::text, warum, ist_vj;
  end loop;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privacy_settings_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_payload jsonb := '{}'::jsonb;
begin
  if tg_op = 'UPDATE' then
    if old.absence_visibility is distinct from new.absence_visibility then
      v_payload := v_payload || jsonb_build_object('absence_visibility', jsonb_build_array(old.absence_visibility, new.absence_visibility));
    end if;
    if old.sickness_visibility is distinct from new.sickness_visibility then
      v_payload := v_payload || jsonb_build_object('sickness_visibility', jsonb_build_array(old.sickness_visibility, new.sickness_visibility));
    end if;
    if old.privacy_notice_version is distinct from new.privacy_notice_version then
      v_payload := v_payload || jsonb_build_object('privacy_notice_version', new.privacy_notice_version);
    end if;
    perform public.write_audit(new.company_id, 'privacy.settings.changed', 'privacy_settings', new.user_id, nullif(v_payload, '{}'::jsonb));
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privacy_settings_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_user_id uuid := auth.uid();
  current_company uuid := auth_company_id();
begin
  if current_user_id is null then
    return new;
  end if;

  if current_company is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  if new.user_id is distinct from current_user_id then
    raise exception 'Du darfst nur deine eigenen Datenschutzeinstellungen ändern.';
  end if;

  if new.company_id is distinct from current_company then
    raise exception 'Ungültige Unternehmenszuordnung.';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();

    if old.absence_visibility = 'minimal' and new.absence_visibility = 'shift' then
      new.absence_granted_at := now();
    end if;
    if old.absence_visibility = 'shift' and new.absence_visibility = 'minimal' then
      new.absence_revoked_at := now();
    end if;

    if old.sickness_visibility = 'private' and new.sickness_visibility = 'shift' then
      new.sickness_granted_at := now();
    end if;
    if old.sickness_visibility = 'shift' and new.sickness_visibility = 'private' then
      new.sickness_revoked_at := now();
    end if;
  end if;

  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_code(p_art text, p_beginn time without time zone)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
           when p_art in ('urlaub', 'krank') then 'U'
           when p_art = 'frei' then 'X'
           when p_beginn is null then 'T'
           when extract(hour from p_beginn) between 4 and 10 then 'F'
           when extract(hour from p_beginn) between 11 and 18 then 'S'
           else 'N'
         end
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_feiertage(p_jahr integer)
 RETURNS TABLE(tag date, name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  land text;
begin
  select k.bundesland into land from privat_konten k where k.user_id = auth.uid();
  if land is null or p_jahr < 2000 or p_jahr > 2100 then
    return;
  end if;
  return query select h.tag, h.bezeichnung from german_holidays(p_jahr, land) h order by h.tag;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_konto_anlegen(p_user uuid, p_name text, p_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from profiles where id = p_user) then
    raise exception 'Dieses Konto gehört bereits zu einem Unternehmen.';
  end if;
  insert into privat_konten (user_id, name, datenschutz_version)
  values (p_user, btrim(p_name), p_version)
  on conflict (user_id) do nothing;
  if not exists (select 1 from privat_schichtarten where user_id = p_user) then
    insert into privat_schichtarten (user_id, name, kuerzel, farbe, art, beginn, ende, stunden, reihenfolge) values
      (p_user, 'Früh',   'F', '#F5A524', 'arbeit', '06:00', '14:00', 8, 1),
      (p_user, 'Spät',   'S', '#22A06B', 'arbeit', '14:00', '22:00', 8, 2),
      (p_user, 'Nacht',  'N', '#2F6FDE', 'arbeit', '22:00', '06:00', 8, 3),
      (p_user, 'Frei',   'X', '#E5484D', 'frei',   null,    null,    0, 4),
      (p_user, 'Urlaub', 'U', '#9B59D0', 'urlaub', null,    null,    8, 5),
      (p_user, 'Krank',  'K', '#F76B15', 'krank',  null,    null,    8, 6);
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_lohnzettel_grenze()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (select count(*) from privat_lohnzettel where user_id = new.user_id) >= 300 then
    raise exception 'Höchstens 300 Lohnabrechnungen.';
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_lohnzettel_weg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into lohnzettel_aufraeumen (pfad) values (old.pfad) on conflict do nothing;
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_neuigkeiten_gelesen()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update privat_konten set neuigkeiten_gesehen = now() where user_id = auth.uid()
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_rotation_anwenden(p_start date, p_bis date, p_muster uuid[], p_ueberschreiben boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich uuid := auth.uid();
  laenge integer := coalesce(array_length(p_muster, 1), 0);
  anzahl integer;
begin
  if not ist_privatkonto(ich) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if laenge < 1 or laenge > 56 then
    raise exception 'Das Muster muss 1 bis 56 Tage lang sein.';
  end if;
  if p_start is null or p_bis is null or p_bis < p_start or p_bis - p_start > 1470 then
    raise exception 'Bitte einen Zeitraum von höchstens vier Jahren wählen.';
  end if;
  if exists (select 1 from unnest(p_muster) m
              where m is not null
                and not exists (select 1 from privat_schichtarten s where s.id = m and s.user_id = ich)) then
    raise exception 'Unbekannte Schichtart im Muster.';
  end if;

  if p_ueberschreiben then
    delete from privat_tage
     where user_id = ich and ebene = 1 and tag between p_start and p_bis
       and p_muster[((tag - p_start) % laenge) + 1] is null;
  end if;

  insert into privat_tage (user_id, tag, ebene, schichtart_id)
  select ich, d::date, 1, p_muster[(((d::date) - p_start) % laenge) + 1]
    from generate_series(p_start, p_bis, interval '1 day') d
   where p_muster[(((d::date) - p_start) % laenge) + 1] is not null
  on conflict (user_id, tag, ebene) do update
     set schichtart_id = excluded.schichtart_id
   where p_ueberschreiben;
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_schichtarten_grenze()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (select count(*) from privat_schichtarten where user_id = new.user_id) >= 30 then
    raise exception 'Höchstens 30 Schichtarten.';
  end if;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_tag_zeiten_aufraeumen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and new.schichtart_id = old.schichtart_id and new.tag = old.tag then
    return null;
  end if;
  delete from privat_tag_zeiten z
   where z.user_id = old.user_id
     and z.tag = old.tag
     and z.schichtart_id = old.schichtart_id
     and not exists (
       select 1 from privat_tage t
        where t.user_id = old.user_id and t.tag = old.tag and t.schichtart_id = old.schichtart_id
     );
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_umfrage_offen()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
           select 1 from privat_konten k
            where k.user_id = auth.uid()
              and k.erstellt_am <= now() - interval '3 days')
     and not exists (select 1 from privat_umfrage u where u.user_id = auth.uid());
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_umfrage_senden(p_quelle text DEFAULT NULL::text, p_zufriedenheit integer DEFAULT NULL::integer, p_verbesserung text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_text text := nullif(btrim(coalesce(p_verbesserung, '')), '');
begin
  if auth.uid() is null or not exists (select 1 from privat_konten where user_id = auth.uid()) then
    raise exception 'Kein Privatbereich.' using errcode = '42501';
  end if;
  insert into privat_umfrage (user_id, quelle, zufriedenheit, verbesserung, uebersprungen)
  values (
    auth.uid(),
    p_quelle,
    p_zufriedenheit,
    left(v_text, 1000),
    p_quelle is null and p_zufriedenheit is null and v_text is null
  )
  on conflict (user_id) do nothing;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privat_weitermachen(p_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p profiles;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null or p.active then
    raise exception 'Das geht nur, wenn dein Zugang zum Betrieb beendet ist.';
  end if;
  if p.austritt_uebernommen_am is not null then
    return;
  end if;
  perform _privat_konto_sicherstellen(p.id, p.first_name, left(coalesce(p_version, ''), 20));
  perform _eigene_eintraege_nach_privat(p.id);
  update profiles set austritt_uebernommen_am = now() where id = p.id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.privatbereich_einrichten(p_version text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p profiles;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null or not p.active then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if exists (select 1 from companies c where c.id = p.company_id and c.is_demo) then
    raise exception 'In der Live-Demo gibt es keinen Privatbereich.';
  end if;
  perform _privat_konto_sicherstellen(p.id, p.first_name, left(coalesce(p_version, ''), 20));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.profil_aus_einladung(p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  u auth.users;
  meta jsonb;
  ziel employees;
begin
  select * into u from auth.users where id = p_user;
  if u.id is null or u.invited_at is null then
    return false;
  end if;
  meta := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  if not (meta ? 'employee_id') then
    return false;
  end if;
  if exists (select 1 from profiles where id = u.id) then
    return true;
  end if;

  select * into ziel
    from employees
   where id = nullif(meta ->> 'employee_id', '')::uuid
     and email is not null
     and lower(email) = lower(u.email);
  if ziel.id is null or ziel.active is not true then
    return false;
  end if;
  -- Hat dieser Mitarbeiter schon einen anderen Zugang, bleibt es dabei.
  if exists (select 1 from profiles where employee_id = ziel.id) then
    return false;
  end if;

  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
  values (
    u.id,
    ziel.company_id,
    ziel.id,
    coalesce(nullif(meta ->> 'first_name', ''), ziel.first_name),
    coalesce(nullif(meta ->> 'last_name', ''),  ziel.last_name),
    u.email,
    ziel.role
  )
  on conflict (id) do nothing;
  return true;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.profil_nachholen()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    return false;
  end if;
  if not exists (
    select 1 from auth.users
     where id = ich and invited_at is not null and invited_at > now() - interval '14 days'
  ) then
    return false;
  end if;
  return public.profil_aus_einladung(ich);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.profiles_guard_self_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.id = auth.uid() and not is_admin() then
    if new.employee_id is distinct from old.employee_id then
      raise exception 'Die Mitarbeiterzuordnung darf nicht selbst geändert werden.';
    end if;
    if new.company_id is distinct from old.company_id then
      raise exception 'Die Unternehmenszuordnung darf nicht selbst geändert werden.';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Die Rolle darf nicht selbst geändert werden.';
    end if;
    if new.active is distinct from old.active then
      raise exception 'Der Aktivstatus darf nicht selbst geändert werden.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Die E-Mail-Adresse darf nicht selbst geändert werden.';
    end if;
  end if;

  if new.avatar_url is not null and new.avatar_url !~* '^https?://' then
    raise exception 'Profilbild-URLs müssen mit http:// oder https:// beginnen.';
  end if;

  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.protokoll_aenderung()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a jsonb;
  n jsonb;
  felder jsonb := '{}'::jsonb;
  feld text;
begin
  if tg_op <> 'INSERT' then a := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;

  if tg_table_name = 'leave_requests' then
    if tg_op = 'INSERT' then
      perform protokoll_schreiben((n->>'company_id')::uuid,
        case when n->>'status' = 'approved' then 'urlaub.eingetragen' else 'urlaub.beantragt' end,
        'leave_requests', (n->>'id')::uuid,
        jsonb_build_object('employee_id', n->'employee_id', 'von', n->'start_date', 'bis', n->'end_date',
                           'art', n->'kind', 'tage', n->'requested_days', 'status', n->'status'));
    elsif tg_op = 'UPDATE' then
      if a->'start_date' is distinct from n->'start_date' or a->'end_date' is distinct from n->'end_date' then
        perform protokoll_schreiben((n->>'company_id')::uuid, 'urlaub.geaendert', 'leave_requests', (n->>'id')::uuid,
          jsonb_build_object('employee_id', n->'employee_id', 'von_vorher', a->'start_date', 'bis_vorher', a->'end_date',
                             'von', n->'start_date', 'bis', n->'end_date', 'art', n->'kind'));
      end if;
    else
      perform protokoll_schreiben((a->>'company_id')::uuid, 'urlaub.geloescht', 'leave_requests', (a->>'id')::uuid,
        jsonb_build_object('employee_id', a->'employee_id', 'von', a->'start_date', 'bis', a->'end_date',
                           'art', a->'kind', 'status', a->'status'));
    end if;

  elsif tg_table_name = 'shift_assignments' then
    if tg_op = 'DELETE' then
      perform protokoll_schreiben((a->>'company_id')::uuid, 'plan.schicht_entfernt', 'shift_assignments', (a->>'id')::uuid,
        jsonb_build_object('employee_id', a->'employee_id', 'tag', a->'date',
          'schicht', (select s.name from shifts s where s.id = (a->>'shift_id')::uuid)));
    elsif tg_op = 'INSERT' or a->'shift_id' is distinct from n->'shift_id' then
      perform protokoll_schreiben((n->>'company_id')::uuid, 'plan.schicht', 'shift_assignments', (n->>'id')::uuid,
        jsonb_build_object('employee_id', n->'employee_id', 'tag', n->'date',
          'schicht', coalesce((select s.name from shifts s where s.id = (n->>'shift_id')::uuid), 'Frei'),
          'vorher', case when tg_op = 'UPDATE'
                         then coalesce((select s.name from shifts s where s.id = (a->>'shift_id')::uuid), 'Frei') end));
    end if;

  elsif tg_table_name = 'plan_kommentare' then
    if tg_op = 'INSERT' then
      perform protokoll_schreiben((n->>'company_id')::uuid, 'kommentar.geschrieben', 'plan_kommentare', (n->>'id')::uuid,
        jsonb_build_object('employee_id', n->'employee_id', 'tag', n->'tag'));
    elsif tg_op = 'DELETE' then
      perform protokoll_schreiben((a->>'company_id')::uuid, 'kommentar.geloescht', 'plan_kommentare', (a->>'id')::uuid,
        jsonb_build_object('employee_id', a->'employee_id', 'tag', a->'tag'));
    end if;

  elsif tg_table_name = 'leave_balances' then
    if tg_op = 'UPDATE' then
      foreach feld in array array['entitlement', 'carried_over', 'v_entitlement', 'v_carried_over'] loop
        if a->feld is distinct from n->feld then
          felder := felder || jsonb_build_object(feld, jsonb_build_array(a->feld, n->feld));
        end if;
      end loop;
      if felder <> '{}'::jsonb then
        perform protokoll_schreiben((n->>'company_id')::uuid, 'konto.geaendert', 'leave_balances', (n->>'id')::uuid,
          jsonb_build_object('employee_id', n->'employee_id', 'jahr', n->'year', 'felder', felder));
      end if;
    end if;

  elsif tg_table_name = 'announcements' then
    if tg_op = 'INSERT' then
      perform protokoll_schreiben((n->>'company_id')::uuid, 'mitteilung.erstellt', 'announcements', (n->>'id')::uuid,
        jsonb_build_object('titel', n->'title'));
    elsif tg_op = 'UPDATE' then
      if a->'title' is distinct from n->'title' or a->'body' is distinct from n->'body' or a->'active' is distinct from n->'active' then
        perform protokoll_schreiben((n->>'company_id')::uuid, 'mitteilung.geaendert', 'announcements', (n->>'id')::uuid,
          jsonb_build_object('titel', n->'title', 'aktiv', n->'active'));
      end if;
    else
      perform protokoll_schreiben((a->>'company_id')::uuid, 'mitteilung.geloescht', 'announcements', (a->>'id')::uuid,
        jsonb_build_object('titel', a->'title'));
    end if;

  elsif tg_table_name = 'staffing_rules' then
    if coalesce(n, a)->>'key' = 'urlaubssperre' then
      if tg_op = 'UPDATE' and a->'value' is not distinct from n->'value' and a->'active' is not distinct from n->'active' then
        return null;
      end if;
      perform protokoll_schreiben((coalesce(n, a)->>'company_id')::uuid,
        case tg_op when 'INSERT' then 'sperre.erstellt' when 'UPDATE' then 'sperre.geaendert' else 'sperre.geloescht' end,
        'staffing_rules', (coalesce(n, a)->>'id')::uuid,
        jsonb_build_object('von', coalesce(n, a)->'value'->'start', 'bis', coalesce(n, a)->'value'->'end',
                           'grund', coalesce(n, a)->'value'->'reason', 'aktiv', coalesce(n, a)->'active'));
    elsif tg_op <> 'UPDATE' or a->'value' is distinct from n->'value' or a->'active' is distinct from n->'active' then
      perform protokoll_schreiben((coalesce(n, a)->>'company_id')::uuid, 'regel.geaendert', 'staffing_rules',
        (coalesce(n, a)->>'id')::uuid, jsonb_build_object('regel', coalesce(n, a)->'key'));
    end if;
  end if;

  return null;
exception when others then
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.protokoll_fehlanmeldung(p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid;
begin
  select p.company_id into firma
    from profiles p
   where lower(p.email) = lower(trim(p_email))
   limit 1;
  if firma is null then
    return;
  end if;
  perform protokoll_schreiben(firma, 'anmeldung.fehlgeschlagen', null, null,
    jsonb_build_object('email', left(lower(trim(p_email)), 200)));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.protokoll_firma()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select z.company_id
    from protokoll_zugang z
    join profiles p on p.id = z.user_id
   where z.user_id = auth.uid()
     and p.active
     and p.role = 'admin'
     and p.company_id = z.company_id;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.protokoll_liste(p_tage integer DEFAULT 7, p_art text DEFAULT NULL::text, p_vor timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 150)
 RETURNS TABLE(id uuid, zeit timestamp with time zone, aktion text, akteur text, betroffen text, details jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  umfang text := protokoll_umfang();
  voll boolean := umfang = 'voll';
  firma uuid := case when umfang = 'voll' then protokoll_firma()
                     when umfang = 'aenderungen' then auth_company_id() end;
begin
  if firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  with eintrag as (
    select l.*,
           case
             when l.payload->>'employee_id' ~ '^[0-9a-f-]{36}$' then (l.payload->>'employee_id')::uuid
             when l.entity = 'employees' then l.entity_id
             when l.entity = 'leave_requests' then (select r.employee_id from leave_requests r where r.id = l.entity_id)
             when l.entity = 'absences' then (select x.employee_id from absences x where x.id = l.entity_id)
             when l.entity = 'fehlzeiten' then (select f.employee_id from fehlzeiten f where f.id = l.entity_id)
             when l.entity = 'leave_balances' then (select b.employee_id from leave_balances b where b.id = l.entity_id)
             when l.entity = 'age_leave_grants' then (select g.employee_id from age_leave_grants g where g.id = l.entity_id)
           end as person_aus_eintrag
      from audit_logs l
     where l.company_id = firma
       and l.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_tage, 7), 730)))
       and (p_vor is null or l.created_at < p_vor)
       and (voll or (l.action not like 'anmeldung%' and l.action not like 'abmeldung%'
                     and l.action not like 'fehler.%'))
       and (
         p_art is null
         or (p_art = 'anmeldung' and (l.action like 'anmeldung%' or l.action like 'abmeldung%'))
         or (p_art = 'fehler' and l.action like 'fehler.%')
         or (p_art = 'aenderung' and l.action not like 'anmeldung%' and l.action not like 'abmeldung%'
                                 and l.action not like 'fehler.%')
       )
     order by l.created_at desc
     limit greatest(1, least(coalesce(p_limit, 150), 500))
  )
  select e.id,
         e.created_at,
         e.action,
         nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
         nullif(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), ''),
         e.payload
    from eintrag e
    left join profiles p on p.id = e.actor_id
    left join employees m on m.id = coalesce(
      e.person_aus_eintrag,
      (select x.id from employees x where x.id = e.entity_id and x.company_id = firma)
    )
   order by e.created_at desc;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.protokoll_melden(p_art text, p_text text DEFAULT NULL::text, p_seite text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
begin
  if auth.uid() is null or firma is null then
    return;
  end if;
  if p_art not in ('anmeldung', 'anmeldung.passwort', 'abmeldung', 'abmeldung.inaktiv', 'fehler.anzeige', 'fehler.absturz') then
    return;
  end if;
  if (select count(*) from audit_logs l
       where l.actor_id = auth.uid()
         and l.created_at > now() - interval '10 minutes'
         and (l.action like 'fehler.%' or l.action like 'anmeldung%' or l.action like 'abmeldung%')) >= 40 then
    return;
  end if;
  perform protokoll_schreiben(firma, p_art, null, null,
    jsonb_build_object('text', left(p_text, 500), 'seite', left(p_seite, 200)));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.protokoll_schreiben(p_company_id uuid, p_action text, p_entity text, p_entity_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  akteur uuid := auth.uid();
begin
  if not exists (select 1 from companies c where c.id = p_company_id and not c.is_demo) then
    return;
  end if;
  if akteur is not null and not exists (select 1 from profiles p where p.id = akteur) then
    akteur := null;
  end if;
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (p_company_id, akteur, p_action, coalesce(p_entity, 'app'), p_entity_id, jsonb_strip_nulls(p_payload));
exception when others then
  null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.protokoll_umfang()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when public.protokoll_firma() is not null then 'voll'
    when exists (
      select 1 from profiles p
       where p.id = auth.uid() and p.active and p.company_id is not null
         and p.role in ('admin', 'shift_leader')
    ) then 'aenderungen'
  end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.protokoll_zahlen(p_tage integer DEFAULT 7)
 RETURNS TABLE(anmeldungen bigint, personen bigint, aenderungen bigint, fehler bigint, fehlanmeldungen bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  umfang text := protokoll_umfang();
  voll boolean := umfang = 'voll';
  firma uuid := case when umfang = 'voll' then protokoll_firma()
                     when umfang = 'aenderungen' then auth_company_id() end;
begin
  if firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  select case when voll then count(*) filter (where l.action = 'anmeldung') else 0 end,
         case when voll then count(distinct l.actor_id) filter (where l.action = 'anmeldung') else 0 end,
         count(*) filter (where l.action not like 'anmeldung%' and l.action not like 'abmeldung%' and l.action not like 'fehler.%'),
         case when voll then count(*) filter (where l.action like 'fehler.%') else 0 end,
         case when voll then count(*) filter (where l.action = 'anmeldung.fehlgeschlagen') else 0 end
    from audit_logs l
   where l.company_id = firma
     and l.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_tage, 7), 730)));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_abo_entfernen(p_endpoint text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from push_abos where endpoint = p_endpoint and user_id = auth.uid();
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_abo_speichern(p_endpoint text, p_p256dh text, p_auth text, p_geraet text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  insert into push_abos (user_id, endpoint, p256dh, auth, geraet)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_geraet, ''), 60))
  on conflict (endpoint) do update
     set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
         geraet = excluded.geraet, erstellt_am = now();
  delete from push_abos
   where user_id = auth.uid()
     and id not in (select id from push_abos where user_id = auth.uid() order by erstellt_am desc limit 10);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_abo_ungueltig(p_endpoint text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from push_abos where endpoint = p_endpoint;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_abos_fuer(p_users uuid[])
 RETURNS TABLE(user_id uuid, endpoint text, p256dh text, auth text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.user_id, p.endpoint, p.p256dh, p.auth from push_abos p where p.user_id = any(p_users);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_aus_benachrichtigung()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  art text := case
    when new.type = 'replacement_requested' then 'einspringen'
    when new.type = 'fehlzeit' then 'plan'
    when new.type like 'tausch_%' then 'plan'
    else 'antraege' end;
  ziel text := case
    when new.type = 'leave_submitted' then '/urlaubsantraege'
    when new.type like 'leave_%' then '/urlaub'
    when new.type like 'tausch_%' then '/schichtplan/tausch'
    else '/start' end;
begin
  begin
    perform push_einreihen(konto_zu_mitarbeiter(new.employee_id), art, new.title, coalesce(new.body, ''), ziel,
                           'glocke-' || new.id::text, null);
  exception when others then
    null;
  end;
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_aus_gruppenbeitritt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g text;
  m record;
begin
  begin
    select name into g from kalender_gruppen where id = new.gruppe_id;
    for m in select user_id from kalender_gruppen_mitglieder where gruppe_id = new.gruppe_id and user_id <> new.user_id loop
      perform push_einreihen(m.user_id, 'teilen',
        '👋 ' || coalesce(nullif(inhaber_vorname(new.user_id), ''), 'Jemand') || ' ist in „' || coalesce(g, 'eurer Gruppe') || '“',
        'Ihr seht jetzt auch ihre Schichten.', '/start', 'gruppe-' || new.gruppe_id::text || '-' || new.user_id::text, null);
    end loop;
  exception when others then
    null;
  end;
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_aus_planaenderung()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  zeile shift_assignments;
  konto uuid;
  v_schicht text;
  v_tag text;
begin
  if tg_op = 'DELETE' then
    zeile := old;
  else
    zeile := new;
  end if;
  begin
    if zeile.date < public.heute() or zeile.date > public.heute() + 60 then
      return null;
    end if;
    if tg_op = 'UPDATE' and new.shift_id is not distinct from old.shift_id then
      return null;
    end if;
    konto := konto_zu_mitarbeiter(zeile.employee_id);
    -- Wer selbst ändert, braucht keine Mitteilung.
    if konto is null or konto = auth.uid() then
      return null;
    end if;
    v_tag := to_char(zeile.date, 'DD.MM.');
    if tg_op = 'DELETE' then
      v_schicht := 'wieder laut Schichtfolge';
    else
      select s.name into v_schicht from shifts s where s.id = new.shift_id;
      v_schicht := coalesce('jetzt ' || v_schicht, 'jetzt frei');
    end if;
    perform push_einreihen(konto, 'plan', '📅 Dein Plan wurde geändert', v_tag || ': ' || v_schicht, '/meine-schichten',
                           'plan', 'plan');
    -- Mehrere Tage auf einmal: zusammenfassen.
    update push_warteschlange w
       set text = 'An ' || w.anzahl || ' Tagen geändert – zuletzt ' || v_tag || ': ' || v_schicht
     where w.user_id = konto and w.sammel = 'plan' and w.gesendet_am is null and w.anzahl > 1;
  exception when others then
    raise warning 'push_aus_planaenderung: %', sqlerrm;
  end;
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_aus_termin_von_anderen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      wer := inhaber_vorname(aktuell_user);
    elsif aktuell_person is not null then
      select name into wer from kalender_personen where id = aktuell_person;
    end if;
    perform push_einreihen(new.owner_id, 'teilen',
      '🗓️ ' || coalesce(nullif(wer, ''), 'Jemand') || ' hat etwas eingetragen',
      coalesce(nullif(new.titel, ''), 'Termin') || ' · ' || to_char(new.datum, 'DD.MM.')
        || case when new.beginn is not null then ' ' || to_char(new.beginn, 'HH24:MI') else '' end,
      '/start', 'termin-' || new.id::text, null);
  exception when others then
    null;
  end;
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_aus_verbindung()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  neu uuid := auth.uid();
  einlader uuid := case when new.a = auth.uid() then new.b else new.a end;
begin
  begin
    perform push_einreihen(einlader, 'teilen',
      '🔗 ' || coalesce(nullif(inhaber_vorname(neu), ''), 'Jemand') || ' ist jetzt mit dir verbunden',
      'Ihr seht gegenseitig eure Schichten. Unter Teilen stellst du ein, was sie noch sehen darf.',
      '/start', 'verbindung-' || new.id::text, null);
  exception when others then
    null;
  end;
  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_einreihen(p_user uuid, p_art text, p_titel text, p_text text, p_url text, p_tag text, p_sammel text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  offen bigint;
begin
  if p_user is null or not exists (select 1 from push_abos where user_id = p_user) then
    return;
  end if;
  if exists (select 1 from push_vorlieben where user_id = p_user and p_art = any(aus)) then
    return;
  end if;
  if p_sammel is not null then
    select id into offen from push_warteschlange
     where user_id = p_user and sammel = p_sammel and gesendet_am is null
     order by id desc limit 1;
    if offen is not null then
      update push_warteschlange
         set anzahl = anzahl + 1, titel = left(p_titel, 120), text = left(coalesce(p_text, ''), 300)
       where id = offen;
      return;
    end if;
  end if;
  insert into push_warteschlange (user_id, art, titel, text, url, tag, sammel)
  values (p_user, p_art, left(p_titel, 120), left(coalesce(p_text, ''), 300), coalesce(p_url, '/start'), p_tag, p_sammel);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_vorlieben_setzen(p_aus text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  insert into push_vorlieben (user_id, aus)
  values (auth.uid(), coalesce((select array_agg(distinct a) from unnest(p_aus) a
                                  where a in ('antraege', 'plan', 'einspringen', 'teilen')), '{}'))
  on conflict (user_id) do update set aus = excluded.aus;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.push_warteschlange_holen()
 RETURNS TABLE(user_id uuid, titel text, text text, url text, tag text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from push_warteschlange where coalesce(senden_ab, erstellt_am) < now() - interval '7 days';
  return query
    with geholt as (
      update push_warteschlange w set gesendet_am = now()
       where w.id in (select x.id from push_warteschlange x
                       where x.gesendet_am is null
                         and (x.senden_ab is null or x.senden_ab <= now())
                         -- Planänderungen kurz sammeln (mehrere Tage am Stück).
                         and (x.sammel is null or x.erstellt_am < now() - interval '45 seconds')
                       order by x.id limit 300 for update skip locked)
      returning w.user_id, w.titel, w.text, w.url, w.tag
    )
    select g.user_id,
           case when ps.push_ohne_inhalt then 'ShiftNexo' else g.titel end,
           case when ps.push_ohne_inhalt then 'Neue Mitteilung – zum Ansehen öffnen.' else g.text end,
           g.url, g.tag
      from geholt g
      left join public.privacy_settings ps on ps.user_id = g.user_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.qualification_coverage(p_shift_id uuid, p_date date)
 RETURNS TABLE(qualification_id uuid, label text, benoetigt integer, vorhanden integer, fehlt integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.qualification_id, b.label, b.benoetigt, b.besetzt, b.fehlt
    from public.qualifikation_besetzung(p_shift_id, p_date, null, false, null) b;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.qualifikation_besetzung(p_shift_id uuid, p_date date, p_ohne uuid DEFAULT NULL::uuid, p_offene_zaehlen boolean DEFAULT false, p_trotzdem_da uuid DEFAULT NULL::uuid)
 RETURNS TABLE(qualification_id uuid, label text, rang integer, benoetigt integer, besetzt integer, fehlt integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid;
  personen uuid[];
  pos_q uuid[];
  kann text[];
  person_von_posten int[];
  posten_von_person int[];
  n int;
  p int;
  s int;
  u int;
  j int;
  pj int;
  qi int;
  gefunden int;
  warteschlange int[];
  vorher int[];
  besucht boolean[];
begin
  select sh.company_id into firma from shifts sh where sh.id = p_shift_id;
  if firma is null or firma is distinct from auth_company_id() then
    return;
  end if;

  -- Wer einen Posten besetzen kann: eingeplant, da – und kein Azubi.
  select coalesce(array_agg(e.id order by e.id), '{}')
    into personen
    from employees e
   where e.active
     and e.company_id = firma
     and zaehlt_zur_besetzung(e)
     and effective_shift_id(e.id, p_date) = p_shift_id
     and e.id is distinct from p_ohne
     and (e.id = p_trotzdem_da
          or e.id not in (select a.employee_id
                            from employees_absent_on(p_date, p_offene_zaehlen) a));

  select coalesce(array_agg(x.qid order by x.rang nulls last, x.label, x.nr), '{}')
    into pos_q
    from (select n2.qualification_id as qid, q.sort_order as rang, q.label, gs as nr
            from shift_qualification_needs n2
            join qualifications q on q.id = n2.qualification_id and q.active
           cross join generate_series(1, n2.minimum) gs
           where n2.shift_id = p_shift_id
             and n2.company_id = firma
             and n2.minimum > 0) x;

  select coalesce(array_agg(t.i || ':' || eq.qualification_id), '{}')
    into kann
    from unnest(personen) with ordinality as t(pid, i)
    join employee_qualifications eq on eq.employee_id = t.pid;

  n := coalesce(array_length(personen, 1), 0);
  p := coalesce(array_length(pos_q, 1), 0);
  person_von_posten := array_fill(0, array[greatest(p, 1)]);
  posten_von_person := array_fill(0, array[greatest(n, 1)]);

  for s in 1 .. p loop
    besucht := array_fill(false, array[greatest(n, 1)]);
    vorher := array_fill(0, array[greatest(n, 1)]);
    warteschlange := array[s];
    qi := 1;
    gefunden := 0;

    while qi <= array_length(warteschlange, 1) and gefunden = 0 loop
      u := warteschlange[qi];
      qi := qi + 1;
      for j in 1 .. n loop
        if not besucht[j] and (j || ':' || pos_q[u]) = any(kann) then
          besucht[j] := true;
          vorher[j] := u;
          if posten_von_person[j] = 0 then
            gefunden := j;
            exit;
          end if;
          warteschlange := warteschlange || posten_von_person[j];
        end if;
      end loop;
    end loop;

    if gefunden > 0 then
      j := gefunden;
      loop
        u := vorher[j];
        pj := person_von_posten[u];
        person_von_posten[u] := j;
        posten_von_person[j] := u;
        exit when u = s;
        j := pj;
      end loop;
    end if;
  end loop;

  return query
  select q.id,
         q.label,
         q.sort_order,
         count(*)::int,
         (count(*) filter (where person_von_posten[x.i::int] > 0))::int,
         (count(*) filter (where person_von_posten[x.i::int] = 0))::int
    from unnest(pos_q) with ordinality as x(qid, i)
    join qualifications q on q.id = x.qid
   group by q.id, q.label, q.sort_order
   order by q.sort_order nulls last, q.label;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_bucket text, p_key_hash text, p_max integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  if coalesce(p_bucket, '') = '' or coalesce(p_key_hash, '') = '' or p_max < 1 or p_window_seconds < 1 then
    raise exception 'Ungültige Parameter.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key_hash, 0));

  select count(*) into v_count
    from public.rate_limit_hits
   where bucket = p_bucket
     and key_hash = p_key_hash
     and hit_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket, key_hash) values (p_bucket, p_key_hash);

  if random() < 0.02 then
    delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  end if;

  return true;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.register_company(p_company_name text, p_first_name text, p_last_name text, p_email text, p_avv_accepted boolean DEFAULT false)
 RETURNS TABLE(company_id uuid, employee_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company_id uuid;
  v_employee_id uuid;
  jahr int := extract(year from public.heute())::int;
begin
  if coalesce(trim(p_company_name), '') = '' then raise exception 'Bitte einen Unternehmensnamen angeben.'; end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then raise exception 'Bitte Vor- und Nachnamen angeben.'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'Bitte eine E-Mail-Adresse angeben.'; end if;
  if not coalesce(p_avv_accepted, false) then
    raise exception 'Bitte die Datenschutzerklärung und den Auftragsverarbeitungsvertrag bestätigen.';
  end if;
  if length(p_company_name) > 200 or length(p_first_name) > 100
     or length(p_last_name) > 100 or length(p_email) > 320 then
    raise exception 'Eine der Angaben ist zu lang.';
  end if;

  -- Bremse gegen Massenanlage über den öffentlichen Zugang.
  if (select count(*) from companies c
       where c.created_at > now() - interval '1 hour'
         and not exists (select 1 from profiles p where p.company_id = c.id)) >= 10 then
    raise exception 'Gerade werden sehr viele Unternehmen angelegt. Bitte versuche es in einer Stunde erneut.';
  end if;

  insert into companies (name, avv_accepted_at)
  values (trim(p_company_name), now())
  returning id into v_company_id;

  insert into employees (
    company_id, personnel_number, first_name, last_name, email, role,
    vacation_days, v_days
  )
  values (
    v_company_id, '10000', trim(p_first_name), trim(p_last_name), trim(p_email), 'admin',
    0, 0
  )
  returning id into v_employee_id;

  insert into shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values
    (v_company_id, 'Frühschicht', 'F', '06:00', '14:00', '#F59E0B', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Spätschicht', 'S', '14:00', '22:00', '#16A34A', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Nachtschicht', 'N', '22:00', '06:00', '#2F5BEA', 1, 1, '{0,1,2,3,4,5,6}');

  if not exists (select 1 from company_settings cs where cs.company_id = v_company_id) then
    insert into company_settings (company_id, state) values (v_company_id, 'NW');
  end if;

  perform ensure_holidays(v_company_id, jahr, false);
  perform ensure_holidays(v_company_id, jahr + 1, false);

  return query select v_company_id, v_employee_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.register_company_for_user(p_user_id uuid, p_company_name text, p_first_name text, p_last_name text, p_terms_accepted boolean, p_business_confirmed boolean, p_terms_version text, p_avv_version text, p_privacy_version text)
 RETURNS TABLE(company_id uuid, employee_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company_id uuid;
  v_employee_id uuid;
  v_email text;
  jahr int := extract(year from public.heute())::int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Nicht erlaubt.';
  end if;

  if coalesce(trim(p_company_name), '') = '' then raise exception 'Bitte einen Unternehmensnamen angeben.'; end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then raise exception 'Bitte Vor- und Nachnamen angeben.'; end if;
  if length(p_company_name) > 200 or length(p_first_name) > 100 or length(p_last_name) > 100 then
    raise exception 'Eine der Angaben ist zu lang.';
  end if;
  if not coalesce(p_terms_accepted, false) then
    raise exception 'Bitte die Nutzungsbedingungen und den Auftragsverarbeitungsvertrag akzeptieren.';
  end if;
  if not coalesce(p_business_confirmed, false) then
    raise exception 'Bitte bestätigen, dass die Registrierung für ein Unternehmen erfolgt.';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'Konto nicht gefunden.';
  end if;
  if exists (select 1 from profiles pr where pr.id = p_user_id) then
    raise exception 'Zu diesem Konto gehört bereits ein Unternehmen.';
  end if;

  insert into companies (
    name, avv_accepted_at, terms_accepted_at, business_confirmed_at,
    terms_version, avv_version, privacy_notice_version
  )
  values (
    trim(p_company_name), now(), now(), now(),
    left(p_terms_version, 20), left(p_avv_version, 20), left(p_privacy_version, 20)
  )
  returning id into v_company_id;

  insert into employees (
    company_id, personnel_number, first_name, last_name, email, role,
    vacation_days, v_days
  )
  values (
    v_company_id, '10000', trim(p_first_name), trim(p_last_name), v_email, 'admin',
    0, 0
  )
  returning id into v_employee_id;

  insert into shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values
    (v_company_id, 'Frühschicht', 'F', '06:00', '14:00', '#F59E0B', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Spätschicht', 'S', '14:00', '22:00', '#16A34A', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Nachtschicht', 'N', '22:00', '06:00', '#2F5BEA', 1, 1, '{0,1,2,3,4,5,6}');

  if not exists (select 1 from company_settings cs where cs.company_id = v_company_id) then
    insert into company_settings (company_id, state) values (v_company_id, 'NW');
  end if;

  perform ensure_holidays(v_company_id, jahr, false);
  perform ensure_holidays(v_company_id, jahr + 1, false);

  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
  values (p_user_id, v_company_id, v_employee_id, trim(p_first_name), trim(p_last_name), v_email, 'admin');

  perform public.write_audit(
    v_company_id, 'company.registered', 'companies', v_company_id,
    jsonb_build_object('terms', p_terms_version, 'avv', p_avv_version, 'privacy', p_privacy_version)
  );

  return query select v_company_id, v_employee_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.replacement_candidates(p_date date, p_shift_id uuid, p_qualification_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(employee_id uuid, name text, rotation_team text, eigene_schicht boolean, hat_qualifikation boolean, beschaeftigt boolean, frei boolean, ohne_ueberschneidung boolean, ruhezeit_stunden numeric, ruhezeit_ok boolean, dauer_stunden numeric, dauer_ok boolean, auswaehlbar boolean, grund text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  s shifts;
  beginnt timestamp;
  endet timestamp;
  ruhe_soll numeric;
  dauer_max numeric;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;

  select * into s from shifts where id = p_shift_id;
  if s.id is null or s.company_id is distinct from firma then
    raise exception 'Schicht nicht gefunden.';
  end if;

  beginnt   := shift_starts_at(p_shift_id, p_date);
  endet     := shift_ends_at(p_shift_id, p_date);
  ruhe_soll := company_rule_number('ruhezeit_stunden', 'stunden', 11, p_shift_id);
  dauer_max := company_rule_number('max_schichtdauer_stunden', 'stunden', 8, p_shift_id);

  return query
  with kandidaten as (
    select
      e.id,
      e.first_name || ' ' || e.last_name as voller_name,
      e.rotation_team::text as team,
      -- Ein Azubi füllt keine Lücke: er zählt nicht zur Besetzung.
      zaehlt_zur_besetzung(e) as zaehlt,
      effective_shift_id(e.id, p_date) as schicht_heute,
      is_employed_on(e.id, p_date) as im_betrieb,
      (p_qualification_id is null or exists (
        select 1 from employee_qualifications eq
         where eq.employee_id = e.id and eq.qualification_id = p_qualification_id
      )) as kann_es,
      (e.id not in (select a.employee_id from employees_absent_on(p_date) a)) as ist_da
    from employees e
    where e.company_id = firma and e.active
  ),
  mit_ruhe as (
    select
      k.*,
      (select min(
                extract(epoch from (
                  beginnt - shift_ends_at(effective_shift_id(k.id, tag::date), tag::date)
                )) / 3600
              )
         from generate_series(p_date - 1, p_date, '1 day') tag
        where effective_shift_id(k.id, tag::date) is not null
          and shift_ends_at(effective_shift_id(k.id, tag::date), tag::date) <= beginnt
      ) as ruhe_davor,
      (select min(
                extract(epoch from (
                  shift_starts_at(effective_shift_id(k.id, tag::date), tag::date) - endet
                )) / 3600
              )
         from generate_series(p_date, p_date + 1, '1 day') tag
        where effective_shift_id(k.id, tag::date) is not null
          and shift_starts_at(effective_shift_id(k.id, tag::date), tag::date) >= endet
      ) as ruhe_danach
    from kandidaten k
  ),
  bewertet as (
    select
      m.id, m.voller_name, m.team, m.zaehlt, m.im_betrieb, m.kann_es, m.ist_da,
      (m.schicht_heute is not distinct from p_shift_id) as ist_eigene,
      (m.schicht_heute is null or m.schicht_heute = p_shift_id) as ohne_konflikt,
      least(coalesce(m.ruhe_davor, 999), coalesce(m.ruhe_danach, 999)) as ruhe,
      extract(epoch from (endet - beginnt)) / 3600 as dauer
    from mit_ruhe m
  )
  select
    b.id,
    b.voller_name,
    b.team,
    b.ist_eigene,
    b.kann_es,
    b.im_betrieb,
    b.ist_da,
    b.ohne_konflikt,
    round(b.ruhe, 1),
    (b.ruhe >= ruhe_soll),
    round(b.dauer, 1),
    (b.dauer <= dauer_max),
    (b.zaehlt and b.kann_es and b.im_betrieb and b.ist_da and b.ohne_konflikt
       and b.ruhe >= ruhe_soll and b.dauer <= dauer_max and not b.ist_eigene),
    case
      when not b.zaehlt        then 'Azubi – zählt nicht zur Besetzung'
      when not b.kann_es       then 'Qualifikation fehlt'
      when not b.im_betrieb    then 'An diesem Tag nicht im Betrieb'
      when not b.ist_da        then 'Bereits abwesend'
      when not b.ohne_konflikt then 'Bereits in einer anderen Schicht eingeplant'
      when b.ruhe < ruhe_soll  then 'Ruhezeit nicht ausreichend: '
                                    || round(b.ruhe, 1) || ' statt ' || ruhe_soll || ' Stunden'
      when b.dauer > dauer_max then 'Einsatz länger als ' || dauer_max || ' Stunden'
      when b.ist_eigene        then 'Deckt diese Schicht bereits ab'
      else 'Verfügbar'
    end
  from bewertet b
  order by
    (b.zaehlt and b.kann_es and b.im_betrieb and b.ist_da and b.ohne_konflikt
       and b.ruhe >= ruhe_soll and b.dauer <= dauer_max and not b.ist_eigene) desc,
    b.ist_eigene desc,
    b.ruhe desc nulls last,
    b.voller_name;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.request_replacement(p_date date, p_shift_id uuid, p_asked_employee_id uuid, p_qualification_id uuid DEFAULT NULL::uuid, p_absent_employee_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  eignung record;
  schicht_name text;
  neue_id uuid;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen Ersatz anfragen.';
  end if;

  select * into eignung
    from replacement_candidates(p_date, p_shift_id, p_qualification_id) k
   where k.employee_id = p_asked_employee_id;

  if eignung.employee_id is null then
    raise exception 'Diese Person gehört nicht zum Unternehmen.';
  end if;
  if not eignung.auswaehlbar then
    raise exception 'Diese Person kommt nicht in Frage: %', eignung.grund;
  end if;

  select s.name into schicht_name from shifts s where s.id = p_shift_id;

  insert into replacement_requests (
    company_id, date, shift_id, qualification_id,
    absent_employee_id, asked_employee_id, requested_by, note
  )
  values (
    firma, p_date, p_shift_id, p_qualification_id,
    p_absent_employee_id, p_asked_employee_id, auth_employee_id(),
    nullif(trim(p_note), '')
  )
  on conflict (asked_employee_id, date, shift_id) do update
    set status = 'offen', requested_at = now(), answered_at = null,
        answer_note = null, note = excluded.note
  returning id into neue_id;

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (
    firma, p_asked_employee_id, 'replacement_requested',
    'Einspringen am ' || to_char(p_date, 'DD.MM.YYYY') || '?',
    'Möchtest du am ' || to_char(p_date, 'DD.MM.YYYY') || ' für die '
      || coalesce(schicht_name, 'Schicht') || ' einspringen?'
      || coalesce(' ' || nullif(trim(p_note), ''), ''),
    'replacement_request', neue_id
  );

  return neue_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.retention_cleanup()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n_rate int;
  n_mail int;
  n_notif int;
  n_komm int;
  n_audit int;
  n_anmeldung int;
  n_plattform int;
  n_pwcode int;
  n_vcode int;
  n_versuch int;
  n_push int;
begin
  delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  get diagnostics n_rate = row_count;

  delete from public.email_outbox where created_at < now() - interval '30 days';
  get diagnostics n_mail = row_count;

  delete from public.notifications where created_at < now() - interval '180 days';
  get diagnostics n_notif = row_count;

  delete from public.plan_kommentare where tag < public.heute() - 365;
  get diagnostics n_komm = row_count;

  -- Anmeldeprotokoll und angezeigte Fehlermeldungen: 90 Tage.
  delete from public.audit_logs
   where created_at < now() - interval '90 days'
     and split_part(action, '.', 1) in ('anmeldung', 'abmeldung', 'fehler');
  get diagnostics n_anmeldung = row_count;

  -- Änderungsprotokoll: 24 Monate.
  delete from public.audit_logs where created_at < now() - interval '24 months';
  get diagnostics n_audit = row_count;

  delete from public.plattform_protokoll where am < now() - interval '24 months';
  get diagnostics n_plattform = row_count;

  -- Abgelaufene Codes; eine laufende Sperre (zu viele Fehlversuche) bleibt bis zu ihrem Ende stehen.
  delete from public.passwort_codes
   where gueltig_bis < now() - interval '7 days'
     and (gesperrt_bis is null or gesperrt_bis < now());
  get diagnostics n_pwcode = row_count;

  delete from public.kalender_verbindung_codes where gueltig_bis < now() - interval '7 days';
  get diagnostics n_vcode = row_count;

  delete from public.kalender_code_versuche where zeit < now() - interval '1 day';
  get diagnostics n_versuch = row_count;

  delete from public.push_warteschlange
   where gesendet_am is not null and gesendet_am < now() - interval '30 days';
  get diagnostics n_push = row_count;

  return jsonb_build_object(
    'rate_limit_hits', n_rate,
    'email_outbox', n_mail,
    'notifications', n_notif,
    'plan_kommentare', n_komm,
    'anmeldeprotokoll', n_anmeldung,
    'audit_logs', n_audit,
    'plattform_protokoll', n_plattform,
    'passwort_codes', n_pwcode,
    'kalender_verbindung_codes', n_vcode,
    'kalender_code_versuche', n_versuch,
    'push_warteschlange', n_push
  );
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.rotation_cycle_length(p_pattern_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(sum((step ->> 'days')::int), 0)::int
  from rotation_patterns p, lateral jsonb_array_elements(p.steps) as step
  where p.id = p_pattern_id;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.rotation_preview(p_pattern_id uuid, p_offset_days integer, p_from date, p_days integer)
 RETURNS TABLE(date date, shift_id uuid, shift_name text, is_free boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  pat rotation_patterns;
  cycle int;
begin
  select * into pat from rotation_patterns where id = p_pattern_id;
  if pat.id is null or pat.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 120 then
    raise exception 'Zeitraum zu gross.';
  end if;

  cycle := rotation_cycle_length(pat.id);
  if cycle <= 0 then return; end if;

  return query
  with days as (
    select gs.day::date as d,
           ((((gs.day::date - pat.anchor_date - p_offset_days) % cycle) + cycle) % cycle) as pos
    from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as gs(day)
  ),
  blocks as (
    select nullif(step ->> 'shift', '')::uuid as sid,
      sum((step ->> 'days')::int) over (order by ord) as cum_end,
      sum((step ->> 'days')::int) over (order by ord) - (step ->> 'days')::int as cum_start
    from jsonb_array_elements(pat.steps) with ordinality as t(step, ord)
  )
  select d.d, b.sid, s.name, (b.sid is null)
  from days d
  join blocks b on d.pos >= b.cum_start and d.pos < b.cum_end
  left join shifts s on s.id = b.sid
  order by d.d;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.rotation_shift_for(p_employee_id uuid, p_date date)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select rotation_shift_for(e, p_date) from employees e where e.id = p_employee_id;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.rotation_shift_for(emp employees, p_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  pat rotation_patterns;
  cycle int := 0;
  pos int;
  acc int := 0;
  step jsonb;
  versatz int := emp.rotation_offset_days;
  team rotation_team;
begin
  if emp.rotation_pattern_id is null then return null; end if;

  select * into pat from rotation_patterns where id = emp.rotation_pattern_id and active;
  if pat.id is null then return null; end if;

  -- Geplanter Gruppenwechsel: an diesem Tag gilt vielleicht eine andere Gruppe.
  if exists (select 1 from employee_gruppenwechsel w where w.employee_id = emp.id) then
    team := gruppe_am(emp.id, p_date, emp.rotation_team);
    if team is distinct from emp.rotation_team then
      versatz := gruppe_versatz(emp.rotation_pattern_id, team);
    end if;
  end if;

  for step in select * from jsonb_array_elements(pat.steps) loop
    cycle := cycle + (step ->> 'days')::int;
  end loop;
  if cycle <= 0 then return null; end if;

  pos := (((p_date - pat.anchor_date - versatz) % cycle) + cycle) % cycle;

  for step in select * from jsonb_array_elements(pat.steps) loop
    acc := acc + (step ->> 'days')::int;
    if pos < acc then
      return nullif(step ->> 'shift', '')::uuid;
    end if;
  end loop;

  return null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.sammelgenehmigung_kandidaten(p_jahr integer DEFAULT NULL::integer)
 RETURNS TABLE(antrag_id uuid, employee_id uuid, von date, bis date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select (array_agg(lr.id order by lr.start_date))[1],
         (array_agg(lr.employee_id order by lr.start_date))[1],
         min(lr.start_date),
         max(lr.end_date)
    from leave_requests lr
   where lr.company_id = v_firma
     and lr.status = 'pending'
     and darf_urlaub_entscheiden(lr.employee_id)
   group by coalesce(lr.request_group_id, lr.id)
  having p_jahr is null
      or extract(year from min(lr.start_date))::int = p_jahr
      or extract(year from max(lr.end_date))::int = p_jahr
   order by min(lr.created_at), min(lr.start_date);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.save_own_setup_profile(p_department text, p_vacation_days numeric, p_v_days numeric, p_shift_worker boolean, p_rotation_team text, p_qualifications text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich uuid := auth_employee_id();
  muster uuid;
  team rotation_team;
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if ich is null then
    raise exception 'Zu deinem Zugang gehört kein Personalstammsatz.';
  end if;
  if p_vacation_days is null or p_vacation_days < 0 or p_vacation_days > 400 then
    raise exception 'Der Urlaubsanspruch muss eine Zahl zwischen 0 und 400 sein.';
  end if;
  if p_v_days is null or p_v_days < 0 or p_v_days > 400 then
    raise exception 'Die V-Tage müssen eine Zahl zwischen 0 und 400 sein.';
  end if;

  if coalesce(p_shift_worker, false) and coalesce(trim(p_rotation_team), '') <> '' then
    team := trim(p_rotation_team)::rotation_team;
    select r.id into muster
      from rotation_patterns r
     where r.company_id = auth_company_id() and r.active
     order by r.created_at
     limit 1;
  else
    team := null;
    muster := null;
  end if;

  update employees e
     set department    = nullif(trim(coalesce(p_department, '')), ''),
         vacation_days = p_vacation_days,
         v_days        = p_v_days,
         shift_worker  = coalesce(p_shift_worker, false),
         rotation_team = team,
         rotation_pattern_id = muster,
         profile_confirmed_at = now(),
         updated_at    = now()
   where e.id = ich
     and e.company_id = auth_company_id();

  perform set_employee_qualifications(ich, p_qualifications);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.save_privacy_settings(p_absence_visibility absence_visibility_level, p_sickness_visibility sickness_visibility_level, p_notice_acknowledged boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company_id uuid := auth_company_id();
  v_user_id uuid := auth.uid();
  v_current privacy_settings;
  v_version text := public.current_legal_version('datenschutz');
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  select * into v_current
    from public.privacy_settings
   where user_id = v_user_id
     and company_id = v_company_id
   for update;

  if v_current.user_id is null then
    insert into public.privacy_settings (
      user_id, company_id, absence_visibility, sickness_visibility,
      privacy_notice_version, accepted_at
    )
    values (
      v_user_id, v_company_id, p_absence_visibility, p_sickness_visibility,
      coalesce(v_version, '1.0'),
      case when p_notice_acknowledged then now() else null end
    );
  else
    update public.privacy_settings
       set absence_visibility = p_absence_visibility,
           sickness_visibility = p_sickness_visibility,
           privacy_notice_version = case
             when p_notice_acknowledged then coalesce(v_version, v_current.privacy_notice_version)
             else v_current.privacy_notice_version
           end,
           accepted_at = case
             when p_notice_acknowledged
                  and (v_current.accepted_at is null
                       or v_current.privacy_notice_version is distinct from v_version)
               then now()
             else v_current.accepted_at
           end
     where user_id = v_user_id
       and company_id = v_company_id;
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.save_qualification(p_id uuid, p_label text, p_active boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  schluessel text;
  ergebnis uuid;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Qualifikationen pflegen.';
  end if;
  if coalesce(trim(p_label), '') = '' then
    raise exception 'Bitte eine Bezeichnung angeben.';
  end if;

  if p_id is not null then
    update qualifications
       set label = trim(p_label), active = coalesce(p_active, true)
     where id = p_id and company_id = firma
    returning id into ergebnis;
    if ergebnis is null then
      raise exception 'Qualifikation nicht gefunden.';
    end if;
    return ergebnis;
  end if;

  schluessel := lower(trim(p_label));
  schluessel := replace(replace(replace(replace(replace(
                  schluessel, 'ä','ae'), 'ö','oe'), 'ü','ue'), 'ß','ss'), '-', '_');
  schluessel := regexp_replace(schluessel, '[^a-z0-9]+', '_', 'g');
  schluessel := trim(both '_' from schluessel);
  if schluessel = '' then
    raise exception 'Aus dieser Bezeichnung lässt sich kein Schlüssel bilden.';
  end if;

  insert into qualifications (company_id, key, label, active, sort_order)
  values (firma, schluessel, trim(p_label), coalesce(p_active, true),
          (select coalesce(max(sort_order), 0) + 1 from qualifications where company_id = firma))
  on conflict (company_id, key) do update
    set label = excluded.label, active = excluded.active
  returning id into ergebnis;

  return ergebnis;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.save_rotation_pattern(p_name text, p_anchor_date date, p_blocks jsonb, p_teams integer DEFAULT 4)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company_id uuid := auth_company_id();
  v_shift_f uuid; v_shift_s uuid; v_shift_n uuid;
  v_steps jsonb := '[]'::jsonb; v_block jsonb; v_cycle int := 0; v_pattern_id uuid; v_shift uuid;
  v_teams int := greatest(1, least(5, coalesce(p_teams, 4)));
begin
  if not is_admin() then raise exception 'Nur die Administration darf das Schichtmuster festlegen.'; end if;
  if jsonb_typeof(p_blocks) is distinct from 'array' or jsonb_array_length(p_blocks) = 0 then
    raise exception 'Das Muster enthält keine Blöcke.'; end if;

  select id into v_shift_f from shifts where company_id = v_company_id and short_name = 'F' limit 1;
  select id into v_shift_s from shifts where company_id = v_company_id and short_name = 'S' limit 1;
  select id into v_shift_n from shifts where company_id = v_company_id and short_name = 'N' limit 1;

  for v_block in select * from jsonb_array_elements(p_blocks) loop
    if (v_block->>'days')::int < 1 then raise exception 'Jeder Block braucht mindestens einen Tag.'; end if;
    v_shift := case upper(v_block->>'code')
      when 'F' then v_shift_f when 'S' then v_shift_s when 'N' then v_shift_n else null end;
    v_steps := v_steps || jsonb_build_object('shift', v_shift, 'days', (v_block->>'days')::int);
    v_cycle := v_cycle + (v_block->>'days')::int;
  end loop;

  update rotation_patterns set active = false where company_id = v_company_id and active;

  insert into rotation_patterns (company_id, name, anchor_date, steps, team_offset_days, active)
  values (v_company_id, coalesce(nullif(trim(p_name), ''), 'Schichtmuster'), p_anchor_date,
          v_steps, greatest(1, round(v_cycle::numeric / v_teams)::int), true)
  returning id into v_pattern_id;
  return v_pattern_id;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.save_training_assignment(p_id uuid, p_employee_id uuid, p_start date, p_end date, p_area text, p_shift_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_status text DEFAULT 'geplant'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  ergebnis uuid;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen die Ausbildung planen.';
  end if;
  if coalesce(trim(p_area), '') = '' then
    raise exception 'Bitte einen Ausbildungsbereich angeben.';
  end if;
  if p_start is null or p_end is null then
    raise exception 'Bitte Beginn und Ende angeben.';
  end if;
  if p_end < p_start then
    raise exception 'Das Ende darf nicht vor dem Beginn liegen.';
  end if;
  if not exists (
    select 1 from employees e where e.id = p_employee_id and e.company_id = firma
  ) then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_id is null then
    insert into training_assignments (
      company_id, employee_id, start_date, end_date, area, shift_id, note, status
    )
    values (
      firma, p_employee_id, p_start, p_end, trim(p_area), p_shift_id,
      nullif(trim(p_note), ''), coalesce(p_status, 'geplant')
    )
    returning id into ergebnis;
  else
    update training_assignments
       set employee_id = p_employee_id,
           start_date = p_start,
           end_date = p_end,
           area = trim(p_area),
           shift_id = p_shift_id,
           note = nullif(trim(p_note), ''),
           status = coalesce(p_status, 'geplant'),
           updated_at = now()
     where id = p_id and company_id = firma
    returning id into ergebnis;
    if ergebnis is null then
      raise exception 'Abschnitt nicht gefunden.';
    end if;
  end if;

  return ergebnis;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.schicht_laeuft_fuer(p_employee_id uuid, p_date date, p_shift shifts, p_work_on_holidays boolean DEFAULT NULL::boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from shift_assignments sa
                  where sa.employee_id = p_employee_id
                    and sa.date = p_date
                    and sa.shift_id = p_shift.id)
      or case when p_work_on_holidays is null
              then shift_runs_on(p_shift, p_date)
              else shift_runs_on(p_shift, p_date, p_work_on_holidays) end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.schichtplan_kompakt(p_company_id uuid, p_from date, p_days integer)
 RETURNS TABLE(employee_id uuid, employee_name text, rotation_team text, personnel_number text, is_me boolean, is_apprentice boolean, tage jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select g.employee_id,
         min(g.employee_name),
         (array_agg(g.rotation_team order by g.day desc))[1],
         min(g.personnel_number),
         bool_or(g.is_me),
         bool_or(g.is_apprentice),
         jsonb_agg(jsonb_build_array(
           g.day, g.shift_name, g.shift_code, g.absence_code,
           g.absence_code in ('V', 'v') and exists (
             select 1 from public.leave_requests r
              where r.employee_id = g.employee_id
                and r.kind = 'v_tag'
                and r.v_jahresplanung
                and r.status in ('approved', 'pending')
                and g.day between r.start_date and r.end_date)
         ) order by g.day)
    from public.shift_plan_grid(p_company_id, p_from, p_days) with ordinality as g(
           employee_id, employee_name, rotation_team, personnel_number, day,
           shift_name, shift_code, absence_code, is_me, is_apprentice, nr)
   group by g.employee_id
   order by min(g.nr);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.school_holidays_for_range(p_from date, p_to date)
 RETURNS TABLE(name text, start_date date, end_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select f.name, f.start_date, f.end_date
    from school_holidays f
    join company_settings cs on cs.company_id = auth_company_id()
   where (f.company_id is null and f.region = cs.state
          or f.company_id = auth_company_id())
     and f.start_date <= p_to
     and f.end_date   >= p_from
   order by f.start_date;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_af_freischaltung(p_employee_id uuid, p_ab date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  v_vorher date;
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select af_ab into v_vorher from employees
   where id = p_employee_id and company_id = v_firma;
  if not found then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if p_ab is not null and (p_ab < date '2000-01-01' or p_ab > public.heute() + 366) then
    raise exception 'Ungültiges Datum.';
  end if;

  update employees set af_ab = p_ab where id = p_employee_id and company_id = v_firma;

  perform write_audit(v_firma, 'age_leave.freischaltung', 'employees', p_employee_id,
    jsonb_build_object('vorher', v_vorher, 'nachher', p_ab));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_af_stand(p_employee_id uuid, p_stunden numeric, p_stichtag date)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select set_stundenstand(p_employee_id, 'af', p_stunden, p_stichtag);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_birth_date(p_employee_id uuid, p_birth_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  v_user uuid;
  v_vorher date;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf das Geburtsdatum ändern.';
  end if;
  select p.id into v_user from profiles p
   where p.employee_id = p_employee_id and p.company_id = v_firma;
  if v_user is null then
    raise exception 'Diese Person hat noch keinen Zugang – das Geburtsdatum hängt am Zugang.';
  end if;

  select birth_date into v_vorher from personal_details where user_id = v_user;

  insert into personal_details (user_id, company_id, birth_date)
  values (v_user, v_firma, p_birth_date)
  on conflict (user_id) do update set birth_date = excluded.birth_date;

  perform write_audit(v_firma, 'personal_details.birth_date', 'employees', p_employee_id,
    jsonb_build_object('vorher', v_vorher, 'nachher', p_birth_date));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_company_state(p_state text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  jahr int := extract(year from public.heute())::int;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf das.';
  end if;
  if upper(p_state) not in
     ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH') then
    raise exception 'Unbekanntes Bundesland.';
  end if;

  insert into company_settings (company_id, state) values (firma, upper(p_state))
  on conflict (company_id) do update set state = upper(p_state), updated_at = now();

  perform ensure_holidays(firma, jahr, true);
  perform ensure_holidays(firma, jahr + 1, true);
  perform ensure_holidays(firma, jahr + 2, true);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_employee_order(p_employee_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen die Reihenfolge ändern.';
  end if;
  if p_employee_ids is null or array_length(p_employee_ids, 1) is null then
    return 0;
  end if;
  if array_length(p_employee_ids, 1) > 500 then
    raise exception 'Zu viele Mitarbeiter auf einmal.';
  end if;

  update employees e
     set sort_order = pos.ord
    from (
      select id, ordinality::int as ord
        from unnest(p_employee_ids) with ordinality as t(id, ordinality)
    ) pos
   where e.id = pos.id
     and e.company_id = auth_company_id();

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_employee_qualifications(p_employee_id uuid, p_keys text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;
  if not exists (
    select 1 from employees e where e.id = p_employee_id and e.company_id = firma
  ) then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  delete from employee_qualifications eq
   where eq.employee_id = p_employee_id
     and eq.qualification_id not in (
       select q.id from qualifications q
        where q.company_id = firma and q.key = any(coalesce(p_keys, '{}'))
     );

  insert into employee_qualifications (employee_id, qualification_id)
  select p_employee_id, q.id
    from qualifications q
   where q.company_id = firma
     and q.active
     and q.key = any(coalesce(p_keys, '{}'))
  on conflict do nothing;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_gruende_fuer_kollegen(p_value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf diese Einstellung ändern.';
  end if;
  insert into company_settings (company_id, gruende_fuer_kollegen, updated_at)
  values (v_firma, coalesce(p_value, false), now())
  on conflict (company_id)
    do update set gruende_fuer_kollegen = excluded.gruende_fuer_kollegen, updated_at = now();
  perform write_audit(v_firma, 'datenschutz.gruende_fuer_kollegen', 'company_settings', v_firma,
                      jsonb_build_object('erlaubt', coalesce(p_value, false)));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_hinweis_standard(p_wert text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf diese Einstellung ändern.';
  end if;
  if p_wert is null or p_wert not in ('schicht', 'sofort', 'aus') then
    raise exception 'Ungültige Auswahl.';
  end if;
  insert into company_settings (company_id, hinweis_standard, updated_at)
  values (v_firma, p_wert, now())
  on conflict (company_id)
    do update set hinweis_standard = excluded.hinweis_standard, updated_at = now();
  perform write_audit(v_firma, 'hinweise.standard', 'company_settings', v_firma,
                      jsonb_build_object('wert', p_wert));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_leave_entitlement(p_employee_id uuid, p_entitlement numeric, p_year smallint DEFAULT (EXTRACT(year FROM now()))::smallint)
 RETURNS leave_balances
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result leave_balances;
  emp_company uuid;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;
  if p_entitlement is null or p_entitlement < 0 then
    raise exception 'Der Urlaubsanspruch muss eine Zahl ab 0 sein.';
  end if;

  select company_id into emp_company from employees where id = p_employee_id;
  if emp_company is null or emp_company is distinct from auth_company_id() then
    raise exception 'Der Mitarbeiter wurde nicht gefunden.';
  end if;

  insert into leave_balances (company_id, employee_id, year, entitlement)
  values (emp_company, p_employee_id, p_year, p_entitlement)
  on conflict (employee_id, year)
  do update set entitlement = excluded.entitlement, updated_at = now()
  returning * into result;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    emp_company, auth.uid(), 'leave_balance.entitlement_updated', 'leave_balances', result.id,
    jsonb_build_object('year', p_year, 'entitlement', p_entitlement)
  );

  return result;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_leave_for_day(p_employee_id uuid, p_date date, p_mode text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  r leave_requests;
  target leave_kind;
  vj boolean;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration duerfen das.';
  end if;
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not darf_urlaub_entscheiden(p_employee_id) then
    raise exception 'Urlaub eintragen darfst du nur für deine eigene Schicht.';
  end if;

  select * into r
    from leave_requests
   where employee_id = p_employee_id
     and status in ('approved', 'pending')
     and p_date between start_date and end_date
   order by start_date
   limit 1;

  if p_mode = 'clear' then
    if r.id is null then return; end if;
    perform split_leave_request_day(r, p_date, null);
    insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
    values (
      e.company_id, auth.uid(), 'leave.day_removed', 'leave_requests', r.id,
      jsonb_build_object('tag', p_date, 'kind', r.kind, 'status', r.status)
    );
    perform benachrichtige_ruecknahme(
      r.id, p_employee_id, leave_kind_label(r.kind), p_date, p_date, r.status = 'approved', null
    );
    return;
  end if;

  -- VJ/V nur ab 2027; davor ist ein V-Tag einfach ein V-Tag.
  vj := case when p_mode = 'vj' and extract(year from p_date) >= 2027 then true
             when p_mode = 'v'  and extract(year from p_date) >= 2027 then false
             else null end;
  target := case
    when p_mode in ('vj', 'v') then 'v_tag'::leave_kind
    when p_mode in ('urlaub', 'v_tag', 'altersfreizeit', 'sonderurlaub',
                    'bildungsurlaub', 'gewerkschaftstag')
      then p_mode::leave_kind
    else 'urlaub'::leave_kind
  end;

  if r.id is null then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at, v_jahresplanung
    )
    values (
      e.company_id, p_employee_id, p_date, p_date, 'approved', target,
      'Direkt im Schichtplan eingetragen', auth.uid(), now(), vj
    );
    return;
  end if;

  if r.kind = target and (vj is null or r.v_jahresplanung is not distinct from vj) then
    return;
  end if;

  -- Nur VJ ↔ V an einem eintägigen Antrag: Kennzeichnung umstellen.
  if r.kind = target and r.start_date = r.end_date then
    update leave_requests set v_jahresplanung = vj where id = r.id;
    return;
  end if;

  perform split_leave_request_day(r, p_date, target);
  if vj is not null then
    update leave_requests set v_jahresplanung = vj
     where employee_id = p_employee_id and kind = 'v_tag' and status = 'approved'
       and start_date = p_date and end_date = p_date;
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_leitung_eigene_antraege(p_value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf diese Einstellung ändern.';
  end if;
  insert into company_settings (company_id, leitung_eigene_antraege, updated_at)
  values (v_firma, coalesce(p_value, false), now())
  on conflict (company_id)
  do update set leitung_eigene_antraege = excluded.leitung_eigene_antraege, updated_at = now();
  perform write_audit(v_firma, 'regel.leitung_eigene_antraege', 'company_settings', v_firma,
    jsonb_build_object('erlaubt', coalesce(p_value, false)));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_notification_settings(p_notify_leave_email boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin() then raise exception 'Nur die Administration darf Benachrichtigungen einstellen.'; end if;
  insert into company_settings (company_id, notify_leave_email, updated_at)
  values (auth_company_id(), p_notify_leave_email, now())
  on conflict (company_id) do update set notify_leave_email = excluded.notify_leave_email, updated_at = now();
end; $function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_shift_qualification_need(p_shift_id uuid, p_qualification_id uuid, p_minimum integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf den Besetzungsbedarf festlegen.';
  end if;
  if p_minimum is null or p_minimum < 0 or p_minimum > 99 then
    raise exception 'Der Bedarf muss eine Zahl zwischen 0 und 99 sein.';
  end if;
  if not exists (select 1 from shifts s where s.id = p_shift_id and s.company_id = firma) then
    raise exception 'Schicht nicht gefunden.';
  end if;
  if not exists (
    select 1 from qualifications q where q.id = p_qualification_id and q.company_id = firma
  ) then
    raise exception 'Qualifikation nicht gefunden.';
  end if;

  if p_minimum = 0 then
    delete from shift_qualification_needs
     where shift_id = p_shift_id and qualification_id = p_qualification_id;
    return;
  end if;

  insert into shift_qualification_needs (company_id, shift_id, qualification_id, minimum)
  values (firma, p_shift_id, p_qualification_id, p_minimum)
  on conflict (shift_id, qualification_id) do update set minimum = excluded.minimum;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_shift_staffing(p_shift_id uuid, p_target integer, p_minimum integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  v_vorher_target smallint;
  v_vorher_min smallint;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_target is null or p_minimum is null then
    raise exception 'Soll und Mindest müssen angegeben werden.';
  end if;
  if p_target < 0 or p_target > 999 or p_minimum < 0 or p_minimum > 999 then
    raise exception 'Bitte Werte zwischen 0 und 999 angeben.';
  end if;
  if p_minimum > p_target then
    raise exception 'Die Mindestbesetzung darf nicht über der Sollbesetzung liegen.';
  end if;

  select target_staff, minimum_staff into v_vorher_target, v_vorher_min
  from shifts where id = p_shift_id and company_id = v_firma;

  if v_vorher_target is null then
    raise exception 'Schicht nicht gefunden.';
  end if;

  update shifts
     set target_staff = p_target::smallint,
         minimum_staff = p_minimum::smallint,
         updated_at = now()
   where id = p_shift_id and company_id = v_firma;

  -- Besetzungsvorgaben steuern jede Urlaubsentscheidung. Wer sie aendert,
  -- soll nachvollziehbar sein.
  perform write_audit(
    v_firma, 'shift.staffing_changed', 'shifts', p_shift_id,
    jsonb_build_object(
      'soll_vorher', v_vorher_target, 'soll_nachher', p_target,
      'mindest_vorher', v_vorher_min, 'mindest_nachher', p_minimum
    )
  );
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_stundenstand(p_employee_id uuid, p_art text, p_stunden numeric, p_stichtag date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  e employees;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_art = 'v' then
    raise exception 'V-Tage werden in Tagen geführt – bitte in der Verwaltung Tage hinzufügen oder abziehen.';
  end if;
  if p_art is distinct from 'af' then
    raise exception 'Unbekanntes Konto.';
  end if;
  select * into e from employees where id = p_employee_id and company_id = v_firma;
  if e.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if p_stichtag is not null then
    if p_stichtag < date '2000-01-01' or p_stichtag > public.heute() then
      raise exception 'Das Datum des Stands darf nicht in der Zukunft liegen.';
    end if;
    if p_stunden is null or p_stunden < -500 or p_stunden > 2000 then
      raise exception 'Bitte einen Stundenstand zwischen -500 und 2000 angeben.';
    end if;
  end if;

  update employees
     set af_ab = p_stichtag,
         af_start_stunden = case when p_stichtag is null then 0 else round(p_stunden, 2) end
   where id = p_employee_id;

  perform write_audit(v_firma, 'stundenkonto.af', 'employees', p_employee_id,
    jsonb_build_object(
      'vorher_ab', e.af_ab,
      'vorher_stunden', e.af_start_stunden,
      'nachher_ab', p_stichtag, 'nachher_stunden', p_stunden));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.set_work_on_holidays(p_value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf die Planungsregeln ändern.';
  end if;
  insert into company_settings (company_id, work_on_holidays, updated_at)
  values (auth_company_id(), coalesce(p_value, true), now())
  on conflict (company_id)
    do update set work_on_holidays = excluded.work_on_holidays, updated_at = now();
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.setup_state()
 RETURNS TABLE(abgeschlossen_at timestamp with time zone, bundesland text, feiertage bigint, muster_vorhanden boolean, gruppen bigint, mitarbeiter bigint, mitarbeiter_mit_gruppe bigint, eigenes_profil_bestaetigt boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.setup_completed_at,
    (select s.state from company_settings s where s.company_id = c.id),
    (select count(*) from holidays h where h.company_id = c.id),
    exists (select 1 from rotation_patterns r where r.company_id = c.id and r.active),
    (select count(distinct e.rotation_team) from employees e
      where e.company_id = c.id and e.active and e.rotation_team is not null),
    (select count(*) from employees e where e.company_id = c.id and e.active),
    (select count(*) from employees e
      where e.company_id = c.id and e.active and e.rotation_team is not null),
    exists (select 1 from employees e
             where e.id = auth_employee_id() and e.profile_confirmed_at is not null)
  from companies c
  where c.id = auth_company_id() and is_admin();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_assignments_for_range(p_company_id uuid, p_from date, p_to date)
 RETURNS TABLE(id uuid, employee_id uuid, employee_name text, default_shift_id uuid, shift_id uuid, shift_name text, date date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;

  return query
  select sa.id, e.id, e.first_name || ' ' || e.last_name,
    e.shift_id, sa.shift_id, s.name, sa.date
  from shift_assignments sa
  join employees e on e.id = sa.employee_id
  join shifts s on s.id = sa.shift_id
  where sa.company_id = p_company_id and sa.date between p_from and p_to
  order by sa.date, e.last_name;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_ends_at(p_shift_id uuid, p_date date)
 RETURNS timestamp without time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case
           when s.end_time > s.start_time then (p_date + s.end_time)::timestamp
           else (p_date + 1 + s.end_time)::timestamp
         end
    from shifts s where s.id = p_shift_id;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_leave_overlap(p_employee_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(overlapping_employees integer, critical_days integer, worst_status staffing_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  return query
  with impact as (select * from check_leave_staffing_impact(p_employee_id, p_start_date, p_end_date)),
  colleagues as (
    select count(distinct r.employee_id)::int as n
    from leave_requests r join employees c on c.id = r.employee_id
    where r.employee_id <> p_employee_id and r.status in ('approved','pending')
      and r.start_date <= p_end_date and r.end_date >= p_start_date
      and ((e.rotation_team is not null and c.rotation_team = e.rotation_team)
           or (e.shift_id is not null and c.shift_id = e.shift_id))
  )
  select (select n from colleagues),
    (select count(*)::int from impact where status = 'critical'),
    coalesce((select status from impact order by
      case status when 'critical' then 0 when 'warn' then 1 else 2 end limit 1), 'ok'::staffing_status);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
 RETURNS TABLE(employee_id uuid, employee_name text, rotation_team text, personnel_number text, day date, shift_name text, shift_code text, absence_code text, is_me boolean, is_apprentice boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
  freigabe boolean := gruende_fuer_kollegen_erlaubt();
  feiertage_arbeiten boolean;
  bis date := p_from + (p_days - 1);
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team
  from public.employees e
  where e.id = me and e.company_id = p_company_id;

  select coalesce(cs.work_on_holidays, true) into feiertage_arbeiten
  from public.company_settings cs where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  with sichtbar as (
    select e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
           e.personnel_number, e.sort_order, e.is_apprentice,
           e.shift_id, e.rotation_pattern_id, e.rotation_offset_days,
           e.entry_date, e.exit_date,
           exists (select 1 from public.employee_gruppenwechsel w where w.employee_id = e.id) as wechselt,
           -- Name nur, wenn die Person sichtbar sein darf (0237): Leitung, ich selbst,
           -- sonst angemeldet, nicht ausgeschieden und – je nach Betrieb – mit Zustimmung.
           public.team_sicht(e.id) as name_frei,
           freigabe
             and coalesce(bool_or(ps.absence_visibility = 'shift'), false)
             and mein_team is not null and e.rotation_team = mein_team as grund_frei,
           freigabe
             and coalesce(bool_or(ps.sickness_visibility = 'shift'), false)
             and mein_team is not null and e.rotation_team = mein_team as krank_frei
    from public.employees e
    left join public.profiles sp
      on sp.employee_id = e.id and sp.company_id = p_company_id
    left join public.privacy_settings ps
      on ps.user_id = sp.id and ps.company_id = p_company_id
    where e.company_id = p_company_id
      and e.active
      and (e.entry_date is null or e.entry_date <= bis)
      and (e.exit_date is null or e.exit_date >= p_from)
    group by e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
             e.personnel_number, e.sort_order, e.is_apprentice,
             e.shift_id, e.rotation_pattern_id, e.rotation_offset_days,
             e.entry_date, e.exit_date
  ),
  muster as (
    select x.id, x.anchor_date, x.ord, x.shift_id,
           x.bis_pos - x.tage as von_pos, x.bis_pos, x.zyklus
      from (
        select p.id, p.anchor_date, st.ord,
               nullif(st.step ->> 'shift', '')::uuid as shift_id,
               (st.step ->> 'days')::int as tage,
               sum((st.step ->> 'days')::int) over (partition by p.id order by st.ord) as bis_pos,
               sum((st.step ->> 'days')::int) over (partition by p.id) as zyklus
          from public.rotation_patterns p
          cross join lateral jsonb_array_elements(p.steps) with ordinality as st(step, ord)
         where p.active
           and p.id in (select s.rotation_pattern_id from sichtbar s)
      ) x
  ),
  tage as (
    select e.id as emp, gs.day::date as tag,
           case when e.wechselt then gruppe_am(e.id, gs.day::date, e.rotation_team) else e.rotation_team end as team
      from sichtbar e
      cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  ),
  zelle as (
    select t.emp, t.tag, t.team,
           sa.employee_id is not null as zugewiesen,
           case
             when not ((e.entry_date is null or t.tag >= e.entry_date)
                   and (e.exit_date is null or t.tag <= e.exit_date)) then null
             when sa.employee_id is not null then sa.shift_id
             when e.shift_worker and e.rotation_pattern_id is not null then (
               select m.shift_id
                 from muster m
                where m.id = e.rotation_pattern_id
                  and m.zyklus > 0
                  and (((t.tag - m.anchor_date
                         - case when t.team is not distinct from e.rotation_team then e.rotation_offset_days
                                else gruppe_versatz(e.rotation_pattern_id, t.team) end
                        ) % m.zyklus) + m.zyklus) % m.zyklus < m.bis_pos
                order by m.ord
                limit 1)
             else e.shift_id
           end as schicht
      from tage t
      join sichtbar e on e.id = t.emp
      left join public.shift_assignments sa
        on sa.employee_id = t.emp and sa.date = t.tag
  ),
  abw as (
    select a.employee_id as emp, a.date as tag,
           bool_or(a.type = 'krank') as krank,
           bool_or(a.type = 'schulung') as schulung,
           case
             when bool_or(a.type::text = 'berufsschule') then 'BS'
             when bool_or(a.type = 'altersfreizeit') then 'AF'
             when bool_or(a.type = 'sonderurlaub') then 'SU'
             when bool_or(a.type = 'bildungsurlaub') then 'BU'
             else 'A'
           end as art_code
    from public.absences a
    join sichtbar x on x.id = a.employee_id
    where a.date between p_from and bis
    group by a.employee_id, a.date
  ),
  frei as (
    select r.employee_id as emp, d::date as tag,
           (array_agg(r.kind order by (r.status = 'approved') desc, r.kind))[1] as art,
           bool_or(r.status = 'approved') as genehmigt
    from public.leave_requests r
    join sichtbar x on x.id = r.employee_id
    cross join lateral generate_series(
      greatest(r.start_date, p_from), least(r.end_date, bis), interval '1 day'
    ) d
    where r.status in ('approved', 'pending')
      and r.start_date <= bis and r.end_date >= p_from
    group by r.employee_id, d::date
  )
  select
    -- Unsichtbare Personen: weder Name noch echte Kennung – nur eine Kennung,
    -- die für jede betrachtende Person anders ist.
    case when e.name_frei then e.id else md5(coalesce(me::text, '') || ':' || e.id::text)::uuid end,
    case when e.name_frei then e.first_name || ' ' || e.last_name end,
    case when e.shift_worker then z.team::text else null end,
    case when fuehrung then e.personnel_number else null end,
    z.tag,
    s.name,
    case
      when s.name ilike 'Früh%' then 'F'
      when s.name ilike 'Spät%' then 'S'
      when s.name ilike 'Nacht%' then 'N'
      when s.name is not null then upper(left(s.name, 1))
      else null
    end,
    case
      when e.id = me then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then a.art_code
          when f.art is not null and s.id is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      when fuehrung then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then a.art_code
          when f.art is not null and s.id is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      else
        case
          when coalesce(a.krank, false) then
            case when e.krank_frei and e.name_frei then 'K' else 'A' end
          when a.tag is not null then
            case when e.grund_frei and e.name_frei
                 then case when coalesce(a.schulung, false) then 'FB' else a.art_code end
                 else 'A' end
          when f.art is not null and s.id is not null then
            case when e.grund_frei and e.name_frei then leave_kind_code(f.art, f.genehmigt)
                 when f.genehmigt then 'A'
                 else null end
          else null
        end
    end,
    (e.id = me),
    coalesce(e.is_apprentice, false)
  from sichtbar e
  join zelle z on z.emp = e.id
  left join abw  a on a.emp = e.id and a.tag = z.tag
  left join frei f on f.emp = e.id and f.tag = z.tag
  left join public.shifts s
    on s.id = z.schicht
   and (
     z.zugewiesen
     or (
       extract(dow from z.tag)::int = any(s.weekdays)
       and (
         feiertage_arbeiten
         or not exists (
           select 1 from public.holidays h
            where h.date = z.tag
              and (h.company_id = s.company_id or h.company_id is null)
         )
       )
     )
   )
  order by case when e.shift_worker then
             (case when e.wechselt then gruppe_am(e.id, bis, e.rotation_team) else e.rotation_team end) end nulls last,
           (not e.name_frei), e.sort_order nulls last, case when e.name_frei then e.last_name end, e.id, z.tag;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_qualification_gaps(p_shift_id uuid, p_date date, p_zusaetzlich_abwesend uuid DEFAULT NULL::uuid)
 RETURNS TABLE(qualification_id uuid, label text, benoetigt integer, vorhanden integer, fehlt integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.qualification_id, b.label, b.benoetigt, b.besetzt, b.fehlt
    from public.qualifikation_besetzung(p_shift_id, p_date, p_zusaetzlich_abwesend, true, null) b;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_qualification_matrix()
 RETURNS TABLE(shift_id uuid, shift_name text, qualification_id uuid, qualification_label text, minimum integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.name, q.id, q.label, coalesce(n.minimum, 0)::int
    from shifts s
    cross join qualifications q
    left join shift_qualification_needs n
      on n.shift_id = s.id and n.qualification_id = q.id
   where s.company_id = auth_company_id()
     and s.active
     and q.company_id = auth_company_id()
     and q.active
   order by s.name, q.sort_order nulls last, q.label;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_runs_on(p_shift shifts, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select shift_runs_on(
    p_shift,
    p_date,
    coalesce(
      (select cs.work_on_holidays from company_settings cs
        where cs.company_id = p_shift.company_id),
      true)
  );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_runs_on(p_shift shifts, p_date date, p_work_on_holidays boolean)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select
    extract(dow from p_date)::int = any(p_shift.weekdays)
    and (
      coalesce(p_work_on_holidays, true)
      or not exists (
        select 1 from holidays h
        where h.date = p_date
          and (h.company_id = p_shift.company_id or h.company_id is null)
      )
    );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_staffing_overview(p_date date DEFAULT NULL::date)
 RETURNS TABLE(shift_id uuid, shift_name text, short_name text, target integer, minimum integer, zugeordnet integer, laeuft_heute boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  v_tag date := coalesce(p_date, public.heute());
begin
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  return query
  select s.id, s.name, s.short_name,
         s.target_staff::int, s.minimum_staff::int,
         (select count(*)::int from employees e
           where e.active and e.company_id = v_firma
             and zaehlt_zur_besetzung(e)
             and effective_shift_id(e.id, v_tag) = s.id),
         shift_runs_on(s, v_tag)
  from shifts s
  where s.company_id = v_firma and s.active
  order by s.start_time nulls last, s.name;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.shift_starts_at(p_shift_id uuid, p_date date)
 RETURNS timestamp without time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select (p_date + s.start_time)::timestamp from shifts s where s.id = p_shift_id;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.sicher_genehmigen(p_request_id uuid)
 RETURNS TABLE(ergebnis text, grund text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  r record;
  v_sicher boolean;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  select coalesce(x.request_group_id, x.id) as gruppe
    into r
    from leave_requests x
   where x.id = p_request_id and x.company_id = v_firma and x.status = 'pending';
  if r.gruppe is null then
    return query select 'uebersprungen'::text, 'bereits entschieden'::text;
    return;
  end if;
  if not darf_urlaub_entscheiden((select x.employee_id from leave_requests x where x.id = p_request_id)) then
    return query select 'uebersprungen'::text, 'andere Schicht'::text;
    return;
  end if;

  select (array_agg(lr.id order by lr.start_date))[1] as erste_id,
         (array_agg(lr.employee_id order by lr.start_date))[1] as employee_id,
         min(lr.start_date) as von,
         max(lr.end_date) as bis
    into r
    from leave_requests lr
   where coalesce(lr.request_group_id, lr.id) = r.gruppe
     and lr.status = 'pending';

  select not exists (
    select 1 from public.check_leave_staffing_impact(r.employee_id, r.von, r.bis) i
    where i.status <> 'ok'
  ) into v_sicher;
  if not v_sicher then
    return query select 'uebersprungen'::text, 'Besetzung wäre knapp'::text;
    return;
  end if;

  select not exists (
    select 1
    from generate_series(r.von, r.bis, interval '1 day') d
    cross join lateral (select effective_shift_id(r.employee_id, d::date) as sid) x
    cross join lateral public.qualifikation_besetzung(x.sid, d::date, null, true, r.employee_id) m
    join lateral public.qualifikation_besetzung(x.sid, d::date, r.employee_id, true, null) o
      on o.qualification_id = m.qualification_id
    where x.sid is not null
      and o.fehlt > m.fehlt
  ) into v_sicher;
  if not v_sicher then
    return query select 'uebersprungen'::text, 'Qualifikation fehlt sonst'::text;
    return;
  end if;

  begin
    perform public.decide_leave_request(r.erste_id, 'approved');
  exception when others then
    return query select 'uebersprungen'::text, sqlerrm;
    return;
  end;

  return query select 'genehmigt'::text, null::text;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.sitzung_vertraut()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
      from vertraute_sitzungen s
      join vertraute_geraete g on g.id = s.geraet_id
     where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and s.user_id = auth.uid()
       and g.bis > now());
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.split_leave_request_day(r leave_requests, p_date date, p_kind leave_kind)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  head_from date := r.start_date;
  head_to   date := p_date - 1;
  tail_from date := p_date + 1;
  tail_to   date := r.end_date;
begin
  -- Teil VOR dem Tag: kuerzen, wenn dort noch ein Arbeitstag liegt, sonst weg.
  if head_to >= head_from
     and calculate_leave_days_for_employee(r.employee_id, head_from, head_to, null) > 0 then
    update leave_requests
       set end_date = head_to, half_day_period = null
     where id = r.id;
  else
    delete from leave_requests where id = r.id;
  end if;

  -- Teil NACH dem Tag als eigener Antrag, gleiche Art, gleicher Status, gleiche VJ/V-Kennzeichnung.
  if tail_to >= tail_from
     and calculate_leave_days_for_employee(r.employee_id, tail_from, tail_to, null) > 0 then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at, requested_days, v_jahresplanung, request_group_id
    )
    values (
      r.company_id, r.employee_id, tail_from, tail_to, r.status, r.kind,
      r.reason, r.reviewed_by, r.reviewed_at, 0, r.v_jahresplanung, r.request_group_id
    );
  end if;

  -- Der herausgeloeste Tag in der gewuenschten Art. p_kind null = entfernen.
  if p_kind is not null then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at, requested_days, v_jahresplanung
    )
    values (
      r.company_id, r.employee_id, p_date, p_date, 'approved', p_kind,
      'Direkt im Schichtplan geaendert', auth.uid(), now(), 0,
      case when p_kind = 'v_tag' and r.kind = 'v_tag' then r.v_jahresplanung end
    );
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.staffing_for_day(p_company_id uuid, p_date date)
 RETURNS TABLE(shift_id uuid, shift_name text, date date, target smallint, minimum smallint, planned integer, absent integer, present integer, status staffing_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;

  return query
  select s.id, s.name, snap.date, snap.target, snap.minimum, snap.planned,
         snap.absent, snap.present, snap.status
  from shifts s
  cross join lateral staffing_snapshot(s.id, p_date) as snap
  where s.company_id = p_company_id and s.active and s.target_staff > 0
    and shift_runs_on(s, p_date);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.staffing_month_overview(p_company_id uuid, p_year integer, p_month integer)
 RETURNS TABLE(day date, status staffing_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;

  return query
  select gs.day::date,
    (array_agg(snap.status order by
      case snap.status when 'critical' then 0 when 'warn' then 1 else 2 end))[1] as status
  from generate_series(
    make_date(p_year, p_month, 1),
    (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date,
    interval '1 day') as gs(day)
  join shifts s on s.company_id = p_company_id and s.active and s.target_staff > 0
  cross join lateral staffing_snapshot(s.id, gs.day::date) as snap
  where shift_runs_on(s, gs.day::date)
  group by gs.day::date;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.staffing_range(p_company_id uuid, p_from date, p_days integer)
 RETURNS TABLE(shift_id uuid, shift_name text, date date, target smallint, minimum smallint, planned integer, absent integer, present integer, status staffing_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu gross.';
  end if;

  return query
  select s.id, s.name, gs.day::date, snap.target, snap.minimum, snap.planned,
         snap.absent, snap.present, snap.status
  from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as gs(day)
  join shifts s on s.company_id = p_company_id and s.active and s.target_staff > 0
  cross join lateral staffing_snapshot(s.id, gs.day::date) as snap
  where shift_runs_on(s, gs.day::date)
  order by gs.day::date, s.name;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.staffing_snapshot(p_shift_id uuid, p_date date)
 RETURNS TABLE(shift_id uuid, date date, target smallint, minimum smallint, planned integer, absent integer, present integer, status staffing_status)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s shifts;
  v_planned int;
  v_absent int;
begin
  select * into s from shifts where id = p_shift_id;
  if s.id is null then
    raise exception 'Schicht nicht gefunden.';
  end if;
  if s.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;

  select count(*) into v_planned from employees e
  where e.active and e.company_id = s.company_id
    and zaehlt_zur_besetzung(e)
    and effective_shift_id(e.id, p_date) = s.id;

  select count(*) into v_absent from employees e
  where e.active and e.company_id = s.company_id
    and zaehlt_zur_besetzung(e)
    and effective_shift_id(e.id, p_date) = s.id
    and e.id in (select employee_id from employees_absent_on(p_date));

  return query select
    s.id, p_date, s.target_staff, s.minimum_staff,
    v_planned, v_absent, v_planned - v_absent,
    case
      when v_planned - v_absent < s.minimum_staff then 'critical'::staffing_status
      when v_planned - v_absent < s.target_staff then 'warn'::staffing_status
      else 'ok'::staffing_status
    end;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.stundenkonto(p_employee_id uuid, p_art text, p_ohne_antrag uuid DEFAULT NULL::uuid)
 RETURNS TABLE(stichtag date, start_stunden numeric, arbeitstage integer, angespart numeric, genommen numeric, beantragt numeric, verplant numeric, stand_heute numeric, noch_moeglich numeric, rest_stunden numeric, satz numeric, kosten numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  ab date;
  v_start numeric;
  v_satz numeric;
  v_kosten numeric;
  v_art leave_kind;
  n int;
  fehl numeric;
  anspar numeric;
  af_abzug numeric := 0;
  gen numeric;
  plan numeric;
  bea numeric;
  stand numeric;
  frei numeric;
  moeglich numeric;
begin
  select * into e from employees where id = p_employee_id;
  if p_art = 'af' then
    ab := e.af_ab; v_start := e.af_start_stunden; v_satz := 0.82; v_kosten := 8; v_art := 'altersfreizeit';
  elsif p_art = 'v' then
    ab := e.v_ab; v_start := e.v_start_stunden; v_satz := 0.75; v_kosten := 7.5; v_art := 'v_tag';
  else
    raise exception 'Unbekanntes Konto.';
  end if;

  if e.id is null or ab is null then
    return query select null::date, 0::numeric, 0, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
                        0::numeric, 0::numeric, 0::numeric, v_satz, v_kosten;
    return;
  end if;

  select count(*), coalesce(sum(fz.std), 0)
    into n, fehl
    from generate_series(ab + 1, public.heute() - 1, interval '1 day') g
    left join lateral (
      select sum(f.stunden) as std
        from fehlzeiten f
       where f.employee_id = e.id and f.tag = g::date
    ) fz on true
   where is_planned_workday(e.id, g::date)
     and not exists (select 1 from absences a
                      where a.employee_id = e.id and a.date = g::date)
     and not exists (select 1 from leave_requests r
                      where r.employee_id = e.id
                        and r.status = 'approved'
                        and g::date between r.start_date and r.end_date);

  if p_art = 'af' then
    -- Anteilig: je fehlender Stunde 0,82/8 weniger angespart.
    anspar := round(n * v_satz - v_satz * fehl / 8, 2);
    select coalesce(sum(f.stunden), 0) into af_abzug
      from fehlzeiten f
     where f.employee_id = e.id and f.abzug = 'af' and f.tag > ab;
  else
    anspar := round(n * v_satz, 2);
  end if;

  with tage as (
    select d::date as tag,
           r.status,
           case when r.half_day_period is not null then 0.5 else 1 end as gewicht
      from leave_requests r
      cross join lateral generate_series(greatest(r.start_date, ab + 1), r.end_date, interval '1 day') d
     where r.employee_id = e.id
       and r.kind = v_art
       and r.status in ('approved', 'pending')
       and r.end_date > ab
       and r.id is distinct from p_ohne_antrag
       and is_planned_workday(e.id, d::date)
    union all
    select a.date, 'approved'::leave_status, 1
      from absences a
     where p_art = 'af'
       and a.employee_id = e.id
       and a.type = 'altersfreizeit'
       and a.date > ab
       and not exists (select 1 from leave_requests r
                        where r.employee_id = e.id
                          and r.kind = 'altersfreizeit'
                          and r.status in ('approved', 'pending')
                          and a.date between r.start_date and r.end_date)
  )
  select coalesce(sum(gewicht) filter (where status = 'approved' and tag < public.heute()), 0),
         coalesce(sum(gewicht) filter (where status = 'pending' or tag >= public.heute()), 0),
         coalesce(sum(gewicht) filter (where status = 'pending'), 0)
    into gen, plan, bea
    from tage;

  stand := v_start + anspar - v_kosten * gen - af_abzug;
  frei := stand - v_kosten * plan;
  moeglich := floor(frei / v_kosten);

  return query select ab, v_start, n, anspar, gen, bea, plan,
                      stand, moeglich, round(frei - v_kosten * moeglich, 2), v_satz, v_kosten;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.submit_leave_auto(p_start_date date, p_end_date date, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(urlaub_tage integer, v_tage integer, antraege integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  e employees; tag date; art leave_kind; jahr int; idx int;
  jahre int[] := '{}'; ru numeric[] := '{}'; rv numeric[] := '{}'; rvj numeric[] := '{}';
  tage date[] := '{}'; arten leave_kind[] := '{}'; vjs boolean[] := '{}';
  vj boolean;
  i int; block_von date; block_bis date; block_art leave_kind; block_vj boolean;
  n_u int := 0; n_v int := 0; n_a int := 0;
  v_gruppe uuid := gen_random_uuid();
  v_erste uuid;
  v_arten text;
  v_tage_gesamt numeric;
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  if p_end_date < p_start_date then
    raise exception 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Der Zeitraum ist zu lang.';
  end if;

  select * into e from employees where id = me;

  for jahr in
    select distinct extract(year from d)::int
      from generate_series(p_start_date, p_end_date, '1 day') d order by 1
  loop
    perform ensure_leave_balance(me, jahr);
    jahre := jahre || jahr;
    ru := ru || coalesce((select remaining_days from leave_balances_view where employee_id = me and year = jahr), 0);
    rv := rv || v_tage_rest(me, jahr);
    rvj := rvj || case when jahr >= 2027 then vj_rest(me, jahr) else 0 end;
  end loop;

  for tag in select d::date from generate_series(p_start_date, p_end_date, '1 day') d loop
    continue when not is_planned_workday(me, tag);
    continue when exists (
      select 1 from leave_requests r
       where r.employee_id = me and r.status in ('approved', 'pending')
         and tag between r.start_date and r.end_date);

    idx := array_position(jahre, extract(year from tag)::int);
    if not e.shift_worker then art := 'urlaub';
    elsif is_premium_day(me, tag) then art := 'urlaub';
    else art := 'v_tag'; end if;
    if art = 'urlaub' and ru[idx] < 1 then art := 'v_tag'; end if;
    if art = 'v_tag'  and rv[idx] < 1 and ru[idx] >= 1 then art := 'urlaub'; end if;
    vj := null;
    if art = 'urlaub' then
      ru[idx] := ru[idx] - 1; n_u := n_u + 1;
    else
      rv[idx] := rv[idx] - 1; n_v := n_v + 1;
      if extract(year from tag) >= 2027 then
        vj := rvj[idx] >= 1;
        if vj then rvj[idx] := rvj[idx] - 1; end if;
      end if;
    end if;
    tage  := tage  || tag;
    arten := arten || art;
    vjs   := vjs   || vj;
  end loop;

  if array_length(tage, 1) is null then
    raise exception 'In diesem Zeitraum hast du keinen eingeplanten Arbeitstag.';
  end if;

  perform set_config('schichtplan.sammelantrag', 'an', true);

  block_von := tage[1]; block_bis := tage[1]; block_art := arten[1]; block_vj := vjs[1];

  for i in 2 .. array_length(tage, 1) loop
    if arten[i] = block_art and vjs[i] is not distinct from block_vj and tage[i] = block_bis + 1
       and extract(year from tage[i]) = extract(year from block_bis) then
      block_bis := tage[i];
    else
      insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days, request_group_id, v_jahresplanung)
      values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0, v_gruppe, block_vj);
      n_a := n_a + 1;
      block_von := tage[i]; block_bis := tage[i]; block_art := arten[i]; block_vj := vjs[i];
    end if;
  end loop;

  insert into leave_requests (company_id, employee_id, start_date, end_date, kind, reason, requested_days, request_group_id, v_jahresplanung)
  values (e.company_id, me, block_von, block_bis, block_art, p_reason, 0, v_gruppe, block_vj);
  n_a := n_a + 1;

  perform set_config('schichtplan.sammelantrag', '', true);

  select (array_agg(id order by start_date))[1],
         string_agg(distinct leave_kind_label(kind), ' und '),
         sum(requested_days)
    into v_erste, v_arten, v_tage_gesamt
  from leave_requests where request_group_id = v_gruppe;

  perform notify_leave_submitted(
    e.company_id, me, v_erste,
    e.first_name || ' ' || e.last_name, e.rotation_team,
    v_arten, tage[1], tage[array_length(tage, 1)], v_tage_gesamt, p_reason
  );

  return query select n_u, n_v, n_a;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.suggest_leave_kind(p_employee_id uuid, p_date date)
 RETURNS TABLE(kind text, grund text, u_rest numeric, v_rest numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees; v_u numeric; v_v numeric;
  is_holiday boolean; is_sunday boolean; is_night boolean; sname text; lohnt boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  if p_employee_id is distinct from auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  select remaining_days, v_remaining_days into v_u, v_v
  from leave_balances_view where employee_id = p_employee_id and year = extract(year from p_date);
  v_u := coalesce(v_u,0); v_v := v_tage_rest(p_employee_id, extract(year from p_date)::int);

  if not is_planned_workday(p_employee_id, p_date) then
    return query select 'keins'::text, 'Freier Tag – kostet keinen Urlaub'::text, v_u, v_v;
    return;
  end if;

  select exists(select 1 from holidays h where h.date = p_date
    and (h.company_id = e.company_id or h.company_id is null)) into is_holiday;
  is_sunday := extract(dow from p_date) = 0;
  select name into sname from shifts where id = effective_shift_id(p_employee_id, p_date);
  is_night := coalesce(sname ilike 'Nacht%', false);

  if not e.shift_worker then
    if v_u > 0 then
      return query select 'urlaub'::text, 'Kein Schichtsystem – der Tag kostet Urlaub'::text, v_u, v_v;
    else
      return query select 'v_tag'::text, 'Urlaub aufgebraucht – V-Tag (darf ins Minus)'::text, v_u, v_v;
    end if;
    return;
  end if;

  lohnt := is_holiday or is_sunday or is_night;

  if lohnt and v_u > 0 then
    return query select 'urlaub'::text,
      case when is_holiday then 'Feiertag – mit Urlaub wird der Zuschlag mitbezahlt'
           when is_sunday  then 'Sonntag – mit Urlaub wird der Zuschlag mitbezahlt'
           else 'Nachtschicht – mit Urlaub wird der Zuschlag mitbezahlt' end, v_u, v_v;
  elsif lohnt and v_u <= 0 then
    return query select 'v_tag'::text,
      'Zuschlagstag, aber Urlaub aufgebraucht – V-Tag als Ersatz'::text, v_u, v_v;
  elsif not lohnt and v_v > 0 then
    return query select 'v_tag'::text,
      'Kein Zuschlagstag – V-Tag verwenden und Urlaub sparen'::text, v_u, v_v;
  elsif v_u > 0 then
    return query select 'urlaub'::text, 'V-Tage aufgebraucht – Urlaub wird verwendet'::text, v_u, v_v;
  else
    return query select 'v_tag'::text, 'Beide Konten aufgebraucht – V-Tag geht ins Minus'::text, v_u, v_v;
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.tausch_anbieten(p_tag date, p_notiz text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  firma uuid := auth_company_id();
  schicht uuid;
  neu uuid;
begin
  if me is null or firma is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  if p_tag < current_date then
    raise exception 'Dieser Tag ist schon vorbei.';
  end if;
  if p_tag > current_date + 180 then
    raise exception 'Tauschen geht höchstens ein halbes Jahr im Voraus.';
  end if;
  schicht := public.effective_shift_id(me, p_tag);
  if schicht is null then
    raise exception 'An diesem Tag hast du keine Schicht.';
  end if;
  if exists (select 1 from public.employees_absent_on(p_tag, true) a where a.employee_id = me) then
    raise exception 'An diesem Tag bist du schon abwesend (z. B. Urlaub).';
  end if;
  if exists (select 1 from public.schicht_tausch t where t.von_employee = me and t.tag = p_tag and t.status in ('offen', 'angefragt')) then
    raise exception 'Diesen Tag hast du schon angeboten.';
  end if;
  insert into public.schicht_tausch (company_id, von_employee, tag, shift_id, notiz)
  values (firma, me, p_tag, schicht, nullif(btrim(coalesce(p_notiz, '')), ''))
  returning id into neu;
  return neu;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.tausch_annehmen(p_id uuid, p_gegen_tag date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  firma uuid := auth_company_id();
  t public.schicht_tausch;
  ich text;
  gegen_schicht uuid;
begin
  if me is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  select * into t from public.schicht_tausch where id = p_id and company_id = firma for update;
  if t.id is null then
    raise exception 'Dieses Angebot gibt es nicht mehr.';
  end if;
  if t.status <> 'offen' then
    raise exception 'Jemand anderes war schneller – das Angebot ist schon vergeben.';
  end if;
  if t.von_employee = me then
    raise exception 'Das ist dein eigenes Angebot.';
  end if;
  if t.tag < current_date then
    raise exception 'Dieser Tag ist schon vorbei.';
  end if;
  if not public.tausch_frei(me, t.tag) then
    raise exception 'Du kannst die Schicht nur übernehmen, wenn du an dem Tag frei hast.';
  end if;
  if p_gegen_tag is not null then
    if p_gegen_tag < current_date then
      raise exception 'Der Gegentag ist schon vorbei.';
    end if;
    if not public.tausch_arbeitet(me, p_gegen_tag) then
      raise exception 'Am Gegentag hast du selbst keine Schicht zum Abgeben.';
    end if;
    if not public.tausch_frei(t.von_employee, p_gegen_tag) then
      raise exception 'Am Gegentag hat die andere Person keine Zeit.';
    end if;
    gegen_schicht := public.effective_shift_id(me, p_gegen_tag);
  end if;

  update public.schicht_tausch
     set status = 'angefragt', uebernehmer = me, gegen_tag = p_gegen_tag,
         gegen_shift_id = gegen_schicht, angefragt_am = now()
   where id = p_id;

  select e.first_name || ' ' || e.last_name into ich from public.employees e where e.id = me;
  -- An die anbietende Person: wer übernehmen möchte (die Person hat sich selbst gemeldet).
  insert into public.notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (firma, t.von_employee, 'tausch_angefragt', 'Deine Schicht wird übernommen',
          ich || ' möchte deine Schicht am ' || to_char(t.tag, 'DD.MM.') || ' übernehmen'
            || case when p_gegen_tag is not null then ' und dir dafür den ' || to_char(p_gegen_tag, 'DD.MM.') || ' geben' else '' end
            || '. Die Leitung bestätigt noch.',
          'schicht_tausch', p_id);
  perform public.tausch_leitung_benachrichtigen(p_id, 'Schichttausch bestätigen',
    ich || ' übernimmt am ' || to_char(t.tag, 'DD.MM.') || ' eine Schicht'
      || case when p_gegen_tag is not null then ' (Gegentag ' || to_char(p_gegen_tag, 'DD.MM.') || ')' else '' end || '.');
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.tausch_arbeitet(p_employee uuid, p_tag date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.effective_shift_id(p_employee, p_tag) is not null
     and not exists (select 1 from public.employees_absent_on(p_tag, true) a where a.employee_id = p_employee);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.tausch_entscheiden(p_id uuid, p_ok boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  t public.schicht_tausch;
  titel text;
  text_ text;
begin
  if not is_leadership() then
    raise exception 'Das darf nur die Leitung.';
  end if;
  select * into t from public.schicht_tausch where id = p_id and company_id = firma for update;
  if t.id is null or t.status <> 'angefragt' then
    raise exception 'Dieser Tausch wartet nicht mehr auf eine Entscheidung.';
  end if;

  if p_ok then
    -- Noch einmal prüfen: Hat sich der Plan seitdem geändert?
    if public.effective_shift_id(t.von_employee, t.tag) is distinct from t.shift_id then
      raise exception 'Der Plan hat sich am % geändert – der Tausch passt nicht mehr.', to_char(t.tag, 'DD.MM.');
    end if;
    if not public.tausch_frei(t.uebernehmer, t.tag) then
      raise exception 'Die übernehmende Person ist am % nicht mehr frei.', to_char(t.tag, 'DD.MM.');
    end if;
    if t.gegen_tag is not null then
      if public.effective_shift_id(t.uebernehmer, t.gegen_tag) is distinct from t.gegen_shift_id
         or not public.tausch_frei(t.von_employee, t.gegen_tag) then
        raise exception 'Der Gegentag % passt nicht mehr.', to_char(t.gegen_tag, 'DD.MM.');
      end if;
    end if;

    delete from public.shift_assignments
     where (employee_id in (t.von_employee, t.uebernehmer) and date = t.tag)
        or (t.gegen_tag is not null and employee_id in (t.von_employee, t.uebernehmer) and date = t.gegen_tag);
    insert into public.shift_assignments (company_id, employee_id, shift_id, date) values
      (firma, t.von_employee, null, t.tag),
      (firma, t.uebernehmer, t.shift_id, t.tag);
    if t.gegen_tag is not null then
      insert into public.shift_assignments (company_id, employee_id, shift_id, date) values
        (firma, t.uebernehmer, null, t.gegen_tag),
        (firma, t.von_employee, t.gegen_shift_id, t.gegen_tag);
    end if;
  end if;

  update public.schicht_tausch
     set status = case when p_ok then 'genehmigt' else 'abgelehnt' end,
         entschieden_von = auth.uid(), entschieden_am = now()
   where id = p_id;

  titel := case when p_ok then 'Schichttausch bestätigt' else 'Schichttausch abgelehnt' end;
  text_ := 'Tausch am ' || to_char(t.tag, 'DD.MM.')
    || case when t.gegen_tag is not null then ' (Gegentag ' || to_char(t.gegen_tag, 'DD.MM.') || ')' else '' end
    || case when p_ok then ' ist bestätigt. Der Plan ist geändert.' else ' wurde von der Leitung abgelehnt.' end;
  insert into public.notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (firma, t.von_employee, 'tausch_entschieden', titel, text_, 'schicht_tausch', p_id),
         (firma, t.uebernehmer, 'tausch_entschieden', titel, text_, 'schicht_tausch', p_id);

  perform public.write_audit(firma, case when p_ok then 'tausch.genehmigt' else 'tausch.abgelehnt' end,
                             'schicht_tausch', p_id, jsonb_build_object('tag', t.tag, 'gegen_tag', t.gegen_tag));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.tausch_frei(p_employee uuid, p_tag date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.effective_shift_id(p_employee, p_tag) is null
     and not exists (select 1 from public.employees_absent_on(p_tag, true) a where a.employee_id = p_employee);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.tausch_leitung_benachrichtigen(p_tausch uuid, p_titel text, p_text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.schicht_tausch;
  gruppe rotation_team;
begin
  select * into t from public.schicht_tausch where id = p_tausch;
  select e.rotation_team into gruppe from public.employees e where e.id = t.von_employee;
  insert into public.notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select t.company_id, p.employee_id, 'tausch_angefragt', p_titel, p_text, 'schicht_tausch', t.id
    from public.profiles p
    join public.employees pe on pe.id = p.employee_id
   where p.company_id = t.company_id
     and p.active
     and p.employee_id is distinct from t.von_employee
     and p.employee_id is distinct from t.uebernehmer
     and (p.role = 'admin'
          or (p.role = 'shift_leader' and (gruppe is null or pe.rotation_team is null or pe.rotation_team = gruppe)));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.tausch_liste()
 RETURNS TABLE(id uuid, tag date, schicht text, von_name text, von_ich boolean, status text, notiz text, uebernehmer_name text, uebernehmer_ich boolean, gegen_tag date, gegen_schicht text, passt boolean, grund text, erstellt_am timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  firma uuid := auth_company_id();
  fuehrung boolean := is_leadership();
begin
  if firma is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  return query
  select t.id, t.tag, s.name,
         case when public.team_sicht(t.von_employee) then v.first_name || ' ' || v.last_name else 'Ohne Namen' end,
         t.von_employee = me,
         t.status, t.notiz,
         case when t.uebernehmer is null then null
              when public.team_sicht(t.uebernehmer) then u.first_name || ' ' || u.last_name
              else 'Ohne Namen' end,
         t.uebernehmer = me,
         t.gegen_tag, gs.name,
         case when me is null or t.von_employee = me or t.status <> 'offen' then null
              else public.tausch_frei(me, t.tag) end,
         case when me is null or t.von_employee = me or t.status <> 'offen' then null
              when public.tausch_frei(me, t.tag) then 'Du hast an dem Tag frei'
              when public.effective_shift_id(me, t.tag) is not null then 'Du arbeitest an dem Tag schon'
              else 'Du bist an dem Tag abwesend' end,
         t.erstellt_am
    from public.schicht_tausch t
    join public.employees v on v.id = t.von_employee
    left join public.employees u on u.id = t.uebernehmer
    left join public.shifts s on s.id = t.shift_id
    left join public.shifts gs on gs.id = t.gegen_shift_id
   where t.company_id = firma
     and (
       (t.status = 'offen' and t.tag >= current_date)
       or (t.status = 'angefragt' and (fuehrung or t.von_employee = me or t.uebernehmer = me))
       or ((t.von_employee = me or t.uebernehmer = me) and t.tag >= current_date - 14)
       or (fuehrung and t.status in ('genehmigt', 'abgelehnt') and t.entschieden_am > now() - interval '14 days')
     )
   order by case t.status when 'angefragt' then 0 when 'offen' then 1 else 2 end, t.tag;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.tausch_zurueckziehen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  t public.schicht_tausch;
begin
  select * into t from public.schicht_tausch where id = p_id and company_id = auth_company_id() for update;
  if t.id is null or t.status not in ('offen', 'angefragt') then
    raise exception 'Das geht nicht mehr – darüber wurde schon entschieden.';
  end if;
  if t.von_employee = me then
    update public.schicht_tausch set status = 'zurueckgezogen' where id = p_id;
  elsif t.uebernehmer = me then
    update public.schicht_tausch
       set status = 'offen', uebernehmer = null, gegen_tag = null, gegen_shift_id = null, angefragt_am = null
     where id = p_id;
  else
    raise exception 'Das ist nicht dein Tausch.';
  end if;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.team_birth_dates()
 RETURNS TABLE(employee_id uuid, birth_date date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  return query
  select e.id, pd.birth_date
  from public.employees e
  join public.profiles p
    on p.employee_id = e.id and p.company_id = v_firma
  join public.personal_details pd
    on pd.user_id = p.id and pd.company_id = v_firma
  where e.company_id = v_firma
    and e.active
    -- Zeilen ohne Datum gar nicht erst ausliefern: "kein Datum" ist keine
    -- Angabe und muss nicht über die Leitung gehen.
    and pd.birth_date is not null;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.team_leave_balances(p_year integer DEFAULT NULL::integer)
 RETURNS TABLE(employee_id uuid, rest numeric, anspruch numeric, v_rest numeric, v_anspruch numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  y int := coalesce(p_year, extract(year from public.heute())::int);
  ziel uuid;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  for ziel in select id from employees where company_id = auth_company_id() and active loop
    perform ensure_leave_balance(ziel, y);
  end loop;

  return query
  select v.employee_id, v.remaining_days, v.entitlement + v.carried_over,
         v.v_remaining_days, v.v_entitlement + v.v_carried_over
    from leave_balances_view v
    join employees e on e.id = v.employee_id
   where e.company_id = auth_company_id() and e.active and v.year = y;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.team_sicht(p_ziel uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth_employee_id();
  firma uuid := auth_company_id();
  ziel_firma uuid;
  ziel_team text;
  ziel_austritt date;
  hat_profil boolean := false;
  er_eigene boolean;
  er_andere boolean;
  modus text;
  mein_team text;
  ich_eigene boolean;
  ich_andere boolean;
begin
  if p_ziel is null or firma is null then
    return false;
  end if;
  if p_ziel = me or is_leadership() then
    return true;
  end if;

  select e.company_id, e.rotation_team::text, e.exit_date
    into ziel_firma, ziel_team, ziel_austritt
    from public.employees e where e.id = p_ziel;
  if ziel_firma is distinct from firma then
    return false;
  end if;
  if ziel_austritt is not null and ziel_austritt < current_date then
    return false;
  end if;

  select true, ps.team_eigene, ps.team_andere
    into hat_profil, er_eigene, er_andere
    from public.profiles p
    left join public.privacy_settings ps on ps.user_id = p.id and ps.company_id = firma
   where p.employee_id = p_ziel and p.company_id = firma
   limit 1;
  if not coalesce(hat_profil, false) then
    return false;
  end if;

  select cs.team_sichtbarkeit into modus from public.company_settings cs where cs.company_id = firma;
  if coalesce(modus, 'zustimmung') = 'alle' then
    return true;
  end if;

  select e.rotation_team::text into mein_team from public.employees e where e.id = me;
  select ps.team_eigene, ps.team_andere into ich_eigene, ich_andere
    from public.privacy_settings ps where ps.user_id = auth.uid() and ps.company_id = firma;

  if coalesce(ziel_team, '') = coalesce(mein_team, '') then
    return coalesce(er_eigene, false) and coalesce(ich_eigene, false);
  end if;
  return coalesce(er_andere, false) and coalesce(ich_andere, false);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.team_sichtbarkeit_setzen(p_eigene boolean DEFAULT NULL::boolean, p_andere boolean DEFAULT NULL::boolean, p_push_ohne_inhalt boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
  gefragt boolean := p_eigene is not null or p_andere is not null;
begin
  if auth.uid() is null or firma is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  insert into public.privacy_settings (user_id, company_id, team_eigene, team_andere, team_gefragt_am, push_ohne_inhalt)
  values (auth.uid(), firma, coalesce(p_eigene, false), coalesce(p_andere, false),
          case when gefragt then now() end, coalesce(p_push_ohne_inhalt, false))
  on conflict (user_id) do update set
    team_eigene = coalesce(p_eigene, privacy_settings.team_eigene),
    team_andere = coalesce(p_andere, privacy_settings.team_andere),
    team_gefragt_am = case when gefragt then now() else privacy_settings.team_gefragt_am end,
    push_ohne_inhalt = coalesce(p_push_ohne_inhalt, privacy_settings.push_ohne_inhalt);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.team_sichtbarkeit_zahlen()
 RETURNS TABLE(eigene integer, andere integer, abgelehnt integer, offen integer, nicht_angemeldet integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  with leute as (
    select e.id,
           exists (select 1 from public.profiles p where p.employee_id = e.id and p.company_id = firma) as angemeldet,
           (select ps from public.profiles p join public.privacy_settings ps on ps.user_id = p.id
             where p.employee_id = e.id and p.company_id = firma limit 1) as ps
      from public.employees e
     where e.company_id = firma and e.active and (e.exit_date is null or e.exit_date >= current_date)
  )
  select count(*) filter (where angemeldet and coalesce((ps).team_eigene, false))::int,
         count(*) filter (where angemeldet and coalesce((ps).team_andere, false))::int,
         count(*) filter (where angemeldet and (ps).team_gefragt_am is not null
                                and not coalesce((ps).team_eigene, false) and not coalesce((ps).team_andere, false))::int,
         count(*) filter (where angemeldet and (ps).team_gefragt_am is null)::int,
         count(*) filter (where not angemeldet)::int
    from leute;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.team_sonder_konten(p_year integer DEFAULT NULL::integer)
 RETURNS TABLE(employee_id uuid, su_erlaubt boolean, su_anspruch numeric, su_rest numeric, af_freigeschaltet boolean, af_verfuegbar numeric, af_rest_stunden numeric, af_stand numeric, v_stunden boolean, v_stand numeric, v_moeglich numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  y int := coalesce(p_year, extract(year from public.heute())::int);
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id,
         su.anspruch > 0,
         su.anspruch, su.rest,
         e.af_ab is not null,
         af.noch_moeglich, af.rest_stunden, af.stand_heute,
         e.v_ab is not null,
         v.stand_heute, v.noch_moeglich
    from employees e
    cross join lateral leave_kind_kontingent(e.id, 'sonderurlaub', y) su
    cross join lateral stundenkonto(e.id, 'af') af
    cross join lateral stundenkonto(e.id, 'v') v
   where e.company_id = auth_company_id()
     and e.active;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.termin_ausfaelle(p_id uuid)
 RETURNS date[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(a.datum order by a.datum) filter (where not a.ab), '{}')
    from kalender_termin_ausnahmen a where a.termin_id = p_id
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.termin_ausnahme(p_id uuid, p_datum date, p_ab boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t kalender_termine;
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into t from kalender_termine k
   where k.id = p_id and (k.owner_id = auth.uid() or (k.von_user = auth.uid() and k.owner_id <> auth.uid()));
  if t.id is null then
    raise exception 'Diesen Termin kannst du nicht ändern.';
  end if;
  if p_datum is null then
    raise exception 'Welcher Tag?';
  end if;
  if t.wiederholung = 'nie' then
    delete from kalender_termine where id = p_id;
    return true;
  end if;
  if p_ab then
    if p_datum <= t.datum then
      delete from kalender_termine where id = p_id;
      return true;
    end if;
    delete from kalender_termin_ausnahmen where termin_id = p_id and datum >= p_datum;
    insert into kalender_termin_ausnahmen (termin_id, datum, ab) values (p_id, p_datum, true);
  else
    if exists (select 1 from kalender_termin_ausnahmen where termin_id = p_id and ab and datum <= p_datum) then
      return false;
    end if;
    insert into kalender_termin_ausnahmen (termin_id, datum, ab) values (p_id, p_datum, false)
    on conflict (termin_id, datum) do nothing;
  end if;
  return false;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.termin_entfernen(p_owner uuid, p_id uuid, p_nur_partner boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from kalender_termine
   where id = p_id and owner_id = p_owner and (not p_nur_partner or von_partner)
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.termin_loeschen(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from kalender_termine where id = p_id and owner_id = auth.uid()
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.termin_schreiben(p_owner uuid, p_von_partner boolean, p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.termin_serie_ab(p_id uuid)
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select min(a.datum) filter (where a.ab) from kalender_termin_ausnahmen a where a.termin_id = p_id
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.termin_sichern(p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text, p_erinnerung text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  neu uuid;
  bis date := case when coalesce(p_ganztaegig, false) and p_bis_datum > p_datum then p_bis_datum end;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if bis is not null and bis > p_datum + 62 then
    raise exception 'Ein Termin kann höchstens zwei Monate lang sein.';
  end if;
  if p_erinnerung is not null and p_erinnerung not in ('m10', 'h1', 'd1', 'morgens8', 'vortag18', 'tag8', 'd2') then
    raise exception 'Diese Erinnerung gibt es nicht.';
  end if;
  -- Erst das alte Enddatum lösen – sonst stört es, wenn der Beginn wandert.
  if p_id is not null then
    update kalender_termine set bis_datum = null where id = p_id and owner_id = auth.uid();
  end if;
  neu := termin_schreiben(auth.uid(), false, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
  update kalender_termine set bis_datum = bis, erinnerung = p_erinnerung
   where id = neu and owner_id = auth.uid();
  return neu;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.termin_speichern(p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return termin_schreiben(auth.uid(), false, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.todo_erledigt(p_id uuid, p_an boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  update kalender_todos
     set erledigt = coalesce(p_an, false),
         erledigt_am = case when coalesce(p_an, false) then now() end
   where id = p_id and owner_id = auth.uid();
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.todo_loeschen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  delete from kalender_todos where id = p_id and owner_id = auth.uid();
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.todo_speichern(p_id uuid, p_titel text, p_datum date, p_uhrzeit time without time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  neu uuid;
  v_titel text := left(btrim(coalesce(p_titel, '')), 120);
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if v_titel = '' then
    raise exception 'Was steht an? Der Text fehlt noch.';
  end if;
  if p_id is null then
    -- Alt Erledigtes aufräumen, dann die Obergrenze prüfen.
    delete from kalender_todos
     where owner_id = auth.uid() and erledigt and erledigt_am < now() - interval '30 days';
    if (select count(*) from kalender_todos where owner_id = auth.uid()) >= 1000 then
      raise exception 'Zu viele To-dos – hak ein paar ab oder lösch sie.';
    end if;
    insert into kalender_todos (owner_id, titel, datum, uhrzeit)
    values (auth.uid(), v_titel, p_datum, case when p_datum is null then null else p_uhrzeit end)
    returning id into neu;
    return neu;
  end if;
  update kalender_todos
     set titel = v_titel, datum = p_datum,
         uhrzeit = case when p_datum is null then null else p_uhrzeit end
   where id = p_id and owner_id = auth.uid()
  returning id into neu;
  if neu is null then
    raise exception 'To-do nicht gefunden.';
  end if;
  return neu;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.training_plan(p_from date, p_to date)
 RETURNS TABLE(id uuid, employee_id uuid, name text, start_date date, end_date date, area text, shift_id uuid, shift_name text, note text, status text, abwesend_tage integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    t.id, t.employee_id, e.first_name || ' ' || e.last_name,
    t.start_date, t.end_date, t.area, t.shift_id, s.name, t.note, t.status,
    (select count(*)::int
       from generate_series(greatest(t.start_date, p_from),
                            least(t.end_date, p_to), '1 day') g
      where exists (select 1 from employees_absent_on(g::date) ab
                     where ab.employee_id = t.employee_id))
  from training_assignments t
  join employees e on e.id = t.employee_id
  left join shifts s on s.id = t.shift_id
  where t.company_id = auth_company_id()
    and (is_leadership() or t.employee_id = auth_employee_id())
    and t.start_date <= p_to
    and t.end_date >= p_from
  order by e.last_name, t.start_date;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.unterbesetzte_tage(p_gruppe uuid)
 RETURNS date[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r leave_requests;
  e employees;
  s shifts;
  d date;
  schicht uuid;
  geplant int;
  fehlt int;
  tage date[] := '{}';
begin
  for r in
    select * from leave_requests
    where coalesce(request_group_id, id) = p_gruppe and status = 'pending'
      and company_id = auth_company_id()
  loop
    select * into e from employees where id = r.employee_id;
    if e.id is null or not zaehlt_zur_besetzung(e) then
      continue;
    end if;
    d := r.start_date;
    while d <= r.end_date loop
      schicht := effective_shift_id(e.id, d);
      if schicht is not null then
        select * into s from shifts where id = schicht;
        if s.id is not null and s.target_staff > 0 and schicht_laeuft_fuer(e.id, d, s) then
          select count(*) into geplant from employees emp
           where emp.active and emp.company_id = e.company_id
             and zaehlt_zur_besetzung(emp)
             and effective_shift_id(emp.id, d) = schicht;
          select count(*) into fehlt from employees emp
           where emp.active and emp.company_id = e.company_id
             and zaehlt_zur_besetzung(emp)
             and effective_shift_id(emp.id, d) = schicht
             and emp.id in (select employee_id from employees_absent_on(d, false, r.id));
          if geplant - fehlt < s.minimum_staff then
            tage := array_append(tage, d);
          end if;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return tage;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.urlaubssperre_pruefen(p_employee_id uuid, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  emp employees;
  grund text;
begin
  select * into emp from employees where id = p_employee_id;
  if not found then
    return jsonb_build_object('grund', null, 'azubi', false);
  end if;
  -- Aus der App nur für den eigenen Betrieb; der Trigger läuft ohne Sitzungsprüfung.
  if auth.uid() is not null and emp.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  grund := leave_block_for_range(emp.company_id, emp.shift_id, p_start_date, p_end_date);
  if grund is null then
    return jsonb_build_object('grund', null, 'azubi', false);
  end if;
  if coalesce(emp.is_apprentice, false) then
    -- Sperre besteht, gilt aber nicht für diese Person.
    return jsonb_build_object('grund', null, 'azubi', true, 'sperre', grund);
  end if;
  return jsonb_build_object('grund', grund, 'azubi', false);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.v_tage_buchen(p_employee_id uuid, p_year integer, p_tage numeric, p_grund text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma uuid := auth_company_id();
  v_vorher numeric;
  v_rest numeric;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if not exists (select 1 from employees where id = p_employee_id and company_id = v_firma) then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not darf_urlaub_entscheiden(p_employee_id) then
    raise exception 'V-Tage ändern darfst du nur für deine eigene Schicht.';
  end if;
  if p_year is null or p_year < 2020 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  if p_tage is null or p_tage = 0 or abs(p_tage) > 100 or p_tage * 2 <> round(p_tage * 2) then
    raise exception 'Bitte eine Anzahl Tage angeben (z. B. 1, 2 oder 0,5 – höchstens 100).';
  end if;

  perform ensure_leave_balance(p_employee_id, p_year);

  select v_korrektur into v_vorher
    from leave_balances where employee_id = p_employee_id and year = p_year;
  if v_vorher is null then
    raise exception 'Für dieses Jahr gibt es noch kein Konto.';
  end if;

  update leave_balances
     set v_korrektur = v_korrektur + p_tage,
         updated_at = now()
   where employee_id = p_employee_id and year = p_year;

  select v_remaining_days into v_rest
    from leave_balances_view where employee_id = p_employee_id and year = p_year;

  perform write_audit(v_firma, 'v_tage.gebucht', 'leave_balances', p_employee_id,
    jsonb_build_object('jahr', p_year, 'tage', p_tage, 'grund', nullif(trim(p_grund), ''),
                       'korrektur_vorher', v_vorher, 'korrektur_nachher', v_vorher + p_tage,
                       'rest_nachher', v_rest));
  return v_rest;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.v_tage_rest(p_employee_id uuid, p_year integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r numeric;
begin
  select v_remaining_days into r from leave_balances_view
   where employee_id = p_employee_id and year = p_year;
  return coalesce(r, 0);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.v_tage_uebersicht(p_year integer)
 RETURNS TABLE(employee_id uuid, anspruch numeric, uebertrag numeric, korrektur numeric, genommen numeric, beantragt numeric, rest numeric, darf_buchen boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.id,
         coalesce(v.v_entitlement, e.v_days, 0),
         coalesce(v.v_carried_over, 0),
         coalesce(v.v_korrektur, 0),
         coalesce(v.v_used_days, 0),
         coalesce(v.v_pending_days, 0),
         coalesce(v.v_remaining_days, e.v_days, 0),
         darf_urlaub_entscheiden(e.id)
    from employees e
    left join leave_balances_view v on v.employee_id = e.id and v.year = p_year
   where e.company_id = auth_company_id()
     and e.active
     and is_leadership();
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_aendern(p_id uuid, p_art text, p_termine boolean, p_darf boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_annehmen(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    case when v_a = c.user_id then coalesce(p.termine_sehen, false) else false end,
    case when v_a = c.user_id then coalesce(p.darf_eintragen, false) else false end,
    case when v_b = c.user_id then coalesce(p.termine_sehen, false) else false end,
    case when v_b = c.user_id then coalesce(p.darf_eintragen, false) else false end)
  returning id into neu;

  if p.id is not null then
    perform person_tage_uebernehmen(p.id, ich);
    update kalender_termine set von_user = ich, person_id = null
     where person_id = p.id and owner_id = c.user_id;
    delete from kalender_personen where id = p.id;
  end if;

  delete from kalender_verbindung_codes where code_hash = c.code_hash;
  return neu;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_beenden(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from kalender_verbindungen where id = p_id and (a = auth.uid() or b = auth.uid());
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_code_erstellen(p_person uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_code_hash(p_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_code_info(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_code_lesen(p_code text)
 RETURNS kalender_verbindung_codes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_mit(p_ich uuid, p_partner uuid)
 RETURNS kalender_verbindungen
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from kalender_verbindungen
   where a = least(p_ich, p_partner) and b = greatest(p_ich, p_partner)
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_termin_loeschen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from kalender_termine where id = p_id and von_user = auth.uid() and owner_id <> auth.uid();
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbindung_termin_speichern(p_partner uuid, p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbunden_darf(p_inhaber uuid, p_schreiber uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select case when v.a = p_inhaber then v.a_darf else v.b_darf end
                     from kalender_verbindungen v
                    where v.a = least(p_inhaber, p_schreiber) and v.b = greatest(p_inhaber, p_schreiber)), false)
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbunden_termine_sichtbar(p_inhaber uuid, p_leser uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select case when v.a = p_inhaber then v.a_termine else v.b_termine end
                     from kalender_verbindungen v
                    where v.a = least(p_inhaber, p_leser) and v.b = greatest(p_inhaber, p_leser)), false)
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbundene_tage(p_von date, p_tage integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'id', v.partner, 'tage', kalender_codes(v.partner, p_von, p_tage),
      'farben', kalender_farben_codes(v.partner)));
  end loop;
  return liste;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.verbundene_termine()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
             'wiederholung', t.wiederholung, 'notiz', t.notiz, 'ort', t.ort,
             'ausfaelle', to_jsonb(termin_ausfaelle(t.id)), 'serie_ab', termin_serie_ab(t.id)) order by t.datum)
      from kalender_termine t
      join kalender_verbindungen v
        on (v.a = ich and v.b = t.owner_id) or (v.b = ich and v.a = t.owner_id)
     where t.von_user = ich
        or (verbunden_termine_sichtbar(t.owner_id, ich) and not t.von_partner)), '[]'::jsonb);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.vierer_regel_tage(p_employee_id uuid, p_von date, p_bis date, p_ohne_antrag uuid DEFAULT NULL::uuid)
 RETURNS TABLE(tag date, andere integer, andere_v integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if e.id is distinct from auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_bis < p_von or p_bis - p_von > 366 or not e.shift_worker then return; end if;

  return query
  with tage as (
    select d::date as tag, gruppe_am(e.id, d::date, e.rotation_team) as team
      from generate_series(greatest(p_von, date '2027-01-01'), p_bis, interval '1 day') d
  )
  select t.tag,
         count(distinct r.employee_id)::int,
         count(distinct r.employee_id) filter (where r.kind = 'v_tag' and r.v_jahresplanung = false)::int
    from tage t
    left join leave_requests r
      on t.tag between r.start_date and r.end_date
     and r.status in ('approved', 'pending')
     and r.kind in ('urlaub', 'v_tag')
     and r.employee_id <> e.id
     and r.id is distinct from p_ohne_antrag
     and exists (select 1 from employees o
                  where o.id = r.employee_id and o.company_id = e.company_id and o.active
                    and not coalesce(o.is_apprentice, false)
                    and gruppe_am(o.id, t.tag, o.rotation_team) is not distinct from t.team)
     and is_planned_workday(r.employee_id, t.tag)
   where t.team is not null
     and is_planned_workday(e.id, t.tag)
   group by t.tag
   order by t.tag;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.vj_kontingent(p_employee_id uuid, p_year integer)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(ceil(0.75 * (b.v_entitlement + b.v_carried_over + coalesce(b.v_korrektur, 0))), 0)
    from leave_balances b
   where b.employee_id = p_employee_id and b.year = p_year;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.vj_rest(p_employee_id uuid, p_year integer, p_ohne uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(vj_kontingent(p_employee_id, p_year), 0)
       - coalesce((select sum(r.requested_days) from leave_requests r
                    where r.employee_id = p_employee_id
                      and r.kind = 'v_tag'
                      and r.v_jahresplanung
                      and r.status in ('approved', 'pending')
                      and extract(year from r.start_date) = p_year
                      and r.id is distinct from p_ohne), 0);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.vj_stand(p_year integer, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(kontingent numeric, belegt numeric, rest numeric, v_belegt numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  emp uuid := coalesce(p_employee_id, auth_employee_id());
begin
  if p_year < 2027 or emp is null then return; end if;
  if emp is distinct from auth_employee_id()
     and not (is_leadership() and exists (select 1 from employees e where e.id = emp and e.company_id = auth_company_id())) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  select vj_kontingent(emp, p_year),
         vj_kontingent(emp, p_year) - vj_rest(emp, p_year),
         vj_rest(emp, p_year),
         coalesce((select sum(r.requested_days) from leave_requests r
                    where r.employee_id = emp and r.kind = 'v_tag' and r.v_jahresplanung = false
                      and r.status in ('approved', 'pending')
                      and extract(year from r.start_date) = p_year), 0);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.vj_umstellen(p_request_id uuid, p_vj boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r leave_requests;
begin
  select * into r from leave_requests where id = p_request_id;
  if r.id is null or r.company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if not darf_urlaub_entscheiden(r.employee_id) then
    raise exception 'Das darfst du nur für deine eigene Schicht.';
  end if;
  if r.kind <> 'v_tag' or extract(year from r.start_date) < 2027 then
    raise exception 'VJ und V gibt es erst ab 2027 und nur bei V-Tagen.';
  end if;
  update leave_requests set v_jahresplanung = p_vj where id = r.id;
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (r.company_id, auth.uid(), 'leave.vj_umgestellt', 'leave_requests', r.id,
          jsonb_build_object('vj', p_vj, 'von', r.start_date, 'bis', r.end_date));
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.vorlieben_setzen(p_rollen text[], p_vorlagen jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rollen text[];
  v_vorlagen jsonb;
  e jsonb;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  if p_rollen is not null then
    select coalesce(array_agg(distinct r), '{}') into v_rollen
      from unnest(p_rollen) r
     where r in ('schule', 'studium', 'job', 'schicht', 'eltern', 'anders');
  end if;

  if p_vorlagen is not null then
    if jsonb_typeof(p_vorlagen) <> 'array' or jsonb_array_length(p_vorlagen) > 12 then
      raise exception 'Höchstens 12 eigene Vorlagen.';
    end if;
    v_vorlagen := '[]'::jsonb;
    for e in select * from jsonb_array_elements(p_vorlagen) loop
      if jsonb_typeof(e) <> 'object' or btrim(coalesce(e->>'titel', '')) = '' then
        raise exception 'Eine Vorlage braucht einen Namen.';
      end if;
      v_vorlagen := v_vorlagen || jsonb_build_array(jsonb_build_object(
        'icon', left(coalesce(e->>'icon', ''), 8),
        'titel', left(btrim(e->>'titel'), 40),
        'min', least(greatest(coalesce((e->>'min')::int, 60), 0), 1440)));
    end loop;
  end if;

  insert into kalender_vorlieben (user_id, rollen, vorlagen, gefragt)
  values (auth.uid(), coalesce(v_rollen, '{}'), coalesce(v_vorlagen, '[]'::jsonb), true)
  on conflict (user_id) do update
     set rollen = coalesce(v_rollen, kalender_vorlieben.rollen),
         vorlagen = coalesce(v_vorlagen, kalender_vorlieben.vorlagen),
         gefragt = true,
         geaendert_am = now();
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.who_is_absent(p_date date)
 RETURNS TABLE(employee_id uuid, employee_name text, shift_name text, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id, e.first_name || ' ' || e.last_name,
         s.name, leave_kind_label(r.kind)
  from leave_requests r
  join employees e on e.id = r.employee_id
  left join shifts s on s.id = effective_shift_id(e.id, p_date)
  where e.company_id = auth_company_id()
    and e.active
    and r.status = 'approved'
    and p_date between r.start_date and r.end_date

  union all

  select e.id, e.first_name || ' ' || e.last_name,
         s.name,
         case a.type
           when 'krank' then 'Krankheit'
           when 'schulung' then 'Schulung'
           else 'Sonstiges'
         end
  from absences a
  join employees e on e.id = a.employee_id
  left join shifts s on s.id = effective_shift_id(e.id, p_date)
  where e.company_id = auth_company_id()
    and e.active
    and a.date = p_date

  order by 2;
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.withdraw_leave_request(p_request_id uuid)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from leave_requests r
     where r.id = p_request_id
       and r.employee_id = auth_employee_id()
       and r.status = 'pending'
  ) then
    raise exception 'Der Antrag laesst sich nicht mehr zurueckziehen.';
  end if;
  return antrag_zuruecknehmen(p_request_id, null);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.write_audit(p_company_id uuid, p_action text, p_entity text, p_entity_id uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_company_id is distinct from auth_company_id()
     and auth.role() <> 'service_role'
     and not (
       auth_company_id() is null
       and exists (
         select 1 from companies c
          where c.id = p_company_id
            and c.created_at > now() - interval '15 minutes'
            and not exists (select 1 from profiles p where p.company_id = c.id)
       )
     )
  then
    raise exception 'Ungültiger Mandant für Audit-Log.';
  end if;

  insert into public.audit_logs
    (company_id, actor_id, action, entity, entity_id, payload)
  values
    (p_company_id, auth.uid(), p_action, p_entity, p_entity_id, p_payload);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.zaehlt_zur_besetzung(e employees)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select not coalesce(e.is_apprentice, false);
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.zugang_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select not exists (
           select 1 from anmelde_sperren s
            where s.user_id = auth.uid() and s.gesperrt_am is not null)
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (
            select 1 from auth.mfa_factors f
             where f.user_id = auth.uid() and f.status = 'verified')
          or sitzung_vertraut());
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.zugang_protokollieren(p_employee uuid, p_art text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  firma uuid;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_art not in ('link', 'link_neu') then
    raise exception 'Ungültige Art.';
  end if;
  select company_id into firma from employees where id = p_employee and company_id = auth_company_id();
  if firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  perform write_audit(firma, 'zugang.' || p_art, 'employees', p_employee, '{}'::jsonb);
end;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.zugang_status_firma()
 RETURNS TABLE(employee_id uuid, gesperrt boolean, zwei_faktor boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select p.employee_id,
         exists (select 1 from anmelde_sperren s where s.user_id = p.id and s.gesperrt_am is not null),
         exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
    from profiles p
   where is_admin()
     and p.company_id = auth_company_id()
     and p.employee_id is not null;
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.zustaendige_fuehrung(p_employee_id uuid)
 RETURNS TABLE(employee_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.employee_id
    from employees ziel
    join profiles p on p.company_id = ziel.company_id
    join employees pe on pe.id = p.employee_id
   where ziel.id = p_employee_id
     and p.active
     and p.employee_id is not null
     and p.employee_id <> p_employee_id
     and (
       p.role = 'admin'
       or (p.role = 'shift_leader'
           and (ziel.rotation_team is null or pe.rotation_team is null
                or pe.rotation_team = ziel.rotation_team))
     );
$function$
;
-- @@
CREATE OR REPLACE FUNCTION public.zwei_faktor_zuruecksetzen(p_employee uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_user uuid;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf die Zwei-Faktor-Anmeldung zurücksetzen.' using errcode = '42501';
  end if;
  select id into v_user from profiles where employee_id = p_employee and company_id = auth_company_id();
  if v_user is null then
    raise exception 'Person nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_user = auth.uid() then
    raise exception 'Den eigenen zweiten Faktor setzt eine andere Administration oder der Support zurück.' using errcode = '42501';
  end if;
  delete from auth.mfa_factors where user_id = v_user;
  delete from vertraute_geraete where user_id = v_user;
  perform protokoll_schreiben(auth_company_id(), 'zwei_faktor.zurueckgesetzt', 'profiles', v_user, jsonb_build_object('employee_id', p_employee));
end;
$function$
;
-- ##VIEWS
create or replace view public.leave_balances_view with (security_invoker=true) as  WITH leave_days AS (
         SELECT DISTINCT r.employee_id,
            (gs.day)::date AS day,
            r.status,
            r.kind,
            (EXTRACT(year FROM gs.day))::integer AS jahr
           FROM (leave_requests r
             CROSS JOIN LATERAL generate_series((r.start_date)::timestamp with time zone, (r.end_date)::timestamp with time zone, '1 day'::interval) gs(day))
          WHERE ((r.status = ANY (ARRAY['approved'::leave_status, 'pending'::leave_status])) AND is_planned_workday(r.employee_id, (gs.day)::date))
        ), counted AS (
         SELECT leave_days.employee_id,
            leave_days.jahr,
            count(*) FILTER (WHERE ((leave_days.kind = 'urlaub'::leave_kind) AND (leave_days.status = 'approved'::leave_status) AND (leave_days.day < heute()))) AS used_days,
            count(*) FILTER (WHERE ((leave_days.kind = 'urlaub'::leave_kind) AND (leave_days.status = 'approved'::leave_status) AND (leave_days.day >= heute()))) AS planned_days,
            count(*) FILTER (WHERE ((leave_days.kind = 'urlaub'::leave_kind) AND (leave_days.status = 'pending'::leave_status))) AS pending_days,
            count(*) FILTER (WHERE ((leave_days.kind = 'urlaub'::leave_kind) AND (leave_days.status = 'approved'::leave_status) AND (leave_days.day <= make_date(leave_days.jahr, 3, 31)))) AS used_until_march,
            count(*) FILTER (WHERE ((leave_days.kind = 'v_tag'::leave_kind) AND (leave_days.status = 'approved'::leave_status))) AS v_used,
            count(*) FILTER (WHERE ((leave_days.kind = 'v_tag'::leave_kind) AND (leave_days.status = 'pending'::leave_status))) AS v_pending
           FROM leave_days
          GROUP BY leave_days.employee_id, leave_days.jahr
        ), fehl AS (
         SELECT f.employee_id,
            (EXTRACT(year FROM f.tag))::integer AS jahr,
            sum(f.stunden) AS stunden
           FROM fehlzeiten f
          WHERE (f.abzug = 'v'::text)
          GROUP BY f.employee_id, ((EXTRACT(year FROM f.tag))::integer)
        )
 SELECT b.id,
    b.company_id,
    b.employee_id,
    b.year,
    b.entitlement,
        CASE
            WHEN (heute() <= make_date((b.year)::integer, 3, 31)) THEN b.carried_over
            ELSE LEAST(b.carried_over, (COALESCE(c.used_until_march, (0)::bigint))::numeric)
        END AS carried_over,
    (COALESCE(c.used_days, (0)::bigint))::numeric AS used_days,
    (COALESCE(c.planned_days, (0)::bigint))::numeric AS planned_days,
    (COALESCE(c.pending_days, (0)::bigint))::numeric AS pending_days,
    ((((b.entitlement +
        CASE
            WHEN (heute() <= make_date((b.year)::integer, 3, 31)) THEN b.carried_over
            ELSE LEAST(b.carried_over, (COALESCE(c.used_until_march, (0)::bigint))::numeric)
        END) - (COALESCE(c.used_days, (0)::bigint))::numeric) - (COALESCE(c.planned_days, (0)::bigint))::numeric) - (COALESCE(c.pending_days, (0)::bigint))::numeric) AS remaining_days,
    b.v_entitlement,
    b.v_carried_over,
    ((COALESCE(c.v_used, (0)::bigint))::numeric + COALESCE(round((fe.stunden / 7.5), 4), (0)::numeric)) AS v_used_days,
    (COALESCE(c.v_pending, (0)::bigint))::numeric AS v_pending_days,
    (((((b.v_entitlement + b.v_carried_over) + b.v_korrektur) - (COALESCE(c.v_used, (0)::bigint))::numeric) - COALESCE(round((fe.stunden / 7.5), 4), (0)::numeric)) - (COALESCE(c.v_pending, (0)::bigint))::numeric) AS v_remaining_days,
    b.created_at,
    b.updated_at,
    b.v_korrektur,
    COALESCE(fe.stunden, (0)::numeric) AS v_fehl_stunden
   FROM ((leave_balances b
     LEFT JOIN counted c ON (((c.employee_id = b.employee_id) AND (c.jahr = b.year))))
     LEFT JOIN fehl fe ON (((fe.employee_id = b.employee_id) AND (fe.jahr = b.year))));
-- ##CONSTRAINTS
alter table public.absences add constraint absences_pkey PRIMARY KEY (id);
alter table public.aenderungszaehler add constraint aenderungszaehler_pkey PRIMARY KEY (company_id, bereich);
alter table public.age_leave_grants add constraint age_leave_grants_pkey PRIMARY KEY (id);
alter table public.anmelde_sperren add constraint anmelde_sperren_pkey PRIMARY KEY (user_id);
alter table public.announcements add constraint announcements_pkey PRIMARY KEY (id);
alter table public.anzeige_einstellungen add constraint anzeige_einstellungen_pkey PRIMARY KEY (user_id);
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.betrieb_beitritte add constraint betrieb_beitritte_pkey PRIMARY KEY (code);
alter table public.companies add constraint companies_pkey PRIMARY KEY (id);
alter table public.company_settings add constraint company_settings_pkey PRIMARY KEY (company_id);
alter table public.demo_settings add constraint demo_settings_pkey PRIMARY KEY (id);
alter table public.email_outbox add constraint email_outbox_pkey PRIMARY KEY (id);
alter table public.employee_gruppenwechsel add constraint employee_gruppenwechsel_pkey PRIMARY KEY (id);
alter table public.employee_qualifications add constraint employee_qualifications_pkey PRIMARY KEY (employee_id, qualification_id);
alter table public.employees add constraint employees_pkey PRIMARY KEY (id);
alter table public.erinnerung_gesendet add constraint erinnerung_gesendet_pkey PRIMARY KEY (art, ref_id, faellig_am);
alter table public.fehlzeiten add constraint fehlzeiten_pkey PRIMARY KEY (id);
alter table public.funktionen add constraint funktionen_pkey PRIMARY KEY (funktion);
alter table public.funktionen_zugang add constraint funktionen_zugang_pkey PRIMARY KEY (funktion, user_id);
alter table public.hinweise add constraint hinweise_pkey PRIMARY KEY (id);
alter table public.holidays add constraint holidays_pkey PRIMARY KEY (id);
alter table public.kalender_abo add constraint kalender_abo_pkey PRIMARY KEY (id);
alter table public.kalender_eigene_arten add constraint kalender_eigene_arten_pkey PRIMARY KEY (id);
alter table public.kalender_eigene_tage add constraint kalender_eigene_tage_pkey PRIMARY KEY (user_id, tag);
alter table public.kalender_farben add constraint kalender_farben_pkey PRIMARY KEY (user_id, schluessel);
alter table public.kalender_gruppen add constraint kalender_gruppen_pkey PRIMARY KEY (id);
alter table public.kalender_gruppen_mitglieder add constraint kalender_gruppen_mitglieder_pkey PRIMARY KEY (gruppe_id, user_id);
alter table public.kalender_partner add constraint kalender_partner_pkey PRIMARY KEY (id);
alter table public.kalender_partner_tage add constraint kalender_partner_tage_pkey PRIMARY KEY (owner_id, tag);
alter table public.kalender_personen add constraint kalender_personen_pkey PRIMARY KEY (id);
alter table public.kalender_personen_tage add constraint kalender_personen_tage_pkey PRIMARY KEY (person_id, tag);
alter table public.kalender_termin_ausnahmen add constraint kalender_termin_ausnahmen_pkey PRIMARY KEY (termin_id, datum);
alter table public.kalender_termine add constraint kalender_termine_pkey PRIMARY KEY (id);
alter table public.kalender_todos add constraint kalender_todos_pkey PRIMARY KEY (id);
alter table public.kalender_verbindung_codes add constraint kalender_verbindung_codes_pkey PRIMARY KEY (code_hash);
alter table public.kalender_verbindungen add constraint kalender_verbindungen_pkey PRIMARY KEY (id);
alter table public.kalender_vorlieben add constraint kalender_vorlieben_pkey PRIMARY KEY (user_id);
alter table public.konsole_tresor add constraint konsole_tresor_pkey PRIMARY KEY (id);
alter table public.konsole_tresor_schluessel add constraint konsole_tresor_schluessel_pkey PRIMARY KEY (id);
alter table public.leave_balances add constraint leave_balances_pkey PRIMARY KEY (id);
alter table public.leave_requests add constraint leave_requests_pkey PRIMARY KEY (id);
alter table public.legal_versions add constraint legal_versions_pkey PRIMARY KEY (doc);
alter table public.lohnzettel_aufraeumen add constraint lohnzettel_aufraeumen_pkey PRIMARY KEY (pfad);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.passwort_codes add constraint passwort_codes_pkey PRIMARY KEY (user_id);
alter table public.personal_details add constraint personal_details_pkey PRIMARY KEY (user_id);
alter table public.plan_kommentare add constraint plan_kommentare_pkey PRIMARY KEY (id);
alter table public.platform_admins add constraint platform_admins_pkey PRIMARY KEY (user_id);
alter table public.plattform_protokoll add constraint plattform_protokoll_pkey PRIMARY KEY (id);
alter table public.plattform_tageszahlen add constraint plattform_tageszahlen_pkey PRIMARY KEY (tag);
alter table public.privacy_settings add constraint privacy_settings_pkey PRIMARY KEY (user_id);
alter table public.privat_konten add constraint privat_konten_pkey PRIMARY KEY (user_id);
alter table public.privat_lohnzettel add constraint privat_lohnzettel_pkey PRIMARY KEY (id);
alter table public.privat_schichtarten add constraint privat_schichtarten_pkey PRIMARY KEY (id);
alter table public.privat_tag_zeiten add constraint privat_tag_zeiten_pkey PRIMARY KEY (user_id, tag, schichtart_id);
alter table public.privat_tage add constraint privat_tage_pkey PRIMARY KEY (user_id, tag, ebene);
alter table public.privat_umfrage add constraint privat_umfrage_pkey PRIMARY KEY (user_id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.protokoll_zugang add constraint protokoll_zugang_pkey PRIMARY KEY (user_id);
alter table public.push_abos add constraint push_abos_pkey PRIMARY KEY (id);
alter table public.push_vorlieben add constraint push_vorlieben_pkey PRIMARY KEY (user_id);
alter table public.push_warteschlange add constraint push_warteschlange_pkey PRIMARY KEY (id);
alter table public.qualifications add constraint qualifications_pkey PRIMARY KEY (id);
alter table public.rate_limit_hits add constraint rate_limit_hits_pkey PRIMARY KEY (id);
alter table public.replacement_requests add constraint replacement_requests_pkey PRIMARY KEY (id);
alter table public.rotation_patterns add constraint rotation_patterns_pkey PRIMARY KEY (id);
alter table public.schicht_tausch add constraint schicht_tausch_pkey PRIMARY KEY (id);
alter table public.school_holidays add constraint school_holidays_pkey PRIMARY KEY (id);
alter table public.shift_assignments add constraint shift_assignments_pkey PRIMARY KEY (id);
alter table public.shift_qualification_needs add constraint shift_qualification_needs_pkey PRIMARY KEY (id);
alter table public.shifts add constraint shifts_pkey PRIMARY KEY (id);
alter table public.staffing_rules add constraint staffing_rules_pkey PRIMARY KEY (id);
alter table public.training_assignments add constraint training_assignments_pkey PRIMARY KEY (id);
alter table public.vertraute_geraete add constraint vertraute_geraete_pkey PRIMARY KEY (id);
alter table public.vertraute_sitzungen add constraint vertraute_sitzungen_pkey PRIMARY KEY (session_id);
alter table public.absences add constraint absences_employee_id_date_type_key UNIQUE (employee_id, date, type);
alter table public.age_leave_grants add constraint age_leave_grants_employee_id_year_key UNIQUE (employee_id, year);
alter table public.employee_gruppenwechsel add constraint employee_gruppenwechsel_employee_id_ab_key UNIQUE (employee_id, ab);
alter table public.employees add constraint employees_company_id_personnel_number_key UNIQUE (company_id, personnel_number);
alter table public.fehlzeiten add constraint fehlzeiten_employee_id_tag_art_key UNIQUE (employee_id, tag, art);
alter table public.holidays add constraint holidays_company_id_date_key UNIQUE (company_id, date);
alter table public.kalender_abo add constraint kalender_abo_token_hash_key UNIQUE (token_hash);
alter table public.kalender_eigene_arten add constraint kalender_eigene_arten_user_id_id_key UNIQUE (user_id, id);
alter table public.kalender_gruppen add constraint kalender_gruppen_token_hash_key UNIQUE (token_hash);
alter table public.kalender_partner add constraint kalender_partner_token_hash_key UNIQUE (token_hash);
alter table public.kalender_personen add constraint kalender_personen_token_hash_key UNIQUE (token_hash);
alter table public.kalender_verbindungen add constraint kalender_verbindungen_a_b_key UNIQUE (a, b);
alter table public.konsole_tresor add constraint konsole_tresor_datei_pfad_key UNIQUE (datei_pfad);
alter table public.leave_balances add constraint leave_balances_employee_id_year_key UNIQUE (employee_id, year);
alter table public.privat_lohnzettel add constraint privat_lohnzettel_pfad_key UNIQUE (pfad);
alter table public.privat_schichtarten add constraint privat_schichtarten_user_id_id_key UNIQUE (user_id, id);
alter table public.profiles add constraint profiles_employee_id_key UNIQUE (employee_id);
alter table public.push_abos add constraint push_abos_endpoint_key UNIQUE (endpoint);
alter table public.qualifications add constraint qualifications_company_id_key_key UNIQUE (company_id, key);
alter table public.replacement_requests add constraint replacement_requests_asked_employee_id_date_shift_id_key UNIQUE (asked_employee_id, date, shift_id);
alter table public.school_holidays add constraint school_holidays_company_id_region_name_start_date_key UNIQUE (company_id, region, name, start_date);
alter table public.shift_assignments add constraint shift_assignments_employee_id_date_key UNIQUE (employee_id, date);
alter table public.shift_qualification_needs add constraint shift_qualification_needs_shift_id_qualification_id_key UNIQUE (shift_id, qualification_id);
alter table public.staffing_rules add constraint staffing_rules_company_id_shift_id_key_key UNIQUE (company_id, shift_id, key);
alter table public.vertraute_geraete add constraint vertraute_geraete_token_hash_key UNIQUE (token_hash);
alter table public.aenderungszaehler add constraint aenderungszaehler_bereich_check CHECK ((bereich = ANY (ARRAY['antraege'::text, 'abwesenheiten'::text, 'plan'::text, 'mitteilungen'::text])));
alter table public.age_leave_grants add constraint age_leave_grants_days_plausibel CHECK (((confirmed_days >= (0)::numeric) AND (confirmed_days <= (60)::numeric)));
alter table public.age_leave_grants add constraint age_leave_grants_jahr_plausibel CHECK (((year >= 2000) AND (year <= 2100)));
alter table public.announcements add constraint announcements_level_check CHECK ((level = ANY (ARRAY['info'::text, 'warn'::text])));
alter table public.anzeige_einstellungen add constraint anzeige_einstellungen_plan_ansicht_check CHECK ((plan_ansicht = ANY (ARRAY['kompakt'::text, 'gross'::text])));
alter table public.anzeige_einstellungen add constraint anzeige_einstellungen_wochenende_check CHECK ((wochenende = ANY (ARRAY['aus'::text, 'leicht'::text, 'kraeftig'::text])));
alter table public.betrieb_beitritte add constraint betrieb_beitritte_code_check CHECK ((code ~ '^[A-Z2-9]{8}$'::text));
alter table public.companies add constraint companies_v_tag_name_check CHECK (((char_length(btrim(v_tag_name)) >= 1) AND (char_length(btrim(v_tag_name)) <= 40)));
alter table public.companies add constraint companies_v_tage_name_check CHECK (((char_length(btrim(v_tage_name)) >= 1) AND (char_length(btrim(v_tage_name)) <= 40)));
alter table public.company_settings add constraint company_settings_hinweis_standard_check CHECK ((hinweis_standard = ANY (ARRAY['schicht'::text, 'sofort'::text, 'aus'::text])));
alter table public.company_settings add constraint company_settings_team_sichtbarkeit_check CHECK ((team_sichtbarkeit = ANY (ARRAY['alle'::text, 'zustimmung'::text])));
alter table public.demo_settings add constraint demo_settings_id_check CHECK (id);
alter table public.email_outbox add constraint email_outbox_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'gesendet'::text, 'fehler'::text])));
alter table public.employees add constraint employees_austritt_nach_eintritt CHECK (((exit_date IS NULL) OR (entry_date IS NULL) OR (exit_date >= entry_date)));
alter table public.fehlzeiten add constraint fehlzeiten_abzug_check CHECK ((abzug = ANY (ARRAY['v'::text, 'af'::text])));
alter table public.fehlzeiten add constraint fehlzeiten_art_check CHECK ((art = ANY (ARRAY['frueher_gegangen'::text, 'spaeter_gekommen'::text])));
alter table public.fehlzeiten add constraint fehlzeiten_notiz_check CHECK (((notiz IS NULL) OR (char_length(notiz) <= 200)));
alter table public.fehlzeiten add constraint fehlzeiten_stunden_check CHECK (((stunden > (0)::numeric) AND (stunden < (8)::numeric) AND ((stunden * (4)::numeric) = floor((stunden * (4)::numeric)))));
alter table public.hinweise add constraint hinweise_push_check CHECK ((push = ANY (ARRAY['schicht'::text, 'sofort'::text, 'aus'::text])));
alter table public.hinweise add constraint hinweise_text_check CHECK (((char_length(text) >= 1) AND (char_length(text) <= 300)));
alter table public.hinweise add constraint hinweise_ziel_check CHECK ((ziel = ANY (ARRAY['/urlaub'::text, '/meine-schichten'::text, '/kalender'::text, '/start'::text])));
alter table public.kalender_eigene_arten add constraint kalender_eigene_arten_farbe_check CHECK ((farbe ~ '^#[0-9a-fA-F]{6}$'::text));
alter table public.kalender_eigene_arten add constraint kalender_eigene_arten_kuerzel_check CHECK (((length(btrim(kuerzel)) >= 1) AND (length(btrim(kuerzel)) <= 3)));
alter table public.kalender_eigene_arten add constraint kalender_eigene_arten_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 30)));
alter table public.kalender_eigene_tage add constraint kalender_eigene_tage_tag_check CHECK (((tag >= '2000-01-01'::date) AND (tag <= '2100-12-31'::date)));
alter table public.kalender_farben add constraint kalender_farben_farbe_check CHECK ((farbe ~ '^#[0-9a-fA-F]{6}$'::text));
alter table public.kalender_farben add constraint kalender_farben_schluessel_check CHECK ((schluessel ~ '^[A-Za-z0-9:_-]{1,40}$'::text));
alter table public.kalender_gruppen add constraint kalender_gruppen_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 40)));
alter table public.kalender_partner_tage add constraint kalender_partner_tage_schicht_check CHECK ((schicht = ANY (ARRAY['F'::text, 'S'::text, 'N'::text, 'T'::text, 'U'::text, 'X'::text])));
alter table public.kalender_personen add constraint kalender_personen_art_check CHECK ((art = ANY (ARRAY['partner'::text, 'familie'::text, 'freunde'::text, 'kollegen'::text])));
alter table public.kalender_personen add constraint kalender_personen_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 40)));
alter table public.kalender_personen_tage add constraint kalender_personen_tage_schicht_check CHECK ((schicht = ANY (ARRAY['F'::text, 'S'::text, 'N'::text, 'T'::text, 'U'::text, 'X'::text])));
alter table public.kalender_termine add constraint kalender_termine_bis_datum_check CHECK (((bis_datum IS NULL) OR ((bis_datum >= datum) AND (bis_datum <= (datum + 62)))));
alter table public.kalender_termine add constraint kalender_termine_erinnerung_check CHECK (((erinnerung IS NULL) OR (erinnerung = ANY (ARRAY['m10'::text, 'h1'::text, 'd1'::text, 'morgens8'::text, 'vortag18'::text, 'tag8'::text, 'd2'::text]))));
alter table public.kalender_termine add constraint kalender_termine_notiz_check CHECK ((length(notiz) <= 500));
alter table public.kalender_termine add constraint kalender_termine_ort_check CHECK ((length(ort) <= 120));
alter table public.kalender_termine add constraint kalender_termine_titel_check CHECK ((length(titel) <= 80));
alter table public.kalender_termine add constraint kalender_termine_wiederholung_check CHECK ((wiederholung = ANY (ARRAY['nie'::text, 'taeglich'::text, 'woechentlich'::text, 'monatlich'::text, 'jaehrlich'::text])));
alter table public.kalender_todos add constraint kalender_todos_titel_check CHECK (((char_length(titel) >= 1) AND (char_length(titel) <= 120)));
alter table public.kalender_verbindungen add constraint kalender_verbindungen_a_art_check CHECK ((a_art = ANY (ARRAY['partner'::text, 'familie'::text, 'freunde'::text, 'kollegen'::text])));
alter table public.kalender_verbindungen add constraint kalender_verbindungen_b_art_check CHECK ((b_art = ANY (ARRAY['partner'::text, 'familie'::text, 'freunde'::text, 'kollegen'::text])));
alter table public.kalender_verbindungen add constraint kalender_verbindungen_check CHECK ((a < b));
alter table public.konsole_tresor add constraint konsole_tresor_art_check CHECK ((art = ANY (ARRAY['eintrag'::text, 'datei'::text])));
alter table public.konsole_tresor add constraint konsole_tresor_check CHECK (((art = 'datei'::text) = (datei_pfad IS NOT NULL)));
alter table public.konsole_tresor add constraint konsole_tresor_daten_check CHECK ((length(daten) <= 200000));
alter table public.konsole_tresor_schluessel add constraint konsole_tresor_schluessel_id_check CHECK ((id = 1));
alter table public.konsole_tresor_schluessel add constraint konsole_tresor_schluessel_runden_check CHECK ((runden >= 100000));
alter table public.leave_requests add constraint half_day_only_single_day CHECK (((half_day_period IS NULL) OR (start_date = end_date)));
alter table public.leave_requests add constraint rejection_reason_required CHECK (((status <> 'rejected'::leave_status) OR (rejection_reason IS NOT NULL)));
alter table public.leave_requests add constraint valid_range CHECK ((end_date >= start_date));
alter table public.legal_versions add constraint legal_versions_doc_check CHECK ((doc = ANY (ARRAY['datenschutz'::text, 'nutzungsbedingungen'::text, 'avv'::text])));
alter table public.passwort_codes add constraint passwort_codes_art_check CHECK ((art = ANY (ARRAY['leitung'::text, 'privat'::text, 'support'::text])));
alter table public.plan_kommentare add constraint plan_kommentare_text_check CHECK (((char_length(btrim(text)) >= 1) AND (char_length(btrim(text)) <= 500)));
alter table public.privat_konten add constraint privat_konten_bundesland_check CHECK ((bundesland = ANY (ARRAY['BW'::text, 'BY'::text, 'BE'::text, 'BB'::text, 'HB'::text, 'HH'::text, 'HE'::text, 'MV'::text, 'NI'::text, 'NW'::text, 'RP'::text, 'SL'::text, 'SN'::text, 'ST'::text, 'SH'::text, 'TH'::text])));
alter table public.privat_konten add constraint privat_konten_kontakt_email_check CHECK (((kontakt_email IS NULL) OR ((length(kontakt_email) <= 320) AND (kontakt_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'::text))));
alter table public.privat_konten add constraint privat_konten_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 80)));
alter table public.privat_konten add constraint privat_konten_wochenstunden_check CHECK (((wochenstunden IS NULL) OR ((wochenstunden >= (0)::numeric) AND (wochenstunden <= (80)::numeric))));
alter table public.privat_lohnzettel add constraint privat_lohnzettel_check CHECK ((pfad ~~ ((user_id)::text || '/%'::text)));
alter table public.privat_lohnzettel add constraint privat_lohnzettel_groesse_check CHECK (((groesse > 0) AND (groesse <= 10485760)));
alter table public.privat_lohnzettel add constraint privat_lohnzettel_monat_check CHECK ((EXTRACT(day FROM monat) = (1)::numeric));
alter table public.privat_lohnzettel add constraint privat_lohnzettel_titel_check CHECK ((length(titel) <= 60));
alter table public.privat_lohnzettel add constraint privat_lohnzettel_typ_check CHECK ((typ = ANY (ARRAY['image/jpeg'::text, 'application/pdf'::text])));
alter table public.privat_schichtarten add constraint privat_schichtarten_art_check CHECK ((art = ANY (ARRAY['arbeit'::text, 'frei'::text, 'urlaub'::text, 'krank'::text])));
alter table public.privat_schichtarten add constraint privat_schichtarten_farbe_check CHECK ((farbe ~ '^#[0-9a-fA-F]{6}$'::text));
alter table public.privat_schichtarten add constraint privat_schichtarten_kuerzel_check CHECK (((length(btrim(kuerzel)) >= 1) AND (length(btrim(kuerzel)) <= 3)));
alter table public.privat_schichtarten add constraint privat_schichtarten_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 30)));
alter table public.privat_schichtarten add constraint privat_schichtarten_stunden_check CHECK (((stunden >= (0)::numeric) AND (stunden <= (24)::numeric)));
alter table public.privat_tag_zeiten add constraint privat_tag_zeiten_check CHECK ((beginn <> ende));
alter table public.privat_tage add constraint privat_tage_ebene_check CHECK ((ebene = ANY (ARRAY[1, 2, 3])));
alter table public.privat_umfrage add constraint privat_umfrage_quelle_check CHECK ((quelle = ANY (ARRAY['tiktok'::text, 'instagram'::text, 'suche'::text, 'freunde'::text, 'arbeit'::text, 'sonstiges'::text])));
alter table public.privat_umfrage add constraint privat_umfrage_verbesserung_check CHECK (((verbesserung IS NULL) OR ((length(verbesserung) >= 1) AND (length(verbesserung) <= 1000))));
alter table public.privat_umfrage add constraint privat_umfrage_zufriedenheit_check CHECK (((zufriedenheit >= 1) AND (zufriedenheit <= 5)));
alter table public.profiles add constraint profiles_start_ansicht_check CHECK ((start_ansicht = ANY (ARRAY['klassisch'::text, 'kompakt'::text])));
alter table public.profiles add constraint profiles_start_seite_check CHECK (((start_seite IS NULL) OR (start_seite = ANY (ARRAY['dashboard'::text, 'schichtplan'::text, 'kalender'::text]))));
alter table public.push_abos add constraint push_abos_auth_check CHECK (((char_length(auth) >= 8) AND (char_length(auth) <= 100)));
alter table public.push_abos add constraint push_abos_endpoint_check CHECK ((((char_length(endpoint) >= 10) AND (char_length(endpoint) <= 1000)) AND (endpoint ~~ 'https://%'::text)));
alter table public.push_abos add constraint push_abos_p256dh_check CHECK (((char_length(p256dh) >= 20) AND (char_length(p256dh) <= 200)));
alter table public.push_warteschlange add constraint push_warteschlange_art_check CHECK ((art = ANY (ARRAY['antraege'::text, 'plan'::text, 'einspringen'::text, 'teilen'::text])));
alter table public.replacement_requests add constraint replacement_requests_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'angenommen'::text, 'abgelehnt'::text, 'zurueckgezogen'::text])));
alter table public.rotation_patterns add constraint steps_is_array CHECK ((jsonb_typeof(steps) = 'array'::text));
alter table public.rotation_patterns add constraint steps_not_empty CHECK ((jsonb_array_length(steps) > 0));
alter table public.schicht_tausch add constraint schicht_tausch_notiz_check CHECK (((notiz IS NULL) OR (char_length(notiz) <= 200)));
alter table public.schicht_tausch add constraint schicht_tausch_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'angefragt'::text, 'genehmigt'::text, 'abgelehnt'::text, 'zurueckgezogen'::text])));
alter table public.school_holidays add constraint school_holidays_check CHECK ((end_date >= start_date));
alter table public.shift_qualification_needs add constraint shift_qualification_needs_minimum_check CHECK ((minimum >= 0));
alter table public.shifts add constraint minimum_not_above_target CHECK ((minimum_staff <= target_staff));
alter table public.shifts add constraint shifts_minimum_staff_check CHECK ((minimum_staff >= 0));
alter table public.shifts add constraint shifts_target_staff_check CHECK ((target_staff >= 0));
alter table public.training_assignments add constraint training_assignments_check CHECK ((end_date >= start_date));
alter table public.training_assignments add constraint training_assignments_status_check CHECK ((status = ANY (ARRAY['geplant'::text, 'laeuft'::text, 'abgeschlossen'::text, 'abgebrochen'::text])));
alter table public.absences add constraint absences_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.absences add constraint absences_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.aenderungszaehler add constraint aenderungszaehler_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.age_leave_grants add constraint age_leave_grants_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.age_leave_grants add constraint age_leave_grants_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.age_leave_grants add constraint age_leave_grants_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.anmelde_sperren add constraint anmelde_sperren_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.announcements add constraint announcements_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.announcements add constraint announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.anzeige_einstellungen add constraint anzeige_einstellungen_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.audit_logs add constraint audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.betrieb_beitritte add constraint betrieb_beitritte_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.betrieb_beitritte add constraint betrieb_beitritte_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.company_settings add constraint company_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.demo_settings add constraint demo_settings_template_company_id_fkey FOREIGN KEY (template_company_id) REFERENCES companies(id) ON DELETE SET NULL;
alter table public.email_outbox add constraint email_outbox_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.employee_gruppenwechsel add constraint employee_gruppenwechsel_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.employee_gruppenwechsel add constraint employee_gruppenwechsel_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.employee_qualifications add constraint employee_qualifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.employee_qualifications add constraint employee_qualifications_qualification_id_fkey FOREIGN KEY (qualification_id) REFERENCES qualifications(id) ON DELETE CASCADE;
alter table public.employees add constraint employees_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.employees add constraint employees_rotation_pattern_id_fkey FOREIGN KEY (rotation_pattern_id) REFERENCES rotation_patterns(id) ON DELETE SET NULL;
alter table public.employees add constraint employees_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
alter table public.fehlzeiten add constraint fehlzeiten_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.fehlzeiten add constraint fehlzeiten_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.fehlzeiten add constraint fehlzeiten_erfasst_von_fkey FOREIGN KEY (erfasst_von) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.funktionen_zugang add constraint funktionen_zugang_funktion_fkey FOREIGN KEY (funktion) REFERENCES funktionen(funktion) ON DELETE CASCADE;
alter table public.funktionen_zugang add constraint funktionen_zugang_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.funktionen_zugang add constraint funktionen_zugang_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.hinweise add constraint hinweise_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.hinweise add constraint hinweise_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.hinweise add constraint hinweise_von_profile_fkey FOREIGN KEY (von_profile) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.holidays add constraint holidays_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.kalender_abo add constraint kalender_abo_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_abo add constraint kalender_abo_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_code_versuche add constraint kalender_code_versuche_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_eigene_arten add constraint kalender_eigene_arten_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_eigene_tage add constraint kalender_eigene_tage_user_id_art_id_fkey FOREIGN KEY (user_id, art_id) REFERENCES kalender_eigene_arten(user_id, id) ON DELETE CASCADE;
alter table public.kalender_eigene_tage add constraint kalender_eigene_tage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_farben add constraint kalender_farben_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_gruppen add constraint kalender_gruppen_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.kalender_gruppen_mitglieder add constraint kalender_gruppen_mitglieder_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES kalender_gruppen(id) ON DELETE CASCADE;
alter table public.kalender_gruppen_mitglieder add constraint kalender_gruppen_mitglieder_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_partner add constraint kalender_partner_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_partner_tage add constraint kalender_partner_tage_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_personen add constraint kalender_personen_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_personen_tage add constraint kalender_personen_tage_person_id_fkey FOREIGN KEY (person_id) REFERENCES kalender_personen(id) ON DELETE CASCADE;
alter table public.kalender_termin_ausnahmen add constraint kalender_termin_ausnahmen_termin_id_fkey FOREIGN KEY (termin_id) REFERENCES kalender_termine(id) ON DELETE CASCADE;
alter table public.kalender_termine add constraint kalender_termine_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_termine add constraint kalender_termine_person_id_fkey FOREIGN KEY (person_id) REFERENCES kalender_personen(id) ON DELETE CASCADE;
alter table public.kalender_termine add constraint kalender_termine_von_user_fkey FOREIGN KEY (von_user) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.kalender_todos add constraint kalender_todos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_verbindung_codes add constraint kalender_verbindung_codes_person_id_fkey FOREIGN KEY (person_id) REFERENCES kalender_personen(id) ON DELETE CASCADE;
alter table public.kalender_verbindung_codes add constraint kalender_verbindung_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_verbindungen add constraint kalender_verbindungen_a_fkey FOREIGN KEY (a) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_verbindungen add constraint kalender_verbindungen_b_fkey FOREIGN KEY (b) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.kalender_vorlieben add constraint kalender_vorlieben_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.konsole_tresor add constraint konsole_tresor_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.konsole_tresor_schluessel add constraint konsole_tresor_schluessel_geaendert_von_fkey FOREIGN KEY (geaendert_von) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.leave_balances add constraint leave_balances_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.leave_balances add constraint leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.leave_requests add constraint leave_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.leave_requests add constraint leave_requests_decided_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.leave_requests add constraint leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.leave_requests add constraint leave_requests_withdrawn_by_fkey FOREIGN KEY (withdrawn_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.notifications add constraint notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.passwort_codes add constraint passwort_codes_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.passwort_codes add constraint passwort_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.personal_details add constraint personal_details_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.personal_details add constraint personal_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.plan_kommentare add constraint plan_kommentare_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.plan_kommentare add constraint plan_kommentare_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.plan_kommentare add constraint plan_kommentare_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.platform_admins add constraint platform_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.plattform_protokoll add constraint plattform_protokoll_wer_fkey FOREIGN KEY (wer) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.privacy_settings add constraint privacy_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.privacy_settings add constraint privacy_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.privat_konten add constraint privat_konten_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.privat_lohnzettel add constraint privat_lohnzettel_user_id_fkey FOREIGN KEY (user_id) REFERENCES privat_konten(user_id) ON DELETE CASCADE;
alter table public.privat_schichtarten add constraint privat_schichtarten_user_id_fkey FOREIGN KEY (user_id) REFERENCES privat_konten(user_id) ON DELETE CASCADE;
alter table public.privat_tag_zeiten add constraint privat_tag_zeiten_user_id_fkey FOREIGN KEY (user_id) REFERENCES privat_konten(user_id) ON DELETE CASCADE;
alter table public.privat_tag_zeiten add constraint privat_tag_zeiten_user_id_schichtart_id_fkey FOREIGN KEY (user_id, schichtart_id) REFERENCES privat_schichtarten(user_id, id) ON DELETE CASCADE;
alter table public.privat_tage add constraint privat_tage_user_id_fkey FOREIGN KEY (user_id) REFERENCES privat_konten(user_id) ON DELETE CASCADE;
alter table public.privat_tage add constraint privat_tage_user_id_schichtart_id_fkey FOREIGN KEY (user_id, schichtart_id) REFERENCES privat_schichtarten(user_id, id) ON DELETE CASCADE;
alter table public.privat_umfrage add constraint privat_umfrage_user_id_fkey FOREIGN KEY (user_id) REFERENCES privat_konten(user_id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.protokoll_zugang add constraint protokoll_zugang_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.protokoll_zugang add constraint protokoll_zugang_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.push_abos add constraint push_abos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_vorlieben add constraint push_vorlieben_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_warteschlange add constraint push_warteschlange_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.qualifications add constraint qualifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.replacement_requests add constraint replacement_requests_absent_employee_id_fkey FOREIGN KEY (absent_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
alter table public.replacement_requests add constraint replacement_requests_asked_employee_id_fkey FOREIGN KEY (asked_employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.replacement_requests add constraint replacement_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.replacement_requests add constraint replacement_requests_qualification_id_fkey FOREIGN KEY (qualification_id) REFERENCES qualifications(id) ON DELETE SET NULL;
alter table public.replacement_requests add constraint replacement_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES employees(id) ON DELETE SET NULL;
alter table public.replacement_requests add constraint replacement_requests_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
alter table public.rotation_patterns add constraint rotation_patterns_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.schicht_tausch add constraint schicht_tausch_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.schicht_tausch add constraint schicht_tausch_entschieden_von_fkey FOREIGN KEY (entschieden_von) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.schicht_tausch add constraint schicht_tausch_gegen_shift_id_fkey FOREIGN KEY (gegen_shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
alter table public.schicht_tausch add constraint schicht_tausch_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
alter table public.schicht_tausch add constraint schicht_tausch_uebernehmer_fkey FOREIGN KEY (uebernehmer) REFERENCES employees(id) ON DELETE SET NULL;
alter table public.schicht_tausch add constraint schicht_tausch_von_employee_fkey FOREIGN KEY (von_employee) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.school_holidays add constraint school_holidays_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.shift_assignments add constraint shift_assignments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.shift_assignments add constraint shift_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.shift_assignments add constraint shift_assignments_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
alter table public.shift_qualification_needs add constraint shift_qualification_needs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.shift_qualification_needs add constraint shift_qualification_needs_qualification_id_fkey FOREIGN KEY (qualification_id) REFERENCES qualifications(id) ON DELETE CASCADE;
alter table public.shift_qualification_needs add constraint shift_qualification_needs_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
alter table public.shifts add constraint shifts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.staffing_rules add constraint staffing_rules_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.staffing_rules add constraint staffing_rules_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
alter table public.training_assignments add constraint training_assignments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.training_assignments add constraint training_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.training_assignments add constraint training_assignments_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
alter table public.vertraute_geraete add constraint vertraute_geraete_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.vertraute_sitzungen add constraint vertraute_sitzungen_geraet_id_fkey FOREIGN KEY (geraet_id) REFERENCES vertraute_geraete(id) ON DELETE CASCADE;
alter table public.vertraute_sitzungen add constraint vertraute_sitzungen_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- ##INDEXE
CREATE INDEX absences_company_id_date_idx ON public.absences USING btree (company_id, date);
CREATE INDEX absences_employee_date_idx ON public.absences USING btree (employee_id, date);
CREATE INDEX age_leave_grants_company_year_idx ON public.age_leave_grants USING btree (company_id, year);
CREATE INDEX announcements_company_created_idx ON public.announcements USING btree (company_id, created_at DESC);
CREATE INDEX audit_logs_actor_zeit ON public.audit_logs USING btree (actor_id, created_at DESC);
CREATE INDEX audit_logs_company_id_created_at_idx ON public.audit_logs USING btree (company_id, created_at DESC);
CREATE INDEX betrieb_beitritte_employee_idx ON public.betrieb_beitritte USING btree (employee_id);
CREATE INDEX companies_demo_expires ON public.companies USING btree (demo_expires_at) WHERE is_demo;
CREATE INDEX email_outbox_company_idx ON public.email_outbox USING btree (company_id, created_at DESC);
CREATE INDEX email_outbox_offen_idx ON public.email_outbox USING btree (created_at) WHERE (status = 'offen'::text);
CREATE INDEX employee_gruppenwechsel_emp ON public.employee_gruppenwechsel USING btree (employee_id, ab);
CREATE INDEX employee_qualifications_qualification_idx ON public.employee_qualifications USING btree (qualification_id);
CREATE INDEX employees_company_id_active_idx ON public.employees USING btree (company_id, active);
CREATE INDEX employees_company_id_shift_id_idx ON public.employees USING btree (company_id, shift_id);
CREATE INDEX employees_qualifications_idx ON public.employees USING gin (qualifications);
CREATE INDEX employees_rotation_pattern_id_idx ON public.employees USING btree (rotation_pattern_id);
CREATE INDEX employees_shift_id_idx ON public.employees USING btree (shift_id);
CREATE INDEX employees_sort_idx ON public.employees USING btree (company_id, rotation_team, sort_order);
CREATE INDEX fehlzeiten_firma_tag ON public.fehlzeiten USING btree (company_id, tag);
CREATE INDEX hinweise_firma ON public.hinweise USING btree (company_id, erstellt_am DESC);
CREATE INDEX hinweise_offen ON public.hinweise USING btree (employee_id) WHERE ((gelesen_am IS NULL) AND (zurueckgezogen_am IS NULL));
CREATE INDEX hinweise_von_profile_idx ON public.hinweise USING btree (von_profile);
CREATE UNIQUE INDEX kalender_abo_ein_aktives ON public.kalender_abo USING btree (user_id) WHERE (beendet_am IS NULL);
CREATE INDEX kalender_code_versuche_user ON public.kalender_code_versuche USING btree (user_id, zeit);
CREATE INDEX kalender_eigene_arten_user ON public.kalender_eigene_arten USING btree (user_id);
CREATE INDEX kalender_eigene_tage_art ON public.kalender_eigene_tage USING btree (art_id);
CREATE INDEX kalender_eigene_tage_art_fk_idx ON public.kalender_eigene_tage USING btree (user_id, art_id);
CREATE INDEX kalender_gruppen_mitglieder_user ON public.kalender_gruppen_mitglieder USING btree (user_id);
CREATE UNIQUE INDEX kalender_partner_ein_aktiver ON public.kalender_partner USING btree (owner_id) WHERE (beendet_am IS NULL);
CREATE INDEX kalender_personen_owner ON public.kalender_personen USING btree (owner_id);
CREATE INDEX kalender_termine_owner ON public.kalender_termine USING btree (owner_id);
CREATE INDEX kalender_termine_person_id_idx ON public.kalender_termine USING btree (person_id);
CREATE INDEX kalender_termine_von_user_idx ON public.kalender_termine USING btree (von_user);
CREATE INDEX kalender_todos_owner ON public.kalender_todos USING btree (owner_id, erledigt, datum);
CREATE INDEX kalender_verbindungen_b ON public.kalender_verbindungen USING btree (b);
CREATE INDEX leave_requests_company_id_start_date_end_date_idx ON public.leave_requests USING btree (company_id, start_date, end_date);
CREATE INDEX leave_requests_employee_status_idx ON public.leave_requests USING btree (employee_id, status);
CREATE INDEX leave_requests_employee_zeitraum_idx ON public.leave_requests USING btree (employee_id, status, start_date, end_date);
CREATE INDEX leave_requests_group_idx ON public.leave_requests USING btree (request_group_id) WHERE (request_group_id IS NOT NULL);
CREATE INDEX notifications_employee_idx ON public.notifications USING btree (employee_id, read_at);
CREATE INDEX plan_kommentare_firma_tag ON public.plan_kommentare USING btree (company_id, tag);
CREATE INDEX plan_kommentare_person ON public.plan_kommentare USING btree (employee_id);
CREATE INDEX privat_lohnzettel_user ON public.privat_lohnzettel USING btree (user_id, monat DESC);
CREATE INDEX privat_schichtarten_user ON public.privat_schichtarten USING btree (user_id);
CREATE INDEX privat_tag_zeiten_art ON public.privat_tag_zeiten USING btree (user_id, schichtart_id);
CREATE INDEX privat_tage_art ON public.privat_tage USING btree (schichtart_id);
CREATE INDEX privat_tage_schichtart_idx ON public.privat_tage USING btree (user_id, schichtart_id);
CREATE INDEX profiles_company_id_idx ON public.profiles USING btree (company_id);
CREATE INDEX push_abos_user ON public.push_abos USING btree (user_id);
CREATE INDEX push_warteschlange_offen ON public.push_warteschlange USING btree (id) WHERE (gesendet_am IS NULL);
CREATE INDEX push_warteschlange_sammel ON public.push_warteschlange USING btree (user_id, sammel) WHERE (gesendet_am IS NULL);
CREATE INDEX rate_limit_hits_lookup ON public.rate_limit_hits USING btree (bucket, key_hash, hit_at DESC);
CREATE INDEX replacement_requests_offen_idx ON public.replacement_requests USING btree (company_id, status, date);
CREATE UNIQUE INDEX schicht_tausch_ein_angebot ON public.schicht_tausch USING btree (von_employee, tag) WHERE (status = ANY (ARRAY['offen'::text, 'angefragt'::text]));
CREATE INDEX schicht_tausch_firma_idx ON public.schicht_tausch USING btree (company_id, status, tag);
CREATE INDEX schicht_tausch_uebernehmer_idx ON public.schicht_tausch USING btree (uebernehmer);
CREATE INDEX schicht_tausch_von_idx ON public.schicht_tausch USING btree (von_employee);
CREATE INDEX school_holidays_zeitraum_idx ON public.school_holidays USING btree (region, start_date, end_date);
CREATE INDEX shift_assignments_company_id_date_idx ON public.shift_assignments USING btree (company_id, date);
CREATE INDEX shift_assignments_employee_date_idx ON public.shift_assignments USING btree (employee_id, date);
CREATE INDEX shift_assignments_shift_id_idx ON public.shift_assignments USING btree (shift_id);
CREATE INDEX shift_qualification_needs_company_idx ON public.shift_qualification_needs USING btree (company_id);
CREATE INDEX training_assignments_zeitraum_idx ON public.training_assignments USING btree (company_id, start_date, end_date);
CREATE INDEX vertraute_geraete_user ON public.vertraute_geraete USING btree (user_id);
CREATE INDEX vertraute_sitzungen_geraet ON public.vertraute_sitzungen USING btree (geraet_id);
-- ##TRIGGER
CREATE TRIGGER absences_audit_trg AFTER INSERT OR DELETE ON public.absences FOR EACH ROW EXECUTE FUNCTION absences_audit();
CREATE TRIGGER aenderung_abwesenheiten AFTER INSERT OR DELETE OR UPDATE ON public.absences FOR EACH ROW EXECUTE FUNCTION aenderung_zaehlen('abwesenheiten');
CREATE TRIGGER freitext_ohne_gesundheit BEFORE INSERT OR UPDATE ON public.absences FOR EACH ROW EXECUTE FUNCTION freitext_ohne_gesundheit('note');
CREATE TRIGGER trg_absences_guard_medical_text BEFORE INSERT OR UPDATE ON public.absences FOR EACH ROW EXECUTE FUNCTION absences_guard_medical_text();
CREATE TRIGGER aenderung_mitteilungen AFTER INSERT OR DELETE OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION aenderung_zaehlen('mitteilungen');
CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER protokoll_announcements AFTER INSERT OR DELETE OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION protokoll_aenderung();
CREATE TRIGGER companies_settings_trg AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION companies_ensure_settings();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER email_outbox_skip_demo BEFORE INSERT ON public.email_outbox FOR EACH ROW EXECUTE FUNCTION email_outbox_skip_demo();
CREATE TRIGGER aenderung_plan_personen AFTER INSERT OR DELETE OR UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION aenderung_zaehlen('plan');
CREATE TRIGGER employees_audit AFTER INSERT OR UPDATE OF role, active ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_audit_role();
CREATE TRIGGER employees_austritt_zurueck AFTER UPDATE OF exit_date ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_austritt_zurueck();
CREATE TRIGGER employees_entitlement_sync AFTER UPDATE OF vacation_days, v_days ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_sync_entitlement();
CREATE TRIGGER employees_leave_balance AFTER INSERT ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_ensure_leave_balance();
CREATE TRIGGER employees_role_guard BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_guard_role_change();
CREATE TRIGGER employees_rotation_offset BEFORE INSERT OR UPDATE OF rotation_team, rotation_pattern_id ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_sync_rotation_offset();
CREATE TRIGGER employees_schichtleitung_grenze BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_schichtleitung_grenze();
CREATE TRIGGER employees_sync_profile_active AFTER UPDATE OF active ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_sync_profile_active();
CREATE TRIGGER employees_sync_profile_role AFTER UPDATE OF role ON public.employees FOR EACH ROW EXECUTE FUNCTION employees_sync_profile_role();
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER aenderung_fehlzeiten AFTER INSERT OR DELETE OR UPDATE ON public.fehlzeiten FOR EACH ROW EXECUTE FUNCTION aenderung_zaehlen('abwesenheiten');
CREATE TRIGGER freitext_ohne_gesundheit BEFORE INSERT OR UPDATE ON public.fehlzeiten FOR EACH ROW EXECUTE FUNCTION freitext_ohne_gesundheit('notiz');
CREATE TRIGGER kalender_eigene_arten_grenze BEFORE INSERT ON public.kalender_eigene_arten FOR EACH ROW EXECUTE FUNCTION kalender_eigene_grenze();
CREATE TRIGGER kalender_farben_grenze BEFORE INSERT ON public.kalender_farben FOR EACH ROW EXECUTE FUNCTION kalender_eigene_grenze();
CREATE TRIGGER kalender_gruppen_grenze BEFORE INSERT ON public.kalender_gruppen_mitglieder FOR EACH ROW EXECUTE FUNCTION kalender_gruppen_grenze();
CREATE TRIGGER push_gruppenbeitritt AFTER INSERT ON public.kalender_gruppen_mitglieder FOR EACH ROW EXECUTE FUNCTION push_aus_gruppenbeitritt();
CREATE TRIGGER kalender_personen_grenze BEFORE INSERT ON public.kalender_personen FOR EACH ROW EXECUTE FUNCTION kalender_personen_grenze();
CREATE CONSTRAINT TRIGGER push_termin_von_anderen AFTER INSERT ON public.kalender_termine DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION push_aus_termin_von_anderen();
CREATE TRIGGER push_verbindung AFTER INSERT ON public.kalender_verbindungen FOR EACH ROW EXECUTE FUNCTION push_aus_verbindung();
CREATE TRIGGER leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER protokoll_leave_balances AFTER UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION protokoll_aenderung();
CREATE TRIGGER aenderung_antraege AFTER INSERT OR DELETE OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION aenderung_zaehlen('antraege');
CREATE TRIGGER freitext_ohne_gesundheit BEFORE INSERT OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION freitext_ohne_gesundheit('reason', 'rejection_reason', 'withdrawal_reason');
CREATE TRIGGER leave_requests_check_block_trg BEFORE INSERT OR UPDATE OF start_date, end_date ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_check_block();
CREATE TRIGGER leave_requests_check_qualifikation_trg BEFORE INSERT ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_check_qualifikation();
CREATE TRIGGER leave_requests_compute_days BEFORE INSERT OR UPDATE OF start_date, end_date, half_day_period ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_set_computed_days();
CREATE TRIGGER leave_requests_no_overlap BEFORE INSERT OR UPDATE OF start_date, end_date, status, half_day_period ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_check_overlap();
CREATE TRIGGER leave_requests_notify AFTER INSERT ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_notify_leadership();
CREATE TRIGGER leave_requests_ruecknahme_konsistent BEFORE INSERT OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_ruecknahme_konsistent();
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER protokoll_leave_requests AFTER INSERT OR DELETE OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION protokoll_aenderung();
CREATE TRIGGER trg_leave_requests_check_kontingent BEFORE INSERT OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_check_kontingent();
CREATE TRIGGER zz_leave_requests_vj BEFORE INSERT OR UPDATE OF kind, start_date ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION leave_requests_vj_setzen();
CREATE TRIGGER push_benachrichtigung AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION push_aus_benachrichtigung();
CREATE TRIGGER trg_personal_details_guard BEFORE INSERT OR UPDATE ON public.personal_details FOR EACH ROW EXECUTE FUNCTION personal_details_guard();
CREATE TRIGGER aenderung_plan_kommentare AFTER INSERT OR DELETE OR UPDATE ON public.plan_kommentare FOR EACH ROW EXECUTE FUNCTION aenderung_zaehlen('plan');
CREATE TRIGGER freitext_ohne_gesundheit BEFORE INSERT OR UPDATE ON public.plan_kommentare FOR EACH ROW EXECUTE FUNCTION freitext_ohne_gesundheit('text');
CREATE TRIGGER plan_kommentar_vorbereiten BEFORE INSERT ON public.plan_kommentare FOR EACH ROW EXECUTE FUNCTION plan_kommentar_vorbereiten();
CREATE TRIGGER protokoll_plan_kommentare AFTER INSERT OR DELETE ON public.plan_kommentare FOR EACH ROW EXECUTE FUNCTION protokoll_aenderung();
CREATE TRIGGER trg_privacy_settings_audit AFTER UPDATE ON public.privacy_settings FOR EACH ROW EXECUTE FUNCTION privacy_settings_audit();
CREATE TRIGGER trg_privacy_settings_guard BEFORE INSERT OR UPDATE ON public.privacy_settings FOR EACH ROW EXECUTE FUNCTION privacy_settings_guard();
CREATE TRIGGER privat_lohnzettel_grenze BEFORE INSERT ON public.privat_lohnzettel FOR EACH ROW EXECUTE FUNCTION privat_lohnzettel_grenze();
CREATE TRIGGER privat_lohnzettel_weg AFTER DELETE ON public.privat_lohnzettel FOR EACH ROW EXECUTE FUNCTION privat_lohnzettel_weg();
CREATE TRIGGER privat_schichtarten_grenze BEFORE INSERT ON public.privat_schichtarten FOR EACH ROW EXECUTE FUNCTION privat_schichtarten_grenze();
CREATE TRIGGER privat_tage_zeiten_aufraeumen AFTER DELETE OR UPDATE ON public.privat_tage FOR EACH ROW EXECUTE FUNCTION privat_tag_zeiten_aufraeumen();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_create_personal_details AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION ensure_personal_details();
CREATE TRIGGER trg_profiles_create_privacy_settings AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION ensure_privacy_settings();
CREATE TRIGGER trg_profiles_guard_self_identity BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_guard_self_identity();
CREATE TRIGGER rotation_patterns_updated_at BEFORE UPDATE ON public.rotation_patterns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER aenderung_plan_zuweisungen AFTER INSERT OR DELETE OR UPDATE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION aenderung_zaehlen('plan');
CREATE TRIGGER protokoll_shift_assignments AFTER INSERT OR DELETE OR UPDATE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION protokoll_aenderung();
CREATE TRIGGER push_planaenderung AFTER INSERT OR DELETE OR UPDATE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION push_aus_planaenderung();
CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER aenderung_regeln AFTER INSERT OR DELETE OR UPDATE ON public.staffing_rules FOR EACH ROW EXECUTE FUNCTION aenderung_zaehlen('mitteilungen');
CREATE TRIGGER protokoll_staffing_rules AFTER INSERT OR DELETE OR UPDATE ON public.staffing_rules FOR EACH ROW EXECUTE FUNCTION protokoll_aenderung();
-- ##RLS
alter table public.kalender_abo enable row level security;
alter table public.kalender_farben enable row level security;
alter table public.plan_kommentare enable row level security;
alter table public.protokoll_zugang enable row level security;
alter table public.fehlzeiten enable row level security;
alter table public.privat_schichtarten enable row level security;
alter table public.privat_konten enable row level security;
alter table public.privat_tage enable row level security;
alter table public.rotation_patterns enable row level security;
alter table public.leave_balances enable row level security;
alter table public.notifications enable row level security;
alter table public.absences enable row level security;
alter table public.holidays enable row level security;
alter table public.staffing_rules enable row level security;
alter table public.shift_qualification_needs enable row level security;
alter table public.qualifications enable row level security;
alter table public.employee_qualifications enable row level security;
alter table public.school_holidays enable row level security;
alter table public.age_leave_grants enable row level security; alter table public.age_leave_grants force row level security;
alter table public.leave_requests enable row level security;
alter table public.company_settings enable row level security;
alter table public.rate_limit_hits enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.legal_versions enable row level security;
alter table public.kalender_personen enable row level security;
alter table public.kalender_gruppen enable row level security;
alter table public.privacy_settings enable row level security; alter table public.privacy_settings force row level security;
alter table public.companies enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.profiles enable row level security;
alter table public.demo_settings enable row level security;
alter table public.kalender_partner_tage enable row level security;
alter table public.kalender_partner enable row level security;
alter table public.announcements enable row level security;
alter table public.email_outbox enable row level security;
alter table public.kalender_termine enable row level security;
alter table public.kalender_eigene_arten enable row level security;
alter table public.kalender_eigene_tage enable row level security;
alter table public.platform_admins enable row level security;
alter table public.replacement_requests enable row level security;
alter table public.training_assignments enable row level security;
alter table public.aenderungszaehler enable row level security;
alter table public.funktionen enable row level security;
alter table public.funktionen_zugang enable row level security;
alter table public.kalender_personen_tage enable row level security;
alter table public.personal_details enable row level security; alter table public.personal_details force row level security;
alter table public.kalender_gruppen_mitglieder enable row level security;
alter table public.push_abos enable row level security;
alter table public.kalender_todos enable row level security;
alter table public.erinnerung_gesendet enable row level security;
alter table public.kalender_vorlieben enable row level security;
alter table public.kalender_verbindungen enable row level security;
alter table public.kalender_verbindung_codes enable row level security;
alter table public.kalender_termin_ausnahmen enable row level security;
alter table public.kalender_code_versuche enable row level security;
alter table public.plattform_protokoll enable row level security;
alter table public.push_vorlieben enable row level security;
alter table public.anzeige_einstellungen enable row level security;
alter table public.passwort_codes enable row level security;
alter table public.push_warteschlange enable row level security;
alter table public.hinweise enable row level security;
alter table public.betrieb_beitritte enable row level security;
alter table public.lohnzettel_aufraeumen enable row level security;
alter table public.privat_tag_zeiten enable row level security;
alter table public.privat_lohnzettel enable row level security;
alter table public.privat_umfrage enable row level security;
alter table public.plattform_tageszahlen enable row level security;
alter table public.anmelde_sperren enable row level security;
alter table public.vertraute_geraete enable row level security;
alter table public.vertraute_sitzungen enable row level security;
alter table public.employee_gruppenwechsel enable row level security;
alter table public.konsole_tresor_schluessel enable row level security;
alter table public.konsole_tresor enable row level security;
alter table public.schicht_tausch enable row level security;
-- ##POLICIES
create policy kalender_farben_aendern on public.kalender_farben as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth_employee_id() AS auth_employee_id) IS NOT NULL) AND ( SELECT hat_funktion('kalender_neu'::text) AS hat_funktion)));
create policy kalender_farben_anlegen on public.kalender_farben as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth_employee_id() AS auth_employee_id) IS NOT NULL) AND ( SELECT hat_funktion('kalender_neu'::text) AS hat_funktion)));
create policy kalender_farben_lesen on public.kalender_farben as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy kalender_farben_loeschen on public.kalender_farben as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Kommentare lesen" on public.plan_kommentare as PERMISSIVE for SELECT to authenticated using ((company_id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Kommentare löschen" on public.plan_kommentare as PERMISSIVE for DELETE to authenticated using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ((autor_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_leadership() AS is_leadership))));
create policy "Kommentare schreiben" on public.plan_kommentare as PERMISSIVE for INSERT to authenticated with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (autor_id = ( SELECT auth.uid() AS uid))));
create policy "Fehlzeiten lesen" on public.fehlzeiten as PERMISSIVE for SELECT to authenticated using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (( SELECT is_admin() AS is_admin) OR (employee_id = ( SELECT auth_employee_id() AS auth_employee_id)))));
create policy privat_schichtarten_eigen on public.privat_schichtarten as PERMISSIVE for ALL to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy privat_konten_eigen on public.privat_konten as PERMISSIVE for ALL to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy privat_tage_eigen on public.privat_tage as PERMISSIVE for ALL to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Rotationsmuster lesen" on public.rotation_patterns as PERMISSIVE for SELECT to public using ((company_id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Rotationsmuster verwaltet Admin" on public.rotation_patterns as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "Urlaubskonto lesen" on public.leave_balances as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ((employee_id = ( SELECT auth_employee_id() AS auth_employee_id)) OR ( SELECT is_leadership() AS is_leadership))));
create policy "Urlaubskonto pflegt Admin" on public.leave_balances as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "eigene Benachrichtigungen als gelesen markieren" on public.notifications as PERMISSIVE for UPDATE to public using ((employee_id = ( SELECT auth_employee_id() AS auth_employee_id))) with check ((employee_id = ( SELECT auth_employee_id() AS auth_employee_id)));
create policy "eigene Benachrichtigungen lesen" on public.notifications as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ((employee_id = ( SELECT auth_employee_id() AS auth_employee_id)) OR ( SELECT is_admin() AS is_admin))));
create policy "Abwesenheiten liest Fuehrung" on public.absences as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ((employee_id = ( SELECT auth_employee_id() AS auth_employee_id)) OR ( SELECT is_leadership() AS is_leadership))));
create policy "Abwesenheiten pflegt Fuehrung" on public.absences as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership)));
create policy "Feiertage lesen" on public.holidays as PERMISSIVE for SELECT to public using (((company_id IS NULL) OR (company_id = ( SELECT auth_company_id() AS auth_company_id))));
create policy "Feiertage pflegt Admin" on public.holidays as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "Regeln lesen" on public.staffing_rules as PERMISSIVE for SELECT to public using ((company_id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Regeln pflegt Admin" on public.staffing_rules as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "Urlaubssperre anlegen Schichtleitung" on public.staffing_rules as PERMISSIVE for INSERT to public with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (( SELECT auth_role() AS auth_role) = 'shift_leader'::app_role) AND (key = 'urlaubssperre'::text) AND ((shift_id IS NULL) OR (EXISTS ( SELECT 1
   FROM shifts s
  WHERE ((s.id = staffing_rules.shift_id) AND (s.company_id = ( SELECT auth_company_id() AS auth_company_id))))))));
create policy "Urlaubssperre entfernen Schichtleitung" on public.staffing_rules as PERMISSIVE for DELETE to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (( SELECT auth_role() AS auth_role) = 'shift_leader'::app_role) AND (key = 'urlaubssperre'::text)));
create policy "Bedarf liest das Unternehmen" on public.shift_qualification_needs as PERMISSIVE for SELECT to public using ((company_id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Bedarf pflegt Admin" on public.shift_qualification_needs as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "Qualifikationen liest das Unternehmen" on public.qualifications as PERMISSIVE for SELECT to public using ((company_id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Qualifikationen pflegt Admin" on public.qualifications as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "Zuordnung liest das Unternehmen" on public.employee_qualifications as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = employee_qualifications.employee_id) AND (e.company_id = ( SELECT auth_company_id() AS auth_company_id))))));
create policy "Zuordnung pflegt Fuehrung" on public.employee_qualifications as PERMISSIVE for ALL to public using (((EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = employee_qualifications.employee_id) AND (e.company_id = ( SELECT auth_company_id() AS auth_company_id))))) AND ( SELECT is_leadership() AS is_leadership))) with check (((EXISTS ( SELECT 1
   FROM employees e
  WHERE ((e.id = employee_qualifications.employee_id) AND (e.company_id = ( SELECT auth_company_id() AS auth_company_id))))) AND ( SELECT is_leadership() AS is_leadership)));
create policy "Ferien lesen" on public.school_holidays as PERMISSIVE for SELECT to public using (((company_id IS NULL) OR (company_id = ( SELECT auth_company_id() AS auth_company_id))));
create policy "Ferien pflegt Admin" on public.school_holidays as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "age_leave admin select" on public.age_leave_grants as PERMISSIVE for SELECT to authenticated using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "age_leave own select" on public.age_leave_grants as PERMISSIVE for SELECT to authenticated using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (employee_id = ( SELECT auth_employee_id() AS auth_employee_id))));
create policy "Antraege lesen" on public.leave_requests as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ((employee_id = ( SELECT auth_employee_id() AS auth_employee_id)) OR ( SELECT is_leadership() AS is_leadership))));
create policy "eigenen Antrag stellen" on public.leave_requests as PERMISSIVE for INSERT to public with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (employee_id = ( SELECT auth_employee_id() AS auth_employee_id)) AND (status = 'pending'::leave_status)));
create policy "Einstellungen lesen" on public.company_settings as PERMISSIVE for SELECT to public using ((company_id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Einstellungen pflegt Admin" on public.company_settings as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "Lohnzettel lesen" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'lohnzettel'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "Lohnzettel löschen" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'lohnzettel'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "Personaldaten aendert auch Schichtleitung" on public.employees as PERMISSIVE for UPDATE to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (( SELECT auth_role() AS auth_role) = 'shift_leader'::app_role))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (( SELECT auth_role() AS auth_role) = 'shift_leader'::app_role)));
create policy "Personaldaten verwaltet Admin" on public.employees as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "eigene Personaldaten lesen" on public.employees as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ((id = ( SELECT auth_employee_id() AS auth_employee_id)) OR ( SELECT is_leadership() AS is_leadership))));
create policy "Schichten lesen" on public.shifts as PERMISSIVE for SELECT to public using ((company_id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Schichten verwaltet Admin" on public.shifts as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "Rechtsversionen lesen" on public.legal_versions as PERMISSIVE for SELECT to authenticated using (true);
create policy "privacy own insert" on public.privacy_settings as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id))));
create policy "privacy own select" on public.privacy_settings as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id))));
create policy "privacy own update" on public.privacy_settings as PERMISSIVE for UPDATE to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id)))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id))));
create policy "Unternehmen aendert Admin" on public.companies as PERMISSIVE for UPDATE to public using (((id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "eigenes Unternehmen lesen" on public.companies as PERMISSIVE for SELECT to public using ((id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Schichtzuordnung lesen" on public.shift_assignments as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ((employee_id = ( SELECT auth_employee_id() AS auth_employee_id)) OR ( SELECT is_leadership() AS is_leadership))));
create policy "Schichtzuordnung pflegt Fuehrung" on public.shift_assignments as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership)));
create policy "Protokoll liest Admin" on public.audit_logs as PERMISSIVE for SELECT to public using ((company_id = ( SELECT protokoll_firma() AS protokoll_firma)));
create policy "Profile verwaltet Admin" on public.profiles as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy "eigenes Profil aendern" on public.profiles as PERMISSIVE for UPDATE to public using ((id = ( SELECT auth.uid() AS uid))) with check (((id = ( SELECT auth.uid() AS uid)) AND (role = ( SELECT auth_role() AS auth_role)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (active = true)));
create policy "profiles leadership select" on public.profiles as PERMISSIVE for SELECT to authenticated using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership)));
create policy "profiles own select" on public.profiles as PERMISSIVE for SELECT to authenticated using ((id = ( SELECT auth.uid() AS uid)));
create policy "Mitteilungen liest das Unternehmen" on public.announcements as PERMISSIVE for SELECT to public using ((company_id = ( SELECT auth_company_id() AS auth_company_id)));
create policy "Mitteilungen pflegt Fuehrung" on public.announcements as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership)));
create policy "Postausgang liest Admin" on public.email_outbox as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_admin() AS is_admin)));
create policy kalender_eigene_arten_aendern on public.kalender_eigene_arten as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth_employee_id() AS auth_employee_id) IS NOT NULL) AND ( SELECT hat_funktion('kalender_neu'::text) AS hat_funktion)));
create policy kalender_eigene_arten_anlegen on public.kalender_eigene_arten as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth_employee_id() AS auth_employee_id) IS NOT NULL) AND ( SELECT hat_funktion('kalender_neu'::text) AS hat_funktion)));
create policy kalender_eigene_arten_lesen on public.kalender_eigene_arten as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy kalender_eigene_arten_loeschen on public.kalender_eigene_arten as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy kalender_eigene_tage_aendern on public.kalender_eigene_tage as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth_employee_id() AS auth_employee_id) IS NOT NULL) AND ( SELECT hat_funktion('kalender_neu'::text) AS hat_funktion)));
create policy kalender_eigene_tage_anlegen on public.kalender_eigene_tage as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT auth_employee_id() AS auth_employee_id) IS NOT NULL) AND ( SELECT hat_funktion('kalender_neu'::text) AS hat_funktion)));
create policy kalender_eigene_tage_lesen on public.kalender_eigene_tage as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy kalender_eigene_tage_loeschen on public.kalender_eigene_tage as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Ersatzanfragen lesen" on public.replacement_requests as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (( SELECT is_leadership() AS is_leadership) OR (asked_employee_id = ( SELECT auth_employee_id() AS auth_employee_id)))));
create policy "Ersatzanfragen stellt Fuehrung" on public.replacement_requests as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership)));
create policy "Ausbildungsplan lesen" on public.training_assignments as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND (( SELECT is_leadership() AS is_leadership) OR (employee_id = ( SELECT auth_employee_id() AS auth_employee_id)))));
create policy "Ausbildungsplan pflegt Fuehrung" on public.training_assignments as PERMISSIVE for ALL to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership))) with check (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership)));
create policy "personal_details leadership select" on public.personal_details as PERMISSIVE for SELECT to authenticated using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership)));
create policy "personal_details own insert" on public.personal_details as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id))));
create policy "personal_details own select" on public.personal_details as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id))));
create policy "personal_details own update" on public.personal_details as PERMISSIVE for UPDATE to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id)))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (company_id = ( SELECT auth_company_id() AS auth_company_id))));
create policy anzeige_einstellungen_aendern on public.anzeige_einstellungen as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy anzeige_einstellungen_anlegen on public.anzeige_einstellungen as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy anzeige_einstellungen_lesen on public.anzeige_einstellungen as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy privat_tag_zeiten_eigen on public.privat_tag_zeiten as PERMISSIVE for ALL to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy privat_lohnzettel_eigen on public.privat_lohnzettel as PERMISSIVE for ALL to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM privat_konten k
  WHERE ((k.user_id = ( SELECT auth.uid() AS uid)) AND (k.lohnzettel_einwilligung IS NOT NULL))))));
create policy "Gruppenwechsel lesen Fuehrung" on public.employee_gruppenwechsel as PERMISSIVE for SELECT to public using (((company_id = ( SELECT auth_company_id() AS auth_company_id)) AND ( SELECT is_leadership() AS is_leadership)));
-- ##RECHTE
grant INSERT on public.kalender_abo to service_role;
grant SELECT on public.kalender_abo to service_role;
grant UPDATE on public.kalender_abo to service_role;
grant DELETE on public.kalender_abo to service_role;
grant TRUNCATE on public.kalender_abo to service_role;
grant REFERENCES on public.kalender_abo to service_role;
grant TRIGGER on public.kalender_abo to service_role;
grant MAINTAIN on public.kalender_abo to service_role;
grant INSERT on public.kalender_farben to service_role;
grant SELECT on public.kalender_farben to service_role;
grant UPDATE on public.kalender_farben to service_role;
grant DELETE on public.kalender_farben to service_role;
grant TRUNCATE on public.kalender_farben to service_role;
grant REFERENCES on public.kalender_farben to service_role;
grant TRIGGER on public.kalender_farben to service_role;
grant MAINTAIN on public.kalender_farben to service_role;
grant INSERT on public.kalender_farben to authenticated;
grant SELECT on public.kalender_farben to authenticated;
grant UPDATE on public.kalender_farben to authenticated;
grant DELETE on public.kalender_farben to authenticated;
grant INSERT on public.plan_kommentare to service_role;
grant SELECT on public.plan_kommentare to service_role;
grant UPDATE on public.plan_kommentare to service_role;
grant DELETE on public.plan_kommentare to service_role;
grant TRUNCATE on public.plan_kommentare to service_role;
grant REFERENCES on public.plan_kommentare to service_role;
grant TRIGGER on public.plan_kommentare to service_role;
grant MAINTAIN on public.plan_kommentare to service_role;
grant INSERT on public.plan_kommentare to authenticated;
grant SELECT on public.plan_kommentare to authenticated;
grant DELETE on public.plan_kommentare to authenticated;
grant INSERT on public.protokoll_zugang to service_role;
grant SELECT on public.protokoll_zugang to service_role;
grant UPDATE on public.protokoll_zugang to service_role;
grant DELETE on public.protokoll_zugang to service_role;
grant TRUNCATE on public.protokoll_zugang to service_role;
grant REFERENCES on public.protokoll_zugang to service_role;
grant TRIGGER on public.protokoll_zugang to service_role;
grant MAINTAIN on public.protokoll_zugang to service_role;
grant INSERT on public.fehlzeiten to service_role;
grant SELECT on public.fehlzeiten to service_role;
grant UPDATE on public.fehlzeiten to service_role;
grant DELETE on public.fehlzeiten to service_role;
grant TRUNCATE on public.fehlzeiten to service_role;
grant REFERENCES on public.fehlzeiten to service_role;
grant TRIGGER on public.fehlzeiten to service_role;
grant MAINTAIN on public.fehlzeiten to service_role;
grant SELECT on public.fehlzeiten to authenticated;
grant INSERT on public.privat_schichtarten to service_role;
grant SELECT on public.privat_schichtarten to service_role;
grant UPDATE on public.privat_schichtarten to service_role;
grant DELETE on public.privat_schichtarten to service_role;
grant TRUNCATE on public.privat_schichtarten to service_role;
grant REFERENCES on public.privat_schichtarten to service_role;
grant TRIGGER on public.privat_schichtarten to service_role;
grant MAINTAIN on public.privat_schichtarten to service_role;
grant INSERT on public.privat_schichtarten to authenticated;
grant SELECT on public.privat_schichtarten to authenticated;
grant UPDATE on public.privat_schichtarten to authenticated;
grant DELETE on public.privat_schichtarten to authenticated;
grant INSERT on public.privat_konten to service_role;
grant SELECT on public.privat_konten to service_role;
grant UPDATE on public.privat_konten to service_role;
grant DELETE on public.privat_konten to service_role;
grant TRUNCATE on public.privat_konten to service_role;
grant REFERENCES on public.privat_konten to service_role;
grant TRIGGER on public.privat_konten to service_role;
grant MAINTAIN on public.privat_konten to service_role;
grant SELECT on public.privat_konten to authenticated;
grant INSERT on public.privat_tage to service_role;
grant SELECT on public.privat_tage to service_role;
grant UPDATE on public.privat_tage to service_role;
grant DELETE on public.privat_tage to service_role;
grant TRUNCATE on public.privat_tage to service_role;
grant REFERENCES on public.privat_tage to service_role;
grant TRIGGER on public.privat_tage to service_role;
grant MAINTAIN on public.privat_tage to service_role;
grant INSERT on public.privat_tage to authenticated;
grant SELECT on public.privat_tage to authenticated;
grant UPDATE on public.privat_tage to authenticated;
grant DELETE on public.privat_tage to authenticated;
grant INSERT on public.rotation_patterns to authenticated;
grant SELECT on public.rotation_patterns to authenticated;
grant UPDATE on public.rotation_patterns to authenticated;
grant DELETE on public.rotation_patterns to authenticated;
grant MAINTAIN on public.rotation_patterns to authenticated;
grant INSERT on public.rotation_patterns to service_role;
grant SELECT on public.rotation_patterns to service_role;
grant UPDATE on public.rotation_patterns to service_role;
grant DELETE on public.rotation_patterns to service_role;
grant TRUNCATE on public.rotation_patterns to service_role;
grant REFERENCES on public.rotation_patterns to service_role;
grant TRIGGER on public.rotation_patterns to service_role;
grant MAINTAIN on public.rotation_patterns to service_role;
grant INSERT on public.leave_balances to authenticated;
grant SELECT on public.leave_balances to authenticated;
grant UPDATE on public.leave_balances to authenticated;
grant DELETE on public.leave_balances to authenticated;
grant MAINTAIN on public.leave_balances to authenticated;
grant INSERT on public.leave_balances to service_role;
grant SELECT on public.leave_balances to service_role;
grant UPDATE on public.leave_balances to service_role;
grant DELETE on public.leave_balances to service_role;
grant TRUNCATE on public.leave_balances to service_role;
grant REFERENCES on public.leave_balances to service_role;
grant TRIGGER on public.leave_balances to service_role;
grant MAINTAIN on public.leave_balances to service_role;
grant SELECT on public.notifications to authenticated;
grant UPDATE on public.notifications to authenticated;
grant DELETE on public.notifications to authenticated;
grant MAINTAIN on public.notifications to authenticated;
grant INSERT on public.notifications to service_role;
grant SELECT on public.notifications to service_role;
grant UPDATE on public.notifications to service_role;
grant DELETE on public.notifications to service_role;
grant TRUNCATE on public.notifications to service_role;
grant REFERENCES on public.notifications to service_role;
grant TRIGGER on public.notifications to service_role;
grant MAINTAIN on public.notifications to service_role;
grant INSERT on public.absences to authenticated;
grant SELECT on public.absences to authenticated;
grant UPDATE on public.absences to authenticated;
grant DELETE on public.absences to authenticated;
grant MAINTAIN on public.absences to authenticated;
grant INSERT on public.absences to service_role;
grant SELECT on public.absences to service_role;
grant UPDATE on public.absences to service_role;
grant DELETE on public.absences to service_role;
grant TRUNCATE on public.absences to service_role;
grant REFERENCES on public.absences to service_role;
grant TRIGGER on public.absences to service_role;
grant MAINTAIN on public.absences to service_role;
grant INSERT on public.holidays to authenticated;
grant SELECT on public.holidays to authenticated;
grant UPDATE on public.holidays to authenticated;
grant DELETE on public.holidays to authenticated;
grant MAINTAIN on public.holidays to authenticated;
grant INSERT on public.holidays to service_role;
grant SELECT on public.holidays to service_role;
grant UPDATE on public.holidays to service_role;
grant DELETE on public.holidays to service_role;
grant TRUNCATE on public.holidays to service_role;
grant REFERENCES on public.holidays to service_role;
grant TRIGGER on public.holidays to service_role;
grant MAINTAIN on public.holidays to service_role;
grant INSERT on public.staffing_rules to authenticated;
grant SELECT on public.staffing_rules to authenticated;
grant UPDATE on public.staffing_rules to authenticated;
grant DELETE on public.staffing_rules to authenticated;
grant MAINTAIN on public.staffing_rules to authenticated;
grant INSERT on public.staffing_rules to service_role;
grant SELECT on public.staffing_rules to service_role;
grant UPDATE on public.staffing_rules to service_role;
grant DELETE on public.staffing_rules to service_role;
grant TRUNCATE on public.staffing_rules to service_role;
grant REFERENCES on public.staffing_rules to service_role;
grant TRIGGER on public.staffing_rules to service_role;
grant MAINTAIN on public.staffing_rules to service_role;
grant INSERT on public.shift_qualification_needs to authenticated;
grant SELECT on public.shift_qualification_needs to authenticated;
grant UPDATE on public.shift_qualification_needs to authenticated;
grant DELETE on public.shift_qualification_needs to authenticated;
grant MAINTAIN on public.shift_qualification_needs to authenticated;
grant INSERT on public.shift_qualification_needs to service_role;
grant SELECT on public.shift_qualification_needs to service_role;
grant UPDATE on public.shift_qualification_needs to service_role;
grant DELETE on public.shift_qualification_needs to service_role;
grant TRUNCATE on public.shift_qualification_needs to service_role;
grant REFERENCES on public.shift_qualification_needs to service_role;
grant TRIGGER on public.shift_qualification_needs to service_role;
grant MAINTAIN on public.shift_qualification_needs to service_role;
grant INSERT on public.qualifications to authenticated;
grant SELECT on public.qualifications to authenticated;
grant UPDATE on public.qualifications to authenticated;
grant DELETE on public.qualifications to authenticated;
grant MAINTAIN on public.qualifications to authenticated;
grant INSERT on public.qualifications to service_role;
grant SELECT on public.qualifications to service_role;
grant UPDATE on public.qualifications to service_role;
grant DELETE on public.qualifications to service_role;
grant TRUNCATE on public.qualifications to service_role;
grant REFERENCES on public.qualifications to service_role;
grant TRIGGER on public.qualifications to service_role;
grant MAINTAIN on public.qualifications to service_role;
grant INSERT on public.employee_qualifications to authenticated;
grant SELECT on public.employee_qualifications to authenticated;
grant UPDATE on public.employee_qualifications to authenticated;
grant DELETE on public.employee_qualifications to authenticated;
grant MAINTAIN on public.employee_qualifications to authenticated;
grant INSERT on public.employee_qualifications to service_role;
grant SELECT on public.employee_qualifications to service_role;
grant UPDATE on public.employee_qualifications to service_role;
grant DELETE on public.employee_qualifications to service_role;
grant TRUNCATE on public.employee_qualifications to service_role;
grant REFERENCES on public.employee_qualifications to service_role;
grant TRIGGER on public.employee_qualifications to service_role;
grant MAINTAIN on public.employee_qualifications to service_role;
grant INSERT on public.school_holidays to authenticated;
grant SELECT on public.school_holidays to authenticated;
grant UPDATE on public.school_holidays to authenticated;
grant DELETE on public.school_holidays to authenticated;
grant MAINTAIN on public.school_holidays to authenticated;
grant INSERT on public.school_holidays to service_role;
grant SELECT on public.school_holidays to service_role;
grant UPDATE on public.school_holidays to service_role;
grant DELETE on public.school_holidays to service_role;
grant TRUNCATE on public.school_holidays to service_role;
grant REFERENCES on public.school_holidays to service_role;
grant TRIGGER on public.school_holidays to service_role;
grant MAINTAIN on public.school_holidays to service_role;
grant SELECT on public.age_leave_grants to authenticated;
grant MAINTAIN on public.age_leave_grants to authenticated;
grant INSERT on public.age_leave_grants to service_role;
grant SELECT on public.age_leave_grants to service_role;
grant UPDATE on public.age_leave_grants to service_role;
grant DELETE on public.age_leave_grants to service_role;
grant TRUNCATE on public.age_leave_grants to service_role;
grant REFERENCES on public.age_leave_grants to service_role;
grant TRIGGER on public.age_leave_grants to service_role;
grant MAINTAIN on public.age_leave_grants to service_role;
grant SELECT on public.rate_limit_hits_id_seq to authenticated;
grant UPDATE on public.rate_limit_hits_id_seq to authenticated;
grant USAGE on public.rate_limit_hits_id_seq to authenticated;
grant SELECT on public.rate_limit_hits_id_seq to service_role;
grant UPDATE on public.rate_limit_hits_id_seq to service_role;
grant USAGE on public.rate_limit_hits_id_seq to service_role;
grant INSERT on public.leave_requests to authenticated;
grant SELECT on public.leave_requests to authenticated;
grant UPDATE on public.leave_requests to authenticated;
grant DELETE on public.leave_requests to authenticated;
grant MAINTAIN on public.leave_requests to authenticated;
grant INSERT on public.leave_requests to service_role;
grant SELECT on public.leave_requests to service_role;
grant UPDATE on public.leave_requests to service_role;
grant DELETE on public.leave_requests to service_role;
grant TRUNCATE on public.leave_requests to service_role;
grant REFERENCES on public.leave_requests to service_role;
grant TRIGGER on public.leave_requests to service_role;
grant MAINTAIN on public.leave_requests to service_role;
grant INSERT on public.leave_balances_view to authenticated;
grant SELECT on public.leave_balances_view to authenticated;
grant UPDATE on public.leave_balances_view to authenticated;
grant DELETE on public.leave_balances_view to authenticated;
grant MAINTAIN on public.leave_balances_view to authenticated;
grant INSERT on public.leave_balances_view to service_role;
grant SELECT on public.leave_balances_view to service_role;
grant UPDATE on public.leave_balances_view to service_role;
grant DELETE on public.leave_balances_view to service_role;
grant TRUNCATE on public.leave_balances_view to service_role;
grant REFERENCES on public.leave_balances_view to service_role;
grant TRIGGER on public.leave_balances_view to service_role;
grant MAINTAIN on public.leave_balances_view to service_role;
grant INSERT on public.company_settings to authenticated;
grant SELECT on public.company_settings to authenticated;
grant UPDATE on public.company_settings to authenticated;
grant DELETE on public.company_settings to authenticated;
grant MAINTAIN on public.company_settings to authenticated;
grant INSERT on public.company_settings to service_role;
grant SELECT on public.company_settings to service_role;
grant UPDATE on public.company_settings to service_role;
grant DELETE on public.company_settings to service_role;
grant TRUNCATE on public.company_settings to service_role;
grant REFERENCES on public.company_settings to service_role;
grant TRIGGER on public.company_settings to service_role;
grant MAINTAIN on public.company_settings to service_role;
grant INSERT on public.rate_limit_hits to service_role;
grant SELECT on public.rate_limit_hits to service_role;
grant UPDATE on public.rate_limit_hits to service_role;
grant DELETE on public.rate_limit_hits to service_role;
grant TRUNCATE on public.rate_limit_hits to service_role;
grant REFERENCES on public.rate_limit_hits to service_role;
grant TRIGGER on public.rate_limit_hits to service_role;
grant MAINTAIN on public.rate_limit_hits to service_role;
grant INSERT on public.employees to authenticated;
grant SELECT on public.employees to authenticated;
grant UPDATE on public.employees to authenticated;
grant DELETE on public.employees to authenticated;
grant MAINTAIN on public.employees to authenticated;
grant INSERT on public.employees to service_role;
grant SELECT on public.employees to service_role;
grant UPDATE on public.employees to service_role;
grant DELETE on public.employees to service_role;
grant TRUNCATE on public.employees to service_role;
grant REFERENCES on public.employees to service_role;
grant TRIGGER on public.employees to service_role;
grant MAINTAIN on public.employees to service_role;
grant INSERT on public.shifts to authenticated;
grant SELECT on public.shifts to authenticated;
grant UPDATE on public.shifts to authenticated;
grant DELETE on public.shifts to authenticated;
grant MAINTAIN on public.shifts to authenticated;
grant INSERT on public.shifts to service_role;
grant SELECT on public.shifts to service_role;
grant UPDATE on public.shifts to service_role;
grant DELETE on public.shifts to service_role;
grant TRUNCATE on public.shifts to service_role;
grant REFERENCES on public.shifts to service_role;
grant TRIGGER on public.shifts to service_role;
grant MAINTAIN on public.shifts to service_role;
grant INSERT on public.legal_versions to service_role;
grant SELECT on public.legal_versions to service_role;
grant UPDATE on public.legal_versions to service_role;
grant DELETE on public.legal_versions to service_role;
grant TRUNCATE on public.legal_versions to service_role;
grant REFERENCES on public.legal_versions to service_role;
grant TRIGGER on public.legal_versions to service_role;
grant MAINTAIN on public.legal_versions to service_role;
grant SELECT on public.legal_versions to authenticated;
grant INSERT on public.kalender_personen to service_role;
grant SELECT on public.kalender_personen to service_role;
grant UPDATE on public.kalender_personen to service_role;
grant DELETE on public.kalender_personen to service_role;
grant TRUNCATE on public.kalender_personen to service_role;
grant REFERENCES on public.kalender_personen to service_role;
grant TRIGGER on public.kalender_personen to service_role;
grant MAINTAIN on public.kalender_personen to service_role;
grant INSERT on public.kalender_gruppen to service_role;
grant SELECT on public.kalender_gruppen to service_role;
grant UPDATE on public.kalender_gruppen to service_role;
grant DELETE on public.kalender_gruppen to service_role;
grant TRUNCATE on public.kalender_gruppen to service_role;
grant REFERENCES on public.kalender_gruppen to service_role;
grant TRIGGER on public.kalender_gruppen to service_role;
grant MAINTAIN on public.kalender_gruppen to service_role;
grant INSERT on public.privacy_settings to authenticated;
grant SELECT on public.privacy_settings to authenticated;
grant UPDATE on public.privacy_settings to authenticated;
grant DELETE on public.privacy_settings to authenticated;
grant MAINTAIN on public.privacy_settings to authenticated;
grant INSERT on public.privacy_settings to service_role;
grant SELECT on public.privacy_settings to service_role;
grant UPDATE on public.privacy_settings to service_role;
grant DELETE on public.privacy_settings to service_role;
grant TRUNCATE on public.privacy_settings to service_role;
grant REFERENCES on public.privacy_settings to service_role;
grant TRIGGER on public.privacy_settings to service_role;
grant MAINTAIN on public.privacy_settings to service_role;
grant INSERT on public.companies to authenticated;
grant SELECT on public.companies to authenticated;
grant UPDATE on public.companies to authenticated;
grant DELETE on public.companies to authenticated;
grant MAINTAIN on public.companies to authenticated;
grant INSERT on public.companies to service_role;
grant SELECT on public.companies to service_role;
grant UPDATE on public.companies to service_role;
grant DELETE on public.companies to service_role;
grant TRUNCATE on public.companies to service_role;
grant REFERENCES on public.companies to service_role;
grant TRIGGER on public.companies to service_role;
grant MAINTAIN on public.companies to service_role;
grant INSERT on public.shift_assignments to authenticated;
grant SELECT on public.shift_assignments to authenticated;
grant UPDATE on public.shift_assignments to authenticated;
grant DELETE on public.shift_assignments to authenticated;
grant MAINTAIN on public.shift_assignments to authenticated;
grant INSERT on public.shift_assignments to service_role;
grant SELECT on public.shift_assignments to service_role;
grant UPDATE on public.shift_assignments to service_role;
grant DELETE on public.shift_assignments to service_role;
grant TRUNCATE on public.shift_assignments to service_role;
grant REFERENCES on public.shift_assignments to service_role;
grant TRIGGER on public.shift_assignments to service_role;
grant MAINTAIN on public.shift_assignments to service_role;
grant SELECT on public.audit_logs to authenticated;
grant MAINTAIN on public.audit_logs to authenticated;
grant INSERT on public.audit_logs to service_role;
grant SELECT on public.audit_logs to service_role;
grant UPDATE on public.audit_logs to service_role;
grant DELETE on public.audit_logs to service_role;
grant TRUNCATE on public.audit_logs to service_role;
grant REFERENCES on public.audit_logs to service_role;
grant TRIGGER on public.audit_logs to service_role;
grant MAINTAIN on public.audit_logs to service_role;
grant INSERT on public.profiles to authenticated;
grant SELECT on public.profiles to authenticated;
grant UPDATE on public.profiles to authenticated;
grant DELETE on public.profiles to authenticated;
grant MAINTAIN on public.profiles to authenticated;
grant INSERT on public.profiles to service_role;
grant SELECT on public.profiles to service_role;
grant UPDATE on public.profiles to service_role;
grant DELETE on public.profiles to service_role;
grant TRUNCATE on public.profiles to service_role;
grant REFERENCES on public.profiles to service_role;
grant TRIGGER on public.profiles to service_role;
grant MAINTAIN on public.profiles to service_role;
grant INSERT on public.demo_settings to service_role;
grant SELECT on public.demo_settings to service_role;
grant UPDATE on public.demo_settings to service_role;
grant DELETE on public.demo_settings to service_role;
grant TRUNCATE on public.demo_settings to service_role;
grant REFERENCES on public.demo_settings to service_role;
grant TRIGGER on public.demo_settings to service_role;
grant MAINTAIN on public.demo_settings to service_role;
grant INSERT on public.kalender_partner_tage to service_role;
grant SELECT on public.kalender_partner_tage to service_role;
grant UPDATE on public.kalender_partner_tage to service_role;
grant DELETE on public.kalender_partner_tage to service_role;
grant TRUNCATE on public.kalender_partner_tage to service_role;
grant REFERENCES on public.kalender_partner_tage to service_role;
grant TRIGGER on public.kalender_partner_tage to service_role;
grant MAINTAIN on public.kalender_partner_tage to service_role;
grant INSERT on public.kalender_partner to service_role;
grant SELECT on public.kalender_partner to service_role;
grant UPDATE on public.kalender_partner to service_role;
grant DELETE on public.kalender_partner to service_role;
grant TRUNCATE on public.kalender_partner to service_role;
grant REFERENCES on public.kalender_partner to service_role;
grant TRIGGER on public.kalender_partner to service_role;
grant MAINTAIN on public.kalender_partner to service_role;
grant INSERT on public.announcements to authenticated;
grant SELECT on public.announcements to authenticated;
grant UPDATE on public.announcements to authenticated;
grant DELETE on public.announcements to authenticated;
grant MAINTAIN on public.announcements to authenticated;
grant INSERT on public.announcements to service_role;
grant SELECT on public.announcements to service_role;
grant UPDATE on public.announcements to service_role;
grant DELETE on public.announcements to service_role;
grant TRUNCATE on public.announcements to service_role;
grant REFERENCES on public.announcements to service_role;
grant TRIGGER on public.announcements to service_role;
grant MAINTAIN on public.announcements to service_role;
grant SELECT on public.email_outbox to authenticated;
grant MAINTAIN on public.email_outbox to authenticated;
grant INSERT on public.email_outbox to service_role;
grant SELECT on public.email_outbox to service_role;
grant UPDATE on public.email_outbox to service_role;
grant DELETE on public.email_outbox to service_role;
grant TRUNCATE on public.email_outbox to service_role;
grant REFERENCES on public.email_outbox to service_role;
grant TRIGGER on public.email_outbox to service_role;
grant MAINTAIN on public.email_outbox to service_role;
grant INSERT on public.kalender_termine to service_role;
grant SELECT on public.kalender_termine to service_role;
grant UPDATE on public.kalender_termine to service_role;
grant DELETE on public.kalender_termine to service_role;
grant TRUNCATE on public.kalender_termine to service_role;
grant REFERENCES on public.kalender_termine to service_role;
grant TRIGGER on public.kalender_termine to service_role;
grant MAINTAIN on public.kalender_termine to service_role;
grant INSERT on public.kalender_eigene_arten to service_role;
grant SELECT on public.kalender_eigene_arten to service_role;
grant UPDATE on public.kalender_eigene_arten to service_role;
grant DELETE on public.kalender_eigene_arten to service_role;
grant TRUNCATE on public.kalender_eigene_arten to service_role;
grant REFERENCES on public.kalender_eigene_arten to service_role;
grant TRIGGER on public.kalender_eigene_arten to service_role;
grant MAINTAIN on public.kalender_eigene_arten to service_role;
grant INSERT on public.kalender_eigene_arten to authenticated;
grant SELECT on public.kalender_eigene_arten to authenticated;
grant UPDATE on public.kalender_eigene_arten to authenticated;
grant DELETE on public.kalender_eigene_arten to authenticated;
grant INSERT on public.kalender_eigene_tage to service_role;
grant SELECT on public.kalender_eigene_tage to service_role;
grant UPDATE on public.kalender_eigene_tage to service_role;
grant DELETE on public.kalender_eigene_tage to service_role;
grant TRUNCATE on public.kalender_eigene_tage to service_role;
grant REFERENCES on public.kalender_eigene_tage to service_role;
grant TRIGGER on public.kalender_eigene_tage to service_role;
grant MAINTAIN on public.kalender_eigene_tage to service_role;
grant INSERT on public.kalender_eigene_tage to authenticated;
grant SELECT on public.kalender_eigene_tage to authenticated;
grant UPDATE on public.kalender_eigene_tage to authenticated;
grant DELETE on public.kalender_eigene_tage to authenticated;
grant INSERT on public.platform_admins to service_role;
grant SELECT on public.platform_admins to service_role;
grant UPDATE on public.platform_admins to service_role;
grant DELETE on public.platform_admins to service_role;
grant TRUNCATE on public.platform_admins to service_role;
grant REFERENCES on public.platform_admins to service_role;
grant TRIGGER on public.platform_admins to service_role;
grant MAINTAIN on public.platform_admins to service_role;
grant INSERT on public.replacement_requests to authenticated;
grant SELECT on public.replacement_requests to authenticated;
grant UPDATE on public.replacement_requests to authenticated;
grant DELETE on public.replacement_requests to authenticated;
grant MAINTAIN on public.replacement_requests to authenticated;
grant INSERT on public.replacement_requests to service_role;
grant SELECT on public.replacement_requests to service_role;
grant UPDATE on public.replacement_requests to service_role;
grant DELETE on public.replacement_requests to service_role;
grant TRUNCATE on public.replacement_requests to service_role;
grant REFERENCES on public.replacement_requests to service_role;
grant TRIGGER on public.replacement_requests to service_role;
grant MAINTAIN on public.replacement_requests to service_role;
grant INSERT on public.training_assignments to authenticated;
grant SELECT on public.training_assignments to authenticated;
grant UPDATE on public.training_assignments to authenticated;
grant DELETE on public.training_assignments to authenticated;
grant MAINTAIN on public.training_assignments to authenticated;
grant INSERT on public.training_assignments to service_role;
grant SELECT on public.training_assignments to service_role;
grant UPDATE on public.training_assignments to service_role;
grant DELETE on public.training_assignments to service_role;
grant TRUNCATE on public.training_assignments to service_role;
grant REFERENCES on public.training_assignments to service_role;
grant TRIGGER on public.training_assignments to service_role;
grant MAINTAIN on public.training_assignments to service_role;
grant INSERT on public.aenderungszaehler to service_role;
grant SELECT on public.aenderungszaehler to service_role;
grant UPDATE on public.aenderungszaehler to service_role;
grant DELETE on public.aenderungszaehler to service_role;
grant TRUNCATE on public.aenderungszaehler to service_role;
grant REFERENCES on public.aenderungszaehler to service_role;
grant TRIGGER on public.aenderungszaehler to service_role;
grant MAINTAIN on public.aenderungszaehler to service_role;
grant INSERT on public.funktionen to service_role;
grant SELECT on public.funktionen to service_role;
grant UPDATE on public.funktionen to service_role;
grant DELETE on public.funktionen to service_role;
grant TRUNCATE on public.funktionen to service_role;
grant REFERENCES on public.funktionen to service_role;
grant TRIGGER on public.funktionen to service_role;
grant MAINTAIN on public.funktionen to service_role;
grant INSERT on public.funktionen_zugang to service_role;
grant SELECT on public.funktionen_zugang to service_role;
grant UPDATE on public.funktionen_zugang to service_role;
grant DELETE on public.funktionen_zugang to service_role;
grant TRUNCATE on public.funktionen_zugang to service_role;
grant REFERENCES on public.funktionen_zugang to service_role;
grant TRIGGER on public.funktionen_zugang to service_role;
grant MAINTAIN on public.funktionen_zugang to service_role;
grant INSERT on public.kalender_personen_tage to service_role;
grant SELECT on public.kalender_personen_tage to service_role;
grant UPDATE on public.kalender_personen_tage to service_role;
grant DELETE on public.kalender_personen_tage to service_role;
grant TRUNCATE on public.kalender_personen_tage to service_role;
grant REFERENCES on public.kalender_personen_tage to service_role;
grant TRIGGER on public.kalender_personen_tage to service_role;
grant MAINTAIN on public.kalender_personen_tage to service_role;
grant INSERT on public.personal_details to authenticated;
grant SELECT on public.personal_details to authenticated;
grant UPDATE on public.personal_details to authenticated;
grant DELETE on public.personal_details to authenticated;
grant MAINTAIN on public.personal_details to authenticated;
grant INSERT on public.personal_details to service_role;
grant SELECT on public.personal_details to service_role;
grant UPDATE on public.personal_details to service_role;
grant DELETE on public.personal_details to service_role;
grant TRUNCATE on public.personal_details to service_role;
grant REFERENCES on public.personal_details to service_role;
grant TRIGGER on public.personal_details to service_role;
grant MAINTAIN on public.personal_details to service_role;
grant INSERT on public.kalender_gruppen_mitglieder to service_role;
grant SELECT on public.kalender_gruppen_mitglieder to service_role;
grant UPDATE on public.kalender_gruppen_mitglieder to service_role;
grant DELETE on public.kalender_gruppen_mitglieder to service_role;
grant TRUNCATE on public.kalender_gruppen_mitglieder to service_role;
grant REFERENCES on public.kalender_gruppen_mitglieder to service_role;
grant TRIGGER on public.kalender_gruppen_mitglieder to service_role;
grant MAINTAIN on public.kalender_gruppen_mitglieder to service_role;
grant INSERT on public.push_abos to service_role;
grant SELECT on public.push_abos to service_role;
grant UPDATE on public.push_abos to service_role;
grant DELETE on public.push_abos to service_role;
grant TRUNCATE on public.push_abos to service_role;
grant REFERENCES on public.push_abos to service_role;
grant TRIGGER on public.push_abos to service_role;
grant MAINTAIN on public.push_abos to service_role;
grant INSERT on public.kalender_todos to service_role;
grant SELECT on public.kalender_todos to service_role;
grant UPDATE on public.kalender_todos to service_role;
grant DELETE on public.kalender_todos to service_role;
grant TRUNCATE on public.kalender_todos to service_role;
grant REFERENCES on public.kalender_todos to service_role;
grant TRIGGER on public.kalender_todos to service_role;
grant MAINTAIN on public.kalender_todos to service_role;
grant INSERT on public.erinnerung_gesendet to service_role;
grant SELECT on public.erinnerung_gesendet to service_role;
grant UPDATE on public.erinnerung_gesendet to service_role;
grant DELETE on public.erinnerung_gesendet to service_role;
grant TRUNCATE on public.erinnerung_gesendet to service_role;
grant REFERENCES on public.erinnerung_gesendet to service_role;
grant TRIGGER on public.erinnerung_gesendet to service_role;
grant MAINTAIN on public.erinnerung_gesendet to service_role;
grant INSERT on public.kalender_vorlieben to service_role;
grant SELECT on public.kalender_vorlieben to service_role;
grant UPDATE on public.kalender_vorlieben to service_role;
grant DELETE on public.kalender_vorlieben to service_role;
grant TRUNCATE on public.kalender_vorlieben to service_role;
grant REFERENCES on public.kalender_vorlieben to service_role;
grant TRIGGER on public.kalender_vorlieben to service_role;
grant MAINTAIN on public.kalender_vorlieben to service_role;
grant INSERT on public.kalender_verbindungen to service_role;
grant SELECT on public.kalender_verbindungen to service_role;
grant UPDATE on public.kalender_verbindungen to service_role;
grant DELETE on public.kalender_verbindungen to service_role;
grant TRUNCATE on public.kalender_verbindungen to service_role;
grant REFERENCES on public.kalender_verbindungen to service_role;
grant TRIGGER on public.kalender_verbindungen to service_role;
grant MAINTAIN on public.kalender_verbindungen to service_role;
grant INSERT on public.kalender_verbindung_codes to service_role;
grant SELECT on public.kalender_verbindung_codes to service_role;
grant UPDATE on public.kalender_verbindung_codes to service_role;
grant DELETE on public.kalender_verbindung_codes to service_role;
grant TRUNCATE on public.kalender_verbindung_codes to service_role;
grant REFERENCES on public.kalender_verbindung_codes to service_role;
grant TRIGGER on public.kalender_verbindung_codes to service_role;
grant MAINTAIN on public.kalender_verbindung_codes to service_role;
grant INSERT on public.kalender_termin_ausnahmen to service_role;
grant SELECT on public.kalender_termin_ausnahmen to service_role;
grant UPDATE on public.kalender_termin_ausnahmen to service_role;
grant DELETE on public.kalender_termin_ausnahmen to service_role;
grant TRUNCATE on public.kalender_termin_ausnahmen to service_role;
grant REFERENCES on public.kalender_termin_ausnahmen to service_role;
grant TRIGGER on public.kalender_termin_ausnahmen to service_role;
grant MAINTAIN on public.kalender_termin_ausnahmen to service_role;
grant INSERT on public.kalender_code_versuche to service_role;
grant SELECT on public.kalender_code_versuche to service_role;
grant UPDATE on public.kalender_code_versuche to service_role;
grant DELETE on public.kalender_code_versuche to service_role;
grant TRUNCATE on public.kalender_code_versuche to service_role;
grant REFERENCES on public.kalender_code_versuche to service_role;
grant TRIGGER on public.kalender_code_versuche to service_role;
grant MAINTAIN on public.kalender_code_versuche to service_role;
grant SELECT on public.push_warteschlange_id_seq to authenticated;
grant UPDATE on public.push_warteschlange_id_seq to authenticated;
grant USAGE on public.push_warteschlange_id_seq to authenticated;
grant SELECT on public.push_warteschlange_id_seq to service_role;
grant UPDATE on public.push_warteschlange_id_seq to service_role;
grant USAGE on public.push_warteschlange_id_seq to service_role;
grant INSERT on public.plattform_protokoll to service_role;
grant SELECT on public.plattform_protokoll to service_role;
grant UPDATE on public.plattform_protokoll to service_role;
grant DELETE on public.plattform_protokoll to service_role;
grant TRUNCATE on public.plattform_protokoll to service_role;
grant REFERENCES on public.plattform_protokoll to service_role;
grant TRIGGER on public.plattform_protokoll to service_role;
grant MAINTAIN on public.plattform_protokoll to service_role;
grant INSERT on public.push_vorlieben to service_role;
grant SELECT on public.push_vorlieben to service_role;
grant UPDATE on public.push_vorlieben to service_role;
grant DELETE on public.push_vorlieben to service_role;
grant TRUNCATE on public.push_vorlieben to service_role;
grant REFERENCES on public.push_vorlieben to service_role;
grant TRIGGER on public.push_vorlieben to service_role;
grant MAINTAIN on public.push_vorlieben to service_role;
grant INSERT on public.anzeige_einstellungen to service_role;
grant SELECT on public.anzeige_einstellungen to service_role;
grant UPDATE on public.anzeige_einstellungen to service_role;
grant DELETE on public.anzeige_einstellungen to service_role;
grant TRUNCATE on public.anzeige_einstellungen to service_role;
grant REFERENCES on public.anzeige_einstellungen to service_role;
grant TRIGGER on public.anzeige_einstellungen to service_role;
grant MAINTAIN on public.anzeige_einstellungen to service_role;
grant INSERT on public.anzeige_einstellungen to authenticated;
grant SELECT on public.anzeige_einstellungen to authenticated;
grant UPDATE on public.anzeige_einstellungen to authenticated;
grant INSERT on public.passwort_codes to service_role;
grant SELECT on public.passwort_codes to service_role;
grant UPDATE on public.passwort_codes to service_role;
grant DELETE on public.passwort_codes to service_role;
grant TRUNCATE on public.passwort_codes to service_role;
grant REFERENCES on public.passwort_codes to service_role;
grant TRIGGER on public.passwort_codes to service_role;
grant MAINTAIN on public.passwort_codes to service_role;
grant SELECT on public.plattform_protokoll_id_seq to authenticated;
grant UPDATE on public.plattform_protokoll_id_seq to authenticated;
grant USAGE on public.plattform_protokoll_id_seq to authenticated;
grant SELECT on public.plattform_protokoll_id_seq to service_role;
grant UPDATE on public.plattform_protokoll_id_seq to service_role;
grant USAGE on public.plattform_protokoll_id_seq to service_role;
grant INSERT on public.push_warteschlange to service_role;
grant SELECT on public.push_warteschlange to service_role;
grant UPDATE on public.push_warteschlange to service_role;
grant DELETE on public.push_warteschlange to service_role;
grant TRUNCATE on public.push_warteschlange to service_role;
grant REFERENCES on public.push_warteschlange to service_role;
grant TRIGGER on public.push_warteschlange to service_role;
grant MAINTAIN on public.push_warteschlange to service_role;
grant INSERT on public.hinweise to service_role;
grant SELECT on public.hinweise to service_role;
grant UPDATE on public.hinweise to service_role;
grant DELETE on public.hinweise to service_role;
grant TRUNCATE on public.hinweise to service_role;
grant REFERENCES on public.hinweise to service_role;
grant TRIGGER on public.hinweise to service_role;
grant MAINTAIN on public.hinweise to service_role;
grant INSERT on public.betrieb_beitritte to service_role;
grant SELECT on public.betrieb_beitritte to service_role;
grant UPDATE on public.betrieb_beitritte to service_role;
grant DELETE on public.betrieb_beitritte to service_role;
grant TRUNCATE on public.betrieb_beitritte to service_role;
grant REFERENCES on public.betrieb_beitritte to service_role;
grant TRIGGER on public.betrieb_beitritte to service_role;
grant MAINTAIN on public.betrieb_beitritte to service_role;
grant INSERT on public.lohnzettel_aufraeumen to service_role;
grant SELECT on public.lohnzettel_aufraeumen to service_role;
grant UPDATE on public.lohnzettel_aufraeumen to service_role;
grant DELETE on public.lohnzettel_aufraeumen to service_role;
grant TRUNCATE on public.lohnzettel_aufraeumen to service_role;
grant REFERENCES on public.lohnzettel_aufraeumen to service_role;
grant TRIGGER on public.lohnzettel_aufraeumen to service_role;
grant MAINTAIN on public.lohnzettel_aufraeumen to service_role;
grant INSERT on public.privat_tag_zeiten to service_role;
grant SELECT on public.privat_tag_zeiten to service_role;
grant UPDATE on public.privat_tag_zeiten to service_role;
grant DELETE on public.privat_tag_zeiten to service_role;
grant TRUNCATE on public.privat_tag_zeiten to service_role;
grant REFERENCES on public.privat_tag_zeiten to service_role;
grant TRIGGER on public.privat_tag_zeiten to service_role;
grant MAINTAIN on public.privat_tag_zeiten to service_role;
grant INSERT on public.privat_tag_zeiten to authenticated;
grant SELECT on public.privat_tag_zeiten to authenticated;
grant UPDATE on public.privat_tag_zeiten to authenticated;
grant DELETE on public.privat_tag_zeiten to authenticated;
grant INSERT on public.privat_lohnzettel to service_role;
grant SELECT on public.privat_lohnzettel to service_role;
grant UPDATE on public.privat_lohnzettel to service_role;
grant DELETE on public.privat_lohnzettel to service_role;
grant TRUNCATE on public.privat_lohnzettel to service_role;
grant REFERENCES on public.privat_lohnzettel to service_role;
grant TRIGGER on public.privat_lohnzettel to service_role;
grant MAINTAIN on public.privat_lohnzettel to service_role;
grant SELECT on public.privat_lohnzettel to authenticated;
grant DELETE on public.privat_lohnzettel to authenticated;
grant INSERT on public.privat_umfrage to service_role;
grant SELECT on public.privat_umfrage to service_role;
grant UPDATE on public.privat_umfrage to service_role;
grant DELETE on public.privat_umfrage to service_role;
grant TRUNCATE on public.privat_umfrage to service_role;
grant REFERENCES on public.privat_umfrage to service_role;
grant TRIGGER on public.privat_umfrage to service_role;
grant MAINTAIN on public.privat_umfrage to service_role;
grant INSERT on public.plattform_tageszahlen to service_role;
grant SELECT on public.plattform_tageszahlen to service_role;
grant UPDATE on public.plattform_tageszahlen to service_role;
grant DELETE on public.plattform_tageszahlen to service_role;
grant TRUNCATE on public.plattform_tageszahlen to service_role;
grant REFERENCES on public.plattform_tageszahlen to service_role;
grant TRIGGER on public.plattform_tageszahlen to service_role;
grant MAINTAIN on public.plattform_tageszahlen to service_role;
grant INSERT on public.anmelde_sperren to service_role;
grant SELECT on public.anmelde_sperren to service_role;
grant UPDATE on public.anmelde_sperren to service_role;
grant DELETE on public.anmelde_sperren to service_role;
grant TRUNCATE on public.anmelde_sperren to service_role;
grant REFERENCES on public.anmelde_sperren to service_role;
grant TRIGGER on public.anmelde_sperren to service_role;
grant MAINTAIN on public.anmelde_sperren to service_role;
grant INSERT on public.vertraute_geraete to service_role;
grant SELECT on public.vertraute_geraete to service_role;
grant UPDATE on public.vertraute_geraete to service_role;
grant DELETE on public.vertraute_geraete to service_role;
grant TRUNCATE on public.vertraute_geraete to service_role;
grant REFERENCES on public.vertraute_geraete to service_role;
grant TRIGGER on public.vertraute_geraete to service_role;
grant MAINTAIN on public.vertraute_geraete to service_role;
grant INSERT on public.vertraute_sitzungen to service_role;
grant SELECT on public.vertraute_sitzungen to service_role;
grant UPDATE on public.vertraute_sitzungen to service_role;
grant DELETE on public.vertraute_sitzungen to service_role;
grant TRUNCATE on public.vertraute_sitzungen to service_role;
grant REFERENCES on public.vertraute_sitzungen to service_role;
grant TRIGGER on public.vertraute_sitzungen to service_role;
grant MAINTAIN on public.vertraute_sitzungen to service_role;
grant INSERT on public.employee_gruppenwechsel to authenticated;
grant SELECT on public.employee_gruppenwechsel to authenticated;
grant UPDATE on public.employee_gruppenwechsel to authenticated;
grant DELETE on public.employee_gruppenwechsel to authenticated;
grant TRUNCATE on public.employee_gruppenwechsel to authenticated;
grant REFERENCES on public.employee_gruppenwechsel to authenticated;
grant TRIGGER on public.employee_gruppenwechsel to authenticated;
grant MAINTAIN on public.employee_gruppenwechsel to authenticated;
grant INSERT on public.employee_gruppenwechsel to service_role;
grant SELECT on public.employee_gruppenwechsel to service_role;
grant UPDATE on public.employee_gruppenwechsel to service_role;
grant DELETE on public.employee_gruppenwechsel to service_role;
grant TRUNCATE on public.employee_gruppenwechsel to service_role;
grant REFERENCES on public.employee_gruppenwechsel to service_role;
grant TRIGGER on public.employee_gruppenwechsel to service_role;
grant MAINTAIN on public.employee_gruppenwechsel to service_role;
grant INSERT on public.konsole_tresor_schluessel to service_role;
grant SELECT on public.konsole_tresor_schluessel to service_role;
grant UPDATE on public.konsole_tresor_schluessel to service_role;
grant DELETE on public.konsole_tresor_schluessel to service_role;
grant TRUNCATE on public.konsole_tresor_schluessel to service_role;
grant REFERENCES on public.konsole_tresor_schluessel to service_role;
grant TRIGGER on public.konsole_tresor_schluessel to service_role;
grant MAINTAIN on public.konsole_tresor_schluessel to service_role;
grant INSERT on public.konsole_tresor to service_role;
grant SELECT on public.konsole_tresor to service_role;
grant UPDATE on public.konsole_tresor to service_role;
grant DELETE on public.konsole_tresor to service_role;
grant TRUNCATE on public.konsole_tresor to service_role;
grant REFERENCES on public.konsole_tresor to service_role;
grant TRIGGER on public.konsole_tresor to service_role;
grant MAINTAIN on public.konsole_tresor to service_role;
grant INSERT on public.schicht_tausch to service_role;
grant SELECT on public.schicht_tausch to service_role;
grant UPDATE on public.schicht_tausch to service_role;
grant DELETE on public.schicht_tausch to service_role;
grant TRUNCATE on public.schicht_tausch to service_role;
grant REFERENCES on public.schicht_tausch to service_role;
grant TRIGGER on public.schicht_tausch to service_role;
grant MAINTAIN on public.schicht_tausch to service_role;
grant UPDATE (name) on public.privat_konten to authenticated;
grant UPDATE (bundesland) on public.privat_konten to authenticated;
grant UPDATE (feiertage_zeigen) on public.privat_konten to authenticated;
grant UPDATE (wochenstunden) on public.privat_konten to authenticated;
grant SELECT (kontakt_email) on public.privat_konten to authenticated;
grant UPDATE (kontakt_email) on public.privat_konten to authenticated;
grant UPDATE (monat) on public.privat_lohnzettel to authenticated;
grant UPDATE (titel) on public.privat_lohnzettel to authenticated;
grant execute on function public.meine_statistik_tage(p_jahr integer) to authenticated;
grant execute on function public.meine_statistik_tage(p_jahr integer) to service_role;
grant execute on function public.privat_umfrage_senden(p_quelle text, p_zufriedenheit integer, p_verbesserung text) to authenticated;
grant execute on function public.privat_umfrage_senden(p_quelle text, p_zufriedenheit integer, p_verbesserung text) to service_role;
grant execute on function public.privat_umfrage_offen() to authenticated;
grant execute on function public.privat_umfrage_offen() to service_role;
grant execute on function public.platform_umfrage() to service_role;
grant execute on function public.platform_dashboard(p_limit integer) to service_role;
grant execute on function public.preview_leave_auto(p_start_date date, p_end_date date) to authenticated;
grant execute on function public.preview_leave_auto(p_start_date date, p_end_date date) to service_role;
grant execute on function public._passwort_code_neu() to service_role;
grant execute on function public._passwort_code_hash(p_code text) to service_role;
grant execute on function public.set_notification_settings(p_notify_leave_email boolean) to authenticated;
grant execute on function public.set_notification_settings(p_notify_leave_email boolean) to service_role;
grant execute on function public.ensure_leave_balances_for_year(p_year integer) to authenticated;
grant execute on function public.ensure_leave_balances_for_year(p_year integer) to service_role;
grant execute on function public._passwort_code_setzen(p_user uuid, p_art text, p_dauer interval) to service_role;
grant execute on function public.partner_inhaber(p_token text) to service_role;
grant execute on function public.plattform_passwort_code(p_email text) to service_role;
grant execute on function public.mein_wiederherstellungscode_stand() to authenticated;
grant execute on function public.mein_wiederherstellungscode_stand() to service_role;
grant execute on function public.mein_wiederherstellungscode() to authenticated;
grant execute on function public.mein_wiederherstellungscode() to service_role;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.zugang_ok() to authenticated;
grant execute on function public.zugang_ok() to service_role;
grant execute on function public.auth_company_id() to authenticated;
grant execute on function public.auth_company_id() to service_role;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_role() to service_role;
grant execute on function public.auth_employee_id() to authenticated;
grant execute on function public.auth_employee_id() to service_role;
grant execute on function public.anmelde_sperre_dauerhaft(p_user uuid) to service_role;
grant execute on function public.passwort_code_einloesen(p_email text, p_code text) to service_role;
grant execute on function public.discard_unclaimed_company(p_company_id uuid) to service_role;
grant execute on function public.anmeldung_erfolgreich(p_user uuid) to service_role;
grant execute on function public.anmeldung_gesperrt(p_email text) to service_role;
grant execute on function public.shift_runs_on(p_shift shifts, p_date date, p_work_on_holidays boolean) to authenticated;
grant execute on function public.shift_runs_on(p_shift shifts, p_date date, p_work_on_holidays boolean) to service_role;
grant execute on function public.inaktive_konten() to authenticated;
grant execute on function public.inaktive_konten() to service_role;
grant execute on function public.inaktiv_erledigt(p_employee_id uuid, p_abmelden boolean) to authenticated;
grant execute on function public.inaktiv_erledigt(p_employee_id uuid, p_abmelden boolean) to service_role;
grant execute on function public.anmeldung_fehlversuch_konto(p_user uuid) to service_role;
grant execute on function public.anmeldung_fehlversuch(p_email text) to service_role;
grant execute on function public.mein_zugang_gesperrt() to authenticated;
grant execute on function public.mein_zugang_gesperrt() to service_role;
grant execute on function public.zugang_status_firma() to authenticated;
grant execute on function public.zugang_status_firma() to service_role;
grant execute on function public.anmeldesperre_aufheben(p_employee uuid) to authenticated;
grant execute on function public.anmeldesperre_aufheben(p_employee uuid) to service_role;
grant execute on function public.employees_sync_entitlement() to service_role;
grant execute on function public.zwei_faktor_zuruecksetzen(p_employee uuid) to authenticated;
grant execute on function public.zwei_faktor_zuruecksetzen(p_employee uuid) to service_role;
grant execute on function public.set_employee_qualifications(p_employee_id uuid, p_keys text[]) to authenticated;
grant execute on function public.set_employee_qualifications(p_employee_id uuid, p_keys text[]) to service_role;
grant execute on function public.company_qualifications() to authenticated;
grant execute on function public.company_qualifications() to service_role;
grant execute on function public.calculate_leave_days(p_company_id uuid, p_start_date date, p_end_date date, p_half_day_period half_day_period) to authenticated;
grant execute on function public.calculate_leave_days(p_company_id uuid, p_start_date date, p_end_date date, p_half_day_period half_day_period) to service_role;
grant execute on function public.plattform_firma_papierkorb(p_company uuid, p_in boolean) to service_role;
grant execute on function public.platform_sperren() to service_role;
grant execute on function public.tausch_frei(p_employee uuid, p_tag date) to service_role;
grant execute on function public.tausch_arbeitet(p_employee uuid, p_tag date) to service_role;
grant execute on function public.platform_zugang(p_email text, p_aktion text) to service_role;
grant execute on function public.papierkorb_leeren() to service_role;
grant execute on function public.effective_shift_id(p_employee_id uuid, p_date date) to authenticated;
grant execute on function public.effective_shift_id(p_employee_id uuid, p_date date) to service_role;
grant execute on function public.employees_absent_on(p_date date, p_include_pending boolean, p_include_request_id uuid) to authenticated;
grant execute on function public.employees_absent_on(p_date date, p_include_pending boolean, p_include_request_id uuid) to service_role;
grant execute on function public.tausch_leitung_benachrichtigen(p_tausch uuid, p_titel text, p_text text) to service_role;
grant execute on function public.meine_daten() to authenticated;
grant execute on function public.meine_daten() to service_role;
grant execute on function public.gruppenwechsel_planen(p_employee_id uuid, p_ab date, p_nach_team rotation_team) to authenticated;
grant execute on function public.gruppenwechsel_planen(p_employee_id uuid, p_ab date, p_nach_team rotation_team) to service_role;
grant execute on function public.leave_requests_check_block() to service_role;
grant execute on function public.gruppenwechsel_loeschen(p_id uuid) to authenticated;
grant execute on function public.gruppenwechsel_loeschen(p_id uuid) to service_role;
grant execute on function public.platform_darf_aendern(p_user_id uuid) to service_role;
grant execute on function public.platform_notfall_merken() to service_role;
grant execute on function public.leave_block_for_range(p_company_id uuid, p_shift_id uuid, p_start_date date, p_end_date date) to authenticated;
grant execute on function public.leave_block_for_range(p_company_id uuid, p_shift_id uuid, p_start_date date, p_end_date date) to service_role;
grant execute on function public.platform_notfall_zugriffe() to service_role;
grant execute on function public.staffing_for_day(p_company_id uuid, p_date date) to authenticated;
grant execute on function public.staffing_for_day(p_company_id uuid, p_date date) to service_role;
grant execute on function public.partner_link_beenden() to authenticated;
grant execute on function public.partner_link_beenden() to service_role;
grant execute on function public.staffing_range(p_company_id uuid, p_from date, p_days integer) to authenticated;
grant execute on function public.staffing_range(p_company_id uuid, p_from date, p_days integer) to service_role;
grant execute on function public.staffing_month_overview(p_company_id uuid, p_year integer, p_month integer) to authenticated;
grant execute on function public.staffing_month_overview(p_company_id uuid, p_year integer, p_month integer) to service_role;
grant execute on function public.staffing_snapshot(p_shift_id uuid, p_date date) to authenticated;
grant execute on function public.staffing_snapshot(p_shift_id uuid, p_date date) to service_role;
grant execute on function public.sitzung_vertraut() to authenticated;
grant execute on function public.sitzung_vertraut() to service_role;
grant execute on function public.geraet_merken(p_user uuid, p_token_hash text, p_geraet text) to service_role;
grant execute on function public.geraet_einloesen(p_user uuid, p_session uuid, p_token_hash text) to service_role;
grant execute on function public.meine_geraete_vergessen() to authenticated;
grant execute on function public.meine_geraete_vergessen() to service_role;
grant execute on function public.fehlzeiten_liste(p_von date, p_bis date) to authenticated;
grant execute on function public.fehlzeiten_liste(p_von date, p_bis date) to service_role;
grant execute on function public.profil_aus_einladung(p_user uuid) to service_role;
grant execute on function public.shift_assignments_for_range(p_company_id uuid, p_from date, p_to date) to authenticated;
grant execute on function public.shift_assignments_for_range(p_company_id uuid, p_from date, p_to date) to service_role;
grant execute on function public.rotation_shift_for(p_employee_id uuid, p_date date) to authenticated;
grant execute on function public.rotation_shift_for(p_employee_id uuid, p_date date) to service_role;
grant execute on function public.rotation_cycle_length(p_pattern_id uuid) to authenticated;
grant execute on function public.rotation_cycle_length(p_pattern_id uuid) to service_role;
grant execute on function public.protokoll_fehlanmeldung(p_email text) to service_role;
grant execute on function public.meine_partner_tage(p_von date, p_bis date) to authenticated;
grant execute on function public.meine_partner_tage(p_von date, p_bis date) to service_role;
grant execute on function public.meine_partner_tage_setzen(p_von date, p_anzahl integer, p_schicht text) to authenticated;
grant execute on function public.meine_partner_tage_setzen(p_von date, p_anzahl integer, p_schicht text) to service_role;
grant execute on function public.plattform_loeschliste() to service_role;
grant execute on function public.firma_endgueltig_loeschen(p_company uuid) to service_role;
grant execute on function public.assign_shift(p_employee_id uuid, p_shift_id uuid, p_date date) to authenticated;
grant execute on function public.assign_shift(p_employee_id uuid, p_shift_id uuid, p_date date) to service_role;
grant execute on function public.my_shift_plan(p_from date, p_days integer) to authenticated;
grant execute on function public.my_shift_plan(p_from date, p_days integer) to service_role;
grant execute on function public.platform_team() to service_role;
grant execute on function public.german_holidays(p_year integer, p_state text) to authenticated;
grant execute on function public.german_holidays(p_year integer, p_state text) to service_role;
grant execute on function public.platform_nutzer_id(p_email text) to service_role;
grant execute on function public.platform_protokoll_liste(p_limit integer) to service_role;
grant execute on function public.qualification_coverage(p_shift_id uuid, p_date date) to authenticated;
grant execute on function public.qualification_coverage(p_shift_id uuid, p_date date) to service_role;
grant execute on function public.profil_nachholen() to authenticated;
grant execute on function public.profil_nachholen() to service_role;
grant execute on function public.privat_rotation_anwenden(p_start date, p_bis date, p_muster uuid[], p_ueberschreiben boolean) to authenticated;
grant execute on function public.privat_rotation_anwenden(p_start date, p_bis date, p_muster uuid[], p_ueberschreiben boolean) to service_role;
grant execute on function public.rotation_preview(p_pattern_id uuid, p_offset_days integer, p_from date, p_days integer) to authenticated;
grant execute on function public.rotation_preview(p_pattern_id uuid, p_offset_days integer, p_from date, p_days integer) to service_role;
grant execute on function public.withdraw_leave_request(p_request_id uuid) to authenticated;
grant execute on function public.withdraw_leave_request(p_request_id uuid) to service_role;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_leadership() to authenticated;
grant execute on function public.is_leadership() to service_role;
grant execute on function public.leave_requests_set_computed_days() to service_role;
grant execute on function public.set_leave_entitlement(p_employee_id uuid, p_entitlement numeric, p_year smallint) to authenticated;
grant execute on function public.set_leave_entitlement(p_employee_id uuid, p_entitlement numeric, p_year smallint) to service_role;
grant execute on function public.employees_ensure_leave_balance() to service_role;
grant execute on function public.email_outbox_status() to authenticated;
grant execute on function public.email_outbox_status() to service_role;
grant execute on function public.apply_rotation_to_all() to authenticated;
grant execute on function public.apply_rotation_to_all() to service_role;
grant execute on function public.replacement_candidates(p_date date, p_shift_id uuid, p_qualification_id uuid) to authenticated;
grant execute on function public.replacement_candidates(p_date date, p_shift_id uuid, p_qualification_id uuid) to service_role;
grant execute on function public.person_link_neu(p_id uuid) to authenticated;
grant execute on function public.person_link_neu(p_id uuid) to service_role;
grant execute on function public.person_link_beenden(p_id uuid) to authenticated;
grant execute on function public.person_link_beenden(p_id uuid) to service_role;
grant execute on function public.berufsschule_selbst(p_von date, p_bis date, p_wochentage integer[], p_entfernen boolean) to authenticated;
grant execute on function public.berufsschule_selbst(p_von date, p_bis date, p_wochentage integer[], p_entfernen boolean) to service_role;
grant execute on function public.who_is_absent(p_date date) to authenticated;
grant execute on function public.who_is_absent(p_date date) to service_role;
grant execute on function public.companies_ensure_settings() to service_role;
grant execute on function public.urlaubssperre_pruefen(p_employee_id uuid, p_start_date date, p_end_date date) to authenticated;
grant execute on function public.urlaubssperre_pruefen(p_employee_id uuid, p_start_date date, p_end_date date) to service_role;
grant execute on function public.get_notification_settings() to authenticated;
grant execute on function public.get_notification_settings() to service_role;
grant execute on function public.partner_einladen(p_termine_teilen boolean) to authenticated;
grant execute on function public.partner_einladen(p_termine_teilen boolean) to service_role;
grant execute on function public.partner_termine_teilen(p_an boolean) to authenticated;
grant execute on function public.partner_termine_teilen(p_an boolean) to service_role;
grant execute on function public.partner_einladung_status() to authenticated;
grant execute on function public.partner_einladung_status() to service_role;
grant execute on function public.shift_leave_overlap(p_employee_id uuid, p_start_date date, p_end_date date) to authenticated;
grant execute on function public.shift_leave_overlap(p_employee_id uuid, p_start_date date, p_end_date date) to service_role;
grant execute on function public.employees_sync_rotation_offset() to service_role;
grant execute on function public.blocked_days(p_from date, p_to date) to authenticated;
grant execute on function public.blocked_days(p_from date, p_to date) to service_role;
grant execute on function public.employees_guard_role_change() to service_role;
grant execute on function public.naechste_arbeitszeit(p_employee uuid) to service_role;
grant execute on function public.kalender_gruppen_grenze() to public;
grant execute on function public.kalender_gruppen_grenze() to anon;
grant execute on function public.kalender_gruppen_grenze() to authenticated;
grant execute on function public.kalender_gruppen_grenze() to service_role;
grant execute on function public.gruppe_zum_link(p_token text) to service_role;
grant execute on function public.suggest_leave_kind(p_employee_id uuid, p_date date) to authenticated;
grant execute on function public.suggest_leave_kind(p_employee_id uuid, p_date date) to service_role;
grant execute on function public.tausch_liste() to authenticated;
grant execute on function public.tausch_liste() to service_role;
grant execute on function public.ist_gruppenmitglied(p_gruppe uuid) to service_role;
grant execute on function public.rls_auto_enable() to service_role;
grant execute on function public.easter_sunday(p_year integer) to authenticated;
grant execute on function public.easter_sunday(p_year integer) to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.hinweis_gelesen(p_id uuid) to authenticated;
grant execute on function public.hinweis_gelesen(p_id uuid) to service_role;
grant execute on function public.is_premium_day(p_employee_id uuid, p_date date) to authenticated;
grant execute on function public.is_premium_day(p_employee_id uuid, p_date date) to service_role;
grant execute on function public.ensure_holidays(p_company_id uuid, p_year integer, p_replace boolean) to authenticated;
grant execute on function public.ensure_holidays(p_company_id uuid, p_year integer, p_replace boolean) to service_role;
grant execute on function public.set_company_state(p_state text) to authenticated;
grant execute on function public.set_company_state(p_state text) to service_role;
grant execute on function public.submit_leave_auto(p_start_date date, p_end_date date, p_reason text) to authenticated;
grant execute on function public.submit_leave_auto(p_start_date date, p_end_date date, p_reason text) to service_role;
grant execute on function public.hinweis_zurueckziehen(p_id uuid) to authenticated;
grant execute on function public.hinweis_zurueckziehen(p_id uuid) to service_role;
grant execute on function public.ensure_leave_balance(p_employee_id uuid, p_year integer) to authenticated;
grant execute on function public.ensure_leave_balance(p_employee_id uuid, p_year integer) to service_role;
grant execute on function public.af_konto(p_employee_id uuid, p_ohne_antrag uuid) to service_role;
grant execute on function public.hinweise_gesendet(p_limit integer) to authenticated;
grant execute on function public.hinweise_gesendet(p_limit integer) to service_role;
grant execute on function public.mail_versand_anstossen() to service_role;
grant execute on function public.my_af_konto() to authenticated;
grant execute on function public.my_af_konto() to service_role;
grant execute on function public.employees_audit_role() to service_role;
grant execute on function public.privacy_settings_audit() to service_role;
grant execute on function public.gruppe_verlassen(p_gruppe uuid) to authenticated;
grant execute on function public.gruppe_verlassen(p_gruppe uuid) to service_role;
grant execute on function public.plan_set_shift(p_employee_id uuid, p_date date, p_shift_id uuid) to authenticated;
grant execute on function public.plan_set_shift(p_employee_id uuid, p_date date, p_shift_id uuid) to service_role;
grant execute on function public.current_rotation_pattern() to authenticated;
grant execute on function public.current_rotation_pattern() to service_role;
grant execute on function public.hinweis_senden(p_empfaenger uuid[], p_text text, p_ziel text, p_push text) to authenticated;
grant execute on function public.hinweis_senden(p_empfaenger uuid[], p_text text, p_ziel text, p_push text) to service_role;
grant execute on function public.employees_sync_profile_role() to service_role;
grant execute on function public.complete_setup(p_abgeschlossen boolean) to authenticated;
grant execute on function public.complete_setup(p_abgeschlossen boolean) to service_role;
grant execute on function public.meine_hinweise() to authenticated;
grant execute on function public.meine_hinweise() to service_role;
grant execute on function public.hinweis_standard() to authenticated;
grant execute on function public.hinweis_standard() to service_role;
grant execute on function public.leave_requests_notify_leadership() to service_role;
grant execute on function public.set_hinweis_standard(p_wert text) to authenticated;
grant execute on function public.set_hinweis_standard(p_wert text) to service_role;
grant execute on function public.platform_overview() to service_role;
grant execute on function public.is_platform_admin(p_user_id uuid) to service_role;
grant execute on function public.set_employee_order(p_employee_ids uuid[]) to authenticated;
grant execute on function public.set_employee_order(p_employee_ids uuid[]) to service_role;
grant execute on function public.save_rotation_pattern(p_name text, p_anchor_date date, p_blocks jsonb, p_teams integer) to authenticated;
grant execute on function public.save_rotation_pattern(p_name text, p_anchor_date date, p_blocks jsonb, p_teams integer) to service_role;
grant execute on function public.team_sicht(p_ziel uuid) to authenticated;
grant execute on function public.team_sicht(p_ziel uuid) to service_role;
grant execute on function public.get_company_rules() to authenticated;
grant execute on function public.get_company_rules() to service_role;
grant execute on function public.set_work_on_holidays(p_value boolean) to authenticated;
grant execute on function public.set_work_on_holidays(p_value boolean) to service_role;
grant execute on function public.answer_replacement_request(p_request_id uuid, p_annehmen boolean, p_note text) to authenticated;
grant execute on function public.answer_replacement_request(p_request_id uuid, p_annehmen boolean, p_note text) to service_role;
grant execute on function public.my_v_konto() to authenticated;
grant execute on function public.my_v_konto() to service_role;
grant execute on function public.sicher_genehmigen(p_request_id uuid) to authenticated;
grant execute on function public.sicher_genehmigen(p_request_id uuid) to service_role;
grant execute on function public.setup_state() to authenticated;
grant execute on function public.setup_state() to service_role;
grant execute on function public.school_holidays_for_range(p_from date, p_to date) to authenticated;
grant execute on function public.school_holidays_for_range(p_from date, p_to date) to service_role;
grant execute on function public.company_rule_number(p_key text, p_field text, p_default numeric, p_shift_id uuid) to authenticated;
grant execute on function public.company_rule_number(p_key text, p_field text, p_default numeric, p_shift_id uuid) to service_role;
grant execute on function public.is_employed_on(p_employee_id uuid, p_date date) to authenticated;
grant execute on function public.is_employed_on(p_employee_id uuid, p_date date) to service_role;
grant execute on function public.save_qualification(p_id uuid, p_label text, p_active boolean) to authenticated;
grant execute on function public.save_qualification(p_id uuid, p_label text, p_active boolean) to service_role;
grant execute on function public.save_own_setup_profile(p_department text, p_vacation_days numeric, p_v_days numeric, p_shift_worker boolean, p_rotation_team text, p_qualifications text[]) to authenticated;
grant execute on function public.save_own_setup_profile(p_department text, p_vacation_days numeric, p_v_days numeric, p_shift_worker boolean, p_rotation_team text, p_qualifications text[]) to service_role;
grant execute on function public.meine_stammdaten_setzen(p_personalnummer text, p_abteilung text) to authenticated;
grant execute on function public.meine_stammdaten_setzen(p_personalnummer text, p_abteilung text) to service_role;
grant execute on function public.shift_starts_at(p_shift_id uuid, p_date date) to authenticated;
grant execute on function public.shift_starts_at(p_shift_id uuid, p_date date) to service_role;
grant execute on function public.shift_ends_at(p_shift_id uuid, p_date date) to authenticated;
grant execute on function public.shift_ends_at(p_shift_id uuid, p_date date) to service_role;
grant execute on function public.request_replacement(p_date date, p_shift_id uuid, p_asked_employee_id uuid, p_qualification_id uuid, p_absent_employee_id uuid, p_note text) to authenticated;
grant execute on function public.request_replacement(p_date date, p_shift_id uuid, p_asked_employee_id uuid, p_qualification_id uuid, p_absent_employee_id uuid, p_note text) to service_role;
grant execute on function public.confirm_replacement(p_request_id uuid) to authenticated;
grant execute on function public.confirm_replacement(p_request_id uuid) to service_role;
grant execute on function public.personal_details_guard() to service_role;
grant execute on function public.rotation_shift_for(emp employees, p_date date) to authenticated;
grant execute on function public.rotation_shift_for(emp employees, p_date date) to service_role;
grant execute on function public.is_employed_on(e employees, p_date date) to authenticated;
grant execute on function public.is_employed_on(e employees, p_date date) to service_role;
grant execute on function public.set_shift_qualification_need(p_shift_id uuid, p_qualification_id uuid, p_minimum integer) to authenticated;
grant execute on function public.set_shift_qualification_need(p_shift_id uuid, p_qualification_id uuid, p_minimum integer) to service_role;
grant execute on function public.geburtsdaten_offen() to authenticated;
grant execute on function public.geburtsdaten_offen() to service_role;
grant execute on function public.shift_qualification_matrix() to authenticated;
grant execute on function public.shift_qualification_matrix() to service_role;
grant execute on function public.geburtsdatum_bestaetigen(p_employee_id uuid) to authenticated;
grant execute on function public.geburtsdatum_bestaetigen(p_employee_id uuid) to service_role;
grant execute on function public.save_training_assignment(p_id uuid, p_employee_id uuid, p_start date, p_end date, p_area text, p_shift_id uuid, p_note text, p_status text) to authenticated;
grant execute on function public.save_training_assignment(p_id uuid, p_employee_id uuid, p_start date, p_end date, p_area text, p_shift_id uuid, p_note text, p_status text) to service_role;
grant execute on function public.delete_training_assignment(p_id uuid) to authenticated;
grant execute on function public.delete_training_assignment(p_id uuid) to service_role;
grant execute on function public.nur_privatkonto(p_user uuid) to authenticated;
grant execute on function public.nur_privatkonto(p_user uuid) to service_role;
grant execute on function public.kalender_farben_codes(p_user uuid) to service_role;
grant execute on function public.employees_sync_profile_active() to service_role;
grant execute on function public.shift_runs_on(p_shift shifts, p_date date) to authenticated;
grant execute on function public.shift_runs_on(p_shift shifts, p_date date) to service_role;
grant execute on function public.ensure_privacy_settings() to service_role;
grant execute on function public.rate_limit_hit(p_bucket text, p_key_hash text, p_max integer, p_window_seconds integer) to service_role;
grant execute on function public._privat_konto_sicherstellen(p_user uuid, p_name text, p_version text) to service_role;
grant execute on function public.approve_safe_leave_requests() to authenticated;
grant execute on function public.approve_safe_leave_requests() to service_role;
grant execute on function public.current_legal_version(p_doc text) to authenticated;
grant execute on function public.current_legal_version(p_doc text) to service_role;
grant execute on function public.write_audit(p_company_id uuid, p_action text, p_entity text, p_entity_id uuid, p_payload jsonb) to service_role;
grant execute on function public._eigene_eintraege_nach_privat(p_user uuid) to service_role;
grant execute on function public.profiles_guard_self_identity() to service_role;
grant execute on function public.absences_guard_medical_text() to service_role;
grant execute on function public.absences_audit() to service_role;
grant execute on function public.calculate_leave_days_for_employee(p_employee_id uuid, p_start_date date, p_end_date date, p_half_day_period half_day_period) to authenticated;
grant execute on function public.calculate_leave_days_for_employee(p_employee_id uuid, p_start_date date, p_end_date date, p_half_day_period half_day_period) to service_role;
grant execute on function public.is_planned_workday(p_employee_id uuid, p_date date) to authenticated;
grant execute on function public.is_planned_workday(p_employee_id uuid, p_date date) to service_role;
grant execute on function public.save_privacy_settings(p_absence_visibility absence_visibility_level, p_sickness_visibility sickness_visibility_level, p_notice_acknowledged boolean) to authenticated;
grant execute on function public.save_privacy_settings(p_absence_visibility absence_visibility_level, p_sickness_visibility sickness_visibility_level, p_notice_acknowledged boolean) to service_role;
grant execute on function public.privatbereich_einrichten(p_version text) to authenticated;
grant execute on function public.privatbereich_einrichten(p_version text) to service_role;
grant execute on function public.austritt_stand() to authenticated;
grant execute on function public.austritt_stand() to service_role;
grant execute on function public.privat_weitermachen(p_version text) to authenticated;
grant execute on function public.privat_weitermachen(p_version text) to service_role;
grant execute on function public.age_leave_hinweis(p_birth_date date, p_year integer) to authenticated;
grant execute on function public.age_leave_hinweis(p_birth_date date, p_year integer) to service_role;
grant execute on function public.ensure_personal_details() to service_role;
grant execute on function public.termin_speichern(p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text) to authenticated;
grant execute on function public.termin_speichern(p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text) to service_role;
grant execute on function public.age_leave_overview(p_year integer) to authenticated;
grant execute on function public.age_leave_overview(p_year integer) to service_role;
grant execute on function public.faellige_erinnerungen() to service_role;
grant execute on function public.erinnerungen_anstossen() to service_role;
grant execute on function public.beitritt_code_anlegen(p_employee_id uuid) to service_role;
grant execute on function public.my_age_leave(p_year integer) to authenticated;
grant execute on function public.my_age_leave(p_year integer) to service_role;
grant execute on function public._beitritt_code(p_code text) to public;
grant execute on function public._beitritt_code(p_code text) to anon;
grant execute on function public._beitritt_code(p_code text) to authenticated;
grant execute on function public._beitritt_code(p_code text) to service_role;
grant execute on function public.confirm_age_leave(p_employee_id uuid, p_year integer, p_days numeric, p_note text) to authenticated;
grant execute on function public.confirm_age_leave(p_employee_id uuid, p_year integer, p_days numeric, p_note text) to service_role;
grant execute on function public.abo_erstellen() to authenticated;
grant execute on function public.abo_erstellen() to service_role;
grant execute on function public.team_birth_dates() to authenticated;
grant execute on function public.team_birth_dates() to service_role;
grant execute on function public.darf_urlaub_entscheiden(p_employee_id uuid) to authenticated;
grant execute on function public.darf_urlaub_entscheiden(p_employee_id uuid) to service_role;
grant execute on function public.leave_kind_code(p_kind leave_kind, p_genehmigt boolean) to authenticated;
grant execute on function public.leave_kind_code(p_kind leave_kind, p_genehmigt boolean) to service_role;
grant execute on function public.leave_kind_label(p_kind leave_kind) to authenticated;
grant execute on function public.leave_kind_label(p_kind leave_kind) to service_role;
grant execute on function public.my_leave_kind_quotas(p_year integer) to authenticated;
grant execute on function public.my_leave_kind_quotas(p_year integer) to service_role;
grant execute on function public.mitarbeiter_endgueltig_loeschen(p_employee_id uuid) to authenticated;
grant execute on function public.mitarbeiter_endgueltig_loeschen(p_employee_id uuid) to service_role;
grant execute on function public.v_tage_uebersicht(p_year integer) to authenticated;
grant execute on function public.v_tage_uebersicht(p_year integer) to service_role;
grant execute on function public.my_leave_reviewers() to authenticated;
grant execute on function public.my_leave_reviewers() to service_role;
grant execute on function public.v_tage_rest(p_employee_id uuid, p_year integer) to service_role;
grant execute on function public.notify_leave_submitted(p_company_id uuid, p_employee_id uuid, p_request_id uuid, p_antragsteller text, p_gruppe rotation_team, p_art text, p_von date, p_bis date, p_tage numeric, p_reason text) to service_role;
grant execute on function public.absence_report(p_year integer, p_month integer) to service_role;
grant execute on function public.shift_qualification_gaps(p_shift_id uuid, p_date date, p_zusaetzlich_abwesend uuid) to authenticated;
grant execute on function public.shift_qualification_gaps(p_shift_id uuid, p_date date, p_zusaetzlich_abwesend uuid) to service_role;
grant execute on function public.abo_beenden() to authenticated;
grant execute on function public.abo_beenden() to service_role;
grant execute on function public.gruppe_erstellen(p_name text) to authenticated;
grant execute on function public.gruppe_erstellen(p_name text) to service_role;
grant execute on function public.meine_gruppen() to authenticated;
grant execute on function public.meine_gruppen() to service_role;
grant execute on function public.gruppe_link_neu(p_gruppe uuid) to authenticated;
grant execute on function public.gruppe_link_neu(p_gruppe uuid) to service_role;
grant execute on function public.gruppe_info(p_token text) to authenticated;
grant execute on function public.gruppe_info(p_token text) to service_role;
grant execute on function public.gruppe_beitreten(p_token text) to authenticated;
grant execute on function public.gruppe_beitreten(p_token text) to service_role;
grant execute on function public.privat_code(p_art text, p_beginn time without time zone) to public;
grant execute on function public.privat_code(p_art text, p_beginn time without time zone) to anon;
grant execute on function public.privat_code(p_art text, p_beginn time without time zone) to authenticated;
grant execute on function public.privat_code(p_art text, p_beginn time without time zone) to service_role;
grant execute on function public.leave_staffing_detail(p_employee_id uuid, p_start_date date, p_end_date date) to authenticated;
grant execute on function public.leave_staffing_detail(p_employee_id uuid, p_start_date date, p_end_date date) to service_role;
grant execute on function public.privat_feiertage(p_jahr integer) to authenticated;
grant execute on function public.privat_feiertage(p_jahr integer) to service_role;
grant execute on function public.zaehlt_zur_besetzung(e employees) to authenticated;
grant execute on function public.zaehlt_zur_besetzung(e employees) to service_role;
grant execute on function public.shift_staffing_overview(p_date date) to authenticated;
grant execute on function public.shift_staffing_overview(p_date date) to service_role;
grant execute on function public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer) to authenticated;
grant execute on function public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer) to service_role;
grant execute on function public.set_shift_staffing(p_shift_id uuid, p_target integer, p_minimum integer) to authenticated;
grant execute on function public.set_shift_staffing(p_shift_id uuid, p_target integer, p_minimum integer) to service_role;
grant execute on function public.beitritt_annehmen(p_code text, p_termine boolean, p_todos boolean, p_schichten boolean) to authenticated;
grant execute on function public.beitritt_annehmen(p_code text, p_termine boolean, p_todos boolean, p_schichten boolean) to service_role;
grant execute on function public.verbindung_code_lesen(p_code text) to service_role;
grant execute on function public.meine_termine() to authenticated;
grant execute on function public.meine_termine() to service_role;
grant execute on function public.meine_todos() to authenticated;
grant execute on function public.meine_todos() to service_role;
grant execute on function public.privat_neuigkeiten_gelesen() to authenticated;
grant execute on function public.privat_neuigkeiten_gelesen() to service_role;
grant execute on function public.my_shift_leave(p_from date, p_to date) to authenticated;
grant execute on function public.my_shift_leave(p_from date, p_to date) to service_role;
grant execute on function public.aenderung_zaehlen() to service_role;
grant execute on function public.leave_requests_check_qualifikation() to service_role;
grant execute on function public.zustaendige_fuehrung(p_employee_id uuid) to service_role;
grant execute on function public.leave_requests_ruecknahme_konsistent() to service_role;
grant execute on function public.platform_nutzung() to service_role;
grant execute on function public.meine_betriebsschichten(p_von date, p_bis date) to authenticated;
grant execute on function public.meine_betriebsschichten(p_von date, p_bis date) to service_role;
grant execute on function public.leave_qualification_block_reason(p_employee_id uuid, p_start_date date, p_end_date date) to authenticated;
grant execute on function public.leave_qualification_block_reason(p_employee_id uuid, p_start_date date, p_end_date date) to service_role;
grant execute on function public.aenderungsstand() to authenticated;
grant execute on function public.aenderungsstand() to service_role;
grant execute on function public.person_tage_uebernehmen(p_person uuid, p_ziel uuid) to service_role;
grant execute on function public.verbindung_code_info(p_code text) to authenticated;
grant execute on function public.verbindung_code_info(p_code text) to service_role;
grant execute on function public.verbindung_code_erstellen(p_person uuid) to authenticated;
grant execute on function public.verbindung_code_erstellen(p_person uuid) to service_role;
grant execute on function public.qualifikation_besetzung(p_shift_id uuid, p_date date, p_ohne uuid, p_offene_zaehlen boolean, p_trotzdem_da uuid) to authenticated;
grant execute on function public.qualifikation_besetzung(p_shift_id uuid, p_date date, p_ohne uuid, p_offene_zaehlen boolean, p_trotzdem_da uuid) to service_role;
grant execute on function public.register_company(p_company_name text, p_first_name text, p_last_name text, p_email text, p_avv_accepted boolean) to service_role;
grant execute on function public.kalender_codes(p_user uuid, p_von date, p_tage integer) to service_role;
grant execute on function public.training_plan(p_from date, p_to date) to authenticated;
grant execute on function public.training_plan(p_from date, p_to date) to service_role;
grant execute on function public.set_af_freischaltung(p_employee_id uuid, p_ab date) to service_role;
grant execute on function public.fehlzeit_loeschen(p_id uuid) to service_role;
grant execute on function public.vj_kontingent(p_employee_id uuid, p_year integer) to authenticated;
grant execute on function public.vj_kontingent(p_employee_id uuid, p_year integer) to service_role;
grant execute on function public.vj_rest(p_employee_id uuid, p_year integer, p_ohne uuid) to authenticated;
grant execute on function public.vj_rest(p_employee_id uuid, p_year integer, p_ohne uuid) to service_role;
grant execute on function public.set_af_stand(p_employee_id uuid, p_stunden numeric, p_stichtag date) to authenticated;
grant execute on function public.set_af_stand(p_employee_id uuid, p_stunden numeric, p_stichtag date) to service_role;
grant execute on function public.leave_requests_vj_setzen() to service_role;
grant execute on function public.schichtplan_kompakt(p_company_id uuid, p_from date, p_days integer) to authenticated;
grant execute on function public.schichtplan_kompakt(p_company_id uuid, p_from date, p_days integer) to service_role;
grant execute on function public.push_warteschlange_holen() to service_role;
grant execute on function public.sammelgenehmigung_kandidaten(p_jahr integer) to authenticated;
grant execute on function public.sammelgenehmigung_kandidaten(p_jahr integer) to service_role;
grant execute on function public.push_aus_verbindung() to service_role;
grant execute on function public.push_aus_gruppenbeitritt() to service_role;
grant execute on function public.meine_push_vorlieben() to authenticated;
grant execute on function public.meine_push_vorlieben() to service_role;
grant execute on function public.push_vorlieben_setzen(p_aus text[]) to authenticated;
grant execute on function public.push_vorlieben_setzen(p_aus text[]) to service_role;
grant execute on function public.termin_ausfaelle(p_id uuid) to authenticated;
grant execute on function public.termin_ausfaelle(p_id uuid) to service_role;
grant execute on function public.termin_serie_ab(p_id uuid) to authenticated;
grant execute on function public.termin_serie_ab(p_id uuid) to service_role;
grant execute on function public.termin_ausnahme(p_id uuid, p_datum date, p_ab boolean) to authenticated;
grant execute on function public.termin_ausnahme(p_id uuid, p_datum date, p_ab boolean) to service_role;
grant execute on function public.geburtsdatum_von(p_employee_id uuid) to service_role;
grant execute on function public.leave_kind_kontingent(p_employee_id uuid, p_kind leave_kind, p_year integer, p_ohne_antrag uuid) to service_role;
grant execute on function public.team_sichtbarkeit_setzen(p_eigene boolean, p_andere boolean, p_push_ohne_inhalt boolean) to authenticated;
grant execute on function public.team_sichtbarkeit_setzen(p_eigene boolean, p_andere boolean, p_push_ohne_inhalt boolean) to service_role;
grant execute on function public.leave_requests_check_kontingent() to service_role;
grant execute on function public.set_birth_date(p_employee_id uuid, p_birth_date date) to authenticated;
grant execute on function public.set_birth_date(p_employee_id uuid, p_birth_date date) to service_role;
grant execute on function public.stundenkonto(p_employee_id uuid, p_art text, p_ohne_antrag uuid) to service_role;
grant execute on function public.split_leave_request_day(r leave_requests, p_date date, p_kind leave_kind) to service_role;
grant execute on function public.set_stundenstand(p_employee_id uuid, p_art text, p_stunden numeric, p_stichtag date) to authenticated;
grant execute on function public.set_stundenstand(p_employee_id uuid, p_art text, p_stunden numeric, p_stichtag date) to service_role;
grant execute on function public.af_uebersicht() to authenticated;
grant execute on function public.af_uebersicht() to service_role;
grant execute on function public.create_absence_range(p_employee_id uuid, p_from date, p_to date, p_type absence_type, p_note text) to authenticated;
grant execute on function public.create_absence_range(p_employee_id uuid, p_from date, p_to date, p_type absence_type, p_note text) to service_role;
grant execute on function public.entscheidbare_mitarbeiter() to authenticated;
grant execute on function public.entscheidbare_mitarbeiter() to service_role;
grant execute on function public.v_tage_buchen(p_employee_id uuid, p_year integer, p_tage numeric, p_grund text) to authenticated;
grant execute on function public.v_tage_buchen(p_employee_id uuid, p_year integer, p_tage numeric, p_grund text) to service_role;
grant execute on function public.af_genommen_jahr(p_year integer) to authenticated;
grant execute on function public.af_genommen_jahr(p_year integer) to service_role;
grant execute on function public.benachrichtige_ruecknahme(p_request_id uuid, p_employee_id uuid, p_arten text, p_von date, p_bis date, p_war_genehmigt boolean, p_grund text) to service_role;
grant execute on function public.meine_einladungen() to authenticated;
grant execute on function public.meine_einladungen() to service_role;
grant execute on function public.einladung_vorschau(p_code text) to service_role;
grant execute on function public.antrag_zuruecknehmen(p_request_id uuid, p_grund text) to authenticated;
grant execute on function public.antrag_zuruecknehmen(p_request_id uuid, p_grund text) to service_role;
grant execute on function public.my_leave_withdrawers() to authenticated;
grant execute on function public.my_leave_withdrawers() to service_role;
grant execute on function public.gruende_fuer_kollegen_erlaubt() to authenticated;
grant execute on function public.gruende_fuer_kollegen_erlaubt() to service_role;
grant execute on function public.set_gruende_fuer_kollegen(p_value boolean) to authenticated;
grant execute on function public.set_gruende_fuer_kollegen(p_value boolean) to service_role;
grant execute on function public.schicht_laeuft_fuer(p_employee_id uuid, p_date date, p_shift shifts, p_work_on_holidays boolean) to authenticated;
grant execute on function public.schicht_laeuft_fuer(p_employee_id uuid, p_date date, p_shift shifts, p_work_on_holidays boolean) to service_role;
grant execute on function public.check_leave_staffing_impact(p_employee_id uuid, p_start_date date, p_end_date date) to authenticated;
grant execute on function public.check_leave_staffing_impact(p_employee_id uuid, p_start_date date, p_end_date date) to service_role;
grant execute on function public.plan_kommentar_vorbereiten() to service_role;
grant execute on function public.employees_austritt_zurueck() to service_role;
grant execute on function public.fehlzeit_speichern(p_employee_id uuid, p_tag date, p_art text, p_stunden numeric, p_notiz text, p_abzug text) to service_role;
grant execute on function public.privacy_settings_guard() to service_role;
grant execute on function public.austritte_vollziehen() to service_role;
grant execute on function public.email_outbox_skip_demo() to service_role;
grant execute on function public.register_company_for_user(p_user_id uuid, p_company_name text, p_first_name text, p_last_name text, p_terms_accepted boolean, p_business_confirmed boolean, p_terms_version text, p_avv_version text, p_privacy_version text) to service_role;
grant execute on function public.demo_create(p_user_id uuid) to service_role;
grant execute on function public.retention_cleanup() to service_role;
grant execute on function public.demo_cleanup() to service_role;
grant execute on function public.protokoll_umfang() to authenticated;
grant execute on function public.protokoll_umfang() to service_role;
grant execute on function public.demo_seed_pending(p_company uuid, p_user uuid) to service_role;
grant execute on function public.privat_tag_zeiten_aufraeumen() to service_role;
grant execute on function public.mein_naechster_urlaub() to authenticated;
grant execute on function public.mein_naechster_urlaub() to service_role;
grant execute on function public.gruppe_am(p_employee_id uuid, p_tag date, p_jetzt rotation_team) to authenticated;
grant execute on function public.gruppe_am(p_employee_id uuid, p_tag date, p_jetzt rotation_team) to service_role;
grant execute on function public.gruppe_versatz(p_pattern_id uuid, p_team rotation_team) to authenticated;
grant execute on function public.gruppe_versatz(p_pattern_id uuid, p_team rotation_team) to service_role;
grant execute on function public.privat_lohnzettel_grenze() to service_role;
grant execute on function public.privat_lohnzettel_weg() to service_role;
grant execute on function public.lohnzettel_einwilligung(p_an boolean) to authenticated;
grant execute on function public.lohnzettel_einwilligung(p_an boolean) to service_role;
grant execute on function public.darf_protokoll() to authenticated;
grant execute on function public.darf_protokoll() to service_role;
grant execute on function public.protokoll_firma() to authenticated;
grant execute on function public.protokoll_firma() to service_role;
grant execute on function public.protokoll_schreiben(p_company_id uuid, p_action text, p_entity text, p_entity_id uuid, p_payload jsonb) to service_role;
grant execute on function public.protokoll_aenderung() to service_role;
grant execute on function public.protokoll_melden(p_art text, p_text text, p_seite text) to authenticated;
grant execute on function public.protokoll_melden(p_art text, p_text text, p_seite text) to service_role;
grant execute on function public.protokoll_zahlen(p_tage integer) to authenticated;
grant execute on function public.protokoll_zahlen(p_tage integer) to service_role;
grant execute on function public.protokoll_liste(p_tage integer, p_art text, p_vor timestamp with time zone, p_limit integer) to authenticated;
grant execute on function public.protokoll_liste(p_tage integer, p_art text, p_vor timestamp with time zone, p_limit integer) to service_role;
grant execute on function public.termin_schreiben(p_owner uuid, p_von_partner boolean, p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text) to service_role;
grant execute on function public.termin_entfernen(p_owner uuid, p_id uuid, p_nur_partner boolean) to service_role;
grant execute on function public.termin_loeschen(p_id uuid) to authenticated;
grant execute on function public.termin_loeschen(p_id uuid) to service_role;
grant execute on function public.konto_uebernommen(p_user uuid) to service_role;
grant execute on function public.gruppe_tage(p_gruppe uuid, p_von date, p_tage integer) to authenticated;
grant execute on function public.gruppe_tage(p_gruppe uuid, p_von date, p_tage integer) to service_role;
grant execute on function public.meine_gruppen_tage(p_von date, p_tage integer) to authenticated;
grant execute on function public.meine_gruppen_tage(p_von date, p_tage integer) to service_role;
grant execute on function public.funktion_frei(p_user uuid, p_name text) to service_role;
grant execute on function public.hat_funktion(p_name text) to authenticated;
grant execute on function public.hat_funktion(p_name text) to service_role;
grant execute on function public.person_entfernen(p_id uuid) to authenticated;
grant execute on function public.person_entfernen(p_id uuid) to service_role;
grant execute on function public.partner_person() to service_role;
grant execute on function public.meine_personen_tage(p_von date, p_bis date) to authenticated;
grant execute on function public.meine_personen_tage(p_von date, p_bis date) to service_role;
grant execute on function public.person_tage_setzen(p_id uuid, p_von date, p_anzahl integer, p_schicht text) to authenticated;
grant execute on function public.person_tage_setzen(p_id uuid, p_von date, p_anzahl integer, p_schicht text) to service_role;
grant execute on function public.privat_schichtarten_grenze() to service_role;
grant execute on function public.privat_konto_anlegen(p_user uuid, p_name text, p_version text) to service_role;
grant execute on function public.ist_privatkonto(p_user uuid) to service_role;
grant execute on function public.zugang_protokollieren(p_employee uuid, p_art text) to authenticated;
grant execute on function public.zugang_protokollieren(p_employee uuid, p_art text) to service_role;
grant execute on function public.kalender_nutzer() to authenticated;
grant execute on function public.kalender_nutzer() to service_role;
grant execute on function public.abo_termine(p_token text) to anon;
grant execute on function public.abo_termine(p_token text) to authenticated;
grant execute on function public.abo_termine(p_token text) to service_role;
grant execute on function public.abo_frei(p_user uuid) to service_role;
grant execute on function public.abo_status() to authenticated;
grant execute on function public.abo_status() to service_role;
grant execute on function public.abo_inhaber(p_token text) to service_role;
grant execute on function public.person_aendern(p_id uuid, p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean) to authenticated;
grant execute on function public.person_aendern(p_id uuid, p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean) to service_role;
grant execute on function public.abo_plan(p_token text, p_von date, p_tage integer) to anon;
grant execute on function public.abo_plan(p_token text, p_von date, p_tage integer) to authenticated;
grant execute on function public.abo_plan(p_token text, p_von date, p_tage integer) to service_role;
grant execute on function public.kalender_eigene_grenze() to service_role;
grant execute on function public.gruppenwechsel_vollziehen() to service_role;
grant execute on function public.kalender_personen_grenze() to public;
grant execute on function public.kalender_personen_grenze() to anon;
grant execute on function public.kalender_personen_grenze() to authenticated;
grant execute on function public.kalender_personen_grenze() to service_role;
grant execute on function public.person_zum_link(p_token text) to service_role;
grant execute on function public.inhaber_vorname(p_user uuid) to service_role;
grant execute on function public.person_tage_schreiben(p_person uuid, p_von date, p_anzahl integer, p_schicht text) to service_role;
grant execute on function public.meine_personen() to authenticated;
grant execute on function public.meine_personen() to service_role;
grant execute on function public.team_sichtbarkeit_zahlen() to authenticated;
grant execute on function public.team_sichtbarkeit_zahlen() to service_role;
grant execute on function public.vierer_regel_tage(p_employee_id uuid, p_von date, p_bis date, p_ohne_antrag uuid) to authenticated;
grant execute on function public.vierer_regel_tage(p_employee_id uuid, p_von date, p_bis date, p_ohne_antrag uuid) to service_role;
grant execute on function public.person_anlegen(p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean) to authenticated;
grant execute on function public.person_anlegen(p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean) to service_role;
grant execute on function public.passwort_code_fuer_mitarbeiter(p_employee uuid) to authenticated;
grant execute on function public.passwort_code_fuer_mitarbeiter(p_employee uuid) to service_role;
grant execute on function public.partner_tage_setzen(p_token text, p_von date, p_anzahl integer, p_schicht text) to anon;
grant execute on function public.partner_tage_setzen(p_token text, p_von date, p_anzahl integer, p_schicht text) to authenticated;
grant execute on function public.partner_tage_setzen(p_token text, p_von date, p_anzahl integer, p_schicht text) to service_role;
grant execute on function public.partner_termin_speichern(p_token text, p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text) to anon;
grant execute on function public.partner_termin_speichern(p_token text, p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text) to authenticated;
grant execute on function public.partner_termin_speichern(p_token text, p_id uuid, p_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text) to service_role;
grant execute on function public.partner_termin_loeschen(p_token text, p_id uuid) to anon;
grant execute on function public.partner_termin_loeschen(p_token text, p_id uuid) to authenticated;
grant execute on function public.partner_termin_loeschen(p_token text, p_id uuid) to service_role;
grant execute on function public.set_leave_for_day(p_employee_id uuid, p_date date, p_mode text) to authenticated;
grant execute on function public.set_leave_for_day(p_employee_id uuid, p_date date, p_mode text) to service_role;
grant execute on function public.termin_sichern(p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text, p_erinnerung text) to authenticated;
grant execute on function public.termin_sichern(p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text, p_erinnerung text) to service_role;
grant execute on function public.employees_schichtleitung_grenze() to service_role;
grant execute on function public.vj_umstellen(p_request_id uuid, p_vj boolean) to authenticated;
grant execute on function public.vj_umstellen(p_request_id uuid, p_vj boolean) to service_role;
grant execute on function public.todo_speichern(p_id uuid, p_titel text, p_datum date, p_uhrzeit time without time zone) to authenticated;
grant execute on function public.todo_speichern(p_id uuid, p_titel text, p_datum date, p_uhrzeit time without time zone) to service_role;
grant execute on function public.todo_erledigt(p_id uuid, p_an boolean) to authenticated;
grant execute on function public.todo_erledigt(p_id uuid, p_an boolean) to service_role;
grant execute on function public.todo_loeschen(p_id uuid) to authenticated;
grant execute on function public.todo_loeschen(p_id uuid) to service_role;
grant execute on function public.meine_vorlieben() to authenticated;
grant execute on function public.meine_vorlieben() to service_role;
grant execute on function public.enthaelt_gesundheitsangabe(p_text text) to public;
grant execute on function public.enthaelt_gesundheitsangabe(p_text text) to anon;
grant execute on function public.enthaelt_gesundheitsangabe(p_text text) to authenticated;
grant execute on function public.enthaelt_gesundheitsangabe(p_text text) to service_role;
grant execute on function public.push_abos_fuer(p_users uuid[]) to service_role;
grant execute on function public.freitext_ohne_gesundheit() to service_role;
grant execute on function public.leave_requests_check_overlap() to service_role;
grant execute on function public.vorlieben_setzen(p_rollen text[], p_vorlagen jsonb) to authenticated;
grant execute on function public.vorlieben_setzen(p_rollen text[], p_vorlagen jsonb) to service_role;
grant execute on function public.push_abo_entfernen(p_endpoint text) to authenticated;
grant execute on function public.push_abo_entfernen(p_endpoint text) to service_role;
grant execute on function public.push_abo_ungueltig(p_endpoint text) to service_role;
grant execute on function public.verbindung_code_hash(p_code text) to service_role;
grant execute on function public.verbindung_mit(p_ich uuid, p_partner uuid) to service_role;
grant execute on function public.verbunden_termine_sichtbar(p_inhaber uuid, p_leser uuid) to service_role;
grant execute on function public.verbunden_darf(p_inhaber uuid, p_schreiber uuid) to service_role;
grant execute on function public.push_abo_speichern(p_endpoint text, p_p256dh text, p_auth text, p_geraet text) to authenticated;
grant execute on function public.push_abo_speichern(p_endpoint text, p_p256dh text, p_auth text, p_geraet text) to service_role;
grant execute on function public.heute() to public;
grant execute on function public.heute() to anon;
grant execute on function public.heute() to authenticated;
grant execute on function public.heute() to service_role;
grant execute on function public.my_leave_balance(p_year integer) to authenticated;
grant execute on function public.my_leave_balance(p_year integer) to service_role;
grant execute on function public.team_leave_balances(p_year integer) to authenticated;
grant execute on function public.team_leave_balances(p_year integer) to service_role;
grant execute on function public.beitritt_vorschau(p_code text) to authenticated;
grant execute on function public.beitritt_vorschau(p_code text) to service_role;
grant execute on function public.team_sonder_konten(p_year integer) to authenticated;
grant execute on function public.team_sonder_konten(p_year integer) to service_role;
grant execute on function public.erinnerungen_im_fenster() to service_role;
grant execute on function public.leitung_eigene_antraege_erlaubt() to authenticated;
grant execute on function public.leitung_eigene_antraege_erlaubt() to service_role;
grant execute on function public.verbindung_annehmen(p_code text) to authenticated;
grant execute on function public.verbindung_annehmen(p_code text) to service_role;
grant execute on function public.verbindung_beenden(p_id uuid) to authenticated;
grant execute on function public.verbindung_beenden(p_id uuid) to service_role;
grant execute on function public.set_leitung_eigene_antraege(p_value boolean) to authenticated;
grant execute on function public.set_leitung_eigene_antraege(p_value boolean) to service_role;
grant execute on function public.meine_verbindungen() to authenticated;
grant execute on function public.meine_verbindungen() to service_role;
grant execute on function public.verbindung_aendern(p_id uuid, p_art text, p_termine boolean, p_darf boolean) to authenticated;
grant execute on function public.verbindung_aendern(p_id uuid, p_art text, p_termine boolean, p_darf boolean) to service_role;
grant execute on function public.unterbesetzte_tage(p_gruppe uuid) to service_role;
grant execute on function public.verbindung_termin_speichern(p_partner uuid, p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text) to authenticated;
grant execute on function public.verbindung_termin_speichern(p_partner uuid, p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean, p_beginn time without time zone, p_ende time without time zone, p_wiederholung text, p_notiz text, p_ort text) to service_role;
grant execute on function public.verbindung_termin_loeschen(p_id uuid) to authenticated;
grant execute on function public.verbindung_termin_loeschen(p_id uuid) to service_role;
grant execute on function public.verbundene_tage(p_von date, p_tage integer) to authenticated;
grant execute on function public.verbundene_tage(p_von date, p_tage integer) to service_role;
grant execute on function public.push_einreihen(p_user uuid, p_art text, p_titel text, p_text text, p_url text, p_tag text, p_sammel text) to service_role;
grant execute on function public.konto_zu_mitarbeiter(p_employee uuid) to service_role;
grant execute on function public.push_aus_termin_von_anderen() to service_role;
grant execute on function public.decide_leave_request(p_request_id uuid, p_decision leave_status, p_rejection_reason text, p_trotz_unterbesetzung boolean) to authenticated;
grant execute on function public.decide_leave_request(p_request_id uuid, p_decision leave_status, p_rejection_reason text, p_trotz_unterbesetzung boolean) to service_role;
grant execute on function public.push_aus_benachrichtigung() to service_role;
grant execute on function public.push_aus_planaenderung() to service_role;
grant execute on function public.verbundene_termine() to authenticated;
grant execute on function public.verbundene_termine() to service_role;
grant execute on function public.partner_kalender(p_token text, p_von date, p_tage integer) to anon;
grant execute on function public.partner_kalender(p_token text, p_von date, p_tage integer) to authenticated;
grant execute on function public.partner_kalender(p_token text, p_von date, p_tage integer) to service_role;
grant execute on function public.vj_stand(p_year integer, p_employee_id uuid) to authenticated;
grant execute on function public.vj_stand(p_year integer, p_employee_id uuid) to service_role;
grant execute on function public.absence_report_anonym(p_year integer, p_month integer) to service_role;
grant execute on function public.einladung_erstellen(p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean) to authenticated;
grant execute on function public.einladung_erstellen(p_name text, p_art text, p_darf_eintragen boolean, p_termine_sehen boolean) to service_role;
grant execute on function public.tausch_anbieten(p_tag date, p_notiz text) to authenticated;
grant execute on function public.tausch_anbieten(p_tag date, p_notiz text) to service_role;
grant execute on function public.tausch_annehmen(p_id uuid, p_gegen_tag date) to authenticated;
grant execute on function public.tausch_annehmen(p_id uuid, p_gegen_tag date) to service_role;
grant execute on function public.tausch_entscheiden(p_id uuid, p_ok boolean) to authenticated;
grant execute on function public.tausch_entscheiden(p_id uuid, p_ok boolean) to service_role;
grant execute on function public.tausch_zurueckziehen(p_id uuid) to authenticated;
grant execute on function public.tausch_zurueckziehen(p_id uuid) to service_role;
-- ##BUCKETS
insert into storage.buckets (id, name, public) values ('lohnzettel', 'lohnzettel', 'f') on conflict do nothing;
insert into storage.buckets (id, name, public) values ('konsole-tresor', 'konsole-tresor', 'f') on conflict do nothing;
-- ##ENDE
