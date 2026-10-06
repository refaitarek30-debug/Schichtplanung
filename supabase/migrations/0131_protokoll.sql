-- Protokoll: wer hat sich wann angemeldet, wer hat was geändert, wo ist
-- ein Fehler aufgetreten.
--
-- Grundlage ist das bestehende Änderungsprotokoll `audit_logs`. Dazu kommen:
--   * Anmeldungen, Abmeldungen, fehlgeschlagene Anmeldungen,
--   * Änderungen an Urlaub/Anträgen, Schichtwechseln, Kommentaren, Konten,
--     Mitteilungen und Urlaubssperren – jeweils mit Person und Datum,
--   * Fehlermeldungen, die jemandem in der App angezeigt wurden.
--
-- Einsehen darf das Protokoll nur, wer ausdrücklich in `protokoll_zugang`
-- steht – nicht jede Administration. Die App liest über `protokoll_liste()`;
-- auch der direkte Lesezugriff auf `audit_logs` gilt nur noch für diese
-- Personen.
--
-- Alle Trigger schreiben über `protokoll_schreiben()`, das Fehler schluckt:
-- Ein Protokolleintrag darf niemals das Speichern selbst verhindern.
-- Demo-Firmen werden nicht protokolliert.
--
-- Inhalte von Kommentaren, Abwesenheitsgründen und Krankmeldungen werden
-- nicht ins Protokoll geschrieben (Datenschutzerklärung).

-- ---------------------------------------------------------------------------
-- Zugang
-- ---------------------------------------------------------------------------

