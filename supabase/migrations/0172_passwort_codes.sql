-- Passwort zurücksetzen mit einem Code statt per E-Mail.
--
-- * Betrieb: Administration oder Schichtleitung erzeugt in der Verwaltung
--   für eine Person einen Einmal-Code (24 Stunden gültig) und gibt ihn
--   persönlich weiter. Die Schichtleitung nur für normale Mitarbeiter –
--   sonst wäre der Code ein Weg zu Rechten, die sie selbst nicht hat.
-- * Privat: jede Person erzeugt sich in den Einstellungen einen eigenen
--   Wiederherstellungs-Code und hebt ihn auf. Verloren: der Support
--   (Betreiber) erzeugt einen neuen (24 Stunden gültig).
--
-- Gespeichert wird nur der SHA-256-Wert des Codes, nie der Code selbst.
-- Jeder Code gilt für genau ein Konto und nur einmal. Nach fünf falschen
-- Eingaben ist das Konto für 15 Minuten gesperrt. Eingelöst wird nur auf dem
-- Server (Dienstrolle); niemand sonst kann die Tabelle lesen.

create table if not exists public.passwort_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  art text not null check (art in ('leitung', 'privat', 'support')),
  erstellt_von uuid references auth.users (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  gueltig_bis timestamptz,
  fehlversuche integer not null default 0,
  gesperrt_bis timestamptz
);

alter table public.passwort_codes enable row level security;
revoke all on public.passwort_codes from anon, authenticated;

-- 10 Zeichen ohne Verwechsler (kein 0/O, 1/I). 256 ist durch 32 teilbar,
-- jedes Zeichen ist also gleich wahrscheinlich.
create or replace function public._passwort_code_neu()
returns text language plpgsql volatile set search_path = public, extensions as $$
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
$$;

-- Leerzeichen und Bindestriche zählen nicht, Groß-/Kleinschreibung auch nicht.
create or replace function public._passwort_code_hash(p_code text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

revoke all on function public._passwort_code_neu() from public, anon, authenticated;
revoke all on function public._passwort_code_hash(text) from public, anon, authenticated;

create or replace function public._passwort_code_setzen(p_user uuid, p_art text, p_dauer interval)
returns text language plpgsql security definer set search_path = public, extensions as $$
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
$$;
revoke all on function public._passwort_code_setzen(uuid, text, interval) from public, anon, authenticated;

-- ---- Betrieb: Leitung erzeugt einen Code für eine Person ------------------
create or replace function public.passwort_code_fuer_mitarbeiter(p_employee uuid)
returns text language plpgsql security definer set search_path = public as $$
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
  return _passwort_code_setzen(ziel_user, 'leitung', interval '24 hours');
end;
$$;
revoke all on function public.passwort_code_fuer_mitarbeiter(uuid) from public, anon;
grant execute on function public.passwort_code_fuer_mitarbeiter(uuid) to authenticated;

-- ---- Privat: eigener Wiederherstellungs-Code ------------------------------
create or replace function public.mein_wiederherstellungscode()
returns text language plpgsql security definer set search_path = public as $$
begin
  if not ist_privatkonto(auth.uid()) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return _passwort_code_setzen(auth.uid(), 'privat', null);
end;
$$;
revoke all on function public.mein_wiederherstellungscode() from public, anon;
grant execute on function public.mein_wiederherstellungscode() to authenticated;

-- Wann der eigene Code erzeugt wurde – null, wenn es keinen gültigen gibt.
create or replace function public.mein_wiederherstellungscode_stand()
returns timestamptz language sql stable security definer set search_path = public as $$
  select erstellt_am from passwort_codes
   where user_id = auth.uid() and art = 'privat' and (gueltig_bis is null or gueltig_bis > now())
$$;
revoke all on function public.mein_wiederherstellungscode_stand() from public, anon;
grant execute on function public.mein_wiederherstellungscode_stand() to authenticated;

-- ---- Support: Betreiber erzeugt einen Code für ein Privatkonto -------------
-- Nur über den Dienstschlüssel; /plattform prüft vorher is_platform_admin().
create or replace function public.plattform_passwort_code(p_email text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  ziel uuid;
begin
  select u.id into ziel from auth.users u
   where lower(u.email) = lower(btrim(p_email)) and ist_privatkonto(u.id);
  if ziel is null then
    raise exception 'Kein Privatkonto mit diesem Spitznamen oder dieser Adresse.';
  end if;
  return _passwort_code_setzen(ziel, 'support', interval '24 hours');
end;
$$;
revoke all on function public.plattform_passwort_code(text) from public, anon, authenticated;
grant execute on function public.plattform_passwort_code(text) to service_role;

-- ---- Einlösen (nur Server) -------------------------------------------------
-- Antwort: {"status": "ok"|"falsch"|"gesperrt", "user_id": …}. Unbekannte
-- Konten, abgelaufene und falsche Codes sehen von außen gleich aus. Ein
-- eingelöster Code wird ungültig gemacht (nicht gelöscht).
create or replace function public.passwort_code_einloesen(p_email text, p_code text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
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
$$;
revoke all on function public.passwort_code_einloesen(text, text) from public, anon, authenticated;
grant execute on function public.passwort_code_einloesen(text, text) to service_role;
