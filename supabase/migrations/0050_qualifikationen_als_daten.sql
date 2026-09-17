-- Qualifikationen als Daten statt als Enum.
--
-- Bisher ist `qualification` ein Postgres-Enum mit fünf festen Werten,
-- gespiegelt in src/lib/qualifications.ts. Eine sechste Funktion
-- aufzunehmen bräuchte also einen Code-Eingriff plus Migration -- und
-- jedes Unternehmen bekäme dieselben fünf, ob sie passen oder nicht.
--
-- Wichtig für den Umbau: die Spalte employees.qualifications bleibt
-- vorerst stehen. Sie wird nicht mehr gelesen, ist aber der Rückweg,
-- falls beim Übernehmen etwas übersehen wurde. Entfernt wird sie erst in
-- einer späteren Migration nach ausdrücklicher Freigabe.

create table if not exists qualifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  key text not null,
  label text not null,
  active boolean not null default true,
  sort_order int,
  created_at timestamptz not null default now(),
  unique (company_id, key)
);

comment on table qualifications is
  'Funktionen und Befähigungen je Unternehmen -- Messwarte, Labor, B-Schein '
  'und was der Betrieb sonst braucht. Ersetzt das feste Enum.';

create table if not exists employee_qualifications (
  employee_id uuid not null references employees (id) on delete cascade,
  qualification_id uuid not null references qualifications (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employee_id, qualification_id)
);

comment on table employee_qualifications is
  'Wer kann was. Eine Person kann mehrere Funktionen abdecken.';

-- Wie viele einer Funktion eine Schicht mindestens braucht. Fehlt ein
-- Eintrag, gibt es für diese Kombination keine Anforderung -- die
-- Ersatzsuche prüft dann nur die Kopfzahl, wie bisher.
create table if not exists shift_qualification_needs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  shift_id uuid not null references shifts (id) on delete cascade,
  qualification_id uuid not null references qualifications (id) on delete cascade,
  minimum smallint not null default 1 check (minimum >= 0),
  created_at timestamptz not null default now(),
  unique (shift_id, qualification_id)
);

comment on table shift_qualification_needs is
  'Mindestbedarf je Schicht und Funktion. Ohne Eintrag keine Anforderung.';

create index if not exists employee_qualifications_qualification_idx
  on employee_qualifications (qualification_id);
create index if not exists shift_qualification_needs_company_idx
  on shift_qualification_needs (company_id);

-- RLS nach dem Muster der übrigen Tabellen: lesen im eigenen
-- Unternehmen, pflegen nur die Administration. employee_qualifications
-- trägt selbst keine company_id, deshalb läuft die Prüfung über die
-- zugehörige Personalzeile.
alter table qualifications             enable row level security;
alter table employee_qualifications    enable row level security;
alter table shift_qualification_needs  enable row level security;

drop policy if exists "Qualifikationen liest das Unternehmen" on qualifications;
create policy "Qualifikationen liest das Unternehmen" on qualifications
  for select using (company_id = auth_company_id());

drop policy if exists "Qualifikationen pflegt Admin" on qualifications;
create policy "Qualifikationen pflegt Admin" on qualifications
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

drop policy if exists "Zuordnung liest das Unternehmen" on employee_qualifications;
create policy "Zuordnung liest das Unternehmen" on employee_qualifications
  for select using (exists (
    select 1 from employees e
     where e.id = employee_qualifications.employee_id
       and e.company_id = auth_company_id()
  ));

drop policy if exists "Zuordnung pflegt Fuehrung" on employee_qualifications;
create policy "Zuordnung pflegt Fuehrung" on employee_qualifications
  for all using (exists (
    select 1 from employees e
     where e.id = employee_qualifications.employee_id
       and e.company_id = auth_company_id()
  ) and is_leadership())
  with check (exists (
    select 1 from employees e
     where e.id = employee_qualifications.employee_id
       and e.company_id = auth_company_id()
  ) and is_leadership());

drop policy if exists "Bedarf liest das Unternehmen" on shift_qualification_needs;
create policy "Bedarf liest das Unternehmen" on shift_qualification_needs
  for select using (company_id = auth_company_id());

drop policy if exists "Bedarf pflegt Admin" on shift_qualification_needs;
create policy "Bedarf pflegt Admin" on shift_qualification_needs
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

-- Bestand übernehmen: je Unternehmen die fünf bisherigen Werte anlegen
-- und die vorhandenen Zuordnungen unverändert übertragen. Beides ist
-- wiederholbar -- ein zweiter Lauf ändert nichts.
insert into qualifications (company_id, key, label, sort_order)
select c.id, v.key, v.label, v.sort_order
  from companies c
  cross join (values
    ('messwarte',               'Messwarte',      1),
    ('labor',                   'Labor',          2),
    ('lager',                   'Lager',          3),
    ('anlagenfahrer',           'Anlagenfahrer',  4),
    ('b_schein_verantwortlich', 'B-Schein',       5)
  ) as v(key, label, sort_order)
on conflict (company_id, key) do nothing;

insert into employee_qualifications (employee_id, qualification_id)
select e.id, q.id
  from employees e
  cross join lateral unnest(e.qualifications) as vorhanden(wert)
  join qualifications q
    on q.company_id = e.company_id
   and q.key = vorhanden.wert::text
on conflict do nothing;

comment on column employees.qualifications is
  'ABGELÖST durch employee_qualifications. Bleibt vorerst als Rückweg '
  'stehen und wird nicht mehr gelesen; Entfernen erst nach Freigabe.';
