-- =============================================================
-- 0237 · Team-Sichtbarkeit
--
-- Kolleginnen und Kollegen sehen Namen nur noch, wenn die Person sichtbar
-- sein darf. Leitung und Administration sehen weiter alles.
--
--  * Wer sich noch nie angemeldet hat (kein Profil), erscheint ohne Namen.
--  * Wer ausgeschieden ist, erscheint für Kollegen ohne Namen.
--  * Betrieb wählt `team_sichtbarkeit`: 'zustimmung' (Standard) oder 'alle'.
--    Bei 'zustimmung' entscheidet jede Person getrennt:
--      team_eigene – die eigene Schichtgruppe sieht mich,
--      team_andere – die anderen Schichtgruppen sehen mich.
--    Gegenseitig: Wer für eine Seite nein sagt, sieht diese Seite auch nur
--    ohne Namen.
--  * Ohne Namen heißt: kein Name, keine echte Kennung (eine je Betrachter
--    andere), kein Grund der Abwesenheit. Die Schichten bleiben, damit
--    Plan und Besetzung stimmen.
--  * Sperrbildschirm: `push_ohne_inhalt` schickt Mitteilungen ohne Inhalt.
--  * Datenschutzerklärung 2.41.
-- =============================================================

alter table public.privacy_settings
  add column if not exists team_eigene boolean,
  add column if not exists team_andere boolean,
  add column if not exists team_gefragt_am timestamptz,
  add column if not exists push_ohne_inhalt boolean not null default false;

alter table public.company_settings
  add column if not exists team_sichtbarkeit text not null default 'zustimmung';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_settings_team_sichtbarkeit_check') then
    alter table public.company_settings
      add constraint company_settings_team_sichtbarkeit_check check (team_sichtbarkeit in ('alle', 'zustimmung'));
  end if;
end $$;

