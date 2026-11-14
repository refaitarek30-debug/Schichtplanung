-- „Diesem Gerät vertrauen“ nach dem Zwei-Faktor-Code.
--
-- Wer nach dem Code „Diesem Gerät 30 Tage vertrauen“ wählt, bekommt ein
-- zufälliges Merkzeichen als Cookie (nur auf dem Gerät). Hier liegt nur ein
-- Prüfwert (SHA-256) davon. Meldet sich die Person auf diesem Gerät wieder mit
-- Passwort an, wird die neue Sitzung als „vertraut“ eingetragen – dann reicht
-- das Passwort. Regeln:
--   * höchstens 30 Tage ab dem Code,
--   * wer das Gerät 7 Tage lang nicht zum Anmelden benutzt, gibt den Code neu ein,
--   * Zwei-Faktor zurücksetzen (Administration, Betreiber) oder „Alle Geräte
--     vergessen“ löscht alle vertrauten Geräte und damit sofort deren Sitzungen,
--   * die Betreiber-Seite verlangt trotzdem immer den Code (prüft die App).
-- zugang_ok() lässt Firmendaten zu bei: kein Faktor, Sitzung mit Code (aal2)
-- oder vertraute Sitzung eines gültigen Geräts.

create table if not exists public.vertraute_geraete (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  geraet text,
  erstellt_am timestamptz not null default now(),
  zuletzt_am timestamptz not null default now(),
  bis timestamptz not null
);
create index if not exists vertraute_geraete_user on public.vertraute_geraete (user_id);

create table if not exists public.vertraute_sitzungen (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  geraet_id uuid not null references public.vertraute_geraete (id) on delete cascade,
  erstellt_am timestamptz not null default now()
);
create index if not exists vertraute_sitzungen_geraet on public.vertraute_sitzungen (geraet_id);

alter table public.vertraute_geraete enable row level security;
alter table public.vertraute_sitzungen enable row level security;
revoke all on table public.vertraute_geraete from anon, authenticated;
revoke all on table public.vertraute_sitzungen from anon, authenticated;

-- Ist die aktuelle Sitzung über ein gültiges vertrautes Gerät entstanden?
create or replace function public.sitzung_vertraut()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from vertraute_sitzungen s
      join vertraute_geraete g on g.id = s.geraet_id
     where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and s.user_id = auth.uid()
       and g.bis > now());
$$;

revoke all on function public.sitzung_vertraut() from public, anon;
grant execute on function public.sitzung_vertraut() to authenticated, service_role;

create or replace function public.zugang_ok()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select not exists (
           select 1 from anmelde_sperren s
            where s.user_id = auth.uid() and s.gesperrt_am is not null)
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (
            select 1 from auth.mfa_factors f
             where f.user_id = auth.uid() and f.status = 'verified')
          or sitzung_vertraut());
$$;

-- Nach einem richtigen Code: Gerät merken (30 Tage). Nur Service-Schlüssel.
create or replace function public.geraet_merken(p_user uuid, p_token_hash text, p_geraet text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into vertraute_geraete (user_id, token_hash, geraet, bis)
  values (p_user, p_token_hash, left(p_geraet, 80), now() + interval '30 days');
$$;

-- Beim Anmelden mit Passwort: Merkzeichen prüfen und die neue Sitzung als
-- vertraut eintragen. Abgelaufene oder 7 Tage unbenutzte Geräte fallen weg.
create or replace function public.geraet_einloesen(p_user uuid, p_session uuid, p_token_hash text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.geraet_merken(uuid, text, text) from public, anon, authenticated;
revoke all on function public.geraet_einloesen(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.geraet_merken(uuid, text, text) to service_role;
grant execute on function public.geraet_einloesen(uuid, uuid, text) to service_role;

-- Profil: alle vertrauten Geräte vergessen (beim nächsten Anmelden wieder der Code).
create or replace function public.meine_geraete_vergessen()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from vertraute_geraete where user_id = auth.uid();
$$;

revoke all on function public.meine_geraete_vergessen() from public, anon;
grant execute on function public.meine_geraete_vergessen() to authenticated;

-- Zwei-Faktor zurücksetzen löscht auch die vertrauten Geräte.
create or replace function public.zwei_faktor_zuruecksetzen(p_employee uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
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
$$;

create or replace function public.platform_zugang(p_email text, p_aktion text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
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
$$;

-- Datenkopie (0220) um die vertrauten Geräte ergänzt.
create or replace function public.meine_daten()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
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
$$;


-- Datenschutzerklärung 2.35: „Diesem Gerät vertrauen“.
update public.legal_versions set version = '2.35', valid_from = current_date where doc = 'datenschutz';
