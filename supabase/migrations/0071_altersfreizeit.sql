-- Altersfreizeit: Hinweis aus dem Geburtsdatum, Entscheidung durch die Führung.
--
-- Der Anspruch auf zusätzliche freie Tage ab einem bestimmten Alter steht in
-- Tarifvertrag oder Betriebsvereinbarung, nicht in dieser Anwendung. Die App
-- darf ihn deshalb NICHT selbst festlegen. Sie rechnet nur aus, bei wem sich
-- ein Blick lohnt -- entschieden wird von Hand.
--
-- Darum sind hier zwei Dinge sauber getrennt:
--
--   automatisch erkannt  -> wird NIE gespeichert. Ein reiner Hinweis, der bei
--                           jedem Aufruf neu aus dem Geburtsdatum gerechnet
--                           wird. Kein Feld, kein Anspruch, keine Wirkung.
--   bestätigt            -> steht in age_leave_grants, mit Person, Zeitpunkt
--                           und Begründung. Nur das gilt.
--
-- Die bestätigten Tage fliessen bewusst NICHT selbsttätig in
-- `leave_balances.entitlement`. Ein Urlaubskonto im Nachhinein maschinell zu
-- erhöhen wäre genau das eigenmächtige Festlegen, das hier ausgeschlossen
-- sein soll. Die Führung sieht den bestätigten Wert und trägt ihn bewusst
-- ins Konto ein.

begin;

-- ---------------------------------------------------------------------------
-- 1) Geburtsdatum: Leserecht für die Führung
-- ---------------------------------------------------------------------------
-- Bisher war personal_details streng auf die eigene Zeile beschränkt. Ohne
-- Leserecht kann die Führung den Altersanspruch nicht prüfen. Bewusst NUR
-- lesend und nur im eigenen Mandanten: ändern oder löschen darf das
-- Geburtsdatum weiterhin ausschliesslich die betroffene Person selbst. Die
-- bestehenden Richtlinien bleiben unangetastet, es kommt eine hinzu.

drop policy if exists "personal_details leadership select" on public.personal_details;
create policy "personal_details leadership select" on public.personal_details
for select to authenticated
using (company_id = auth_company_id() and is_leadership());

-- ---------------------------------------------------------------------------
-- 2) Bestätigte Altersfreizeit
-- ---------------------------------------------------------------------------
create table if not exists public.age_leave_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  year int not null,
  -- 0 ist eine gültige Entscheidung: "geprüft, kein Anspruch".
  confirmed_days numeric(4,1) not null default 0,
  note text,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint age_leave_grants_days_plausibel check (confirmed_days >= 0 and confirmed_days <= 60),
  constraint age_leave_grants_jahr_plausibel check (year between 2000 and 2100),
  unique (employee_id, year)
);

comment on table public.age_leave_grants is
  'Verbindlich bestätigte Altersfreizeit je Person und Jahr. Nur Eintraege hier gelten; der automatische Hinweis wird nirgends gespeichert.';
comment on column public.age_leave_grants.confirmed_days is
  'Von der Fuehrung festgelegte Zusatztage. 0 heisst geprueft und kein Anspruch.';

create index if not exists age_leave_grants_company_year_idx
  on public.age_leave_grants (company_id, year);

alter table public.age_leave_grants enable row level security;
alter table public.age_leave_grants force row level security;

-- Die betroffene Person darf ihren eigenen Stand sehen -- aber nicht setzen.
drop policy if exists "age_leave own select" on public.age_leave_grants;
create policy "age_leave own select" on public.age_leave_grants
for select to authenticated
using (company_id = auth_company_id() and employee_id = auth_employee_id());

drop policy if exists "age_leave leadership select" on public.age_leave_grants;
create policy "age_leave leadership select" on public.age_leave_grants
for select to authenticated
using (company_id = auth_company_id() and is_leadership());

-- Geschrieben wird ausschliesslich ueber confirm_age_leave(). Deshalb gibt es
-- bewusst KEINE insert/update/delete-Richtlinie: ohne sie weist RLS jeden
-- direkten Schreibversuch ab, auch den der Fuehrung.
revoke all on public.age_leave_grants from anon;
grant select on public.age_leave_grants to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Der Hinweis (nur Rechnung, keine Festlegung)
-- ---------------------------------------------------------------------------
-- Schwelle und Tagesvorschlag stehen hier an einer Stelle. Wer sie aendert,
-- aendert nur den Hinweis -- bereits bestaetigte Eintraege bleiben, wie sie
-- sind. Genau so soll es sein: eine getroffene Entscheidung darf sich nicht
-- rueckwirkend durch eine geaenderte Vorgabe verschieben.
create or replace function public.age_leave_hinweis(p_birth_date date, p_year int)
returns table (alter_im_jahr int, moeglich boolean, vorschlag_tage numeric)
language sql
immutable
set search_path = public
as $$
  select
    case when p_birth_date is null then null
         else (p_year - extract(year from p_birth_date))::int end,
    case when p_birth_date is null then false
         else (p_year - extract(year from p_birth_date)) >= 50 end,
    case when p_birth_date is null then 0::numeric
         when (p_year - extract(year from p_birth_date)) >= 50 then 10::numeric
         else 0::numeric end;
$$;

comment on function public.age_leave_hinweis(date, int) is
  'Reiner Hinweis: ab 50 Jahren im Kalenderjahr koennten rund 10 Zusatztage in Frage kommen. Kein Anspruch, nirgends gespeichert.';

