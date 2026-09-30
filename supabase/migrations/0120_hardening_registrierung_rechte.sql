-- Hardening: Tabellenrechte, Ratenbegrenzung, sichere Firmenregistrierung,
-- Versionen der Rechtstexte.
--
-- Rein additiv: keine bestehende Migration wird verändert. Die alte Funktion
-- register_company() bleibt zunächst bestehen, damit die bisherige Anwendung
-- bis zum Deploy der neuen weiterläuft; sie wird in einer Folgemigration
-- entzogen.

-- ---------------------------------------------------------------------
-- 1. Tabellenrechte
-- ---------------------------------------------------------------------
-- Der Zugriff wird über Row Level Security geregelt. Zusätzlich bekommt die
-- Rolle anon gar keine Tabellenrechte (sie meldet niemanden an, sie liest
-- nichts), und niemand über die API braucht TRUNCATE, TRIGGER oder
-- REFERENCES – TRUNCATE würde RLS ohnehin umgehen.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- Das Protokoll ist nur lesbar: Schreiben geschieht ausschließlich über
-- write_audit() (SECURITY DEFINER).
revoke insert, update, delete on public.audit_logs from authenticated;
drop policy if exists "Protokoll schreiben" on public.audit_logs;

-- Der Postausgang wird nur durch Datenbankfunktionen und den Dienst gefüllt.
revoke insert, update, delete on public.email_outbox from authenticated;

-- Künftig angelegte Tabellen und Sequenzen bekommen kein anon-Recht mehr.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- Triggerfunktion: kein RPC-Zugriff nötig.
revoke execute on function public.leave_requests_ruecknahme_konsistent() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Ratenbegrenzung (nur Dienstrolle)
-- ---------------------------------------------------------------------
create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  key_hash text not null,
  hit_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup
  on public.rate_limit_hits (bucket, key_hash, hit_at desc);
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

comment on table public.rate_limit_hits is
  'Zähler für die Ratenbegrenzung (Anmeldung, Passwort-Reset, Registrierung). '
  'key_hash ist ein Hash, keine Klartext-IP und keine Klartext-E-Mail. '
  'Einträge werden nach 1 Tag gelöscht.';

-- Zählt einen Versuch und sagt, ob er noch erlaubt ist (true) oder ob das
-- Limit erreicht ist (false). Blockierte Versuche werden nicht mitgezählt –
-- sonst hielte sich eine Sperre durch weiteres Probieren selbst am Leben.
create or replace function public.rate_limit_hit(p_bucket text, p_key_hash text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
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

  -- Aufräumen, gelegentlich und nur alte Zeilen.
  if random() < 0.02 then
    delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;

revoke all on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- 3. Versionen der Rechtstexte
-- ---------------------------------------------------------------------
create table if not exists public.legal_versions (
  doc text primary key check (doc in ('datenschutz', 'nutzungsbedingungen', 'avv')),
  version text not null,
  valid_from date not null default current_date
);
alter table public.legal_versions enable row level security;
revoke all on public.legal_versions from anon, authenticated;
grant select on public.legal_versions to authenticated;
drop policy if exists "Rechtsversionen lesen" on public.legal_versions;
create policy "Rechtsversionen lesen" on public.legal_versions
  for select to authenticated using (true);

comment on table public.legal_versions is
  'Aktuelle Fassung je Rechtstext. Muss zu src/lib/legal/version.ts passen '
  '(wird im Regressionstest geprüft).';

insert into public.legal_versions (doc, version, valid_from) values
  ('datenschutz', '1.0', current_date),
  ('nutzungsbedingungen', '1.0', current_date),
  ('avv', '1.0', current_date)
on conflict (doc) do nothing;

create or replace function public.current_legal_version(p_doc text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select version from public.legal_versions where doc = p_doc
$$;
revoke all on function public.current_legal_version(text) from public, anon;
grant execute on function public.current_legal_version(text) to authenticated, service_role;

-- Nachweis der Zustimmung je Unternehmen (Firmenkunde, nicht Endnutzer).
alter table public.companies
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists avv_version text,
  add column if not exists privacy_notice_version text,
  add column if not exists business_confirmed_at timestamptz;

comment on column public.companies.terms_accepted_at is
  'Zeitpunkt, zu dem die Nutzungsbedingungen bei der Registrierung akzeptiert wurden (serverseitig gesetzt).';
comment on column public.companies.business_confirmed_at is
  'Zeitpunkt der Bestätigung, dass die Registrierung für ein Unternehmen bzw. eine berufliche Tätigkeit erfolgt.';

-- ---------------------------------------------------------------------
-- 4. Datenschutz-Einstellungen: aktuelle Fassung, konsistente Zeitpunkte
-- ---------------------------------------------------------------------
alter table public.privacy_settings
  add column if not exists absence_granted_at timestamptz,
  add column if not exists sickness_granted_at timestamptz;

create or replace function public.privacy_settings_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  current_user_id uuid := auth.uid();
  current_company uuid := auth_company_id();
begin
  -- Aufruf aus einem internen SECURITY DEFINER-Kontext (Anlage der
  -- Systemzeile) ohne angemeldete Person.
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
$$;

-- Protokoll ohne Personenbezug im Payload: nur, welche Einstellung sich wie
-- geändert hat. Keine Gründe, keine Diagnosen.
create or replace function public.privacy_settings_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
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
$$;

-- Speichert Sichtbarkeit und (optional) die Kenntnisnahme der aktuellen
-- Datenschutzerklärung. Die Fassung kommt aus der Datenbank, nicht vom Client.
create or replace function public.save_privacy_settings(
  p_absence_visibility absence_visibility_level,
  p_sickness_visibility sickness_visibility_level,
  p_notice_acknowledged boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
$$;

-- ---------------------------------------------------------------------
-- 5. Sichere Firmenregistrierung (nur Dienstrolle)
-- ---------------------------------------------------------------------
-- Ablauf der Anwendung: erst auth.signUp (ohne Zuordnung in den Metadaten,
-- der Trigger handle_new_user legt dann kein Profil an), danach ruft der
-- Server diese Funktion mit dem Service-Key auf. Firma, Personal-Stammsatz,
-- Schichten und Profil entstehen in EINER Transaktion – es bleibt nie eine
-- halbe Firma zurück. Kein Client kann company_id, employee_id oder Rolle
-- bestimmen.
create or replace function public.register_company_for_user(
  p_user_id uuid,
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_terms_accepted boolean,
  p_business_confirmed boolean,
  p_terms_version text,
  p_avv_version text,
  p_privacy_version text
)
returns table(company_id uuid, employee_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company_id uuid;
  v_employee_id uuid;
  v_email text;
  jahr int := extract(year from current_date)::int;
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
$$;

revoke all on function public.register_company_for_user(uuid, text, text, text, boolean, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.register_company_for_user(uuid, text, text, text, boolean, boolean, text, text, text) to service_role;
