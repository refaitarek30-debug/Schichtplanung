-- „Du bist im Urlaub“ auch an den freien Tagen rund um den Urlaub.
--
-- Bisher zählten nur Anträge, die heute oder später enden. Lag der erste
-- Urlaubstag gestern und heute ist laut Rotation frei, fiel der laufende
-- Urlaub heraus – die Startseite zeigte „Dein nächster Urlaub ab 05.10.“,
-- obwohl man seit dem 01.10. nicht mehr gearbeitet hat.
--
-- Jetzt:
--   * Anträge (und SU/AF/BU-Abwesenheiten) der letzten 62 Tage zählen mit,
--     damit ein laufender Urlaub erkannt wird.
--   * Ein Zeitraum wird um die freien Tage direkt davor und danach
--     erweitert (höchstens 7 je Seite): der Urlaub beginnt nach der letzten
--     Schicht und endet vor der nächsten.
--   * Geliefert wird der erste Zeitraum, der heute noch nicht vorbei ist.
--
-- Abgezogen wird dadurch nichts anderes: `tage` bleibt die Summe der
-- beantragten Tage, nur `von`, `bis` und `kalendertage` zeigen die ganze
-- Zeit, in der man frei hat.

create or replace function public.mein_naechster_urlaub()
 returns table(von date, bis date, tage numeric, kalendertage integer, arten text[], offen boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  me uuid := auth_employee_id();
  heute date := current_date;
  r record;
  b_von date;
  b_bis date;
  b_tage numeric := 0;
  b_arten text[] := '{}';
  b_offen boolean := false;
  e_von date;
  e_bis date;
  luecke_frei boolean;
begin
  if me is null then
    return;
  end if;

  for r in
    select x.start_date, x.end_date, x.tage, x.art, x.status
      from (
        select lr.start_date, lr.end_date, lr.requested_days as tage,
               lr.kind::text as art, lr.status
          from leave_requests lr
         where lr.employee_id = me
           and lr.status in ('approved', 'pending')
           and lr.end_date >= heute - 62
        union all
        select a.date, a.date, 1::numeric, a.type::text, 'approved'::leave_status
          from absences a
         where a.employee_id = me
           and a.type in ('sonderurlaub', 'altersfreizeit', 'bildungsurlaub')
           and a.date >= heute - 62
           and not exists (select 1 from leave_requests lr
                            where lr.employee_id = me
                              and lr.status in ('approved', 'pending')
                              and a.date between lr.start_date and lr.end_date)
      ) x
     order by x.start_date
  loop
    if b_von is not null and r.start_date > b_bis + 1 then
      select not exists (
        select 1 from generate_series(b_bis + 1, r.start_date - 1, interval '1 day') g
         where is_planned_workday(me, g::date)
      ) into luecke_frei;

      if not luecke_frei then
        -- Zeitraum abgeschlossen: um die freien Tage davor und danach
        -- erweitern und liefern, wenn er heute noch läuft oder kommt.
        e_von := b_von;
        while e_von > b_von - 7 and not is_planned_workday(me, e_von - 1) loop
          e_von := e_von - 1;
        end loop;
        e_bis := b_bis;
        while e_bis < b_bis + 7 and not is_planned_workday(me, e_bis + 1) loop
          e_bis := e_bis + 1;
        end loop;
        if e_bis >= heute then
          return query select e_von, e_bis, b_tage, (e_bis - e_von + 1)::int, b_arten, b_offen;
          return;
        end if;
        b_von := null;
        b_tage := 0;
        b_arten := '{}';
        b_offen := false;
      end if;
    end if;

    if b_von is null then
      b_von := r.start_date;
      b_bis := r.end_date;
    else
      b_bis := greatest(b_bis, r.end_date);
    end if;
    b_tage := b_tage + coalesce(r.tage, 0);
    if not (r.art = any(b_arten)) then
      b_arten := b_arten || r.art;
    end if;
    b_offen := b_offen or r.status = 'pending';
  end loop;

  if b_von is null then
    return;
  end if;

  e_von := b_von;
  while e_von > b_von - 7 and not is_planned_workday(me, e_von - 1) loop
    e_von := e_von - 1;
  end loop;
  e_bis := b_bis;
  while e_bis < b_bis + 7 and not is_planned_workday(me, e_bis + 1) loop
    e_bis := e_bis + 1;
  end loop;

  if e_bis >= heute then
    return query select e_von, e_bis, b_tage, (e_bis - e_von + 1)::int, b_arten, b_offen;
  end if;
end;
$function$;
