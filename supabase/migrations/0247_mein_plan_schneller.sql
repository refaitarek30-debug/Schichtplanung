-- 0247: Kalender-Abo, „Meine Zahlen“, Betriebsschichten im Privatkalender und
-- verbundene Personen aus dem Betrieb schneller.
--
-- abo_plan, kalender_codes, meine_statistik_tage und meine_betriebsschichten
-- haben bisher den Plan des ganzen Betriebs berechnet (shift_plan_grid) und
-- danach nur die eigene Zeile behalten (where g.is_me). Live war abo_plan damit
-- der größte Verbraucher der Datenbank (Mittel 483 ms je Abruf).
--
-- _mein_plan ist shift_plan_grid (Stand 0237) mit einer einzigen Zeile mehr:
-- es rechnet nur die angemeldete Person selbst (e.id = me). Für diese Zeile
-- ist das Ergebnis gleich – andere Personen fließen in die eigene Zeile nicht
-- ein. Die vier Funktionen bleiben sonst unverändert (Stand 0233/0230/0196/0216).
-- shift_plan_grid selbst bleibt, wie es ist (Schichtplan, Druck, Besetzung).

create or replace function public._mein_plan(p_company_id uuid, p_from date, p_days integer)
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
      -- 0247: nur die angemeldete Person selbst
      and e.id = me
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

-- Nur für die Funktionen oben, nicht direkt aufrufbar.
revoke all on function public._mein_plan(uuid, date, integer) from public, anon, authenticated;

create or replace function public.abo_plan(p_token text, p_von date, p_tage integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  inhaber uuid := abo_inhaber(p_token);
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  ergebnis jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  if nur_privatkonto(inhaber) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'tag', t.tag,
             'art', case s.art when 'urlaub' then 'urlaub' when 'krank' then 'abwesend' else 'schicht' end,
             'name', s.name,
             'von', to_char(s.beginn, 'HH24:MI'),
             'bis', to_char(s.ende, 'HH24:MI')) order by t.tag, t.ebene), '[]'::jsonb)
      into ergebnis
      from privat_tage t
      join privat_schichtarten s on s.id = t.schichtart_id
     where t.user_id = inhaber and s.art <> 'frei'
       and t.tag between p_von and p_von + (p_tage - 1);
  else
    select p.company_id into firma from profiles p where p.id = inhaber;

    perform set_config('request.jwt.claims', json_build_object('sub', inhaber, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    perform set_config('request.jwt.claim.sub', inhaber::text, true);

    select coalesce(jsonb_agg(z.j order by z.tag, z.reihe), '[]'::jsonb)
      into ergebnis
      from (
        select g.day as tag, 1 as reihe, jsonb_build_object(
                 'tag', g.day,
                 'art', case
                          when g.absence_code is not null and g.absence_code = upper(g.absence_code) then
                            case when g.absence_code = 'FB' then 'schulung'
                                 when g.absence_code in ('U', 'V', 'AF', 'SU', 'BU', 'G') then 'urlaub'
                                 else 'abwesend' end
                          else 'schicht' end,
                 'name', g.shift_name,
                 'von', to_char(s.start_time, 'HH24:MI'),
                 'bis', to_char(s.end_time, 'HH24:MI')) as j
          from _mein_plan(firma, p_von, p_tage) g
          left join lateral (select sh.start_time, sh.end_time from shifts sh
                              where sh.company_id = firma and sh.name = g.shift_name limit 1) s on true
         where g.is_me
           and (g.shift_name is not null
                or (g.absence_code is not null and g.absence_code = upper(g.absence_code)))
        union all
        select e.tag, 2, jsonb_build_object(
                 'tag', e.tag,
                 'art', 'eigen',
                 'name', a.name,
                 'von', to_char(a.beginn, 'HH24:MI'),
                 'bis', to_char(a.ende, 'HH24:MI'))
          from kalender_eigene_tage e
          join kalender_eigene_arten a on a.user_id = e.user_id and a.id = e.art_id
         where e.user_id = inhaber
           and e.tag between p_von and p_von + (p_tage - 1)
      ) z;

    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  end if;

  update kalender_abo set zuletzt_abgerufen = now()
   where user_id = inhaber and beendet_am is null
     and (zuletzt_abgerufen is null or zuletzt_abgerufen < now() - interval '5 minutes');

  return ergebnis;
end;
$function$;

create or replace function public.kalender_codes(p_user uuid, p_von date, p_tage integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  codes jsonb;
begin
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  if nur_privatkonto(p_user) then
    select jsonb_object_agg(x.tag::text, x.code) into codes
      from (select distinct on (t.tag) t.tag, privat_code(s.art, s.beginn) as code
              from privat_tage t
              join privat_schichtarten s on s.id = t.schichtart_id
             where t.user_id = p_user and t.tag between p_von and p_von + (p_tage - 1)
             order by t.tag, t.ebene desc) x;
    return coalesce(codes, '{}'::jsonb);
  end if;

  select p.company_id into firma from profiles p where p.id = p_user and p.active and p.employee_id is not null;
  if firma is null then
    return '{}'::jsonb;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  begin
    if auth_company_id() is distinct from firma then
      -- z. B. Konto gesperrt: nichts zeigen, aber nicht abbrechen.
      codes := '{}'::jsonb;
    else
      select jsonb_object_agg(
               g.day::text,
               case
                 when g.absence_code is not null and g.absence_code = upper(g.absence_code) then 'U'
                 when g.shift_code in ('F', 'S', 'N') then g.shift_code
                 when g.shift_name is not null then 'T'
                 else 'X'
               end)
        into codes
        from _mein_plan(firma, p_von, p_tage) g
       where g.is_me;
    end if;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  return coalesce(codes, '{}'::jsonb);
end;
$$;

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
      select g.day,
             coalesce(g.shift_name, 'Frei'),
             case when g.shift_name is null then 'FREI' else g.shift_code end
        from _mein_plan(firma, ab, n) g
       where g.is_me
         and (g.absence_code is null or g.absence_code <> upper(g.absence_code));
    ab := ab + n;
  end loop;
end;
$$;

create or replace function public.meine_statistik_tage(p_jahr integer)
returns table (tag date, schicht text, kuerzel text, abwesenheit text, stunden numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
  ab date;
  bis date;
  n int;
  std numeric;
begin
  if firma is null or auth_employee_id() is null then
    return;
  end if;
  if p_jahr is null or p_jahr < 2000 or p_jahr > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  ab := make_date(p_jahr, 1, 1);
  bis := make_date(p_jahr, 12, 31);
  std := company_rule_number('stunden_pro_arbeitstag', 'stunden', 8);
  while ab <= bis loop
    n := least(62, bis - ab + 1);
    return query
      select g.day,
             g.shift_name,
             g.shift_code,
             -- nur genehmigte Abwesenheiten (Großbuchstaben); beantragte zählen nicht
             case when g.absence_code is not null and g.absence_code = upper(g.absence_code) then g.absence_code end,
             std
        from _mein_plan(firma, ab, n) g
       where g.is_me;
    ab := ab + n;
  end loop;
end;
$function$;
