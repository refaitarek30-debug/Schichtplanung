-- Schichtplan für alle, Azubis zählen nicht zur Besetzung, Rücknahme von
-- Abwesenheiten mit Benachrichtigung, schnellere Änderungsprüfung.
--
-- 1. Besetzung: Azubis (employees.is_apprentice) zählen nirgends mehr zur
--    Besetzung. Die Regel steht an EINER Stelle (zaehlt_zur_besetzung) und
--    wird von allen Besetzungsrechnungen benutzt: staffing_snapshot (und
--    damit staffing_for_day, staffing_range, staffing_month_overview),
--    shift_staffing_overview, check_leave_staffing_impact (und damit
--    leave_staffing_detail, shift_leave_overlap, sicher_genehmigen),
--    qualifikation_besetzung (und damit qualification_coverage,
--    shift_qualification_gaps, leave_qualification_block_reason) und
--    replacement_candidates.
--
-- 2. Schichtplan: jeder im Unternehmen sieht alle Schichtgruppen. Ansehen
--    ist nicht Bearbeiten – geändert wird weiter nur über die geprüften
--    Funktionen der Führung. Abwesenheitsgründe bleiben geschützt: ohne
--    Freigabe der Person steht bei Kollegen nur „A“, Krank nur mit eigener
--    Freigabe und nur innerhalb der eigenen Schichtgruppe (unverändert).
--    Personalnummern bekommt weiterhin nur die Führung.
--    Neu: is_apprentice je Zeile, damit auch die Besetzungszeile im Plan
--    Azubis nicht mitzählt, und schichtplan_kompakt() – eine Zeile je
--    Person statt je Person und Tag (ein Aufruf statt mehrerer Seiten,
--    ein Bruchteil der Datenmenge).
--
-- 3. Änderungsprüfung: aenderungsstand() las bisher bei jedem Aufruf alle
--    Anträge, Abwesenheiten und Zuweisungen (md5 über alle Zeilen). Jetzt
--    zählen Trigger je Unternehmen und Bereich hoch; die Abfrage liest nur
--    noch vier Zähler. Die Benachrichtigungen bleiben je Person.
--
-- 4. Rücknahme: antrag_zuruecknehmen() nimmt einen Antrag (Urlaub, V-Tag,
--    Altersfreizeit, Sonderurlaub, Bildungsurlaub, Gewerkschaftstag) als
--    Ganzes zurück – durch die Person selbst oder durch die Führung, die
--    über sie entscheiden darf. Der Antrag bleibt als „zurückgezogen“ mit
--    Zeitpunkt und Person erhalten; Konto, Plan und Besetzung rechnen nur
--    mit offenen und genehmigten Anträgen und stimmen damit sofort.
--    Benachrichtigt wird über das bestehende System (notifications):
--    nimmt die Person selbst zurück, die zuständige Führung; nimmt die
--    Führung zurück, die Person. Dasselbe gilt für das Entfernen eines
--    Tages direkt im Schichtplan (set_leave_for_day 'clear').

-- 1. Besetzungsregel ---------------------------------------------------------

create or replace function public.zaehlt_zur_besetzung(e public.employees)
returns boolean
language sql
immutable
parallel safe
as $$
  select not coalesce(e.is_apprentice, false);
$$;

comment on function public.zaehlt_zur_besetzung(public.employees) is
  'Einzige Stelle der Regel, wer zur Schichtbesetzung zählt. Azubis zählen nicht.';

revoke all on function public.zaehlt_zur_besetzung(public.employees) from public, anon;
grant execute on function public.zaehlt_zur_besetzung(public.employees) to authenticated;

create or replace function public.staffing_snapshot(p_shift_id uuid, p_date date)
returns table(shift_id uuid, date date, target smallint, minimum smallint, planned integer, absent integer, present integer, status staffing_status)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  s shifts;
  v_planned int;
  v_absent int;
begin
  select * into s from shifts where id = p_shift_id;
  if s.id is null then
    raise exception 'Schicht nicht gefunden.';
  end if;
  if s.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;

  select count(*) into v_planned from employees e
  where e.active and e.company_id = s.company_id
    and zaehlt_zur_besetzung(e)
    and effective_shift_id(e.id, p_date) = s.id;

  select count(*) into v_absent from employees e
  where e.active and e.company_id = s.company_id
    and zaehlt_zur_besetzung(e)
    and effective_shift_id(e.id, p_date) = s.id
    and e.id in (select employee_id from employees_absent_on(p_date));

  return query select
    s.id, p_date, s.target_staff, s.minimum_staff,
    v_planned, v_absent, v_planned - v_absent,
    case
      when v_planned - v_absent < s.minimum_staff then 'critical'::staffing_status
      when v_planned - v_absent < s.target_staff then 'warn'::staffing_status
      else 'ok'::staffing_status
    end;