-- ---------------------------------------------------------------------------
-- 4) Uebersicht fuer die Fuehrung
-- ---------------------------------------------------------------------------
-- Alle Funktionen hier sind SECURITY DEFINER, RLS greift in ihnen also nicht.
-- Der Mandant wird deshalb in JEDER Verknuepfung ausdruecklich geprueft, auch
-- wo er sich aus der Kette ohnehin ergaebe -- eine spaetere Umstellung der
-- Abfrage soll die Trennung nicht versehentlich aufheben.
create or replace function public.age_leave_overview(p_year int)
returns table (
  employee_id uuid,
  employee_name text,
  rotation_team text,
  birth_date date,
  alter_im_jahr int,
  automatisch_moeglich boolean,
  vorschlag_tage numeric,
  bestaetigt boolean,
  bestaetigte_tage numeric,
  bestaetigt_von text,
  bestaetigt_am timestamptz,
  notiz text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  return query
  select
    e.id,
    e.first_name || ' ' || e.last_name,
    e.rotation_team::text,
    pd.birth_date,
    h.alter_im_jahr,
    h.moeglich,
    h.vorschlag_tage,
    (g.id is not null),
    coalesce(g.confirmed_days, 0),
    case when g.confirmed_by is null then null
         else bp.first_name || ' ' || bp.last_name end,
    g.confirmed_at,
    g.note
  from public.employees e
  -- Das Geburtsdatum haengt am Login, nicht am Mitarbeiterdatensatz. Wer
  -- keinen Login hat oder nichts eingetragen hat, steht mit leerem Datum da.
  left join public.profiles p
    on p.employee_id = e.id and p.company_id = v_firma
  left join public.personal_details pd
    on pd.user_id = p.id and pd.company_id = v_firma
  left join public.age_leave_grants g
    on g.employee_id = e.id and g.year = p_year and g.company_id = v_firma
  left join public.profiles bp
    on bp.id = g.confirmed_by and bp.company_id = v_firma
  cross join lateral public.age_leave_hinweis(pd.birth_date, p_year) h
  where e.company_id = v_firma
    and e.active
  order by h.moeglich desc nulls last, e.last_name, e.first_name;
end;
$$;

revoke all on function public.age_leave_overview(int) from public, anon;
grant execute on function public.age_leave_overview(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Verbindlich bestaetigen
-- ---------------------------------------------------------------------------
create or replace function public.confirm_age_leave(
  p_employee_id uuid,
  p_year int,
  p_days numeric,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  v_vorher numeric;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;
  -- Mandant der Zielperson pruefen, nicht dem Aufruf glauben.
  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.company_id = v_firma
  ) then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  if p_days is null or p_days < 0 or p_days > 60 then
    raise exception 'Bitte eine Tageszahl zwischen 0 und 60 angeben.';
  end if;

  select confirmed_days into v_vorher
  from public.age_leave_grants
  where employee_id = p_employee_id and year = p_year;

  insert into public.age_leave_grants
    (company_id, employee_id, year, confirmed_days, note, confirmed_by, confirmed_at, updated_at)
  values
    (v_firma, p_employee_id, p_year, p_days, nullif(btrim(coalesce(p_note, '')), ''),
     auth.uid(), now(), now())
  on conflict (employee_id, year) do update
    set confirmed_days = excluded.confirmed_days,
        note           = excluded.note,
        confirmed_by   = excluded.confirmed_by,
        confirmed_at   = now(),
        updated_at     = now();

  -- Nachvollziehbar: wer hat wann von welchem auf welchen Wert gestellt.
  perform write_audit(
    v_firma,
    case when v_vorher is null then 'age_leave.confirmed' else 'age_leave.changed' end,
    'age_leave_grants',
    p_employee_id,
    jsonb_build_object('jahr', p_year, 'vorher', v_vorher, 'nachher', p_days)
  );
end;
$$;

revoke all on function public.confirm_age_leave(uuid, int, numeric, text) from public, anon;
grant execute on function public.confirm_age_leave(uuid, int, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Eigene Sicht
-- ---------------------------------------------------------------------------
create or replace function public.my_age_leave(p_year int)
returns table (
  alter_im_jahr int,
  automatisch_moeglich boolean,
  vorschlag_tage numeric,
  bestaetigt boolean,
  bestaetigte_tage numeric,
  bestaetigt_am timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ich uuid := auth_employee_id();
  v_firma uuid := auth_company_id();
  v_gebdat date;
begin
  if v_ich is null or v_firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  select pd.birth_date into v_gebdat
  from public.personal_details pd
  where pd.user_id = auth.uid() and pd.company_id = v_firma;

  return query
  select h.alter_im_jahr, h.moeglich, h.vorschlag_tage,
         (g.id is not null), coalesce(g.confirmed_days, 0), g.confirmed_at
  from public.age_leave_hinweis(v_gebdat, p_year) h
  left join public.age_leave_grants g
    on g.employee_id = v_ich and g.year = p_year and g.company_id = v_firma;
  -- Die Notiz der Fuehrung bleibt bewusst aussen vor: sie kann interne
  -- Erwaegungen enthalten und ist nicht fuer die betroffene Person gedacht.
end;
$$;

revoke all on function public.my_age_leave(int) from public, anon;
grant execute on function public.my_age_leave(int) to authenticated;

commit;
