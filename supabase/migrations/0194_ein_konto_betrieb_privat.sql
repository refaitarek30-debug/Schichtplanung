-- Teil 2 (28.10.2026): Ein Konto für Betrieb und Privat.
--
--  1. Mitarbeiter richten sich mit einem Tipp einen Privatbereich ein (gleicher Login).
--  2. Im Privatbereich stehen die eigenen Betriebsschichten – nur zum Ansehen.
--  3. „Deaktivieren“ sperrt den Betriebszugang (bisher blieb der Login offen) und
--     gilt als Austritt: beim nächsten Anmelden kommt die Frage „Privat weitermachen?“.
--     Mit: Termine, To-dos, eigene Einträge, Farben. Nicht mit: Betriebsschichten,
--     Krank- und Urlaubsanträge.
--  4. Endgültig löschen: Wer einen Privatbereich hat, behält Login und Privatbereich.
--  5. Beitritt: Ein Betrieb kann eine Person aufnehmen, die schon einen
--     Privatkalender hat – per Link oder Code, mit Übernahme-Frage.
--
-- Abwärtsverträglich: neue Spalten und Funktionen; bestehende Funktionen liefern
-- höchstens zusätzliche Felder.

-- ---- 1. Neue Spalten ------------------------------------------------------------------
-- Austritt: wann die Übernahme in den Privatbereich erledigt war.
alter table public.profiles add column if not exists austritt_uebernommen_am timestamptz;

-- Glühbirne im Privatbereich. Bisherige Konten: leer (sie sehen das Neue), neue: ab Anlage.
alter table public.privat_konten add column if not exists neuigkeiten_gesehen timestamptz;
alter table public.privat_konten alter column neuigkeiten_gesehen set default now();

-- Beim Beitritt nicht übernommen: bleibt im Privatbereich, erscheint nicht im Betriebskalender.
alter table public.kalender_termine add column if not exists nur_privat boolean not null default false;
alter table public.kalender_todos add column if not exists nur_privat boolean not null default false;

