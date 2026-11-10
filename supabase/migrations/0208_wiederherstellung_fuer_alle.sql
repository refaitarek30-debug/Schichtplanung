-- Passwort zurücksetzen ohne E-Mail (10.11.2026), Folge aus S-01 (docs/review/02-sicherheit.md).
--
-- 1) Jede Person kann sich einen EIGENEN Wiederherstellungs-Code erzeugen – nicht nur
--    Privatkonten, auch Betriebskonten. Nur die Person selbst kennt ihn (gespeichert wird
--    nur ein Prüfwert). Damit setzt sie unter „Passwort vergessen“ ein neues Passwort.
--
-- 2) Hat die Person keinen Code mehr, gibt die Verwaltung (Administration; Schichtleitung nur
--    für Mitarbeiter) einen Einmal-Code frei – aber nur für reine Betriebskonten. Konten mit
--    Privatbereich (Kalender, Freigaben) bekommen keinen Code von der Führung. Jede Freigabe
--    steht im Änderungsprotokoll, und die Person bekommt eine Benachrichtigung in der App.
--    Der Freigabe-Code ersetzt einen vorhandenen eigenen Code (ein Code je Konto).
--
-- Ersetzt passwort_code_fuer_mitarbeiter aus 0207.

create or replace function public.mein_wiederherstellungscode()
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from auth.users where id = auth.uid()) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return _passwort_code_setzen(auth.uid(), 'privat', null);
end;
$$;
revoke execute on function public.mein_wiederherstellungscode() from public, anon;
grant execute on function public.mein_wiederherstellungscode() to authenticated;

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
$$;
revoke execute on function public.passwort_code_fuer_mitarbeiter(uuid) from public, anon;
grant execute on function public.passwort_code_fuer_mitarbeiter(uuid) to authenticated;
