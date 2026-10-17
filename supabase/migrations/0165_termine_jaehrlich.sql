-- Termine jährlich wiederholen (z. B. Geburtstage).

alter table public.kalender_termine
  drop constraint if exists kalender_termine_wiederholung_check,
  add constraint kalender_termine_wiederholung_check
    check (wiederholung in ('nie', 'taeglich', 'woechentlich', 'monatlich', 'jaehrlich'));

create or replace function public.erinnerungen_im_fenster()
returns table(user_id uuid, art text, ref_id uuid, titel text, datum date, beginn text, ganztaegig boolean, faellig_am timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with tage as (
    select d::date as d from generate_series(current_date - 1, current_date + 3, interval '1 day') d
  ),
  termine as (
    select t.owner_id, t.id, t.titel, x.d, t.beginn, t.ganztaegig,
           (case t.erinnerung
              when 'm10' then (x.d + t.beginn) - interval '10 minutes'
              when 'h1' then (x.d + t.beginn) - interval '1 hour'
              when 'd1' then (x.d + t.beginn) - interval '1 day'
              when 'morgens8' then x.d + time '08:00'
              when 'vortag18' then (x.d - 1) + time '18:00'
              when 'tag8' then x.d + time '08:00'
              when 'd2' then (x.d - 2) + time '08:00'
            end) at time zone 'Europe/Berlin' as faellig
      from kalender_termine t
      join tage x on x.d >= t.datum
     where t.erinnerung is not null
       and (t.ganztaegig or t.beginn is not null or t.erinnerung in ('morgens8', 'vortag18', 'tag8', 'd2'))
       and not exists (select 1 from kalender_termin_ausnahmen a
                        where a.termin_id = t.id and (a.datum = x.d or (a.ab and a.datum <= x.d)))
       and case t.wiederholung
             when 'taeglich' then true
             when 'woechentlich' then (x.d - t.datum) % 7 = 0
             when 'monatlich' then extract(day from x.d) = extract(day from t.datum)
             when 'jaehrlich' then extract(month from x.d) = extract(month from t.datum)
                               and extract(day from x.d) = extract(day from t.datum)
             else x.d = t.datum
           end
  ),
  todos as (
    select o.owner_id, o.id, o.titel, o.datum, o.uhrzeit,
           (o.datum + o.uhrzeit) at time zone 'Europe/Berlin' as faellig
      from kalender_todos o
     where not o.erledigt and o.uhrzeit is not null
       and o.datum between current_date - 1 and current_date + 1
  ),
  alle as (
    select owner_id, 'termin'::text as art, id, titel, d as datum, to_char(beginn, 'HH24:MI') as beginn, ganztaegig, faellig from termine
    union all
    select owner_id, 'todo', id, titel, datum, to_char(uhrzeit, 'HH24:MI'), false, faellig from todos
  )
  select a.owner_id, a.art, a.id, a.titel, a.datum, a.beginn, a.ganztaegig, a.faellig
    from alle a
   where a.faellig between now() - interval '15 minutes' and now() + interval '30 seconds'
     and not exists (select 1 from erinnerung_gesendet g
                      where g.art = a.art and g.ref_id = a.id and g.faellig_am = a.faellig);
$$;
