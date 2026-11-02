-- Zusatzrollen (Schritt 5): eine Schichtleitung kann von der Administration
-- eine Rolle mit Zusatzrechten bekommen, z. B. "Tagschichtmeister".
--
-- Die Rolle bleibt "Schichtleitung" (profiles.role / employees.role ändern
-- sich nicht). Dazu kommen drei einzeln schaltbare Rechte:
--   urlaub_alle            Urlaub, V-Tage usw. aller Gruppen entscheiden
--   entscheidungen_aendern Genehmigt <-> Abgelehnt drehen
--   mitarbeiter_verwalten  Personen anlegen, deaktivieren/aktivieren,
--                          endgültig löschen (nur normale Mitarbeiter)
--
-- Vergeben und ändern darf das nur die Administration. Der Schichtplan,
-- die Krankmeldungen und alle übrigen Sicherheitsfunktionen bleiben
-- unberührt. Ohne zugewiesene Rolle ändert sich für niemanden etwas –
-- mit EINER Ausnahme, die gewollt ist: "aktiv" ändern darf eine
-- Schichtleitung nicht mehr (bisher nur die Oberfläche versteckte den Knopf).

-- 1. Rollen je Unternehmen ---------------------------------------------------

create table public.rollen (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  urlaub_alle boolean not null default false,
  entscheidungen_aendern boolean not null default false,
  mitarbeiter_verwalten boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index rollen_name_je_firma on public.rollen (company_id, lower(btrim(name)));

create trigger rollen_updated_at before update on public.rollen
  for each row execute function public.set_updated_at();

alter table public.rollen enable row level security;
revoke all on public.rollen from anon;

create policy "Rollen lesen" on public.rollen
  for select to authenticated
  using (company_id = (select auth_company_id()));

create policy "Rollen verwaltet Admin" on public.rollen
  for all to authenticated
  using (company_id = (select auth_company_id()) and (select is_admin()))
  with check (company_id = (select auth_company_id()) and (select is_admin()));

-- 2. Zuweisung an der Person -------------------------------------------------
-- Auf employees (nicht profiles): Dort darf jede Person ihr eigenes Profil
-- ändern, sie könnte sich die Rolle sonst selbst geben. employees ändert
-- nur Schichtleitung/Administration, und der Wächter unten sperrt das Feld
-- für die Schichtleitung.
-- restrict: eine Rolle, die noch jemand hat, lässt sich nicht löschen.

alter table public.employees
  add column rolle_id uuid references public.rollen(id) on delete restrict;

create index employees_rolle_id on public.employees (rolle_id) where rolle_id is not null;

-- Nur für die Schichtleitung, nur eine Rolle aus dem eigenen Unternehmen.
-- Wer nicht (mehr) Schichtleitung ist, verliert die Zusatzrolle.
create or replace function public.employees_zusatzrolle_pruefen()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.role is distinct from 'shift_leader' then
    new.rolle_id := null;
  end if;
  if new.rolle_id is not null
     and not exists (select 1 from rollen r where r.id = new.rolle_id and r.company_id = new.company_id) then
    raise exception 'Diese Rolle gibt es in deinem Unternehmen nicht.';
  end if;
  return new;
end;
$$;

create trigger employees_zusatzrolle_pruefen
  before insert or update on public.employees
  for each row execute function public.employees_zusatzrolle_pruefen();

-- 3. Wer hat welches Recht? --------------------------------------------------

-- Für eine bestimmte Person (nur von anderen Funktionen aufgerufen).
create or replace function public.zusatzrecht_von(p_employee_id uuid, p_recht text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(bool_or(
           case p_recht
             when 'urlaub_alle' then r.urlaub_alle
             when 'entscheidungen_aendern' then r.entscheidungen_aendern
             when 'mitarbeiter_verwalten' then r.mitarbeiter_verwalten
             else false
           end), false)
    from employees e
    join rollen r on r.id = e.rolle_id and r.company_id = e.company_id
    join profiles p on p.employee_id = e.id and p.company_id = e.company_id
   where e.id = p_employee_id
     and e.active
     and p.active
     and p.role = 'shift_leader';
$$;
revoke execute on function public.zusatzrecht_von(uuid, text) from public, anon, authenticated;

-- Für die Person, die gerade angemeldet ist.
create or replace function public.hat_zusatzrecht(p_recht text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select public.zusatzrecht_von(auth_employee_id(), p_recht);
$$;
revoke execute on function public.hat_zusatzrecht(text) from public, anon;
grant execute on function public.hat_zusatzrecht(text) to authenticated;

-- Eigene Rolle und Rechte für die Oberfläche (leer, wenn es keine gibt).
create or replace function public.meine_zusatzrolle()
returns table(name text, urlaub_alle boolean, entscheidungen_aendern boolean, mitarbeiter_verwalten boolean)
language sql
stable security definer
set search_path to 'public'
as $$
  select r.name, r.urlaub_alle, r.entscheidungen_aendern, r.mitarbeiter_verwalten
    from employees e
    join rollen r on r.id = e.rolle_id and r.company_id = e.company_id
    join profiles p on p.employee_id = e.id and p.company_id = e.company_id
   where e.id = auth_employee_id()
     and e.active
     and p.active
     and p.role = 'shift_leader';
$$;
revoke execute on function public.meine_zusatzrolle() from public, anon;
grant execute on function public.meine_zusatzrolle() to authenticated;

-- 4. Wächter an employees: Rolle, Zusatzrolle, "aktiv" ------------------------
-- Bisher: eine Schichtleitung darf keine Rolle ändern. Neu: auch keine
-- Zusatzrolle, und "aktiv" nur mit dem Recht "Mitarbeiter verwalten" – und
-- dann nur bei normalen Mitarbeitern, nie bei sich selbst.

create or replace function public.employees_guard_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth_role() = 'admin' then
    return new;
  end if;

  if auth_role() = 'shift_leader' then
    if new.role is distinct from old.role then
      raise exception 'Nur die Administration darf Rollen vergeben.';
    end if;
    if new.rolle_id is distinct from old.rolle_id then
      raise exception 'Nur die Administration darf Zusatzrollen vergeben.';
    end if;
    if new.active is distinct from old.active then
      if not hat_zusatzrecht('mitarbeiter_verwalten') then
        raise exception 'Nur die Administration darf Personen deaktivieren oder aktivieren.';
      end if;
      if old.role is distinct from 'employee' then
        raise exception 'Schichtleitung und Administration (de)aktiviert nur die Administration.';
      end if;
      if old.id is not distinct from auth_employee_id() then
        raise exception 'Du kannst dich nicht selbst deaktivieren.';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

-- Anlegen: nur die Administration – oder mit dem Recht ein normaler
-- Mitarbeiter ohne Zusatzrolle (neben der bestehenden Admin-Richtlinie).
create policy "Personal anlegen mit Zusatzrecht" on public.employees
  for insert to authenticated
  with check (
    company_id = (select auth_company_id())
    and (select auth_role()) = 'shift_leader'
    and (select hat_zusatzrecht('mitarbeiter_verwalten'))
    and role = 'employee'
    and rolle_id is null
  );

-- 5. Protokoll -----------------------------------------------------------------

create or replace function public.employees_audit_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    perform public.write_audit(new.company_id, 'role.changed', 'employees', new.id, null);
  end if;
  if tg_op = 'UPDATE' and new.rolle_id is distinct from old.rolle_id then
    perform public.write_audit(new.company_id, 'role.extra_changed', 'employees', new.id,
      jsonb_build_object('von', old.rolle_id, 'nach', new.rolle_id));
  end if;
  if tg_op = 'UPDATE' and new.active is distinct from old.active then
    perform public.write_audit(
      new.company_id,
      case when new.active then 'employee.reactivated' else 'employee.deactivated' end,
      'employees',
      new.id,
      null
    );
  end if;
  if tg_op = 'UPDATE' and new.* is distinct from old.* then
    perform public.write_audit(new.company_id, 'employee.updated', 'employees', new.id, null);
  end if;
  if tg_op = 'INSERT' then
    perform public.write_audit(new.company_id, 'employee.created', 'employees', new.id, null);
  end if;
  return new;
end;
$function$;

drop trigger employees_audit on public.employees;
create trigger employees_audit
  after insert or update of role, active, rolle_id on public.employees
  for each row execute function public.employees_audit_role();

create or replace function public.rollen_protokoll()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    -- Löscht ein Unternehmen seine Rollen mit, gibt es keinen Mandanten
    -- mehr für den Eintrag. Das Protokoll darf das Löschen nie verhindern.
    begin
      perform public.write_audit(old.company_id, 'rolle.geloescht', 'rollen', old.id,
        jsonb_build_object('name', old.name));
    exception when others then
      null;
    end;
    return old;
  end if;
  perform public.write_audit(new.company_id,
    case when tg_op = 'INSERT' then 'rolle.angelegt' else 'rolle.geaendert' end,
    'rollen', new.id,
    jsonb_build_object('name', new.name, 'urlaub_alle', new.urlaub_alle,
                       'entscheidungen_aendern', new.entscheidungen_aendern,
                       'mitarbeiter_verwalten', new.mitarbeiter_verwalten));
  return new;
end;
$function$;

create trigger rollen_protokoll
  after insert or update or delete on public.rollen
  for each row execute function public.rollen_protokoll();

-- 6. Urlaub aller Gruppen --------------------------------------------------------
-- Eine Stelle entscheidet, wessen Anträge jemand entscheiden darf – elf
-- Funktionen verlassen sich darauf. Neu: mit "urlaub_alle" alle Gruppen.
-- Sonst unverändert.

create or replace function public.darf_urlaub_entscheiden(p_employee_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  ich employees;
  ziel employees;
begin
  select * into ziel from employees where id = p_employee_id;
  if ziel.id is null or ziel.company_id is distinct from auth_company_id() then
    return false;
  end if;
  if is_admin() then
    return true;
  end if;
  if auth_role() is distinct from 'shift_leader' then
    return false;
  end if;
  select * into ich from employees where id = auth_employee_id();
  if ich.id is null then
    return false;
  end if;
  -- Die eigenen Anträge entscheidet die Schichtleitung selbst.
  if ich.id = ziel.id then
    return true;
  end if;
  -- Zusatzrecht: alle Gruppen.
  if hat_zusatzrecht('urlaub_alle') then
    return true;
  end if;
  if ich.rotation_team is not null then
    return ziel.rotation_team = ich.rotation_team;
  end if;
  return ziel.rotation_team is null and ich.shift_id is not null and ziel.shift_id = ich.shift_id;
end;
$function$;

-- Wer erfährt von einem Rücknahme-Antrag usw.? Mit "urlaub_alle" auch die
-- Schichtleitung anderer Gruppen.
create or replace function public.zustaendige_fuehrung(p_employee_id uuid)
returns table(employee_id uuid)
language sql
stable security definer
set search_path to 'public'
as $function$
  select p.employee_id
    from employees ziel
    join profiles p on p.company_id = ziel.company_id
    join employees pe on pe.id = p.employee_id
   where ziel.id = p_employee_id
     and p.active
     and p.employee_id is not null
     and p.employee_id <> p_employee_id
     and (
       p.role = 'admin'
       or (p.role = 'shift_leader'
           and (ziel.rotation_team is null or pe.rotation_team is null
                or pe.rotation_team = ziel.rotation_team
                or public.zusatzrecht_von(p.employee_id, 'urlaub_alle')))
     );
$function$;

-- E-Mail bei neuem Antrag: Schichtleitung der eigenen Gruppe, die
-- Administration – und mit "urlaub_alle" jede Gruppe.
create or replace function public.notify_leave_submitted(p_company_id uuid, p_employee_id uuid, p_request_id uuid, p_antragsteller text, p_gruppe rotation_team, p_art text, p_von date, p_bis date, p_tage numeric, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  firma text;
  zeitraum text;
  tage text;
  per_mail boolean;
begin
  zeitraum := case
    when p_von = p_bis then to_char(p_von, 'DD.MM.YYYY')
    else to_char(p_von, 'DD.MM.YYYY') || ' bis ' || to_char(p_bis, 'DD.MM.YYYY')
  end;

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    p_company_id, p.employee_id,
    'leave_submitted', 'Neuer Antrag: ' || p_art,
    p_antragsteller || ' hat ' || p_art || ' beantragt: ' || zeitraum || '.',
    'leave_requests', p_request_id
  from profiles p
  where p.company_id = p_company_id
    and p.role in ('shift_leader', 'admin')
    and p.employee_id is not null
    and p.active
    and p.employee_id is distinct from p_employee_id;

  select coalesce(s.notify_leave_email, true) into per_mail
    from company_settings s where s.company_id = p_company_id;
  if not coalesce(per_mail, true) then
    return;
  end if;

  select c.name into firma from companies c where c.id = p_company_id;

  tage := case
    when p_tage = trunc(p_tage) then trunc(p_tage)::text
    else replace(to_char(p_tage, 'FM9990D0'), '.', ',')
  end;

  insert into email_outbox (company_id, empfaenger, betreff, text_teil, html_teil, anlass, related_id)
  select
    p_company_id,
    p.email,
    'Neuer Antrag (' || p_art || '): ' || p_antragsteller,
    'Hallo ' || coalesce(p.first_name, '') || ',' || chr(10) || chr(10) ||
      p_antragsteller || ' hat ' || p_art || ' beantragt.' || chr(10) ||
      'Zeitraum: ' || zeitraum || chr(10) ||
      'Tage: ' || tage || chr(10) ||
      coalesce('Kommentar: ' || nullif(trim(p_reason), '') || chr(10), '') || chr(10) ||
      'Der Antrag liegt im Schichtplan zur Entscheidung bereit.' || chr(10) || chr(10) ||
      firma || ' · Schichtplan',
    '<p>Hallo ' || coalesce(p.first_name, '') || ',</p>' ||
      '<p><strong>' || p_antragsteller || '</strong> hat ' || p_art || ' beantragt.</p>' ||
      '<ul>' ||
      '<li>Zeitraum: ' || zeitraum || '</li>' ||
      '<li>Tage: ' || tage || '</li>' ||
      coalesce('<li>Kommentar: ' || nullif(trim(p_reason), '') || '</li>', '') ||
      '</ul>' ||
      '<p>Der Antrag liegt im Schichtplan zur Entscheidung bereit.</p>' ||
      '<p style="color:#6b7280;font-size:12px">' || firma || ' · Schichtplan</p>',
    'urlaubsantrag',
    p_request_id
  from profiles p
  join employees pe on pe.id = p.employee_id
  where p.company_id = p_company_id
    and p.active
    and p.email is not null
    and p.email <> ''
    and p.employee_id is distinct from p_employee_id
    and (
      p.role = 'admin'
      or (p.role = 'shift_leader'
          and (p_gruppe is null or pe.rotation_team is null or pe.rotation_team = p_gruppe
               or public.zusatzrecht_von(p.employee_id, 'urlaub_alle')))
    );
end;
$function$;

-- 7. Entscheidung ändern -------------------------------------------------------
-- Genehmigt <-> Abgelehnt. Bisher fasste decide_leave_request nur offene
-- Anträge an. Hier: Administration, oder Schichtleitung mit dem Recht
-- "entscheidungen_aendern" – und nur für Anträge, über die sie auch sonst
-- entscheiden darf. Die Prüfungen auf Überschneidung und Kontingent laufen
-- über dieselben Trigger wie beim Stellen des Antrags; das Urlaubskonto wird
-- nach der Änderung geprüft und alles zurückgenommen, wenn es ins Minus ginge.

create or replace function public.entscheidung_aendern(p_request_id uuid, p_decision leave_status, p_rejection_reason text default null)
returns leave_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result leave_requests;
  v_firma uuid := auth_company_id();
  v_mitarbeiter uuid;
  v_gruppe uuid;
  v_alt leave_status;
  v_anzahl int;
  fehlend text;
  arten text;
  v_von date;
  v_bis date;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Ungueltige Entscheidung.';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_rejection_reason), '') = '' then
    raise exception 'Fuer eine Ablehnung ist eine Begruendung erforderlich.';
  end if;
  if not (is_admin() or (auth_role() = 'shift_leader' and hat_zusatzrecht('entscheidungen_aendern'))) then
    raise exception 'Du darfst Entscheidungen nicht aendern.';
  end if;

  select r.employee_id, coalesce(r.request_group_id, r.id), r.status
    into v_mitarbeiter, v_gruppe, v_alt
    from leave_requests r
   where r.id = p_request_id and r.company_id = v_firma;

  if v_gruppe is null then
    raise exception 'Der Antrag wurde nicht gefunden.';
  end if;
  if v_alt not in ('approved', 'rejected') then
    raise exception 'Geaendert werden nur genehmigte oder abgelehnte Antraege. Offene werden ganz normal entschieden.';
  end if;
  if v_alt = p_decision then
    raise exception 'Der Antrag ist bereits so entschieden.';
  end if;
  if not darf_urlaub_entscheiden(v_mitarbeiter) then
    raise exception 'Du darfst nur Antraege aendern, ueber die du auch entscheiden darfst.';
  end if;

  update leave_requests
     set status = p_decision,
         rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where coalesce(request_group_id, id) = v_gruppe
     and company_id = v_firma
     and status = v_alt;

  get diagnostics v_anzahl = row_count;
  if v_anzahl = 0 then
    raise exception 'Der Antrag wurde inzwischen geaendert.';
  end if;

  -- Nur das Urlaubskonto darf nicht ins Minus (wie bei decide_leave_request).
  -- Der Saldo zaehlt die Tage jetzt mit; scheitert die Pruefung, nimmt die
  -- Ausnahme die ganze Aenderung zurueck.
  if p_decision = 'approved' then
    select string_agg(distinct x.konto, ' und ') into fehlend
    from (
      select 'Urlaubstage' as konto
        from leave_requests r
        join leave_balances_view v
          on v.employee_id = r.employee_id
         and v.year = extract(year from r.start_date)
       where coalesce(r.request_group_id, r.id) = v_gruppe
         and r.status = 'approved'
         and r.kind = 'urlaub'
         and v.remaining_days < 0
    ) x;

    if fehlend is not null then
      raise exception 'Fuer diesen Antrag stehen nicht genuegend % zur Verfuegung.', fehlend;
    end if;
  end if;

  select * into result from leave_requests where id = p_request_id;

  select min(start_date), max(end_date),
         string_agg(distinct leave_kind_label(kind), ' und ')
    into v_von, v_bis, arten
    from leave_requests
   where coalesce(request_group_id, id) = v_gruppe
     and company_id = v_firma
     and status = p_decision;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    result.company_id, auth.uid(), 'leave.decision_changed', 'leave_requests', result.id,
    jsonb_build_object(
      'von_status', v_alt,
      'nach_status', p_decision,
      'reason', p_rejection_reason,
      'kind', result.kind,
      'gruppe', v_gruppe,
      'zeilen', v_anzahl,
      'von', v_von,
      'bis', v_bis
    )
  );

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    result.company_id, e.id,
    case when p_decision = 'approved' then 'leave_approved' else 'leave_rejected' end,
    arten || case when p_decision = 'approved' then ' jetzt genehmigt' else ' jetzt abgelehnt' end,
    'Die Entscheidung wurde geaendert: '
    || case when v_von = v_bis
            then to_char(v_von, 'DD.MM.YYYY')
            else to_char(v_von, 'DD.MM.YYYY') || ' bis ' || to_char(v_bis, 'DD.MM.YYYY') end
    || case when p_decision = 'approved'
            then ' ist jetzt genehmigt.'
            else ' ist jetzt abgelehnt. ' || coalesce(p_rejection_reason, '') end,
    'leave_requests', result.id
  from employees e where e.id = result.employee_id;

  return result;
end;
$function$;

revoke execute on function public.entscheidung_aendern(uuid, leave_status, text) from public, anon;
grant execute on function public.entscheidung_aendern(uuid, leave_status, text) to authenticated;

-- 8. Mitarbeiter endgültig löschen ---------------------------------------------
-- Wie bisher, nur dass jetzt auch das Recht "mitarbeiter_verwalten" reicht –
-- dann aber nur für normale Mitarbeiter (nie Schichtleitung/Administration).

create or replace function public.mitarbeiter_endgueltig_loeschen(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_firma uuid := auth_company_id();
  e employees;
  zugaenge uuid[];
  mit_privat uuid[];
  antraege uuid[];
  n_zugang int := 0;
  z uuid;
begin
  if not (is_admin() or (auth_role() = 'shift_leader' and hat_zusatzrecht('mitarbeiter_verwalten'))) then
    raise exception 'Nur die Administration darf Personen löschen.';
  end if;

  select * into e from employees
   where id = p_employee_id and company_id = v_firma
   for update;
  if e.id is null then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not is_admin() and e.role is distinct from 'employee' then
    raise exception 'Schichtleitung und Administration löscht nur die Administration.';
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
$function$;
