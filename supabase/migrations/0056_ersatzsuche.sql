-- Besetzungslücken je Qualifikation und die Suche nach Ersatz.
--
-- Die vorhandene Prüfung (staffing_snapshot) zählt Köpfe gegen
-- minimum_staff. Das reicht nicht: eine Schicht kann vollzählig sein und
-- trotzdem niemanden mit B-Schein haben. Ab hier wird je Funktion
-- gerechnet.
--
-- Alles Neue setzt auf Vorhandenem auf: employees_absent_on() sagt, wer
-- fehlt, effective_shift_id() sagt, wer wann arbeitet, is_employed_on()
-- begrenzt auf die Beschäftigungszeit, company_rule_number() liefert
-- Ruhezeit und Höchstdauer aus staffing_rules.

-- Anfang und Ende einer Schicht an einem Tag als Zeitpunkt.
--
-- Die Nachtschicht läuft über Mitternacht: endet sie rechnerisch vor
-- ihrem Beginn, liegt das Ende am Folgetag. Ohne das käme für 22:00-06:00
-- eine negative Dauer heraus, und jede Ruhezeitprüfung wäre wertlos.
create or replace function shift_starts_at(p_shift_id uuid, p_date date)
returns timestamp
language sql stable set search_path = public as $$
  select (p_date + s.start_time)::timestamp from shifts s where s.id = p_shift_id;
$$;

create or replace function shift_ends_at(p_shift_id uuid, p_date date)
returns timestamp
language sql stable set search_path = public as $$
  select case
           when s.end_time > s.start_time then (p_date + s.end_time)::timestamp
           else (p_date + 1 + s.end_time)::timestamp
         end
    from shifts s where s.id = p_shift_id;
$$;

revoke execute on function shift_starts_at(uuid, date) from public, anon;
revoke execute on function shift_ends_at(uuid, date)   from public, anon;
grant execute on function shift_starts_at(uuid, date) to authenticated;
grant execute on function shift_ends_at(uuid, date)   to authenticated;

-- Wer deckt eine Funktion an einem Tag in einer Schicht tatsächlich ab?
-- Gezählt wird, wer eingeplant ist, nicht fehlt und die Qualifikation hat.
create or replace function qualification_coverage(p_shift_id uuid, p_date date)
returns table (
  qualification_id uuid,
  label text,
  benoetigt int,
  vorhanden int,
  fehlt int
)
language sql stable security definer set search_path = public as $$
  select
    n.qualification_id,
    q.label,
    n.minimum::int,
    count(e.id)::int,
    greatest(n.minimum - count(e.id), 0)::int
  from shift_qualification_needs n
  join qualifications q on q.id = n.qualification_id
  left join employees e
    on e.company_id = n.company_id
   and e.active
   and effective_shift_id(e.id, p_date) = n.shift_id
   and exists (
     select 1 from employee_qualifications eq
      where eq.employee_id = e.id and eq.qualification_id = n.qualification_id
   )
   -- Spaltenname qualifiziert: `employee_id` heisst auch eine
   -- Ausgabespalte dieser Funktion, unqualifiziert waere es mehrdeutig.
   and e.id not in (select a.employee_id from employees_absent_on(p_date) a)
  where n.shift_id = p_shift_id
    and n.company_id = auth_company_id()
  group by n.qualification_id, q.label, n.minimum;
$$;

comment on function qualification_coverage(uuid, date) is
  'Abdeckung je Funktion in einer Schicht an einem Tag. Ohne Eintrag in '
  'shift_qualification_needs gibt es für eine Funktion keine Anforderung '
  'und damit auch keine Lücke.';

revoke execute on function qualification_coverage(uuid, date) from public, anon;
grant execute on function qualification_coverage(uuid, date) to authenticated;

-- Geeignete Ersatzleute für eine Schicht an einem Tag.
--
-- Die Reihenfolge folgt der betrieblichen Logik: zuerst die eigene
-- Schicht (dort ist kein Ersatz nötig, wenn jemand die Funktion ohnehin
-- abdeckt), dann Nachbarschichten. Wer eine zwingende Voraussetzung
-- reisst, erscheint zwar mit Begründung, ist aber nicht auswählbar --
-- sonst wüsste niemand, warum eine naheliegende Person fehlt.
create or replace function replacement_candidates(
  p_date date,
  p_shift_id uuid,
  p_qualification_id uuid default null
)
returns table (
  employee_id uuid,
  name text,
  rotation_team text,
  eigene_schicht boolean,
  hat_qualifikation boolean,
  beschaeftigt boolean,
  frei boolean,
  ohne_ueberschneidung boolean,
  ruhezeit_stunden numeric,
  ruhezeit_ok boolean,
  dauer_stunden numeric,
  dauer_ok boolean,
  auswaehlbar boolean,
  grund text
)
language plpgsql stable security definer set search_path = public as $$
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
      effective_shift_id(e.id, p_date) as schicht_heute,
      is_employed_on(e.id, p_date) as im_betrieb,
      (p_qualification_id is null or exists (
        select 1 from employee_qualifications eq
         where eq.employee_id = e.id and eq.qualification_id = p_qualification_id
      )) as kann_es,
      -- Auch hier qualifiziert: `employee_id` ist zugleich Ausgabespalte
      -- dieser Funktion und Spalte von employees_absent_on().
      (e.id not in (select a.employee_id from employees_absent_on(p_date) a)) as ist_da
    from employees e
    where e.company_id = firma and e.active
  ),
  -- Ruhezeit gegen die Einsätze rundherum. Betrachtet werden Vortag,
  -- Tag und Folgetag -- weiter reicht eine Schicht nie.
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
      m.id, m.voller_name, m.team, m.im_betrieb, m.kann_es, m.ist_da,
      -- `is not distinct from` statt `=`: wer an dem Tag frei hat, hat
      -- keine Schicht, und ein Vergleich mit null ergaebe null statt false.
      (m.schicht_heute is not distinct from p_shift_id) as ist_eigene,
      -- Eine Überschneidung liegt vor, wenn die Person an diesem Tag
      -- bereits einer anderen Schicht zugeordnet ist.
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
    -- Wer bereits in dieser Schicht steht, ist kein Ersatz, sondern der
    -- Grund, warum keiner gebraucht wird. Er erscheint oben in der Liste,
    -- aber nicht als Auswahl -- sonst wuerde man ihn sich selbst zuweisen.
    (b.kann_es and b.im_betrieb and b.ist_da and b.ohne_konflikt
       and b.ruhe >= ruhe_soll and b.dauer <= dauer_max and not b.ist_eigene),
    case
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
  -- Auswählbare zuerst, darunter die eigene Schicht vor fremden, dann
  -- nach verbleibender Ruhezeit -- wer am meisten Luft hat, steht oben.
  order by
    (b.kann_es and b.im_betrieb and b.ist_da and b.ohne_konflikt
       and b.ruhe >= ruhe_soll and b.dauer <= dauer_max and not b.ist_eigene) desc,
    -- Die eigene Schicht steht direkt darunter: sie beantwortet die Frage,
    -- ob ueberhaupt jemand gebraucht wird.
    b.ist_eigene desc,
    b.ruhe desc nulls last,
    b.voller_name;
end;
$$;

revoke execute on function replacement_candidates(date, uuid, uuid) from public, anon;
grant execute on function replacement_candidates(date, uuid, uuid) to authenticated;
