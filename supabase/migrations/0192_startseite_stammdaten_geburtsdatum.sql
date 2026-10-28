-- Teil 1 (28.10.2026): Startseite „Kompakt“, Neuigkeiten, Stammdaten selbst pflegen,
-- Geburtsdatum jederzeit änderbar – der Sonderurlaub ab 55 zählt erst nach Bestätigung.
-- Abwärtsverträglich: nur neue Spalten und Funktionen; die laufende App merkt nichts.

-- ---- 1. Startseite: Klassisch oder Kompakt -------------------------------------------
-- Alle bisherigen Konten behalten „klassisch“; neue Konten starten mit „kompakt“.
alter table public.profiles add column if not exists start_ansicht text not null default 'klassisch';
alter table public.profiles drop constraint if exists profiles_start_ansicht_check;
alter table public.profiles add constraint profiles_start_ansicht_check
  check (start_ansicht in ('klassisch', 'kompakt'));
alter table public.profiles alter column start_ansicht set default 'kompakt';

-- ---- 2. Neuigkeiten (Glühbirne): wann zuletzt geöffnet ---------------------------------
-- Bisherige Konten: leer – sie sehen, was neu ist. Neue Konten: ab Anlage, sonst
-- leuchtet die Glühbirne gleich beim ersten Anmelden für alles Alte.
alter table public.profiles add column if not exists neuigkeiten_gesehen timestamptz;
alter table public.profiles alter column neuigkeiten_gesehen set default now();

-- ---- 3. Personalnummer und Abteilung selbst eintragen ----------------------------------
create or replace function public.meine_stammdaten_setzen(p_personalnummer text, p_abteilung text)
returns void language plpgsql security definer set search_path to 'public' as $$
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
$$;
revoke all on function public.meine_stammdaten_setzen(text, text) from public, anon;
grant execute on function public.meine_stammdaten_setzen(text, text) to authenticated;

-- ---- 4. Geburtsdatum: jederzeit änderbar, Bestätigung durch die Administration ---------
-- Bestehende Einträge gelten als bestätigt (so wie bisher). Ändert die Person ihr Datum
-- selbst, ist es unbestätigt, bis die Administration es bestätigt – bis dahin zählt der
-- Sonderurlaub ab 55 nicht.
alter table public.personal_details add column if not exists birth_date_bestaetigt boolean not null default true;

create or replace function public.personal_details_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
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
    -- Selbst geändert: unbestätigt. Die Bestätigung setzt nur die Administration.
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
    -- Von der Administration eingetragen: gilt als bestätigt.
    new.birth_date_bestaetigt := true;
  end if;

  new.updated_at := now();

  if new.birth_date is not null and new.birth_date > current_date then
    raise exception 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
  end if;
  if new.birth_date is not null and new.birth_date < current_date - interval '120 years' then
    raise exception 'Bitte ein gültiges Geburtsdatum eingeben.';
  end if;

  return new;
end;
$$;

-- Nur ein bestätigtes Datum zählt für den Sonderurlaub ab 55 (leave_kind_kontingent).
create or replace function public.geburtsdatum_von(p_employee_id uuid)
returns date language sql stable security definer set search_path to 'public' as $$
  select pd.birth_date
    from profiles p
    join personal_details pd on pd.user_id = p.id and pd.company_id = p.company_id
   where p.employee_id = p_employee_id
     and pd.birth_date_bestaetigt
   limit 1;
$$;

-- Liste für die Administration: selbst geänderte, noch unbestätigte Geburtsdaten.
create or replace function public.geburtsdaten_offen()
returns table(employee_id uuid, name text, birth_date date, geaendert_am timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
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
$$;
revoke all on function public.geburtsdaten_offen() from public, anon;
grant execute on function public.geburtsdaten_offen() to authenticated;

create or replace function public.geburtsdatum_bestaetigen(p_employee_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
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
$$;
revoke all on function public.geburtsdatum_bestaetigen(uuid) from public, anon;
grant execute on function public.geburtsdatum_bestaetigen(uuid) to authenticated;