create table if not exists public.protokoll_zugang (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.protokoll_zugang enable row level security;
revoke all on public.protokoll_zugang from anon, authenticated;

create index if not exists audit_logs_actor_zeit on public.audit_logs (actor_id, created_at desc);

/** Firma, deren Protokoll die angemeldete Person sehen darf – sonst null. */
create or replace function public.protokoll_firma()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select z.company_id
    from protokoll_zugang z
    join profiles p on p.id = z.user_id
   where z.user_id = auth.uid()
     and p.active
     and p.role = 'admin'
     and p.company_id = z.company_id;
$$;

create or replace function public.darf_protokoll()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.protokoll_firma() is not null;
$$;

revoke all on function public.protokoll_firma() from public, anon;
revoke all on function public.darf_protokoll() from public, anon;
grant execute on function public.darf_protokoll() to authenticated;

-- ---------------------------------------------------------------------------
-- Schreiben
-- ---------------------------------------------------------------------------

create or replace function public.protokoll_schreiben(
  p_company_id uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  akteur uuid := auth.uid();
begin
  -- Gelöschte Firma (Löschen läuft gerade) oder Demo: nichts schreiben.
  if not exists (select 1 from companies c where c.id = p_company_id and not c.is_demo) then
    return;
  end if;
  if akteur is not null and not exists (select 1 from profiles p where p.id = akteur) then
    akteur := null;
  end if;
  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (p_company_id, akteur, p_action, coalesce(p_entity, 'app'), p_entity_id, jsonb_strip_nulls(p_payload));
exception when others then
  -- Das Protokoll ist Beiwerk. Lieber ein fehlender Eintrag als ein
  -- Urlaubsantrag, der deswegen nicht gespeichert wird.
  null;
end;
$$;

revoke all on function public.protokoll_schreiben(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

-- Abwesenheiten: bisher ohne Inhalt protokolliert. Jetzt mit Person, Tag
-- und Art – „krank“ bleibt bewusst ungenannt.
create or replace function public.absences_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  z absences;
begin
  if tg_op = 'DELETE' then z := old; else z := new; end if;
  perform protokoll_schreiben(
    z.company_id,
    case tg_op when 'INSERT' then 'absence.created' when 'UPDATE' then 'absence.updated' else 'absence.deleted' end,
    'absences',
    z.id,
    jsonb_build_object(
      'employee_id', z.employee_id,
      'tag', z.date,
      'art', case when z.type::text = 'krank' then null else z.type::text end
    )
  );
  return null;
end;
$$;

create or replace function public.protokoll_aenderung()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a jsonb;
  n jsonb;
  felder jsonb := '{}'::jsonb;
  feld text;
begin
  if tg_op <> 'INSERT' then a := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;

  if tg_table_name = 'leave_requests' then
    if tg_op = 'INSERT' then
      perform protokoll_schreiben((n->>'company_id')::uuid,
        case when n->>'status' = 'approved' then 'urlaub.eingetragen' else 'urlaub.beantragt' end,
        'leave_requests', (n->>'id')::uuid,
        jsonb_build_object('employee_id', n->'employee_id', 'von', n->'start_date', 'bis', n->'end_date',
                           'art', n->'kind', 'tage', n->'requested_days', 'status', n->'status'));
    elsif tg_op = 'UPDATE' then
      -- Genehmigen, Ablehnen und Zurücknehmen schreiben ihre Funktionen
      -- selbst ins Protokoll. Hier nur, was sonst nirgends auftaucht.
      if a->'start_date' is distinct from n->'start_date' or a->'end_date' is distinct from n->'end_date' then
        perform protokoll_schreiben((n->>'company_id')::uuid, 'urlaub.geaendert', 'leave_requests', (n->>'id')::uuid,
          jsonb_build_object('employee_id', n->'employee_id', 'von_vorher', a->'start_date', 'bis_vorher', a->'end_date',
                             'von', n->'start_date', 'bis', n->'end_date', 'art', n->'kind'));
      end if;
    else
      perform protokoll_schreiben((a->>'company_id')::uuid, 'urlaub.geloescht', 'leave_requests', (a->>'id')::uuid,
        jsonb_build_object('employee_id', a->'employee_id', 'von', a->'start_date', 'bis', a->'end_date',
                           'art', a->'kind', 'status', a->'status'));
    end if;

  elsif tg_table_name = 'shift_assignments' then
    if tg_op = 'DELETE' then
      perform protokoll_schreiben((a->>'company_id')::uuid, 'plan.schicht_entfernt', 'shift_assignments', (a->>'id')::uuid,
        jsonb_build_object('employee_id', a->'employee_id', 'tag', a->'date',
          'schicht', (select s.name from shifts s where s.id = (a->>'shift_id')::uuid)));
    elsif tg_op = 'INSERT' or a->'shift_id' is distinct from n->'shift_id' then
      perform protokoll_schreiben((n->>'company_id')::uuid, 'plan.schicht', 'shift_assignments', (n->>'id')::uuid,
        jsonb_build_object('employee_id', n->'employee_id', 'tag', n->'date',
          'schicht', coalesce((select s.name from shifts s where s.id = (n->>'shift_id')::uuid), 'Frei'),
          'vorher', case when tg_op = 'UPDATE'
                         then coalesce((select s.name from shifts s where s.id = (a->>'shift_id')::uuid), 'Frei') end));
    end if;

  elsif tg_table_name = 'plan_kommentare' then
    if tg_op = 'INSERT' then
      perform protokoll_schreiben((n->>'company_id')::uuid, 'kommentar.geschrieben', 'plan_kommentare', (n->>'id')::uuid,
        jsonb_build_object('employee_id', n->'employee_id', 'tag', n->'tag'));
    elsif tg_op = 'DELETE' then
      perform protokoll_schreiben((a->>'company_id')::uuid, 'kommentar.geloescht', 'plan_kommentare', (a->>'id')::uuid,
        jsonb_build_object('employee_id', a->'employee_id', 'tag', a->'tag'));
    end if;

  elsif tg_table_name = 'leave_balances' then
    if tg_op = 'UPDATE' then
      -- v_korrektur bucht `book_v_days` mit eigenem Eintrag.
      foreach feld in array array['entitlement', 'carried_over', 'v_entitlement', 'v_carried_over'] loop
        if a->feld is distinct from n->feld then
          felder := felder || jsonb_build_object(feld, jsonb_build_array(a->feld, n->feld));
        end if;
      end loop;
      if felder <> '{}'::jsonb then
        perform protokoll_schreiben((n->>'company_id')::uuid, 'konto.geaendert', 'leave_balances', (n->>'id')::uuid,
          jsonb_build_object('employee_id', n->'employee_id', 'jahr', n->'year', 'felder', felder));
      end if;
    end if;

  elsif tg_table_name = 'announcements' then
    if tg_op = 'INSERT' then
      perform protokoll_schreiben((n->>'company_id')::uuid, 'mitteilung.erstellt', 'announcements', (n->>'id')::uuid,
        jsonb_build_object('titel', n->'title'));
    elsif tg_op = 'UPDATE' then
      if a->'title' is distinct from n->'title' or a->'body' is distinct from n->'body' or a->'active' is distinct from n->'active' then
        perform protokoll_schreiben((n->>'company_id')::uuid, 'mitteilung.geaendert', 'announcements', (n->>'id')::uuid,
          jsonb_build_object('titel', n->'title', 'aktiv', n->'active'));
      end if;
    else
      perform protokoll_schreiben((a->>'company_id')::uuid, 'mitteilung.geloescht', 'announcements', (a->>'id')::uuid,
        jsonb_build_object('titel', a->'title'));
    end if;

  elsif tg_table_name = 'staffing_rules' then
    if coalesce(n, a)->>'key' = 'urlaubssperre' then
      if tg_op = 'UPDATE' and a->'value' is not distinct from n->'value' and a->'active' is not distinct from n->'active' then
        return null;
      end if;
      perform protokoll_schreiben((coalesce(n, a)->>'company_id')::uuid,
        case tg_op when 'INSERT' then 'sperre.erstellt' when 'UPDATE' then 'sperre.geaendert' else 'sperre.geloescht' end,
        'staffing_rules', (coalesce(n, a)->>'id')::uuid,
        jsonb_build_object('von', coalesce(n, a)->'value'->'start', 'bis', coalesce(n, a)->'value'->'end',
                           'grund', coalesce(n, a)->'value'->'reason', 'aktiv', coalesce(n, a)->'active'));
    elsif tg_op <> 'UPDATE' or a->'value' is distinct from n->'value' or a->'active' is distinct from n->'active' then
      perform protokoll_schreiben((coalesce(n, a)->>'company_id')::uuid, 'regel.geaendert', 'staffing_rules',
        (coalesce(n, a)->>'id')::uuid, jsonb_build_object('regel', coalesce(n, a)->'key'));
    end if;
  end if;

  return null;
exception when others then
  return null;
end;
$$;

revoke all on function public.protokoll_aenderung() from public, anon, authenticated;

create or replace trigger protokoll_leave_requests after insert or update or delete on public.leave_requests
  for each row execute function public.protokoll_aenderung();

create or replace trigger protokoll_shift_assignments after insert or update or delete on public.shift_assignments
  for each row execute function public.protokoll_aenderung();

create or replace trigger protokoll_plan_kommentare after insert or delete on public.plan_kommentare
  for each row execute function public.protokoll_aenderung();

create or replace trigger protokoll_leave_balances after update on public.leave_balances
  for each row execute function public.protokoll_aenderung();

create or replace trigger protokoll_announcements after insert or update or delete on public.announcements
  for each row execute function public.protokoll_aenderung();

create or replace trigger protokoll_staffing_rules after insert or update or delete on public.staffing_rules
  for each row execute function public.protokoll_aenderung();

/**
 * Aus der App gemeldet: Anmeldung, Abmeldung, angezeigte Fehlermeldungen.
 * Nur feste Arten, gekürzte Texte, höchstens 40 Meldungen je Person und
 * zehn Minuten – eine Endlosschleife im Browser kann das Protokoll nicht
 * fluten.
 */
create or replace function public.protokoll_melden(p_art text, p_text text default null, p_seite text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  firma uuid := auth_company_id();
begin
  if auth.uid() is null or firma is null then
    return;
  end if;
  if p_art not in ('anmeldung', 'abmeldung', 'abmeldung.inaktiv', 'fehler.anzeige', 'fehler.absturz') then
    return;
  end if;
  if (select count(*) from audit_logs l
       where l.actor_id = auth.uid()
         and l.created_at > now() - interval '10 minutes'
         and (l.action like 'fehler.%' or l.action like 'anmeldung%' or l.action like 'abmeldung%')) >= 40 then
    return;
  end if;
  perform protokoll_schreiben(firma, p_art, null, null,
    jsonb_build_object('text', left(p_text, 500), 'seite', left(p_seite, 200)));
end;
$$;

revoke all on function public.protokoll_melden(text, text, text) from public, anon;
grant execute on function public.protokoll_melden(text, text, text) to authenticated;

/**
 * Fehlgeschlagene Anmeldung – nur vom Server (Service-Rolle) aufgerufen.
 * Protokolliert wird nur, wenn es die Adresse in einer Firma gibt; sonst
 * gäbe es niemanden, dem der Eintrag gehört.
 */
create or replace function public.protokoll_fehlanmeldung(p_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  firma uuid;
begin
  select p.company_id into firma
    from profiles p
   where lower(p.email) = lower(trim(p_email))
   limit 1;
  if firma is null then
    return;
  end if;
  perform protokoll_schreiben(firma, 'anmeldung.fehlgeschlagen', null, null,
    jsonb_build_object('email', left(lower(trim(p_email)), 200)));
end;
$$;

revoke all on function public.protokoll_fehlanmeldung(text) from public, anon, authenticated;
grant execute on function public.protokoll_fehlanmeldung(text) to service_role;

-- ---------------------------------------------------------------------------
-- Lesen
-- ---------------------------------------------------------------------------

-- Direkt lesen darf die Tabelle nur noch, wer Protokoll-Zugang hat (die
-- App liest ohnehin nur über protokoll_liste()).
alter policy "Protokoll liest Admin" on public.audit_logs
  using (company_id = public.protokoll_firma());

create or replace function public.protokoll_liste(
  p_tage integer default 7,
  p_art text default null,
  p_vor timestamptz default null,
  p_limit integer default 150
)
returns table(id uuid, zeit timestamptz, aktion text, akteur text, betroffen text, details jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  firma uuid := protokoll_firma();
begin
  if firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  with eintrag as (
    select l.*,
           case
             when l.payload->>'employee_id' ~ '^[0-9a-f-]{36}$' then (l.payload->>'employee_id')::uuid
             when l.entity = 'employees' then l.entity_id
             when l.entity = 'leave_requests' then (select r.employee_id from leave_requests r where r.id = l.entity_id)
             when l.entity = 'absences' then (select x.employee_id from absences x where x.id = l.entity_id)
             when l.entity = 'fehlzeiten' then (select f.employee_id from fehlzeiten f where f.id = l.entity_id)
             when l.entity = 'leave_balances' then (select b.employee_id from leave_balances b where b.id = l.entity_id)
             when l.entity = 'age_leave_grants' then (select g.employee_id from age_leave_grants g where g.id = l.entity_id)
           end as person
      from audit_logs l
     where l.company_id = firma
       and l.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_tage, 7), 730)))
       and (p_vor is null or l.created_at < p_vor)
       and (
         p_art is null
         or (p_art = 'anmeldung' and (l.action like 'anmeldung%' or l.action like 'abmeldung%'))
         or (p_art = 'fehler' and l.action like 'fehler.%')
         or (p_art = 'aenderung' and l.action not like 'anmeldung%' and l.action not like 'abmeldung%'
                                 and l.action not like 'fehler.%')
       )
     order by l.created_at desc
     limit greatest(1, least(coalesce(p_limit, 150), 500))
  )
  select e.id,
         e.created_at,
         e.action,
         nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
         nullif(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), ''),
         e.payload
    from eintrag e
    left join profiles p on p.id = e.actor_id
    left join employees m on m.id = e.person
   order by e.created_at desc;
end;
$$;

revoke all on function public.protokoll_liste(integer, text, timestamptz, integer) from public, anon;
grant execute on function public.protokoll_liste(integer, text, timestamptz, integer) to authenticated;

/** Kopfzeile der Protokollseite: wie viel ist im Zeitraum passiert. */
create or replace function public.protokoll_zahlen(p_tage integer default 7)
returns table(anmeldungen bigint, personen bigint, aenderungen bigint, fehler bigint, fehlanmeldungen bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  firma uuid := protokoll_firma();
begin
  if firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  select count(*) filter (where l.action = 'anmeldung'),
         count(distinct l.actor_id) filter (where l.action = 'anmeldung'),
         count(*) filter (where l.action not like 'anmeldung%' and l.action not like 'abmeldung%' and l.action not like 'fehler.%'),
         count(*) filter (where l.action like 'fehler.%'),
         count(*) filter (where l.action = 'anmeldung.fehlgeschlagen')
    from audit_logs l
   where l.company_id = firma
     and l.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_tage, 7), 730)));
end;
$$;

revoke all on function public.protokoll_zahlen(integer) from public, anon;
grant execute on function public.protokoll_zahlen(integer) to authenticated;
