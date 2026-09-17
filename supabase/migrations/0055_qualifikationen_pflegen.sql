-- Qualifikationen setzen und lesen.
--
-- Die Anwendung soll nicht in zwei Tabellen gleichzeitig schreiben und
-- dabei Berechtigungen selbst prüfen. Beides steckt hier: eine Funktion
-- setzt den vollständigen Satz einer Person, eine liefert den Katalog.
--
-- Ab hier liest die Anwendung employees.qualifications nicht mehr. Die
-- Spalte bleibt als Rückweg stehen, siehe 0050.

-- Der vollständige Satz einer Person. Übergeben werden Schlüssel, nicht
-- IDs -- das Formular kennt keine UUIDs, und unbekannte Schlüssel fallen
-- still weg, wie im bisherigen Formular auch.
create or replace function set_employee_qualifications(
  p_employee_id uuid,
  p_keys text[]
)
returns void
language plpgsql security definer set search_path = public as $$
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
$$;

revoke execute on function set_employee_qualifications(uuid, text[]) from public, anon;
grant execute on function set_employee_qualifications(uuid, text[]) to authenticated;

-- Katalog des eigenen Unternehmens, für Formulare und Auswertungen.
create or replace function company_qualifications()
returns table (id uuid, key text, label text, active boolean, sort_order int, anzahl bigint)
language sql stable security definer set search_path = public as $$
  select q.id, q.key, q.label, q.active, q.sort_order,
         (select count(*) from employee_qualifications eq
           join employees e on e.id = eq.employee_id
          where eq.qualification_id = q.id and e.active)
    from qualifications q
   where q.company_id = auth_company_id()
   order by q.sort_order nulls last, q.label;
$$;

revoke execute on function company_qualifications() from public, anon;
grant execute on function company_qualifications() to authenticated;

-- Eine Qualifikation anlegen oder umbenennen. Der Schlüssel entsteht aus
-- der Bezeichnung und bleibt danach fest -- daran hängen die Zuordnungen.
create or replace function save_qualification(
  p_id uuid,
  p_label text,
  p_active boolean default true
)
returns uuid
language plpgsql security definer set search_path = public as $$
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

  -- Schlüssel aus der Bezeichnung: Kleinbuchstaben, Umlaute aufgelöst,
  -- alles Übrige zu Unterstrichen.
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
$$;

revoke execute on function save_qualification(uuid, text, boolean) from public, anon;
grant execute on function save_qualification(uuid, text, boolean) to authenticated;

-- Der Einrichtungsassistent schreibt ebenfalls auf die neuen Tabellen.
-- Unverändert bleibt: nur die eigene Zeile, keine Mitarbeiter-ID von
-- außen, weder Rolle noch Status.
create or replace function save_own_setup_profile(
  p_department text,
  p_vacation_days numeric,
  p_v_days numeric,
  p_shift_worker boolean,
  p_rotation_team text,
  p_qualifications text[]
)
returns void
language plpgsql security definer set search_path = public as $$
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
$$;
