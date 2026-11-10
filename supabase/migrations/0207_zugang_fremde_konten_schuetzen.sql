-- Zugang zu fremden Konten schließen (10.11.2026), Fund S-01 aus docs/review/02-sicherheit.md.
--
-- Bisher konnte die Führung für ein bestehendes Konto einen Passwort-Code (hier) oder
-- einen Passwort-Link (Server, invite.ts) erzeugen und sich damit als diese Person
-- anmelden. Jetzt gilt: Link und Code gibt es nur für Konten, die noch NICHT von der
-- Person übernommen wurden, also noch kein eigenes Passwort haben. Wer schon ein
-- Passwort hat, nutzt „Passwort vergessen“ (E-Mail) oder den eigenen
-- Wiederherstellungs-Code (Privatkonto).
--
-- Jedes Erzeugen von Link oder Code steht im Änderungsprotokoll.

-- Hat die Person dieses Konto schon übernommen (eigenes Passwort gesetzt)?
-- Nur für den Server (Dienstrolle) und für andere Datenbank-Funktionen.
create or replace function public.konto_uebernommen(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select nullif(u.encrypted_password, '') is not null from auth.users u where u.id = p_user),
    false
  );
$$;
revoke execute on function public.konto_uebernommen(uuid) from public, anon, authenticated;
grant execute on function public.konto_uebernommen(uuid) to service_role;

-- Protokolleintrag für „Zugangslink erzeugt“ (vom Server aufgerufen, mit der Sitzung der Führung).
create or replace function public.zugang_protokollieren(p_employee uuid, p_art text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;
revoke execute on function public.zugang_protokollieren(uuid, text) from public, anon;
grant execute on function public.zugang_protokollieren(uuid, text) to authenticated;

-- Passwort-Code für eine Person: nur für noch nicht übernommene Konten, mit Protokoll.
create or replace function public.passwort_code_fuer_mitarbeiter(p_employee uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
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

  -- NEU: Hat die Person schon ein eigenes Passwort, darf niemand sonst einen Code erzeugen.
  if konto_uebernommen(ziel_user) then
    raise exception 'Diese Person hat schon ein eigenes Passwort. Sie setzt es selbst über „Passwort vergessen“ zurück.';
  end if;

  perform write_audit(ich_firma, 'zugang.code', 'employees', p_employee, '{}'::jsonb);
  return _passwort_code_setzen(ziel_user, 'leitung', interval '24 hours');
end;
$$;
revoke execute on function public.passwort_code_fuer_mitarbeiter(uuid) from public, anon;
grant execute on function public.passwort_code_fuer_mitarbeiter(uuid) to authenticated;
