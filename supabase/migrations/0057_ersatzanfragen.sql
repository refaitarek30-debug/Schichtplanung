-- Ersatzanfragen mit Antwortweg.
--
-- Wichtig: eine Anfrage plant niemanden ein. Erst die Zusage und die
-- anschliessende Bestaetigung durch die Fuehrung setzen die Besetzung --
-- und zwar ueber plan_set_shift(), das bereits laufende Urlaubsantraege
-- splittet und Abwesenheiten raeumt. Hier wird nichts davon nachgebaut.
--
-- Benachrichtigt wird ueber die vorhandene Tabelle notifications, die
-- type/title/body/related_entity/related_id schon mitbringt.

create table if not exists replacement_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  date date not null,
  shift_id uuid not null references shifts (id) on delete cascade,
  qualification_id uuid references qualifications (id) on delete set null,
  -- Wer ausfaellt. Leer, wenn es allgemein an Besetzung fehlt.
  absent_employee_id uuid references employees (id) on delete set null,
  asked_employee_id uuid not null references employees (id) on delete cascade,
  status text not null default 'offen'
    check (status in ('offen', 'angenommen', 'abgelehnt', 'zurueckgezogen')),
  note text,
  requested_by uuid references employees (id) on delete set null,
  requested_at timestamptz not null default now(),
  answered_at timestamptz,
  answer_note text,
  -- Wurde nach der Zusage tatsaechlich eingeplant? Getrennt vom Status,
  -- weil Zusage und Einplanung zwei Schritte sind.
  assigned_at timestamptz,
  -- Eine offene Anfrage je Person, Tag und Schicht reicht.
  unique (asked_employee_id, date, shift_id)
);

comment on table replacement_requests is
  'Anfragen an moegliche Ersatzleute. Eine Anfrage plant niemanden ein -- '
  'die Besetzung entsteht erst durch plan_set_shift() nach der Zusage.';

create index if not exists replacement_requests_offen_idx
  on replacement_requests (company_id, status, date);

alter table replacement_requests enable row level security;

-- Lesen darf die Fuehrung alles, jeder Einzelne seine eigenen Anfragen.
drop policy if exists "Ersatzanfragen lesen" on replacement_requests;
create policy "Ersatzanfragen lesen" on replacement_requests
  for select using (
    company_id = auth_company_id()
    and (is_leadership() or asked_employee_id = auth_employee_id())
  );

-- Anlegen und zuruecknehmen nur die Fuehrung. Das Beantworten laeuft
-- ueber eine eigene Funktion, nicht ueber eine Schreibpolicy -- sonst
-- koennte jemand den Status auf beliebige Werte setzen.
drop policy if exists "Ersatzanfragen stellt Fuehrung" on replacement_requests;
create policy "Ersatzanfragen stellt Fuehrung" on replacement_requests
  for all using (company_id = auth_company_id() and is_leadership())
  with check (company_id = auth_company_id() and is_leadership());

