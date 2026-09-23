-- Qualifikationen als Posten: jede Person besetzt genau einen.
--
-- Bisher wurde jede Qualifikation für sich gezählt. Wer B-Schein, Messwarte
-- und Anlagenfahrer hat, zählte dreimal – obwohl er in der Schicht nur
-- EINEN Posten ausfüllen kann. Dadurch ging am 26.09.2026 ein Antrag durch,
-- nach dem in der Frühschicht ein Anlagenfahrer gefehlt hätte:
--
--   da: Matthias (B-Schein), Alexander (B-Schein, Messwarte, Anlagenfahrer,
--       Lager), Lars (Messwarte, Anlagenfahrer, Lager), Tarek (Messwarte,
--       Anlagenfahrer, Lager)
--   gebraucht: 1 B-Schein, 1 Messwarte, 2 Anlagenfahrer, 1 Lager
--
--   Einzeln gezählt ohne Tarek: 2 Anlagenfahrer (Alexander, Lars) – "reicht".
--   Als Posten: Matthias B-Schein, Alexander oder Lars Messwarte, der
--   andere Anlagenfahrer – ein Anlagenfahrer fehlt.
--
-- Die Posten werden in der Reihenfolge der Wichtigkeit besetzt, die der
-- Betrieb vorgibt (qualifications.sort_order, bei Röhm: B-Schein,
-- Messwarte, Anlagenfahrer, Lager, Labor). Reicht das Personal nicht,
-- bleibt der unwichtigste Posten offen.
--
-- Verfahren: Posten für Posten in dieser Reihenfolge; jeder neue Posten
-- wird besetzt, wenn sich dafür ein Weg findet – notfalls, indem schon
-- eingeteilte Personen auf einen anderen Posten wechseln, für den sie auch
-- befähigt sind (erweiternder Pfad). Ein einmal besetzter Posten wird dabei
-- nie wieder frei. So entsteht die bestmögliche Besetzung in genau dieser
-- Rangfolge. Bei einer Schicht mit rund zehn Personen und sechs Posten sind
-- das wenige Rechenschritte.

create or replace function public.qualifikation_besetzung(
  p_shift_id uuid,
  p_date date,
  -- diese Person fehlt (zusätzlich)
  p_ohne uuid default null,
  -- offene Anträge anderer als Abwesenheit zählen (Entscheidungssicht)
  p_offene_zaehlen boolean default false,
  -- diese Person gilt als anwesend, auch wenn ihr eigener Antrag läuft
  p_trotzdem_da uuid default null
)
returns table (
  qualification_id uuid,
  label text,
  rang int,
  benoetigt int,
  besetzt int,
  fehlt int
)
language plpgsql
stable
security definer
set search_path = public
as $$
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

  -- Wer an diesem Tag in dieser Schicht steht und nicht fehlt.
  select coalesce(array_agg(e.id order by e.id), '{}')
    into personen
    from employees e
   where e.active
     and e.company_id = firma
     and effective_shift_id(e.id, p_date) = p_shift_id
     and e.id is distinct from p_ohne
     and (e.id = p_trotzdem_da
          or e.id not in (select a.employee_id
                            from employees_absent_on(p_date, p_offene_zaehlen) a));

  -- Die Posten, nach Wichtigkeit geordnet: "2 Anlagenfahrer" sind zwei Posten.
  select coalesce(array_agg(x.qid order by x.rang nulls last, x.label, x.nr), '{}')
    into pos_q
    from (select n2.qualification_id as qid, q.sort_order as rang, q.label, gs as nr
            from shift_qualification_needs n2
            join qualifications q on q.id = n2.qualification_id and q.active
           cross join generate_series(1, n2.minimum) gs
           where n2.shift_id = p_shift_id
             and n2.company_id = firma
             and n2.minimum > 0) x;

  -- Wer darf welchen Posten: "Personennummer:Qualifikation".
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

    -- Breitensuche: freie Person für Posten s, notfalls über Umsetzungen.
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

    -- Umsetzen entlang des gefundenen Wegs.
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
$$;