-- Darf die angemeldete Person den Namen von p_ziel sehen?
create or replace function public.team_sicht(p_ziel uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  firma uuid := auth_company_id();
  ziel_firma uuid;
  ziel_team text;
  ziel_austritt date;
  hat_profil boolean := false;
  er_eigene boolean;
  er_andere boolean;
  modus text;
  mein_team text;
  ich_eigene boolean;
  ich_andere boolean;
begin
  if p_ziel is null or firma is null then
    return false;
  end if;
  if p_ziel = me or is_leadership() then
    return true;
  end if;

  select e.company_id, e.rotation_team::text, e.exit_date
    into ziel_firma, ziel_team, ziel_austritt
    from public.employees e where e.id = p_ziel;
  if ziel_firma is distinct from firma then
    return false;
  end if;
  if ziel_austritt is not null and ziel_austritt < current_date then
    return false;
  end if;

  select true, ps.team_eigene, ps.team_andere
    into hat_profil, er_eigene, er_andere
    from public.profiles p
    left join public.privacy_settings ps on ps.user_id = p.id and ps.company_id = firma
   where p.employee_id = p_ziel and p.company_id = firma
   limit 1;
  if not coalesce(hat_profil, false) then
    return false;
  end if;

  select cs.team_sichtbarkeit into modus from public.company_settings cs where cs.company_id = firma;
  if coalesce(modus, 'zustimmung') = 'alle' then
    return true;
  end if;

  select e.rotation_team::text into mein_team from public.employees e where e.id = me;
  select ps.team_eigene, ps.team_andere into ich_eigene, ich_andere
    from public.privacy_settings ps where ps.user_id = auth.uid() and ps.company_id = firma;

  if coalesce(ziel_team, '') = coalesce(mein_team, '') then
    return coalesce(er_eigene, false) and coalesce(ich_eigene, false);
  end if;
  return coalesce(er_andere, false) and coalesce(ich_andere, false);
end;
$function$;

revoke execute on function public.team_sicht(uuid) from public, anon;
grant execute on function public.team_sicht(uuid) to authenticated;

-- Schichtplan: Namen nur, wo team_sicht() es erlaubt (Rest wie 0232).
create or replace function public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
returns table(employee_id uuid, employee_name text, rotation_team text, personnel_number text, day date, shift_name text, shift_code text, absence_code text, is_me boolean, is_apprentice boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
  freigabe boolean := gruende_fuer_kollegen_erlaubt();
  feiertage_arbeiten boolean;
  bis date := p_from + (p_days - 1);
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team
  from public.employees e
  where e.id = me and e.company_id = p_company_id;

  select coalesce(cs.work_on_holidays, true) into feiertage_arbeiten
  from public.company_settings cs where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  with sichtbar as (
    select e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
           e.personnel_number, e.sort_order, e.is_apprentice,
           e.shift_id, e.rotation_pattern_id, e.rotation_offset_days,
           e.entry_date, e.exit_date,
           exists (select 1 from public.employee_gruppenwechsel w where w.employee_id = e.id) as wechselt,
           -- Name nur, wenn die Person sichtbar sein darf (0237): Leitung, ich selbst,
           -- sonst angemeldet, nicht ausgeschieden und – je nach Betrieb – mit Zustimmung.
           public.team_sicht(e.id) as name_frei,
           freigabe
             and coalesce(bool_or(ps.absence_visibility = 'shift'), false)
             and mein_team is not null and e.rotation_team = mein_team as grund_frei,
           freigabe
             and coalesce(bool_or(ps.sickness_visibility = 'shift'), false)
             and mein_team is not null and e.rotation_team = mein_team as krank_frei
    from public.employees e
    left join public.profiles sp
      on sp.employee_id = e.id and sp.company_id = p_company_id
    left join public.privacy_settings ps
      on ps.user_id = sp.id and ps.company_id = p_company_id
    where e.company_id = p_company_id
      and e.active
      and (e.entry_date is null or e.entry_date <= bis)
      and (e.exit_date is null or e.exit_date >= p_from)
    group by e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
             e.personnel_number, e.sort_order, e.is_apprentice,
             e.shift_id, e.rotation_pattern_id, e.rotation_offset_days,
             e.entry_date, e.exit_date
  ),
  muster as (
    select x.id, x.anchor_date, x.ord, x.shift_id,
           x.bis_pos - x.tage as von_pos, x.bis_pos, x.zyklus
      from (
        select p.id, p.anchor_date, st.ord,
               nullif(st.step ->> 'shift', '')::uuid as shift_id,
               (st.step ->> 'days')::int as tage,
               sum((st.step ->> 'days')::int) over (partition by p.id order by st.ord) as bis_pos,
               sum((st.step ->> 'days')::int) over (partition by p.id) as zyklus
          from public.rotation_patterns p
          cross join lateral jsonb_array_elements(p.steps) with ordinality as st(step, ord)
         where p.active
           and p.id in (select s.rotation_pattern_id from sichtbar s)
      ) x
  ),
  tage as (
    select e.id as emp, gs.day::date as tag,
           case when e.wechselt then gruppe_am(e.id, gs.day::date, e.rotation_team) else e.rotation_team end as team
      from sichtbar e
      cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  ),
  zelle as (
    select t.emp, t.tag, t.team,
           sa.employee_id is not null as zugewiesen,
           case
             when not ((e.entry_date is null or t.tag >= e.entry_date)
                   and (e.exit_date is null or t.tag <= e.exit_date)) then null
             when sa.employee_id is not null then sa.shift_id
             when e.shift_worker and e.rotation_pattern_id is not null then (
               select m.shift_id
                 from muster m
                where m.id = e.rotation_pattern_id
                  and m.zyklus > 0
                  and (((t.tag - m.anchor_date
                         - case when t.team is not distinct from e.rotation_team then e.rotation_offset_days
                                else gruppe_versatz(e.rotation_pattern_id, t.team) end
                        ) % m.zyklus) + m.zyklus) % m.zyklus < m.bis_pos
                order by m.ord
                limit 1)
             else e.shift_id
           end as schicht
      from tage t
      join sichtbar e on e.id = t.emp
      left join public.shift_assignments sa
        on sa.employee_id = t.emp and sa.date = t.tag
  ),
  abw as (
    select a.employee_id as emp, a.date as tag,
           bool_or(a.type = 'krank') as krank,
           bool_or(a.type = 'schulung') as schulung,
           case
             when bool_or(a.type::text = 'berufsschule') then 'BS'
             when bool_or(a.type = 'altersfreizeit') then 'AF'
             when bool_or(a.type = 'sonderurlaub') then 'SU'
             when bool_or(a.type = 'bildungsurlaub') then 'BU'
             else 'A'
           end as art_code
    from public.absences a
    join sichtbar x on x.id = a.employee_id
    where a.date between p_from and bis
    group by a.employee_id, a.date
  ),
  frei as (
    select r.employee_id as emp, d::date as tag,
           (array_agg(r.kind order by (r.status = 'approved') desc, r.kind))[1] as art,
           bool_or(r.status = 'approved') as genehmigt
    from public.leave_requests r
    join sichtbar x on x.id = r.employee_id
    cross join lateral generate_series(
      greatest(r.start_date, p_from), least(r.end_date, bis), interval '1 day'
    ) d
    where r.status in ('approved', 'pending')
      and r.start_date <= bis and r.end_date >= p_from
    group by r.employee_id, d::date
  )
  select
    -- Unsichtbare Personen: weder Name noch echte Kennung – nur eine Kennung,
    -- die für jede betrachtende Person anders ist.
    case when e.name_frei then e.id else md5(coalesce(me::text, '') || ':' || e.id::text)::uuid end,
    case when e.name_frei then e.first_name || ' ' || e.last_name end,
    case when e.shift_worker then z.team::text else null end,
    case when fuehrung then e.personnel_number else null end,
    z.tag,
    s.name,
    case
      when s.name ilike 'Früh%' then 'F'
      when s.name ilike 'Spät%' then 'S'
      when s.name ilike 'Nacht%' then 'N'
      when s.name is not null then upper(left(s.name, 1))
      else null
    end,
    case
      when e.id = me then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then a.art_code
          when f.art is not null and s.id is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      when fuehrung then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then a.art_code
          when f.art is not null and s.id is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      else
        case
          when coalesce(a.krank, false) then
            case when e.krank_frei and e.name_frei then 'K' else 'A' end
          when a.tag is not null then
            case when e.grund_frei and e.name_frei
                 then case when coalesce(a.schulung, false) then 'FB' else a.art_code end
                 else 'A' end
          when f.art is not null and s.id is not null then
            case when e.grund_frei and e.name_frei then leave_kind_code(f.art, f.genehmigt)
                 when f.genehmigt then 'A'
                 else null end
          else null
        end
    end,
    (e.id = me),
    coalesce(e.is_apprentice, false)
  from sichtbar e
  join zelle z on z.emp = e.id
  left join abw  a on a.emp = e.id and a.tag = z.tag
  left join frei f on f.emp = e.id and f.tag = z.tag
  left join public.shifts s
    on s.id = z.schicht
   and (
     z.zugewiesen
     or (
       extract(dow from z.tag)::int = any(s.weekdays)
       and (
         feiertage_arbeiten
         or not exists (
           select 1 from public.holidays h
            where h.date = z.tag
              and (h.company_id = s.company_id or h.company_id is null)
         )
       )
     )
   )
  order by case when e.shift_worker then
             (case when e.wechselt then gruppe_am(e.id, bis, e.rotation_team) else e.rotation_team end) end nulls last,
           (not e.name_frei), e.sort_order nulls last, case when e.name_frei then e.last_name end, e.id, z.tag;
end;
$function$;

-- Urlaub in meiner Schicht: ohne Namen, wo team_sicht() es nicht erlaubt.
create or replace function public.my_shift_leave(p_from date, p_to date)
returns table(employee_id uuid, employee_name text, start_date date, end_date date, status leave_status, is_me boolean, reason_visible boolean, kind leave_kind)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  meine_firma uuid := auth_company_id();
  fuehrung boolean := is_leadership();
  freigabe boolean := gruende_fuer_kollegen_erlaubt();
  my_shift uuid;
  my_pattern uuid;
begin
  if me is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  select e.shift_id, e.rotation_pattern_id into my_shift, my_pattern
  from employees e where e.id = me;

  return query
  with roh as (
    select
      r.employee_id as emp_id,
      e.first_name || ' ' || e.last_name as emp_name,
      r.start_date as von,
      r.end_date as bis,
      r.status as stand,
      (r.employee_id = me) as ich,
      e.last_name as nachname,
      r.kind as art,
      public.team_sicht(r.employee_id) as frei,
      case
        when r.employee_id = me then true
        when fuehrung then true
        when not freigabe then false
        else exists (
          select 1
          from public.profiles sp
          join public.privacy_settings ps on ps.user_id = sp.id
          where sp.employee_id = r.employee_id
            and sp.company_id = meine_firma
            and ps.company_id = meine_firma
            and ps.absence_visibility = 'shift'
        )
      end as grund
    from leave_requests r
    join employees e on e.id = r.employee_id
    where e.company_id = meine_firma
      and e.active
      and r.status in ('approved', 'pending')
      and r.start_date <= p_to
      and r.end_date >= p_from
      and (
        (my_shift is not null and e.shift_id = my_shift)
        or (my_pattern is not null and e.rotation_pattern_id = my_pattern)
        or r.employee_id = me
      )
  ),
  sichtbar as (
    select roh.*, (roh.grund and roh.frei) as grund_sichtbar from roh
  )
  select case when frei then emp_id else md5(me::text || ':' || emp_id::text)::uuid end,
         case when frei then emp_name end,
         von, bis, stand, ich, grund_sichtbar,
         case when grund_sichtbar then art else null end
  from sichtbar
  where grund_sichtbar or stand = 'approved'
  order by von, (not frei), case when frei then nachname end;
end;
$function$;

-- Ausbildungsplan: Mitarbeitende sehen nur ihre eigenen Abschnitte.
create or replace function public.training_plan(p_from date, p_to date)
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
    (select count(*)::int
       from generate_series(greatest(t.start_date, p_from),
                            least(t.end_date, p_to), '1 day') g
      where exists (select 1 from employees_absent_on(g::date) ab
                     where ab.employee_id = t.employee_id))
  from training_assignments t
  join employees e on e.id = t.employee_id
  left join shifts s on s.id = t.shift_id
  where t.company_id = auth_company_id()
    and (is_leadership() or t.employee_id = auth_employee_id())
    and t.start_date <= p_to
    and t.end_date >= p_from
  order by e.last_name, t.start_date;
$$;

revoke execute on function public.training_plan(date, date) from public, anon;
grant execute on function public.training_plan(date, date) to authenticated;

-- Push: Wer es so eingestellt hat, bekommt Mitteilungen ohne Inhalt auf den Sperrbildschirm.
create or replace function public.push_warteschlange_holen()
returns table(user_id uuid, titel text, text text, url text, tag text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from push_warteschlange where coalesce(senden_ab, erstellt_am) < now() - interval '7 days';
  return query
    with geholt as (
      update push_warteschlange w set gesendet_am = now()
       where w.id in (select x.id from push_warteschlange x
                       where x.gesendet_am is null
                         and (x.senden_ab is null or x.senden_ab <= now())
                         -- Planänderungen kurz sammeln (mehrere Tage am Stück).
                         and (x.sammel is null or x.erstellt_am < now() - interval '45 seconds')
                       order by x.id limit 300 for update skip locked)
      returning w.user_id, w.titel, w.text, w.url, w.tag
    )
    select g.user_id,
           case when ps.push_ohne_inhalt then 'ShiftNexo' else g.titel end,
           case when ps.push_ohne_inhalt then 'Neue Mitteilung – zum Ansehen öffnen.' else g.text end,
           g.url, g.tag
      from geholt g
      left join public.privacy_settings ps on ps.user_id = g.user_id;
end;
$function$;

revoke execute on function public.push_warteschlange_holen() from public, anon, authenticated;

-- Eigene Wahl speichern. Leere Werte bleiben, wie sie sind.
create or replace function public.team_sichtbarkeit_setzen(
  p_eigene boolean default null,
  p_andere boolean default null,
  p_push_ohne_inhalt boolean default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
  gefragt boolean := p_eigene is not null or p_andere is not null;
begin
  if auth.uid() is null or firma is null then
    raise exception 'Du bist nicht angemeldet.';
  end if;
  insert into public.privacy_settings (user_id, company_id, team_eigene, team_andere, team_gefragt_am, push_ohne_inhalt)
  values (auth.uid(), firma, coalesce(p_eigene, false), coalesce(p_andere, false),
          case when gefragt then now() end, coalesce(p_push_ohne_inhalt, false))
  on conflict (user_id) do update set
    team_eigene = coalesce(p_eigene, privacy_settings.team_eigene),
    team_andere = coalesce(p_andere, privacy_settings.team_andere),
    team_gefragt_am = case when gefragt then now() else privacy_settings.team_gefragt_am end,
    push_ohne_inhalt = coalesce(p_push_ohne_inhalt, privacy_settings.push_ohne_inhalt);
end;
$function$;

revoke execute on function public.team_sichtbarkeit_setzen(boolean, boolean, boolean) from public, anon;
grant execute on function public.team_sichtbarkeit_setzen(boolean, boolean, boolean) to authenticated;

-- Für die Administration: nur Zahlen, keine Namen.
create or replace function public.team_sichtbarkeit_zahlen()
returns table(eigene integer, andere integer, abgelehnt integer, offen integer, nicht_angemeldet integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  with leute as (
    select e.id,
           exists (select 1 from public.profiles p where p.employee_id = e.id and p.company_id = firma) as angemeldet,
           (select ps from public.profiles p join public.privacy_settings ps on ps.user_id = p.id
             where p.employee_id = e.id and p.company_id = firma limit 1) as ps
      from public.employees e
     where e.company_id = firma and e.active and (e.exit_date is null or e.exit_date >= current_date)
  )
  select count(*) filter (where angemeldet and coalesce((ps).team_eigene, false))::int,
         count(*) filter (where angemeldet and coalesce((ps).team_andere, false))::int,
         count(*) filter (where angemeldet and (ps).team_gefragt_am is not null
                                and not coalesce((ps).team_eigene, false) and not coalesce((ps).team_andere, false))::int,
         count(*) filter (where angemeldet and (ps).team_gefragt_am is null)::int,
         count(*) filter (where not angemeldet)::int
    from leute;
end;
$function$;

revoke execute on function public.team_sichtbarkeit_zahlen() from public, anon;
grant execute on function public.team_sichtbarkeit_zahlen() to authenticated;

update public.legal_versions set version = '2.41', valid_from = current_date where doc = 'datenschutz';
