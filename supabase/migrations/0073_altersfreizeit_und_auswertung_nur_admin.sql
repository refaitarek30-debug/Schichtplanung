-- Altersfreizeit und Auswertung nur noch fuer die Administration.
--
-- Beide Bereiche standen bisher der gesamten Fuehrung offen, also auch der
-- Schichtleitung. Das soll nicht mehr sein: ueber die Altersfreizeit
-- entscheidet die Administration, und die Auswertung wertet Kranktage je
-- Person aus -- eine Zahl, die nicht in jede Hand gehoert.
--
-- Die Navigation auszublenden reicht dafuer nicht. Sie ist nur Kosmetik; wer
-- die Adresse kennt, ruft die Seite trotzdem auf, und der Browser kann die
-- RPC ohnehin direkt rufen. Die Grenze muss deshalb hier stehen, in der
-- Datenbank. Die Seiten im Frontend pruefen zusaetzlich, das spart nur eine
-- Seite, auf der sonst bloss eine Fehlermeldung staende.
--
-- Bewusst NICHT geaendert:
--   * `personal_details leadership select` -- das Geburtsdatum bleibt fuer
--     die Schichtleitung lesbar. Das war eine eigene Entscheidung (Anzeige
--     in der Mitarbeiterliste) und haengt nicht an der Altersfreizeit.
--   * `my_age_leave()` -- die eigene Lage sieht weiterhin jede Person
--     selbst, unabhaengig von der Rolle.
--   * `age_leave own select` -- dito fuer die eigene Zeile in der Tabelle.

begin;

