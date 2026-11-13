-- Zwei-Faktor-Anmeldung (Code aus einer Authenticator-App) und Sperre nach
-- 5 falschen Versuchen.
--
-- 1. zugang_ok(): Wer einen zweiten Faktor eingerichtet hat, sieht Firmendaten
--    nur mit einer Sitzung, die den Code bestätigt hat (aal2). Wer gesperrt
--    ist, sieht gar keine Firmendaten. Eingebaut in auth_company_id(),
--    auth_role() und auth_employee_id() – damit greift es in jeder Policy,
--    auch wenn jemand die App umgeht und die Datenbank direkt anspricht.
-- 2. anmelde_sperren: Fehlversuche je Konto. Nach 5 falschen Passwörtern oder
--    Codes ist das Konto gesperrt. Firmenkonten bleiben gesperrt, bis die
--    Administration (oder der Betreiber) freischaltet; reine Privatkonten
--    nach 15 Minuten wieder frei. Keine Policies: nur über die Funktionen.
-- 3. Verwaltung: Status je Person, Sperre aufheben, zweiten Faktor
--    zurücksetzen (Handy verloren) – nur die Administration der eigenen Firma.
-- 4. Betreiber (/plattform, Service-Schlüssel): gesperrte Konten sehen,
--    freischalten, zweiten Faktor zurücksetzen.
-- 5. Hinweise ohne Lesebestätigung: Absender und Leitung sehen nicht mehr, ob
--    und wann jemand einen Hinweis gelesen hat (Verhaltensdaten, § 87 Abs. 1
--    Nr. 6 BetrVG). Auch „aufs Handy geschickt“ fällt weg – das ging nur raus,
--    wenn noch nicht gelesen war. Zurückziehen geht jetzt immer.

create table if not exists public.anmelde_sperren (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fehlversuche integer not null default 0,
  letzter_versuch timestamptz not null default now(),
  gesperrt_am timestamptz
);

alter table public.anmelde_sperren enable row level security;
revoke all on table public.anmelde_sperren from anon, authenticated;

-- 1. Zugang zu Firmendaten -----------------------------------------------------

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
             where f.user_id = auth.uid() and f.status = 'verified'));
$$;

revoke all on function public.zugang_ok() from public, anon;
grant execute on function public.zugang_ok() to authenticated, service_role;

create or replace function public.auth_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid() and active and zugang_ok();
$$;

create or replace function public.auth_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active and zugang_ok();
$$;

create or replace function public.auth_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select employee_id from profiles where id = auth.uid() and active and zugang_ok();
$$;

-- 2. Sperre nach Fehlversuchen ------------------------------------------------

-- Firmenkonto = aktives Profil in einer Firma. Nur das bleibt bis zur
-- Freischaltung gesperrt.
create or replace function public.anmelde_sperre_dauerhaft(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles p where p.id = p_user and p.active);
$$;

revoke all on function public.anmelde_sperre_dauerhaft(uuid) from public, anon, authenticated;

create or replace function public.anmeldung_gesperrt(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from auth.users u
      join anmelde_sperren s on s.user_id = u.id
     where lower(u.email) = lower(trim(p_email))
       and s.gesperrt_am is not null
       and (s.gesperrt_am > now() - interval '15 minutes' or anmelde_sperre_dauerhaft(u.id)));
$$;