end;
$function$;

create or replace function public.shift_staffing_overview(p_date date default null::date)
returns table(shift_id uuid, shift_name text, short_name text, target integer, minimum integer, zugeordnet integer, laeuft_heute boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_firma uuid := auth_company_id();
  v_tag date := coalesce(p_date, current_date);
begin
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  return query
  select s.id, s.name, s.short_name,
         s.target_staff::int, s.minimum_staff::int,
         (select count(*)::int from employees e
           where e.active and e.company_id = v_firma
             and zaehlt_zur_besetzung(e)
             and effective_shift_id(e.id, v_tag) = s.id),
         shift_runs_on(s, v_tag)
  from shifts s
  where s.company_id = v_firma and s.active
  order by s.start_time nulls last, s.name;
end;
$function$;

create or replace function public.check_leave_staffing_impact(p_employee_id uuid, p_start_date date, p_end_date date)
returns table(date date, present integer, target smallint, minimum smallint, status staffing_status)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  e employees; s shifts; d date; day_shift uuid;
  planned int; absent int; adjusted_present int; already_counted boolean;
  zaehlt boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.'; end if;

  -- Fällt ein Azubi aus, sinkt die Besetzung nicht: er zählt gar nicht erst.
  zaehlt := zaehlt_zur_besetzung(e);

  d := p_start_date;
  while d <= p_end_date loop
    day_shift := effective_shift_id(p_employee_id, d);
    if day_shift is not null then
      select * into s from shifts where id = day_shift;
      if s.id is not null and s.target_staff > 0 and shift_runs_on(s, d) then
        select count(*) into planned from employees emp
        where emp.active and emp.company_id = e.company_id
          and zaehlt_zur_besetzung(emp)
          and effective_shift_id(emp.id, d) = day_shift;
        select count(*) into absent from employees emp
        where emp.active and emp.company_id = e.company_id
          and zaehlt_zur_besetzung(emp)
          and effective_shift_id(emp.id, d) = day_shift
          and emp.id in (select employee_id from employees_absent_on(d, true));
        select exists(select 1 from employees_absent_on(d, true) a where a.employee_id = p_employee_id)
          into already_counted;
        adjusted_present := planned - absent
          - case when already_counted or not zaehlt then 0 else 1 end;
        return query select d, adjusted_present, s.target_staff, s.minimum_staff,
          case when adjusted_present < s.minimum_staff then 'critical'::staffing_status
               when adjusted_present < s.target_staff then 'warn'::staffing_status
               else 'ok'::staffing_status end;
      end if;
    end if;
    d := d + 1;
  end loop;
end;
$function$;

create or replace function public.qualifikation_besetzung(p_shift_id uuid, p_date date, p_ohne uuid default null::uuid, p_offene_zaehlen boolean default false, p_trotzdem_da uuid default null::uuid)
returns table(qualification_id uuid, label text, rang integer, benoetigt integer, besetzt integer, fehlt integer)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  firma uuid;
  personen uuid[];
  pos_q uuid[];
  kann text[];
  person_von_posten int[];
  posten_von_person int[];
  n int;
  p int;
  s int;
  u int;
  j int;
  pj int;
  qi int;
  gefunden int;
  warteschlange int[];
  vorher int[];
  besucht boolean[];
begin
  select sh.company_id into firma from shifts sh where sh.id = p_shift_id;
  if firma is null or firma is distinct from auth_company_id() then
    return;
  end if;

  -- Wer einen Posten besetzen kann: eingeplant, da – und kein Azubi.
  select coalesce(array_agg(e.id order by e.id), '{}')
    into personen
    from employees e
   where e.active
     and e.company_id = firma
     and zaehlt_zur_besetzung(e)
     and effective_shift_id(e.id, p_date) = p_shift_id
     and e.id is distinct from p_ohne
     and (e.id = p_trotzdem_da
          or e.id not in (select a.employee_id
                            from employees_absent_on(p_date, p_offene_zaehlen) a));

  select coalesce(array_agg(x.qid order by x.rang nulls last, x.label, x.nr), '{}')
    into pos_q
    from (select n2.qualification_id as qid, q.sort_order as rang, q.label, gs as nr
            from shift_qualification_needs n2
            join qualifications q on q.id = n2.qualification_id and q.active
           cross join generate_series(1, n2.minimum) gs
           where n2.shift_id = p_shift_id
             and n2.company_id = firma
             and n2.minimum > 0) x;

  select coalesce(array_agg(t.i || ':' || eq.qualification_id), '{}')
    into kann
    from unnest(personen) with ordinality as t(pid, i)
    join employee_qualifications eq on eq.employee_id = t.pid;

  n := coalesce(array_length(personen, 1), 0);
  p := coalesce(array_length(pos_q, 1), 0);
  person_von_posten := array_fill(0, array[greatest(p, 1)]);
  posten_von_person := array_fill(0, array[greatest(n, 1)]);

  for s in 1 .. p loop
    besucht := array_fill(false, array[greatest(n, 1)]);
    vorher := array_fill(0, array[greatest(n, 1)]);
    warteschlange := array[s];
    qi := 1;
    gefunden := 0;

    while qi <= array_length(warteschlange, 1) and gefunden = 0 loop
      u := warteschlange[qi];
      qi := qi + 1;
      for j in 1 .. n loop
        if not besucht[j] and (j || ':' || pos_q[u]) = any(kann) then
          besucht[j] := true;
          vorher[j] := u;
          if posten_von_person[j] = 0 then
            gefunden := j;
            exit;
          end if;
          warteschlange := warteschlange || posten_von_person[j];
        end if;
      end loop;
    end loop;

    if gefunden > 0 then
      j := gefunden;
      loop
        u := vorher[j];
        pj := person_von_posten[u];
        person_von_posten[u] := j;
        posten_von_person[j] := u;
        exit when u = s;
        j := pj;
      end loop;
    end if;
  end loop;

  return query
  select q.id,
         q.label,
         q.sort_order,
         count(*)::int,
         (count(*) filter (where person_von_posten[x.i::int] > 0))::int,
         (count(*) filter (where person_von_posten[x.i::int] = 0))::int
    from unnest(pos_q) with ordinality as x(qid, i)
    join qualifications q on q.id = x.qid
   group by q.id, q.label, q.sort_order
   order by q.sort_order nulls last, q.label;
end;
$function$;

create or replace function public.replacement_candidates(p_date date, p_shift_id uuid, p_qualification_id uuid default null::uuid)
returns table(employee_id uuid, name text, rotation_team text, eigene_schicht boolean, hat_qualifikation boolean, beschaeftigt boolean, frei boolean, ohne_ueberschneidung boolean, ruhezeit_stunden numeric, ruhezeit_ok boolean, dauer_stunden numeric, dauer_ok boolean, auswaehlbar boolean, grund text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
  s shifts;
  beginnt timestamp;
  endet timestamp;
  ruhe_soll numeric;
  dauer_max numeric;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;

  select * into s from shifts where id = p_shift_id;
  if s.id is null or s.company_id is distinct from firma then
    raise exception 'Schicht nicht gefunden.';
  end if;

  beginnt   := shift_starts_at(p_shift_id, p_date);
  endet     := shift_ends_at(p_shift_id, p_date);
  ruhe_soll := company_rule_number('ruhezeit_stunden', 'stunden', 11, p_shift_id);
  dauer_max := company_rule_number('max_schichtdauer_stunden', 'stunden', 8, p_shift_id);

  return query
  with kandidaten as (
    select
      e.id,
      e.first_name || ' ' || e.last_name as voller_name,
      e.rotation_team::text as team,
      -- Ein Azubi füllt keine Lücke: er zählt nicht zur Besetzung.
      zaehlt_zur_besetzung(e) as zaehlt,
      effective_shift_id(e.id, p_date) as schicht_heute,
      is_employed_on(e.id, p_date) as im_betrieb,
      (p_qualification_id is null or exists (
        select 1 from employee_qualifications eq
         where eq.employee_id = e.id and eq.qualification_id = p_qualification_id
      )) as kann_es,
      (e.id not in (select a.employee_id from employees_absent_on(p_date) a)) as ist_da
    from employees e
    where e.company_id = firma and e.active
  ),
  mit_ruhe as (
    select
      k.*,
      (select min(
                extract(epoch from (
                  beginnt - shift_ends_at(effective_shift_id(k.id, tag::date), tag::date)
                )) / 3600
              )
         from generate_series(p_date - 1, p_date, '1 day') tag
        where effective_shift_id(k.id, tag::date) is not null
          and shift_ends_at(effective_shift_id(k.id, tag::date), tag::date) <= beginnt
      ) as ruhe_davor,
      (select min(
                extract(epoch from (
                  shift_starts_at(effective_shift_id(k.id, tag::date), tag::date) - endet
                )) / 3600
              )
         from generate_series(p_date, p_date + 1, '1 day') tag
        where effective_shift_id(k.id, tag::date) is not null
          and shift_starts_at(effective_shift_id(k.id, tag::date), tag::date) >= endet
      ) as ruhe_danach
    from kandidaten k
  ),
  bewertet as (
    select
      m.id, m.voller_name, m.team, m.zaehlt, m.im_betrieb, m.kann_es, m.ist_da,
      (m.schicht_heute is not distinct from p_shift_id) as ist_eigene,
      (m.schicht_heute is null or m.schicht_heute = p_shift_id) as ohne_konflikt,
      least(coalesce(m.ruhe_davor, 999), coalesce(m.ruhe_danach, 999)) as ruhe,
      extract(epoch from (endet - beginnt)) / 3600 as dauer
    from mit_ruhe m
  )
  select
    b.id,
    b.voller_name,
    b.team,
    b.ist_eigene,
    b.kann_es,
    b.im_betrieb,
    b.ist_da,
    b.ohne_konflikt,
    round(b.ruhe, 1),
    (b.ruhe >= ruhe_soll),
    round(b.dauer, 1),
    (b.dauer <= dauer_max),
    (b.zaehlt and b.kann_es and b.im_betrieb and b.ist_da and b.ohne_konflikt
       and b.ruhe >= ruhe_soll and b.dauer <= dauer_max and not b.ist_eigene),
    case
      when not b.zaehlt        then 'Azubi – zählt nicht zur Besetzung'
      when not b.kann_es       then 'Qualifikation fehlt'
      when not b.im_betrieb    then 'An diesem Tag nicht im Betrieb'
      when not b.ist_da        then 'Bereits abwesend'
      when not b.ohne_konflikt then 'Bereits in einer anderen Schicht eingeplant'
      when b.ruhe < ruhe_soll  then 'Ruhezeit nicht ausreichend: '
                                    || round(b.ruhe, 1) || ' statt ' || ruhe_soll || ' Stunden'
      when b.dauer > dauer_max then 'Einsatz länger als ' || dauer_max || ' Stunden'
      when b.ist_eigene        then 'Deckt diese Schicht bereits ab'
      else 'Verfügbar'
    end
  from bewertet b
  order by
    (b.zaehlt and b.kann_es and b.im_betrieb and b.ist_da and b.ohne_konflikt
       and b.ruhe >= ruhe_soll and b.dauer <= dauer_max and not b.ist_eigene) desc,
    b.ist_eigene desc,
    b.ruhe desc nulls last,
    b.voller_name;
end;
$function$;

-- 2. Schichtplan für alle ----------------------------------------------------

-- Neue Spalte im Ergebnis: dafür muss die Funktion neu angelegt werden.
drop function if exists public.shift_plan_grid(uuid, date, integer);

create function public.shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
returns table(employee_id uuid, employee_name text, rotation_team text, personnel_number text, day date, shift_name text, shift_code text, absence_code text, is_me boolean, is_apprentice boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
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
    -- Alle aktiven Personen des Unternehmens im Zeitraum. Den Grund einer
    -- Abwesenheit sehen Kollegen nur mit Freigabe und nur in der eigenen
    -- Schichtgruppe – daran ändert die erweiterte Sicht nichts.
    select e.id, e.first_name, e.last_name, e.shift_worker, e.rotation_team,
           e.personnel_number, e.sort_order, e.is_apprentice,
           coalesce(bool_or(ps.absence_visibility = 'shift'), false)
             and mein_team is not null and e.rotation_team = mein_team as grund_frei,
           coalesce(bool_or(ps.sickness_visibility = 'shift'), false)
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
             e.personnel_number, e.sort_order, e.is_apprentice
  ),
  abw as (
    select a.employee_id as emp, a.date as tag,
           bool_or(a.type = 'krank') as krank,
           bool_or(a.type = 'schulung') as schulung,
           case
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
    e.id,
    e.first_name || ' ' || e.last_name,
    case when e.shift_worker then e.rotation_team::text else null end,
    case when fuehrung then e.personnel_number else null end,
    gs.day::date,
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
          when f.art is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      when fuehrung then
        case
          when coalesce(a.krank, false) then 'K'
          when coalesce(a.schulung, false) then 'FB'
          when a.tag is not null then a.art_code
          when f.art is not null then leave_kind_code(f.art, f.genehmigt)
          else null
        end
      else
        -- Kollegen: ohne Freigabe des Grundes bleibt es "A".
        case
          when coalesce(a.krank, false) then
            case when e.krank_frei then 'K' else 'A' end
          when a.tag is not null then
            case when e.grund_frei
                 then case when coalesce(a.schulung, false) then 'FB' else a.art_code end
                 else 'A' end
          -- Offen beantragt ist nicht abwesend: ohne Freigabe steht dann
          -- nichts da (vorher „A“ – das zählte in der Besetzungszeile
          -- fälschlich als Ausfall und verriet den offenen Antrag).
          when f.art is not null then
            case when e.grund_frei then leave_kind_code(f.art, f.genehmigt)
                 when f.genehmigt then 'A'
                 else null end
          else null
        end
    end,
    (e.id = me),
    coalesce(e.is_apprentice, false)
  from sichtbar e
  cross join generate_series(p_from, bis, interval '1 day') as gs(day)
  left join abw  a on a.emp = e.id and a.tag = gs.day::date
  left join frei f on f.emp = e.id and f.tag = gs.day::date
  left join public.shifts s
    on s.id = effective_shift_id(e.id, gs.day::date)
   and shift_runs_on(s, gs.day::date, feiertage_arbeiten)
  order by case when e.shift_worker then e.rotation_team end nulls last,
           e.sort_order nulls last, e.last_name, e.id, gs.day;
end;
$function$;

revoke all on function public.shift_plan_grid(uuid, date, integer) from public, anon;
grant execute on function public.shift_plan_grid(uuid, date, integer) to authenticated, service_role;

-- Eine Zeile je Person, die Tage als Liste [Tag, Schicht, Kürzel, Abwesenheit].
-- Dieselben Regeln wie shift_plan_grid – sie IST shift_plan_grid, nur
-- zusammengefasst. Bei 50 Personen über 30 Tage: 50 statt 1500 Zeilen und
-- ein Aufruf statt zwei Seiten.
create or replace function public.schichtplan_kompakt(p_company_id uuid, p_from date, p_days integer)
returns table(employee_id uuid, employee_name text, rotation_team text, personnel_number text, is_me boolean, is_apprentice boolean, tage jsonb)
language sql
stable security definer
set search_path to 'public'
as $$
  select g.employee_id,
         min(g.employee_name),
         min(g.rotation_team),
         min(g.personnel_number),
         bool_or(g.is_me),
         bool_or(g.is_apprentice),
         jsonb_agg(jsonb_build_array(g.day, g.shift_name, g.shift_code, g.absence_code) order by g.day)
    from public.shift_plan_grid(p_company_id, p_from, p_days) with ordinality as g(
           employee_id, employee_name, rotation_team, personnel_number, day,
           shift_name, shift_code, absence_code, is_me, is_apprentice, nr)
   group by g.employee_id
   order by min(g.nr);
$$;

revoke all on function public.schichtplan_kompakt(uuid, date, integer) from public, anon;
grant execute on function public.schichtplan_kompakt(uuid, date, integer) to authenticated, service_role;

-- 3. Änderungsprüfung über Zähler ------------------------------------------

create table if not exists public.aenderungszaehler (
  company_id uuid not null references public.companies(id) on delete cascade,
  bereich text not null check (bereich in ('antraege', 'abwesenheiten', 'plan', 'mitteilungen')),
  stand bigint not null default 0,
  geaendert_am timestamptz not null default now(),
  primary key (company_id, bereich)
);

comment on table public.aenderungszaehler is
  'Zähler je Unternehmen und Bereich; steigt bei jeder Änderung. Grundlage von aenderungsstand().';

alter table public.aenderungszaehler enable row level security;
revoke all on table public.aenderungszaehler from anon, authenticated;

create or replace function public.aenderung_zaehlen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  firma uuid;
begin
  if tg_op = 'DELETE' then
    firma := old.company_id;
  else
    firma := new.company_id;
  end if;
  if firma is null then
    return null;
  end if;
  insert into aenderungszaehler as z (company_id, bereich, stand, geaendert_am)
  values (firma, tg_argv[0], 1, now())
  on conflict (company_id, bereich)
  do update set stand = z.stand + 1, geaendert_am = now();
  -- Zieht eine Zeile in ein anderes Unternehmen um (kommt praktisch nicht
  -- vor), erfährt auch das alte davon.
  if tg_op = 'UPDATE' and old.company_id is distinct from new.company_id and old.company_id is not null then
    insert into aenderungszaehler as z (company_id, bereich, stand, geaendert_am)
    values (old.company_id, tg_argv[0], 1, now())
    on conflict (company_id, bereich)
    do update set stand = z.stand + 1, geaendert_am = now();
  end if;
  return null;
end;
$function$;

revoke all on function public.aenderung_zaehlen() from public, anon, authenticated;

drop trigger if exists aenderung_antraege on public.leave_requests;
create trigger aenderung_antraege
  after insert or update or delete on public.leave_requests
  for each row execute function public.aenderung_zaehlen('antraege');

drop trigger if exists aenderung_abwesenheiten on public.absences;
create trigger aenderung_abwesenheiten
  after insert or update or delete on public.absences
  for each row execute function public.aenderung_zaehlen('abwesenheiten');

drop trigger if exists aenderung_plan_zuweisungen on public.shift_assignments;
create trigger aenderung_plan_zuweisungen
  after insert or update or delete on public.shift_assignments
  for each row execute function public.aenderung_zaehlen('plan');

-- Neue Kollegen, Gruppenwechsel und Reihenfolge verändern den Plan ebenso.
drop trigger if exists aenderung_plan_personen on public.employees;
create trigger aenderung_plan_personen
  after insert or update or delete on public.employees
  for each row execute function public.aenderung_zaehlen('plan');

drop trigger if exists aenderung_mitteilungen on public.announcements;
create trigger aenderung_mitteilungen
  after insert or update or delete on public.announcements
  for each row execute function public.aenderung_zaehlen('mitteilungen');

drop trigger if exists aenderung_regeln on public.staffing_rules;
create trigger aenderung_regeln
  after insert or update or delete on public.staffing_rules
  for each row execute function public.aenderung_zaehlen('mitteilungen');

create or replace function public.aenderungsstand()
returns table(antraege text, abwesenheiten text, plan text, benachrichtigungen text, mitteilungen text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
  ich uuid := auth_employee_id();
begin
  if firma is null then
    return;
  end if;

  -- Jeder sieht den ganzen Plan – also meldet jede Änderung im Unternehmen
  -- sich bei allen. Die Zähler kosten eine Zeile je Bereich.
  return query
  select
    coalesce((select z.stand::text from aenderungszaehler z where z.company_id = firma and z.bereich = 'antraege'), '0'),
    coalesce((select z.stand::text from aenderungszaehler z where z.company_id = firma and z.bereich = 'abwesenheiten'), '0'),
    coalesce((select z.stand::text from aenderungszaehler z where z.company_id = firma and z.bereich = 'plan'), '0'),
    md5(coalesce((select string_agg(n.id::text || ':' || n.xmin::text, ',' order by n.id)
                     from notifications n
                    where n.employee_id = ich), '')),
    coalesce((select z.stand::text from aenderungszaehler z where z.company_id = firma and z.bereich = 'mitteilungen'), '0');
end;
$function$;

-- 4. Rücknahme -------------------------------------------------------------

alter table public.leave_requests
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by uuid references public.profiles(id) on delete set null,
  add column if not exists withdrawal_reason text;

comment on column public.leave_requests.withdrawn_at is 'Zeitpunkt der Rücknahme (nur bei status = withdrawn).';
comment on column public.leave_requests.withdrawn_by is 'Wer zurückgenommen hat: die Person selbst oder die Führung.';
comment on column public.leave_requests.withdrawal_reason is 'Freiwilliger Grund der Rücknahme.';

-- Die Angaben zur Rücknahme gibt es nur bei zurückgezogenen Anträgen. So
-- kann sie auch ein direkter Schreibzugriff nicht an einen offenen oder
-- genehmigten Antrag hängen.
create or replace function public.leave_requests_ruecknahme_konsistent()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status is distinct from 'withdrawn' then
    new.withdrawn_at := null;
    new.withdrawn_by := null;
    new.withdrawal_reason := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists leave_requests_ruecknahme_konsistent on public.leave_requests;
create trigger leave_requests_ruecknahme_konsistent
  before insert or update on public.leave_requests
  for each row execute function public.leave_requests_ruecknahme_konsistent();

-- Wer ist für eine Person zuständig? Dieselbe Regel wie bei der E-Mail zu
-- einem neuen Antrag: die Administration und die Schichtleitung der
-- eigenen Schichtgruppe (Schichtleitung ohne Gruppe bzw. Person ohne
-- Gruppe: alle Schichtleitungen). Die Person selbst nie.
create or replace function public.zustaendige_fuehrung(p_employee_id uuid)
returns table(employee_id uuid)
language sql
stable security definer
set search_path to 'public'
as $$
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
                or pe.rotation_team = ziel.rotation_team))
     );
$$;

revoke all on function public.zustaendige_fuehrung(uuid) from public, anon, authenticated;

-- Benachrichtigung zu einer Rücknahme, zentral für alle Wege.
-- Nimmt die Person selbst zurück: an die zuständige Führung.
-- Nimmt jemand anderes zurück: an die Person.
create or replace function public.benachrichtige_ruecknahme(
  p_request_id uuid,
  p_employee_id uuid,
  p_arten text,
  p_von date,
  p_bis date,
  p_war_genehmigt boolean,
  p_grund text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  firma uuid;
  person text;
  wer text;
  rolle text;
  zeitraum text;
  zeitpunkt text;
begin
  select e.company_id, e.first_name || ' ' || e.last_name
    into firma, person
    from employees e where e.id = p_employee_id;
  if firma is null then
    return;
  end if;

  zeitraum := case
    when p_von = p_bis then 'am ' || to_char(p_von, 'DD.MM.YYYY')
    else 'vom ' || to_char(p_von, 'DD.MM.YYYY') || ' bis ' || to_char(p_bis, 'DD.MM.YYYY')
  end;
  zeitpunkt := to_char(now() at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI "Uhr"');

  if auth_employee_id() is not distinct from p_employee_id then
    insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
    select firma, f.employee_id, 'leave_withdrawn',
           case when p_war_genehmigt
                then p_arten || ' zurückgenommen'
                else 'Antrag zurückgezogen: ' || p_arten end,
           case when p_war_genehmigt
                then format('%s hat %s %s zurückgenommen (am %s) und steht an %s wieder im Plan.',
                            person, p_arten, zeitraum, zeitpunkt,
                            case when p_von = p_bis then 'diesem Tag' else 'diesen Tagen' end)
                else format('%s hat den Antrag auf %s %s zurückgezogen (am %s).',
                            person, p_arten, zeitraum, zeitpunkt) end,
           'leave_requests', p_request_id
      from zustaendige_fuehrung(p_employee_id) f;
  else
    select p.first_name || ' ' || p.last_name,
           case p.role when 'admin' then 'Administration' when 'shift_leader' then 'Schichtleitung' else null end
      into wer, rolle
      from profiles p where p.id = auth.uid();

    insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
    values (
      firma, p_employee_id, 'leave_withdrawn',
      p_arten || ' zurückgenommen',
      format('Dein %sAntrag auf %s %s wurde von %s zurückgenommen (am %s).%s%s',
             case when p_war_genehmigt then 'genehmigter ' else '' end,
             p_arten, zeitraum,
             coalesce(nullif(trim(coalesce(wer, '')), '') || coalesce(' (' || rolle || ')', ''), 'der Schichtleitung'),
             zeitpunkt,
             case when p_war_genehmigt
                  then case when p_von = p_bis then ' Du bist an diesem Tag wieder eingeplant.'
                            else ' Du bist an diesen Tagen wieder eingeplant.' end
                  else '' end,
             coalesce(' Grund: ' || nullif(trim(p_grund), ''), '')),
      'leave_requests', p_request_id
    );
  end if;
end;
$function$;

revoke all on function public.benachrichtige_ruecknahme(uuid, uuid, text, date, date, boolean, text) from public, anon, authenticated;

-- Einen Antrag zurücknehmen – als Ganzes, wie er gestellt wurde.
--
-- Die Person selbst: offene Anträge immer, genehmigte, solange sie noch
-- nicht begonnen haben. Die Führung (darf_urlaub_entscheiden): ebenso.
-- Einzelne Tage eines bereits laufenden Zeitraums entfernt die Führung
-- direkt im Schichtplan (set_leave_for_day 'clear').
create or replace function public.antrag_zuruecknehmen(p_request_id uuid, p_grund text default null)
returns leave_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r leave_requests;
  result leave_requests;
  v_gruppe uuid;
  eigener boolean;
  v_von date;
  v_bis date;
  v_genehmigt boolean;
  v_begonnen boolean;
  arten text;
  v_anzahl int;
  -- „Heute“ nach deutscher Zeit – die Datenbank rechnet sonst in UTC, und
  -- bis 2 Uhr nachts wäre noch gestern.
  heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  select * into r
    from leave_requests
   where id = p_request_id and company_id = auth_company_id();
  if r.id is null then
    raise exception 'Der Antrag wurde nicht gefunden.';
  end if;
  if r.status not in ('pending', 'approved') then
    raise exception 'Dieser Antrag ist bereits erledigt und lässt sich nicht mehr zurücknehmen.';
  end if;

  eigener := r.employee_id = auth_employee_id();
  if not eigener and not darf_urlaub_entscheiden(r.employee_id) then
    raise exception 'Zurücknehmen darfst du nur eigene Anträge oder Anträge deiner eigenen Schicht.';
  end if;

  v_gruppe := coalesce(r.request_group_id, r.id);

  -- Zurückgenommen wird, was zusammen gestellt wurde und denselben Stand
  -- hat – genau so fasst auch die Anzeige einen Antrag zusammen.
  select min(x.start_date), max(x.end_date),
         bool_or(x.status = 'approved'),
         bool_or(x.status = 'approved' and x.start_date <= heute),
         string_agg(distinct leave_kind_label(x.kind), ' und ')
    into v_von, v_bis, v_genehmigt, v_begonnen, arten
    from leave_requests x
   where coalesce(x.request_group_id, x.id) = v_gruppe
     and x.company_id = r.company_id
     and x.status = r.status;

  if v_von is null then
    raise exception 'Dieser Antrag ist bereits erledigt und lässt sich nicht mehr zurücknehmen.';
  end if;
  if v_begonnen then
    if eigener then
      raise exception 'Dieser Zeitraum hat bereits begonnen und lässt sich nicht mehr selbst zurücknehmen. Bitte an die Schichtleitung wenden.';
    end if;
    raise exception 'Dieser Zeitraum hat bereits begonnen. Einzelne Tage lassen sich im Schichtplan entfernen.';
  end if;

  update leave_requests
     set status = 'withdrawn',
         withdrawn_at = now(),
         withdrawn_by = auth.uid(),
         withdrawal_reason = nullif(trim(coalesce(p_grund, '')), '')
   where coalesce(request_group_id, id) = v_gruppe
     and company_id = r.company_id
     and status = r.status;

  get diagnostics v_anzahl = row_count;
  if v_anzahl = 0 then
    raise exception 'Dieser Antrag ist bereits erledigt und lässt sich nicht mehr zurücknehmen.';
  end if;

  select * into result from leave_requests where id = p_request_id;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    r.company_id, auth.uid(), 'leave.withdrawn', 'leave_requests', r.id,
    jsonb_build_object(
      'gruppe', v_gruppe, 'zeilen', v_anzahl, 'von', v_von, 'bis', v_bis,
      'war_genehmigt', v_genehmigt, 'selbst', eigener,
      'grund', nullif(trim(coalesce(p_grund, '')), '')
    )
  );

  perform benachrichtige_ruecknahme(r.id, r.employee_id, arten, v_von, v_bis, v_genehmigt, p_grund);

  return result;
end;
$function$;

revoke all on function public.antrag_zuruecknehmen(uuid, text) from public, anon;
grant execute on function public.antrag_zuruecknehmen(uuid, text) to authenticated;

-- Der bisherige Weg (nur eigene, offene Anträge) läuft über dieselbe
-- Logik – damit gibt es auch dort die Benachrichtigung.
create or replace function public.withdraw_leave_request(p_request_id uuid)
returns leave_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from leave_requests r
     where r.id = p_request_id
       and r.employee_id = auth_employee_id()
       and r.status = 'pending'
  ) then
    raise exception 'Der Antrag laesst sich nicht mehr zurueckziehen.';
  end if;
  return antrag_zuruecknehmen(p_request_id, null);
end;
$function$;

-- Wer hat zurückgenommen? Für „Meine Anträge“ – die Profile der Führung
-- darf ein Mitarbeiter selbst nicht lesen.
create or replace function public.my_leave_withdrawers()
returns table(request_id uuid, withdrawer_name text)
language sql
stable security definer
set search_path to 'public'
as $$
  select r.id, p.first_name || ' ' || p.last_name
    from leave_requests r
    join profiles p on p.id = r.withdrawn_by
   where r.employee_id = auth_employee_id()
     and r.company_id = auth_company_id()
     and r.withdrawn_by is not null;
$$;

revoke all on function public.my_leave_withdrawers() from public, anon;
grant execute on function public.my_leave_withdrawers() to authenticated;

-- Tag im Plan entfernen: benachrichtigt jetzt wie jede andere Rücknahme.
create or replace function public.set_leave_for_day(p_employee_id uuid, p_date date, p_mode text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e employees;
  r leave_requests;
  target leave_kind;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration duerfen das.';
  end if;
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not darf_urlaub_entscheiden(p_employee_id) then
    raise exception 'Urlaub eintragen darfst du nur für deine eigene Schicht.';
  end if;

  select * into r
    from leave_requests
   where employee_id = p_employee_id
     and status in ('approved', 'pending')
     and p_date between start_date and end_date
   order by start_date
   limit 1;

  if p_mode = 'clear' then
    if r.id is null then return; end if;
    perform split_leave_request_day(r, p_date, null);
    insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
    values (
      e.company_id, auth.uid(), 'leave.day_removed', 'leave_requests', r.id,
      jsonb_build_object('tag', p_date, 'kind', r.kind, 'status', r.status)
    );
    perform benachrichtige_ruecknahme(
      r.id, p_employee_id, leave_kind_label(r.kind), p_date, p_date, r.status = 'approved', null
    );
    return;
  end if;

  target := case
    when p_mode in ('urlaub', 'v_tag', 'altersfreizeit', 'sonderurlaub',
                    'bildungsurlaub', 'gewerkschaftstag')
      then p_mode::leave_kind
    else 'urlaub'::leave_kind
  end;

  if r.id is null then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at
    )
    values (
      e.company_id, p_employee_id, p_date, p_date, 'approved', target,
      'Direkt im Schichtplan eingetragen', auth.uid(), now()
    );
    return;
  end if;

  if r.kind = target then return; end if;

  perform split_leave_request_day(r, p_date, target);
end;
$function$;