-- Anfrage stellen. Prueft die Eignung noch einmal serverseitig: das
-- ausgegraute Kaestchen im Dialog sichert nichts.
create or replace function request_replacement(
  p_date date,
  p_shift_id uuid,
  p_asked_employee_id uuid,
  p_qualification_id uuid default null,
  p_absent_employee_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  firma uuid := auth_company_id();
  eignung record;
  schicht_name text;
  neue_id uuid;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen Ersatz anfragen.';
  end if;

  select * into eignung
    from replacement_candidates(p_date, p_shift_id, p_qualification_id) k
   where k.employee_id = p_asked_employee_id;

  if eignung.employee_id is null then
    raise exception 'Diese Person gehört nicht zum Unternehmen.';
  end if;
  if not eignung.auswaehlbar then
    raise exception 'Diese Person kommt nicht in Frage: %', eignung.grund;
  end if;

  select s.name into schicht_name from shifts s where s.id = p_shift_id;

  insert into replacement_requests (
    company_id, date, shift_id, qualification_id,
    absent_employee_id, asked_employee_id, requested_by, note
  )
  values (
    firma, p_date, p_shift_id, p_qualification_id,
    p_absent_employee_id, p_asked_employee_id, auth_employee_id(),
    nullif(trim(p_note), '')
  )
  on conflict (asked_employee_id, date, shift_id) do update
    set status = 'offen', requested_at = now(), answered_at = null,
        answer_note = null, note = excluded.note
  returning id into neue_id;

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  values (
    firma, p_asked_employee_id, 'replacement_requested',
    'Einspringen am ' || to_char(p_date, 'DD.MM.YYYY') || '?',
    'Möchtest du am ' || to_char(p_date, 'DD.MM.YYYY') || ' für die '
      || coalesce(schicht_name, 'Schicht') || ' einspringen?'
      || coalesce(' ' || nullif(trim(p_note), ''), ''),
    'replacement_request', neue_id
  );

  return neue_id;
end;
$$;

revoke execute on function request_replacement(date, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function request_replacement(date, uuid, uuid, uuid, uuid, text) to authenticated;

-- Antworten darf nur die angefragte Person, und nur solange die Anfrage
-- offen ist. Eine Zusage plant bewusst noch nicht ein.
create or replace function answer_replacement_request(
  p_request_id uuid,
  p_annehmen boolean,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r replacement_requests;
  person text;
  schicht_name text;
begin
  select * into r from replacement_requests where id = p_request_id;
  if r.id is null or r.company_id is distinct from auth_company_id() then
    raise exception 'Anfrage nicht gefunden.';
  end if;
  if r.asked_employee_id is distinct from auth_employee_id() then
    raise exception 'Diese Anfrage richtet sich an jemand anderen.';
  end if;
  if r.status <> 'offen' then
    raise exception 'Diese Anfrage ist bereits beantwortet.';
  end if;

  update replacement_requests
     set status = case when p_annehmen then 'angenommen' else 'abgelehnt' end,
         answered_at = now(),
         answer_note = nullif(trim(p_note), '')
   where id = p_request_id;

  select e.first_name || ' ' || e.last_name into person
    from employees e where e.id = r.asked_employee_id;
  select s.name into schicht_name from shifts s where s.id = r.shift_id;

  -- Die anfragende Person erfährt die Antwort. Ohne das müsste die
  -- Schichtleitung die Liste immer wieder von Hand durchsehen.
  if r.requested_by is not null then
    insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
    values (
      r.company_id, r.requested_by,
      case when p_annehmen then 'replacement_accepted' else 'replacement_declined' end,
      person || ' hat ' || case when p_annehmen then 'zugesagt' else 'abgelehnt' end,
      person || ' hat die Anfrage für die ' || coalesce(schicht_name, 'Schicht')
        || ' am ' || to_char(r.date, 'DD.MM.YYYY') || ' '
        || case when p_annehmen then 'angenommen.' else 'abgelehnt.' end
        || case when p_annehmen
                then ' Eingeplant ist damit noch niemand – das geschieht erst mit der Bestätigung.'
                else ' Du kannst die nächste geeignete Person anfragen.' end,
      'replacement_request', r.id
    );
  end if;
end;
$$;

revoke execute on function answer_replacement_request(uuid, boolean, text) from public, anon;
grant execute on function answer_replacement_request(uuid, boolean, text) to authenticated;

-- Nach der Zusage tatsaechlich einplanen. Ruft plan_set_shift() auf,
-- statt die Zuweisung nachzubauen -- dort werden laufende
-- Urlaubsantraege gesplittet und Abwesenheiten geraeumt.
create or replace function confirm_replacement(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r replacement_requests;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;

  select * into r from replacement_requests where id = p_request_id;
  if r.id is null or r.company_id is distinct from auth_company_id() then
    raise exception 'Anfrage nicht gefunden.';
  end if;
  if r.status <> 'angenommen' then
    raise exception 'Erst nach einer Zusage lässt sich die Besetzung setzen.';
  end if;

  perform plan_set_shift(r.asked_employee_id, r.date, r.shift_id);

  update replacement_requests set assigned_at = now() where id = p_request_id;
end;
$$;

revoke execute on function confirm_replacement(uuid) from public, anon;
grant execute on function confirm_replacement(uuid) to authenticated;