revoke all on function public.qualifikation_besetzung(uuid, date, uuid, boolean, uuid) from public, anon;
grant execute on function public.qualifikation_besetzung(uuid, date, uuid, boolean, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bestehende Funktionen auf die Postenbesetzung umstellen (Signaturen bleiben)
-- ---------------------------------------------------------------------------

-- Lücken einer Schicht, offene Anträge zählen als abwesend (Entscheidungssicht).
create or replace function public.shift_qualification_gaps(
  p_shift_id uuid,
  p_date date,
  p_zusaetzlich_abwesend uuid default null
)
returns table (qualification_id uuid, label text, benoetigt int, vorhanden int, fehlt int)
language sql
stable
security definer
set search_path = public
as $$
  select b.qualification_id, b.label, b.benoetigt, b.besetzt, b.fehlt
    from public.qualifikation_besetzung(p_shift_id, p_date, p_zusaetzlich_abwesend, true, null) b;
$$;

-- Deckung für die Besetzungsseite und die Ersatzsuche: nur Genehmigtes.
create or replace function public.qualification_coverage(p_shift_id uuid, p_date date)
returns table (qualification_id uuid, label text, benoetigt int, vorhanden int, fehlt int)
language sql
stable
security definer
set search_path = public
as $$
  select b.qualification_id, b.label, b.benoetigt, b.besetzt, b.fehlt
    from public.qualifikation_besetzung(p_shift_id, p_date, null, false, null) b;
$$;

-- Die Sperre beim Antrag: gesperrt wird nur, was DURCH diese Abwesenheit
-- zusätzlich unbesetzt bliebe. Fehlt ein Posten ohnehin (z. B. Lager, weil
-- der einzige Lagerist frei hat), ist das kein Grund, einem anderen den
-- Urlaub zu verweigern. Gezählt werden nur genehmigte Abwesenheiten (so
-- entschieden, siehe 0096).
create or replace function public.leave_qualification_block_reason(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  emp employees;
  d date;
  s shifts;
  l record;
  luecken text[] := '{}';
  genannt text[] := '{}';
  quali text;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then
    return null;
  end if;
  if emp.company_id is distinct from auth_company_id()
     or (p_employee_id is distinct from auth_employee_id() and not is_leadership()) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 400 then
    return null;
  end if;

  d := p_start_date;
  while d <= p_end_date loop
    select sh.* into s
      from shifts sh
     where sh.id = effective_shift_id(p_employee_id, d)
       and sh.company_id = emp.company_id;

    if s.id is not null and shift_runs_on(s, d) then
      for l in
        select m.label, m.rang, m.benoetigt, o.besetzt as ohne_besetzt
          from public.qualifikation_besetzung(s.id, d, null, false, p_employee_id) m
          join public.qualifikation_besetzung(s.id, d, p_employee_id, false, null) o
            on o.qualification_id = m.qualification_id
         where o.fehlt > m.fehlt
         order by m.rang nulls last, m.label
      loop
        luecken := luecken || format('%s %s (%s benötigt, ohne dich %s)',
                                     to_char(d, 'DD.MM.YYYY'), s.name, l.benoetigt, l.ohne_besetzt);
        if not (l.label = any(genannt)) then
          genannt := genannt || l.label;
        end if;
      end loop;
    end if;

    d := d + 1;
  end loop;

  if cardinality(luecken) = 0 then
    return null;
  end if;

  -- Die Qualifikationen in der Reihenfolge ihrer Wichtigkeit nennen.
  select string_agg(q.label, ' und ' order by q.sort_order nulls last, q.label)
    into quali
    from qualifications q
   where q.company_id = emp.company_id and q.label = any(genannt);

  return format('Antrag nicht möglich – sonst ist nicht genug %s da: %s%s.',
                quali,
                array_to_string(luecken[1:3], '; '),
                case when cardinality(luecken) > 3
                     then format(' und an %s weiteren Tagen', cardinality(luecken) - 3)
                     else '' end);
end;
$$;

-- Besetzungsdetail für die Führung: nur die Lücken, die DIESER Antrag
-- zusätzlich reißen würde – nicht die, die ohnehin bestehen.
create or replace function public.leave_staffing_detail(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  tag date,
  shift_name text,
  present int,
  target int,
  minimum int,
  status staffing_status,
  luecken jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  return query
  select i.date,
         s.name,
         i.present,
         i.target::int,
         i.minimum::int,
         i.status,
         coalesce(
           (select jsonb_agg(jsonb_build_object('label', m.label, 'fehlt', o.fehlt - m.fehlt)
                             order by m.rang nulls last, m.label)
              from public.qualifikation_besetzung(
                     effective_shift_id(p_employee_id, i.date), i.date, null, true, p_employee_id) m
              join public.qualifikation_besetzung(
                     effective_shift_id(p_employee_id, i.date), i.date, p_employee_id, true, null) o
                on o.qualification_id = m.qualification_id
             where o.fehlt > m.fehlt),
           '[]'::jsonb)
  from public.check_leave_staffing_impact(p_employee_id, p_start_date, p_end_date) i
  left join shifts s on s.id = effective_shift_id(p_employee_id, i.date)
  order by i.date;
end;
$$;

-- Sammelgenehmigung: sicher ist ein Antrag, wenn seine Genehmigung keinen
-- Posten zusätzlich unbesetzt lässt. Offene Anträge anderer zählen dabei
-- als abwesend – konkurrieren zwei Anträge um denselben Posten, wird keiner
-- automatisch genehmigt (so entschieden, siehe 0096).
create or replace function public.approve_safe_leave_requests()
returns table (genehmigt int, uebersprungen int, geprueft int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  r record;
  v_sicher boolean;
  v_genehmigt int := 0;
  v_uebersprungen int := 0;
  v_geprueft int := 0;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  for r in
    select coalesce(lr.request_group_id, lr.id) as gruppe,
           (array_agg(lr.id order by lr.start_date))[1] as erste_id,
           (array_agg(lr.employee_id order by lr.start_date))[1] as employee_id,
           min(lr.start_date) as von,
           max(lr.end_date) as bis
    from leave_requests lr
    where lr.company_id = v_firma
      and lr.status = 'pending'
    group by coalesce(lr.request_group_id, lr.id)
    order by min(lr.created_at), min(lr.start_date)
  loop
    v_geprueft := v_geprueft + 1;

    select not exists (
      select 1 from public.check_leave_staffing_impact(r.employee_id, r.von, r.bis) i
      where i.status <> 'ok'
    ) into v_sicher;

    if v_sicher then
      select not exists (
        select 1
        from generate_series(r.von, r.bis, interval '1 day') d
        cross join lateral (select effective_shift_id(r.employee_id, d::date) as sid) x
        cross join lateral public.qualifikation_besetzung(x.sid, d::date, null, true, r.employee_id) m
        join lateral public.qualifikation_besetzung(x.sid, d::date, r.employee_id, true, null) o
          on o.qualification_id = m.qualification_id
        where x.sid is not null
          and o.fehlt > m.fehlt
      ) into v_sicher;
    end if;

    if v_sicher then
      begin
        perform public.decide_leave_request(r.erste_id, 'approved');
        v_genehmigt := v_genehmigt + 1;
      exception when others then
        v_uebersprungen := v_uebersprungen + 1;
      end;
    else
      v_uebersprungen := v_uebersprungen + 1;
    end if;
  end loop;

  return query select v_genehmigt, v_uebersprungen, v_geprueft;
end;
$$;
