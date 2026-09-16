-- Ausbildungsplanung und Besetzungsbedarf je Funktion.
--
-- Beides fehlte noch, damit die Ersatzsuche aus Phase 6 ueberhaupt etwas
-- zu pruefen hat: ohne einen Eintrag in shift_qualification_needs gibt es
-- keine Anforderung und damit auch keine Luecke.

-- ---------------------------------------------------------------------
-- Besetzungsbedarf setzen
-- ---------------------------------------------------------------------

-- Eine 0 loescht den Eintrag, statt eine Anforderung von null Personen zu
-- hinterlassen -- das waere dasselbe wie keine Anforderung, aber eine
-- Zeile, die man spaeter suchen muss.
create or replace function set_shift_qualification_need(
  p_shift_id uuid,
  p_qualification_id uuid,
  p_minimum int
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf den Besetzungsbedarf festlegen.';
  end if;
  if p_minimum is null or p_minimum < 0 or p_minimum > 99 then
    raise exception 'Der Bedarf muss eine Zahl zwischen 0 und 99 sein.';
  end if;
  if not exists (select 1 from shifts s where s.id = p_shift_id and s.company_id = firma) then
    raise exception 'Schicht nicht gefunden.';
  end if;
  if not exists (
    select 1 from qualifications q where q.id = p_qualification_id and q.company_id = firma
  ) then
    raise exception 'Qualifikation nicht gefunden.';
  end if;

  if p_minimum = 0 then
    delete from shift_qualification_needs
     where shift_id = p_shift_id and qualification_id = p_qualification_id;
    return;
  end if;

  insert into shift_qualification_needs (company_id, shift_id, qualification_id, minimum)
  values (firma, p_shift_id, p_qualification_id, p_minimum)
  on conflict (shift_id, qualification_id) do update set minimum = excluded.minimum;
end;
$$;

revoke execute on function set_shift_qualification_need(uuid, uuid, int) from public, anon;
grant execute on function set_shift_qualification_need(uuid, uuid, int) to authenticated;

-- Die vollstaendige Matrix Schicht x Funktion, auch wo noch nichts
-- hinterlegt ist -- sonst muesste das Formular die Luecken selbst raten.
create or replace function shift_qualification_matrix()
returns table (
  shift_id uuid,
  shift_name text,
  qualification_id uuid,
  qualification_label text,
  minimum int
)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, q.id, q.label, coalesce(n.minimum, 0)::int
    from shifts s
    cross join qualifications q
    left join shift_qualification_needs n
      on n.shift_id = s.id and n.qualification_id = q.id
   where s.company_id = auth_company_id()
     and s.active
     and q.company_id = auth_company_id()
     and q.active
   order by s.name, q.sort_order nulls last, q.label;
$$;

revoke execute on function shift_qualification_matrix() from public, anon;
grant execute on function shift_qualification_matrix() to authenticated;

-- ---------------------------------------------------------------------
-- Ausbildungsplanung
-- ---------------------------------------------------------------------

-- Abschnitte und Einsaetze der Auszubildenden. Bewusst getrennt vom
-- Schichtplan: ein Ausbildungsabschnitt ist ein Zeitraum in einem
-- Bereich, keine Tageszuweisung. Wer waehrend eines Abschnitts in einer
-- Schicht mitlaeuft, bekommt zusaetzlich eine Schicht hinterlegt -- der
-- Schichtplan selbst bleibt unberuehrt.
create table if not exists training_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  area text not null,
  shift_id uuid references shifts (id) on delete set null,
  note text,
  status text not null default 'geplant'
    check (status in ('geplant', 'laeuft', 'abgeschlossen', 'abgebrochen')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

comment on table training_assignments is
  'Ausbildungsabschnitte und Einsaetze. Zeitraeume, keine Tageszuweisungen '
  '-- der Schichtplan bleibt davon unberuehrt.';

create index if not exists training_assignments_zeitraum_idx
  on training_assignments (company_id, start_date, end_date);

alter table training_assignments enable row level security;

-- Lesen darf jeder im Unternehmen den eigenen Plan; die Fuehrung alles.
drop policy if exists "Ausbildungsplan lesen" on training_assignments;
create policy "Ausbildungsplan lesen" on training_assignments
  for select using (
    company_id = auth_company_id()
    and (is_leadership() or employee_id = auth_employee_id())
  );

drop policy if exists "Ausbildungsplan pflegt Fuehrung" on training_assignments;
create policy "Ausbildungsplan pflegt Fuehrung" on training_assignments
  for all using (company_id = auth_company_id() and is_leadership())
  with check (company_id = auth_company_id() and is_leadership());

create or replace function save_training_assignment(
  p_id uuid,
  p_employee_id uuid,
  p_start date,
  p_end date,
  p_area text,
  p_shift_id uuid default null,
  p_note text default null,
  p_status text default 'geplant'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  firma uuid := auth_company_id();
  ergebnis uuid;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen die Ausbildung planen.';
  end if;
  if coalesce(trim(p_area), '') = '' then
    raise exception 'Bitte einen Ausbildungsbereich angeben.';
  end if;
  if p_start is null or p_end is null then
    raise exception 'Bitte Beginn und Ende angeben.';
  end if;
  if p_end < p_start then
    raise exception 'Das Ende darf nicht vor dem Beginn liegen.';
  end if;
  if not exists (
    select 1 from employees e where e.id = p_employee_id and e.company_id = firma
  ) then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  if p_id is null then
    insert into training_assignments (
      company_id, employee_id, start_date, end_date, area, shift_id, note, status
    )
    values (
      firma, p_employee_id, p_start, p_end, trim(p_area), p_shift_id,
      nullif(trim(p_note), ''), coalesce(p_status, 'geplant')
    )
    returning id into ergebnis;
  else
    update training_assignments
       set employee_id = p_employee_id,
           start_date = p_start,
           end_date = p_end,
           area = trim(p_area),
           shift_id = p_shift_id,
           note = nullif(trim(p_note), ''),
           status = coalesce(p_status, 'geplant'),
           updated_at = now()
     where id = p_id and company_id = firma
    returning id into ergebnis;
    if ergebnis is null then
      raise exception 'Abschnitt nicht gefunden.';
    end if;
  end if;

  return ergebnis;
end;
$$;

revoke execute on function save_training_assignment(uuid, uuid, date, date, text, uuid, text, text)
  from public, anon;
grant execute on function save_training_assignment(uuid, uuid, date, date, text, uuid, text, text)
  to authenticated;

create or replace function delete_training_assignment(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;
  delete from training_assignments where id = p_id and company_id = auth_company_id();
end;
$$;

revoke execute on function delete_training_assignment(uuid) from public, anon;
grant execute on function delete_training_assignment(uuid) to authenticated;

-- Der Plan eines Zeitraums, samt Namen und geplanten Abwesenheiten.
-- Letztere kommen aus derselben Quelle wie ueberall sonst
-- (employees_absent_on), damit ein Abschnitt nicht als bespielt erscheint,
-- waehrend die Person im Urlaub ist.
create or replace function training_plan(p_from date, p_to date)
returns table (
  id uuid,
  employee_id uuid,
  name text,
  start_date date,
  end_date date,
  area text,
  shift_id uuid,
  shift_name text,
  note text,
  status text,
  abwesend_tage int
)
language sql stable security definer set search_path = public as $$
  select
    t.id, t.employee_id, e.first_name || ' ' || e.last_name,
    t.start_date, t.end_date, t.area, t.shift_id, s.name, t.note, t.status,
    -- Wie viele Tage des Abschnitts faellt die Person aus? Gezaehlt wird
    -- ueber employees_absent_on() -- dieselbe Quelle wie im Schichtplan
    -- und in der Auswertung, damit ein Abschnitt nicht als bespielt
    -- erscheint, waehrend die Person im Urlaub ist.
    (select count(*)::int
       from generate_series(greatest(t.start_date, p_from),
                            least(t.end_date, p_to), '1 day') g
      where exists (select 1 from employees_absent_on(g::date) ab
                     where ab.employee_id = t.employee_id))
  from training_assignments t
  join employees e on e.id = t.employee_id
  left join shifts s on s.id = t.shift_id
  where t.company_id = auth_company_id()
    and t.start_date <= p_to
    and t.end_date >= p_from
  order by e.last_name, t.start_date;
$$;

revoke execute on function training_plan(date, date) from public, anon;
grant execute on function training_plan(date, date) to authenticated;
