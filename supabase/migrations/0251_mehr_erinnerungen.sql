-- =============================================================
-- 0251 · Termine: mehr Erinnerungen und Wiederholungen
--
-- Erinnerungen neu: zum Beginn, 5/15/30 Minuten, 2/3 Stunden vorher, am Tag
-- 7:00, am Vortag 20:00, 1 Woche vorher (8:00).
-- Wiederholung neu: alle 2 Wochen, werktags (Mo–Fr).
--
-- Alles Bisherige bleibt gültig. Die Push-Erinnerungen schauen jetzt 8 statt
-- 3 Tage voraus (für „1 Woche vorher“).
-- =============================================================

alter table public.kalender_termine
  drop constraint if exists kalender_termine_erinnerung_check,
  add constraint kalender_termine_erinnerung_check
    check (erinnerung is null or erinnerung in (
      'm0', 'm5', 'm10', 'm15', 'm30', 'h1', 'h2', 'h3', 'd1', 'd2', 'w1',
      'morgens8', 'tag7', 'tag8', 'vortag18', 'vortag20'));

alter table public.kalender_termine
  drop constraint if exists kalender_termine_wiederholung_check,
  add constraint kalender_termine_wiederholung_check
    check (wiederholung in ('nie', 'taeglich', 'werktags', 'woechentlich', 'zweiwoechentlich', 'monatlich', 'jaehrlich'));

-- Wie bisher (0154), nur mit den neuen Erinnerungen.
create or replace function public.termin_sichern(
  p_id uuid, p_datum date, p_bis_datum date, p_titel text, p_ganztaegig boolean,
  p_beginn time, p_ende time, p_wiederholung text, p_notiz text, p_ort text, p_erinnerung text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  neu uuid;
  bis date := case when coalesce(p_ganztaegig, false) and p_bis_datum > p_datum then p_bis_datum end;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if bis is not null and bis > p_datum + 62 then
    raise exception 'Ein Termin kann höchstens zwei Monate lang sein.';
  end if;
  if p_erinnerung is not null and p_erinnerung not in (
       'm0', 'm5', 'm10', 'm15', 'm30', 'h1', 'h2', 'h3', 'd1', 'd2', 'w1',
       'morgens8', 'tag7', 'tag8', 'vortag18', 'vortag20') then
    raise exception 'Diese Erinnerung gibt es nicht.';
  end if;
  -- Erst das alte Enddatum lösen – sonst stört es, wenn der Beginn wandert.
  if p_id is not null then
    update kalender_termine set bis_datum = null where id = p_id and owner_id = auth.uid();
  end if;
  neu := termin_schreiben(auth.uid(), false, p_id, p_datum, p_titel, p_ganztaegig, p_beginn, p_ende,
                          p_wiederholung, p_notiz, p_ort);
  update kalender_termine set bis_datum = bis, erinnerung = p_erinnerung
   where id = neu and owner_id = auth.uid();
  return neu;
end;
$$;

revoke all on function public.termin_sichern(uuid, date, date, text, boolean, time, time, text, text, text, text) from public, anon;
grant execute on function public.termin_sichern(uuid, date, date, text, boolean, time, time, text, text, text, text) to authenticated;

-- Fällige Erinnerungen (Stand 0165) – mit den neuen Zeitpunkten und Wiederholungen.
create or replace function public.erinnerungen_im_fenster()
returns table(user_id uuid, art text, ref_id uuid, titel text, datum date, beginn text, ganztaegig boolean, faellig_am timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with tage as (
    select d::date as d from generate_series(public.heute() - 1, public.heute() + 8, interval '1 day') d
  ),
  termine as (
    select t.owner_id, t.id, t.titel, x.d, t.beginn, t.ganztaegig,
           (case t.erinnerung
              when 'm0' then (x.d + t.beginn)
              when 'm5' then (x.d + t.beginn) - interval '5 minutes'
              when 'm10' then (x.d + t.beginn) - interval '10 minutes'
              when 'm15' then (x.d + t.beginn) - interval '15 minutes'
              when 'm30' then (x.d + t.beginn) - interval '30 minutes'
              when 'h1' then (x.d + t.beginn) - interval '1 hour'
              when 'h2' then (x.d + t.beginn) - interval '2 hours'
              when 'h3' then (x.d + t.beginn) - interval '3 hours'
              when 'd1' then (x.d + t.beginn) - interval '1 day'
              when 'morgens8' then x.d + time '08:00'
              when 'tag8' then x.d + time '08:00'
              when 'tag7' then x.d + time '07:00'
              when 'vortag18' then (x.d - 1) + time '18:00'
              when 'vortag20' then (x.d - 1) + time '20:00'
              when 'd2' then (x.d - 2) + time '08:00'
              when 'w1' then (x.d - 7) + time '08:00'
            end) at time zone 'Europe/Berlin' as faellig
      from kalender_termine t
      join tage x on x.d >= t.datum
     where t.erinnerung is not null
       and (t.ganztaegig or t.beginn is not null
            or t.erinnerung in ('morgens8', 'tag7', 'tag8', 'vortag18', 'vortag20', 'd2', 'w1'))
       and not exists (select 1 from kalender_termin_ausnahmen a
                        where a.termin_id = t.id and (a.datum = x.d or (a.ab and a.datum <= x.d)))
       and case t.wiederholung
             when 'taeglich' then true
             when 'werktags' then extract(isodow from x.d) between 1 and 5
             when 'woechentlich' then (x.d - t.datum) % 7 = 0
             when 'zweiwoechentlich' then (x.d - t.datum) % 14 = 0
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
       and o.datum between public.heute() - 1 and public.heute() + 1
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