create or replace function public.anmeldung_fehlversuch_konto(p_user uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
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
$$;

create or replace function public.anmeldung_fehlversuch(p_email text)
returns boolean
language sql
volatile
security definer
set search_path = public, auth
as $$
  select anmeldung_fehlversuch_konto(
    (select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1));
$$;

-- Nach vollständiger Anmeldung (Passwort und ggf. Code): Zähler zurück.
-- Eine bestehende Sperre bleibt – die hebt nur die Administration auf.
create or replace function public.anmeldung_erfolgreich(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from anmelde_sperren where user_id = p_user and gesperrt_am is null;
$$;

revoke all on function public.anmeldung_gesperrt(text) from public, anon, authenticated;
revoke all on function public.anmeldung_fehlversuch_konto(uuid) from public, anon, authenticated;
revoke all on function public.anmeldung_fehlversuch(text) from public, anon, authenticated;
revoke all on function public.anmeldung_erfolgreich(uuid) from public, anon, authenticated;
grant execute on function public.anmeldung_gesperrt(text) to service_role;
grant execute on function public.anmeldung_fehlversuch_konto(uuid) to service_role;
grant execute on function public.anmeldung_fehlversuch(text) to service_role;
grant execute on function public.anmeldung_erfolgreich(uuid) to service_role;

-- Bin ich gesperrt? Für die Seite „Zugang gesperrt“ statt einer stummen Umleitung.
create or replace function public.mein_zugang_gesperrt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from anmelde_sperren s
     where s.user_id = auth.uid() and s.gesperrt_am is not null
       and (s.gesperrt_am > now() - interval '15 minutes' or anmelde_sperre_dauerhaft(s.user_id)));
$$;

revoke all on function public.mein_zugang_gesperrt() from public, anon;
grant execute on function public.mein_zugang_gesperrt() to authenticated;

-- 3. Verwaltung (Administration der eigenen Firma) ------------------------------

create or replace function public.zugang_status_firma()
returns table (employee_id uuid, gesperrt boolean, zwei_faktor boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.employee_id,
         exists (select 1 from anmelde_sperren s where s.user_id = p.id and s.gesperrt_am is not null),
         exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
    from profiles p
   where is_admin()
     and p.company_id = auth_company_id()
     and p.employee_id is not null;
$$;

create or replace function public.anmeldesperre_aufheben(p_employee uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
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
$$;

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
  perform protokoll_schreiben(auth_company_id(), 'zwei_faktor.zurueckgesetzt', 'profiles', v_user, jsonb_build_object('employee_id', p_employee));
end;
$$;

revoke all on function public.zugang_status_firma() from public, anon;
revoke all on function public.anmeldesperre_aufheben(uuid) from public, anon;
revoke all on function public.zwei_faktor_zuruecksetzen(uuid) from public, anon;
grant execute on function public.zugang_status_firma() to authenticated;
grant execute on function public.anmeldesperre_aufheben(uuid) to authenticated;
grant execute on function public.zwei_faktor_zuruecksetzen(uuid) to authenticated;

-- 4. Betreiber (nur Service-Schlüssel) -------------------------------------------

create or replace function public.platform_sperren()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
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
$$;

-- p_aktion: 'entsperren' oder 'zwei_faktor'. Gibt false zurück, wenn es das Konto nicht gibt.
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
  else
    raise exception 'Unbekannte Aktion.' using errcode = '22023';
  end if;
  return true;
end;
$$;

revoke all on function public.platform_sperren() from public, anon, authenticated;
revoke all on function public.platform_zugang(text, text) from public, anon, authenticated;
grant execute on function public.platform_sperren() to service_role;
grant execute on function public.platform_zugang(text, text) to service_role;

-- 5. Hinweise ohne Lesebestätigung --------------------------------------------------

create or replace function public.hinweise_gesendet(p_limit integer default 30)
returns table(
  id uuid, employee_id uuid, empfaenger text, text text, ziel text, push text, push_ab timestamptz,
  push_gesendet boolean, von_name text, erstellt_am timestamptz, gelesen_am timestamptz,
  zurueckgezogen_am timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
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
$$;

create or replace function public.hinweis_zurueckziehen(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
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
$$;

-- Datenschutzerklärung 2.33: Zwei-Faktor-Anmeldung, Sperre nach Fehlversuchen, Hinweise ohne Lesebestätigung.
update public.legal_versions set version = '2.33', valid_from = current_date where doc = 'datenschutz';