-- ---- 2. Nur-Privatkonto: Privatbereich ohne aktiven Betriebszugang ----------------------
-- Partner, Verbundene, Gruppen und das Kalender-Abo sehen bei Mitarbeitern weiter die
-- Betriebsschichten – auch wenn sie zusätzlich einen Privatbereich haben.
create or replace function public.nur_privatkonto(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select ist_privatkonto(p_user)
     and not exists (select 1 from profiles p where p.id = p_user and p.active and p.employee_id is not null)
$$;
revoke execute on function public.nur_privatkonto(uuid) from public, anon;

do $$
declare
  f regprocedure;
  alt text;
  neu text;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('kalender_codes', 'kalender_farben_codes', 'abo_plan')
  loop
    alt := pg_get_functiondef(f);
    neu := replace(alt, 'if ist_privatkonto(', 'if nur_privatkonto(');
    if neu = alt then
      raise exception 'Umstellung auf nur_privatkonto: % unverändert', f;
    end if;
    execute neu;
  end loop;
end $$;

-- ---- 3. Deaktivieren sperrt den Betriebszugang ------------------------------------------
create or replace function public.employees_sync_profile_active()
returns trigger language plpgsql security definer set search_path to 'public' as $$
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
$$;
revoke execute on function public.employees_sync_profile_active() from public, anon, authenticated;

drop trigger if exists employees_sync_profile_active on public.employees;
create trigger employees_sync_profile_active
  after update of active on public.employees
  for each row execute function public.employees_sync_profile_active();

-- Bestand angleichen (heute: keine Abweichung).
update public.profiles p
   set active = e.active
  from public.employees e
 where p.employee_id = e.id and p.active is distinct from e.active;

-- ---- 4. Privatkonto anlegen (gemeinsamer Kern) ------------------------------------------
-- Standard-Schichten wie bei der Registrierung; Farben aus dem Betriebskalender
-- gehen auf die passenden Standard-Schichten über.
create or replace function public._privat_konto_sicherstellen(p_user uuid, p_name text, p_version text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
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
$$;
revoke execute on function public._privat_konto_sicherstellen(uuid, text, text) from public, anon, authenticated;

-- Eigene Einträge aus dem Betriebskalender in den Privatbereich (je Tag in die erste freie Ebene).
create or replace function public._eigene_eintraege_nach_privat(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
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
$$;
revoke execute on function public._eigene_eintraege_nach_privat(uuid) from public, anon, authenticated;

-- ---- 5. Privatbereich für Mitarbeiter: erster Tipp --------------------------------------
-- Der Betrieb erfährt davon nichts (kein Eintrag im Protokoll).
create or replace function public.privatbereich_einrichten(p_version text)
returns void language plpgsql security definer set search_path to 'public' as $$
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
$$;
revoke execute on function public.privatbereich_einrichten(text) from public, anon;
grant execute on function public.privatbereich_einrichten(text) to authenticated;

-- ---- 6. Betriebsschichten im Privatbereich – nur die eigenen, nur Schichten -------------
-- Genehmigte Abwesenheiten (Urlaub, Krank …) erscheinen dort nicht.
create or replace function public.meine_betriebsschichten(p_von date, p_bis date)
returns table(tag date, name text, kuerzel text)
language plpgsql stable security definer set search_path to 'public' as $$
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
      select g.day, g.shift_name, g.shift_code
        from shift_plan_grid(firma, ab, n) g
       where g.is_me
         and g.shift_name is not null
         and (g.absence_code is null or g.absence_code <> upper(g.absence_code));
    ab := ab + n;
  end loop;
end;
$$;
revoke execute on function public.meine_betriebsschichten(date, date) from public, anon;
grant execute on function public.meine_betriebsschichten(date, date) to authenticated;

-- ---- 7. Austritt -----------------------------------------------------------------------
create or replace function public.austritt_stand()
returns table(ausgetreten boolean, firma text, hat_privat boolean, erledigt boolean)
language sql stable security definer set search_path to 'public' as $$
  select not p.active,
         c.name,
         exists (select 1 from privat_konten k where k.user_id = p.id),
         p.austritt_uebernommen_am is not null
    from profiles p
    left join companies c on c.id = p.company_id
   where p.id = auth.uid()
$$;
revoke execute on function public.austritt_stand() from public, anon;
grant execute on function public.austritt_stand() to authenticated;

create or replace function public.privat_weitermachen(p_version text)
returns void language plpgsql security definer set search_path to 'public' as $$
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
$$;
revoke execute on function public.privat_weitermachen(text) from public, anon;
grant execute on function public.privat_weitermachen(text) to authenticated;

-- ---- 8. Endgültig löschen: Privatbereich bleibt -----------------------------------------
create or replace function public.mitarbeiter_endgueltig_loeschen(p_employee_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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
$$;

-- ---- 9. Beitritt mit bestehendem Konto ---------------------------------------------------
create table if not exists public.betrieb_beitritte (
  code text primary key check (code ~ '^[A-Z2-9]{8}$'),
  employee_id uuid not null references public.employees(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  gueltig_bis timestamptz not null default now() + interval '7 days'
);
create index if not exists betrieb_beitritte_employee_idx on public.betrieb_beitritte (employee_id);
alter table public.betrieb_beitritte enable row level security;
revoke all on public.betrieb_beitritte from anon, authenticated;

-- Neuer Code je Einladung (der alte verfällt). Nur über den Server mit Dienstschlüssel.
create or replace function public.beitritt_code_anlegen(p_employee_id uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
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
$$;
revoke execute on function public.beitritt_code_anlegen(uuid) from public, anon, authenticated;
grant execute on function public.beitritt_code_anlegen(uuid) to service_role;

create or replace function public._beitritt_code(p_code text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- Vorschau für die Übernahme-Frage.
create or replace function public.beitritt_vorschau(p_code text)
returns table(firma text, name text, termine int, todos int, eigene_schichten int)
language plpgsql stable security definer set search_path to 'public' as $$
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
           (select count(*)::int from privat_tage t where t.user_id = auth.uid() and t.tag >= current_date)
      from companies c, employees e
     where c.id = b.company_id and e.id = b.employee_id;
end;
$$;
revoke execute on function public.beitritt_vorschau(text) from public, anon;
grant execute on function public.beitritt_vorschau(text) to authenticated;

create or replace function public.beitritt_annehmen(p_code text, p_termine boolean, p_todos boolean, p_schichten boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
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
        join privat_tage t on t.user_id = ich and t.schichtart_id = s.id and t.tag >= current_date
       where s.user_id = ich and s.art = 'arbeit'
    loop
      insert into kalender_eigene_arten (user_id, name, kuerzel, farbe, beginn, ende, reihenfolge)
      values (ich, art.name, art.kuerzel, art.farbe, art.beginn, art.ende, art.reihenfolge)
      returning id into neu;
      insert into kalender_eigene_tage (user_id, tag, art_id)
      select ich, t.tag, neu from privat_tage t
       where t.user_id = ich and t.schichtart_id = art.id and t.tag >= current_date
      on conflict (user_id, tag) do nothing;
    end loop;
  end if;

  delete from betrieb_beitritte where employee_id = e.id;
  perform write_audit(e.company_id, 'zugang.beitritt', 'employees', e.id, '{}'::jsonb);
end;
$$;
revoke execute on function public.beitritt_annehmen(text, boolean, boolean, boolean) from public, anon;
grant execute on function public.beitritt_annehmen(text, boolean, boolean, boolean) to authenticated;

-- ---- 10. Termine und To-dos: Kennzeichen für den Betriebskalender ---------------------
drop function if exists public.meine_termine();
create function public.meine_termine()
returns table(id uuid, von_partner boolean, person_id uuid, von_user uuid, datum date, bis_datum date, titel text,
              ganztaegig boolean, beginn text, ende text, wiederholung text, notiz text, ort text, erinnerung text,
              ausfaelle date[], serie_ab date, nur_privat boolean)
language plpgsql stable security definer set search_path to 'public' as $$
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
$$;
revoke execute on function public.meine_termine() from public, anon;
grant execute on function public.meine_termine() to authenticated;

drop function if exists public.meine_todos();
create function public.meine_todos()
returns table(id uuid, titel text, datum date, uhrzeit text, erledigt boolean, erledigt_am timestamptz, nur_privat boolean)
language plpgsql stable security definer set search_path to 'public' as $$
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
$$;
revoke execute on function public.meine_todos() from public, anon;
grant execute on function public.meine_todos() to authenticated;

-- Glühbirne im Privatbereich: gelesen.
create or replace function public.privat_neuigkeiten_gelesen()
returns void language sql security definer set search_path to 'public' as $$
  update privat_konten set neuigkeiten_gesehen = now() where user_id = auth.uid()
$$;
revoke execute on function public.privat_neuigkeiten_gelesen() from public, anon;
grant execute on function public.privat_neuigkeiten_gelesen() to authenticated;