-- ---------------------------------------------------------------------------
-- 1) Auswertung
-- ---------------------------------------------------------------------------
-- Unveraendert bis auf den Waechter: aus is_leadership() wird is_admin().
create or replace function absence_report(
  p_year int,
  p_month int default null
)
returns table (
  employee_id uuid,
  name text,
  rotation_team text,
  monat int,
  soll_tage int,
  anwesend_tage int,
  krank_tage int,
  urlaub_tage int,
  v_tage int,
  sonderurlaub_tage int,
  altersfreizeit_tage int,
  bildungsurlaub_tage int,
  seminar_tage int,
  sonstige_tage int,
  ausfall_tage int,
  soll_stunden numeric,
  anwesend_stunden numeric,
  krank_stunden numeric,
  ausfall_stunden numeric,
  ausfallquote numeric,
  gesundheitsrate numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  firma uuid := auth_company_id();
  von date;
  bis date;
  stunden numeric;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf Auswertungen sehen.';
  end if;
  if p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  if p_month is not null and (p_month < 1 or p_month > 12) then
    raise exception 'Ungültiger Monat.';
  end if;

  von := make_date(p_year, coalesce(p_month, 1), 1);
  bis := case when p_month is null
              then make_date(p_year, 12, 31)
              else (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
         end;

  stunden := company_rule_number('stunden_pro_arbeitstag', 'stunden', 8);

  return query
  with arbeitstage as (
    select
      e.id as emp,
      e.first_name || ' ' || e.last_name as voller_name,
      e.rotation_team::text as team,
      d::date as tag,
      extract(month from d)::int as m
    from employees e
    cross join generate_series(von, bis, interval '1 day') d
    where e.company_id = firma
      and e.active
      and is_planned_workday(e.id, d::date)
  ),
  -- Genau eine Kategorie je Tag. Erfasste Abwesenheit sticht Urlaub;
  -- ein genehmigter Urlaubstag, an dem jemand krankgemeldet ist, zaehlt
  -- als Kranktag und nicht doppelt.
  eingeteilt as (
    select
      a.emp, a.voller_name, a.team, a.m,
      coalesce(
        (select ab.type::text from absences ab
          where ab.employee_id = a.emp and ab.date = a.tag
          order by case ab.type::text
                     when 'krank' then 1
                     when 'sonderurlaub' then 2
                     when 'altersfreizeit' then 3
                     when 'bildungsurlaub' then 4
                     when 'schulung' then 5
                     else 6 end
          limit 1),
        (select case when r.kind = 'v_tag' then 'v_tag' else 'urlaub' end
           from leave_requests r
          where r.employee_id = a.emp
            and r.status = 'approved'
            and a.tag between r.start_date and r.end_date
          limit 1),
        'anwesend'
      ) as art
    from arbeitstage a
  ),
  gezaehlt as (
    select
      g.emp, g.voller_name, g.team, g.m,
      count(*)::int as soll,
      count(*) filter (where g.art = 'anwesend')::int       as anwesend,
      count(*) filter (where g.art = 'krank')::int          as krank,
      count(*) filter (where g.art = 'urlaub')::int         as urlaub,
      count(*) filter (where g.art = 'v_tag')::int          as v,
      count(*) filter (where g.art = 'sonderurlaub')::int   as su,
      count(*) filter (where g.art = 'altersfreizeit')::int as af,
      count(*) filter (where g.art = 'bildungsurlaub')::int as bu,
      count(*) filter (where g.art = 'schulung')::int       as seminar,
      count(*) filter (where g.art = 'sonstiges')::int      as sonstige
    from eingeteilt g
    group by g.emp, g.voller_name, g.team, g.m
  )
  select
    z.emp, z.voller_name, z.team, z.m,
    z.soll, z.anwesend, z.krank, z.urlaub, z.v, z.su, z.af, z.bu,
    z.seminar, z.sonstige,
    -- Ausfall ist der ungeplante Teil: Krankheit und Sonstiges. Urlaub,
    -- V-Tage, Sonderurlaub, Altersfreizeit und Bildungsurlaub sind
    -- geplante Abwesenheiten und keine Ausfaelle.
    (z.krank + z.sonstige) as ausfall,
    round(z.soll * stunden, 1),
    -- Seminar zaehlt als Anwesenheit: die Person arbeitet, nur woanders.
    -- So rechnet es auch die Excel-Vorlage.
    round((z.anwesend + z.seminar) * stunden, 1),
    round(z.krank * stunden, 1),
    round((z.krank + z.sonstige) * stunden, 1),
    case when (z.anwesend + z.seminar + z.krank + z.sonstige) = 0 then null
         else round(100.0 * (z.krank + z.sonstige)
                    / (z.anwesend + z.seminar + z.krank + z.sonstige), 1)
    end,
    -- Gesundheitsrate = Anwesenheit / (Anwesenheit + Ausfall) x 100.
    -- Anders als die Excel-Vorlage, die Kranktage nicht von der
    -- Anwesenheit abzieht und sie dadurch doppelt zaehlt.
    case when (z.anwesend + z.seminar + z.krank + z.sonstige) = 0 then null
         else round(100.0 * (z.anwesend + z.seminar)
                    / (z.anwesend + z.seminar + z.krank + z.sonstige), 1)
    end
  from gezaehlt z
  order by z.team nulls last, z.voller_name, z.m;
end;
$$;

comment on function absence_report(int, int) is
  'Ausfall und Anwesenheit je Person und Monat. Nur fuer die Administration. '
  'Gesamtbetrieb, Schicht und Jahr entstehen daraus durch Summieren -- eine '
  'eigene Funktion je Ebene waere eine zweite Wahrheit fuer dieselbe Zahl.';

revoke execute on function absence_report(int, int) from public, anon;
grant execute on function absence_report(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Altersfreizeit: Uebersicht und Festlegung
-- ---------------------------------------------------------------------------
-- Nur die beiden Waechter aendern sich. Die Rechnung selbst bleibt, wie sie
-- in 0071 steht -- insbesondere die Trennung zwischen "automatisch erkannt"
-- (nie gespeichert) und "bestaetigt" (nur das gilt).
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
  if not is_admin() then
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
  if not is_admin() then
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
-- 3) Direktes Lesen der bestaetigten Tage
-- ---------------------------------------------------------------------------
-- Ohne diesen Schritt bliebe die Tabelle fuer die Schichtleitung per
-- PostgREST lesbar, auch wenn die Uebersichtsfunktion sie abweist. Die
-- eigene Zeile bleibt fuer alle offen -- dafuer gibt es "age_leave own
-- select", die hier unberuehrt bleibt.
drop policy if exists "age_leave leadership select" on public.age_leave_grants;
create policy "age_leave admin select" on public.age_leave_grants
for select to authenticated
using (company_id = auth_company_id() and is_admin());

commit;
