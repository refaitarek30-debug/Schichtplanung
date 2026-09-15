-- Nichts mehr stillschweigend voreinstellen, und den Gründer nach seinen
-- eigenen Daten fragen.
--
-- Bisher bekam jeder neue Mitarbeiter 30 Urlaubstage und 27 V-Tage, weil
-- das die Spaltenvorgaben waren. Für ein frisch registriertes Unternehmen
-- sind das erfundene Zahlen: niemand hat sie eingegeben, sie sehen aber
-- aus wie gepflegte Daten. Ab jetzt steht alles auf 0 und muss bewusst
-- gesetzt werden.

alter table employees  alter column vacation_days  set default 0;
alter table employees  alter column v_days         set default 0;
alter table leave_balances alter column entitlement   set default 0;
alter table leave_balances alter column v_entitlement set default 0;

comment on column employees.vacation_days is
  'Jahresanspruch an Urlaubstagen. Vorgabe 0 – wird beim Anlegen bewusst '
  'gesetzt, damit keine erfundene Zahl wie ein gepflegter Wert aussieht.';
comment on column employees.v_days is
  'Jahresanspruch an V-Tagen (Freischichten). Vorgabe 0, siehe vacation_days.';

-- Damit die Fortschrittsanzeige im Assistenten die Wahrheit sagt. Ohne
-- eigenen Vermerk müsste sie aus den Werten raten, und "0 Urlaubstage"
-- ist eine gültige Antwort, keine fehlende.
alter table employees
  add column if not exists profile_confirmed_at timestamptz;

comment on column employees.profile_confirmed_at is
  'Wann diese Person ihre eigenen Stammdaten im Einrichtungsassistenten '
  'bestätigt hat. Nur für die Fortschrittsanzeige – blockiert nichts.';

-- Der Gründer startet jetzt ebenfalls bei 0. Die drei Schichten bleiben:
-- sie sind ein brauchbarer Startpunkt und lassen sich löschen, wer keine
-- Schicht fährt, wird ihnen ohnehin nicht zugeordnet.
create or replace function register_company(
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_avv_accepted boolean default false
)
returns table (company_id uuid, employee_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid;
  v_employee_id uuid;
  jahr int := extract(year from current_date)::int;
begin
  if coalesce(trim(p_company_name), '') = '' then raise exception 'Bitte einen Unternehmensnamen angeben.'; end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then raise exception 'Bitte Vor- und Nachnamen angeben.'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'Bitte eine E-Mail-Adresse angeben.'; end if;
  if not coalesce(p_avv_accepted, false) then
    raise exception 'Bitte die Datenschutzerklärung und den Auftragsverarbeitungsvertrag bestätigen.';
  end if;

  insert into companies (name, avv_accepted_at)
  values (trim(p_company_name), now())
  returning id into v_company_id;

  -- vacation_days und v_days ausdrücklich auf 0: der Assistent fragt sie
  -- im ersten Schritt ab. Abteilung bleibt leer, auch das wird gefragt.
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
$$;

revoke execute on function register_company(text, text, text, text, boolean) from public;
grant execute on function register_company(text, text, text, text, boolean) to anon, authenticated;

-- Die eigenen Stammdaten aus dem Assistenten speichern.
--
-- Bewusst eine eigene Funktion statt des allgemeinen Mitarbeiter-
-- Formulars: der Assistent soll nur die eigene Zeile anfassen können und
-- weder Rolle noch Status noch fremde Personen. Geschrieben wird immer
-- auf auth_employee_id() – die Zeile, die zum angemeldeten Zugang gehört.
-- Eine Mitarbeiter-ID von außen gibt es nicht, also lässt sich auch keine
-- fremde unterschieben.
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
  quals qualification[];
begin
  -- Der Assistent ist der Administration vorbehalten; dieselbe Prüfung
  -- steht hier noch einmal, weil ein ausgegrautes Formular nichts sichert.
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

  -- Eine Schichtgruppe ergibt nur im Schichtbetrieb Sinn. Wer Tagschicht
  -- fährt, bekommt keine – sonst stünde dieselbe Widersprüchlichkeit im
  -- Datenbestand, die in 0047 die Urlaubsberechnung verdreht hat.
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

  -- Nur bekannte Qualifikationen übernehmen. Ein Wert, den das Enum nicht
  -- kennt, würde beim Umwandeln mit einer rohen Datenbankmeldung platzen;
  -- hier fällt er einfach weg, wie im Mitarbeiterformular auch.
  select coalesce(array_agg(w::qualification), '{}')
    into quals
    from unnest(coalesce(p_qualifications, '{}')) as w
   where w in (select unnest(enum_range(null::qualification))::text);

  update employees e
     set department    = nullif(trim(coalesce(p_department, '')), ''),
         vacation_days = p_vacation_days,
         v_days        = p_v_days,
         shift_worker  = coalesce(p_shift_worker, false),
         rotation_team = team,
         rotation_pattern_id = muster,
         qualifications = quals,
         profile_confirmed_at = now(),
         updated_at    = now()
   where e.id = ich
     and e.company_id = auth_company_id();
end;
$$;

revoke execute on function save_own_setup_profile(text, numeric, numeric, boolean, text, text[])
  from public, anon;
grant execute on function save_own_setup_profile(text, numeric, numeric, boolean, text, text[])
  to authenticated;

-- Fortschrittsanzeige: der Assistent soll zeigen, was steht, nicht raten.
--
-- Die Funktion bekommt eine Spalte dazu, deshalb erst weg damit:
-- `create or replace` kann den Rückgabetyp nicht ändern. Niemand sonst in
-- der Datenbank hängt daran, nur die Anwendung ruft sie auf.
drop function if exists setup_state();

create function setup_state()
returns table (
  abgeschlossen_at timestamptz, bundesland text, feiertage bigint,
  muster_vorhanden boolean, gruppen bigint, mitarbeiter bigint,
  mitarbeiter_mit_gruppe bigint, eigenes_profil_bestaetigt boolean
)
language sql stable security definer set search_path = public as $$
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
$$;

revoke execute on function setup_state() from public, anon;
grant execute on function setup_state() to authenticated;
