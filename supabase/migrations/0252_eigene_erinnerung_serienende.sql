-- =============================================================
-- 0252 · Termine: eigene Erinnerung und Ende einer Wiederholung
--
-- Erinnerung selbst einstellen – zusätzlich zu den festen Werten (0251):
--   v<Minuten>        so viele Minuten vor dem Beginn (bis 14 Tage), z. B. v90
--   t<Tage>-<HHMM>    so viele Tage vorher um diese Uhrzeit (0 = am Tag), z. B. t1-1930
--
-- Wiederholung mit Ende: termin_serie_ende setzt den letzten Tag einer Serie
-- (z. B. „werktags bis 23.12.“) oder nimmt das Ende wieder weg. Gespeichert wird
-- es wie „ab hier löschen“ (0161) als Ausnahme am Tag danach.
-- =============================================================

create or replace function public._erinnerung_gueltig(p text)
returns boolean language sql immutable set search_path to 'public' as $$
  select p is null
      or p in ('m0', 'm5', 'm10', 'm15', 'm30', 'h1', 'h2', 'h3', 'd1', 'd2', 'w1',
               'morgens8', 'tag7', 'tag8', 'vortag18', 'vortag20')
      or (p ~ '^v[0-9]{1,5}$' and substr(p, 2)::int <= 20160)
      or (p ~ '^t[0-9]{1,2}-([01][0-9]|2[0-3])[0-5][0-9]$' and split_part(substr(p, 2), '-', 1)::int <= 14)
$$;

alter table public.kalender_termine
  drop constraint if exists kalender_termine_erinnerung_check,
  add constraint kalender_termine_erinnerung_check check (public._erinnerung_gueltig(erinnerung));

-- Zeitpunkt einer Erinnerung für einen Termin an Tag d (Berliner Zeit, ohne Zone).
create or replace function public._erinnerung_zeit(p text, d date, p_beginn time)
returns timestamp language sql immutable set search_path to 'public' as $$
  select case
    when p = 'm0' then d + p_beginn
    when p = 'm5' then (d + p_beginn) - interval '5 minutes'
    when p = 'm10' then (d + p_beginn) - interval '10 minutes'
    when p = 'm15' then (d + p_beginn) - interval '15 minutes'
    when p = 'm30' then (d + p_beginn) - interval '30 minutes'
    when p = 'h1' then (d + p_beginn) - interval '1 hour'
    when p = 'h2' then (d + p_beginn) - interval '2 hours'
    when p = 'h3' then (d + p_beginn) - interval '3 hours'
    when p = 'd1' then (d + p_beginn) - interval '1 day'
    when p in ('morgens8', 'tag8') then d + time '08:00'
    when p = 'tag7' then d + time '07:00'
    when p = 'vortag18' then (d - 1) + time '18:00'
    when p = 'vortag20' then (d - 1) + time '20:00'
    when p = 'd2' then (d - 2) + time '08:00'
    when p = 'w1' then (d - 7) + time '08:00'
    when p ~ '^v[0-9]+$' then (d + p_beginn) - make_interval(mins => substr(p, 2)::int)
    when p ~ '^t[0-9]+-[0-9]{4}$' then
      (d - split_part(substr(p, 2), '-', 1)::int)
        + make_time(substr(split_part(p, '-', 2), 1, 2)::int, substr(split_part(p, '-', 2), 3, 2)::int, 0)
  end
$$;

-- Braucht die Erinnerung keinen Beginn (feste Uhrzeit)?
create or replace function public._erinnerung_ohne_beginn(p text)
returns boolean language sql immutable set search_path to 'public' as $$
  select p in ('morgens8', 'tag7', 'tag8', 'vortag18', 'vortag20', 'd2', 'w1') or p ~ '^t[0-9]+-[0-9]{4}$'
$$;

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
  if not _erinnerung_gueltig(p_erinnerung) then
    raise exception 'Diese Erinnerung gibt es nicht.';
  end if;
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

-- Letzter Tag einer Wiederholung (null = kein Ende). Darf, wer den Termin ändern darf:
-- der Inhaber oder eine verbundene Person mit Erlaubnis (wie verbindung_termin_speichern).
create or replace function public.termin_serie_ende(p_id uuid, p_ende date)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  t kalender_termine;
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into t from kalender_termine k where k.id = p_id;
  if t.id is null or not (t.owner_id = auth.uid() or _verbunden_termin_erlaubt(p_id, t.owner_id)) then
    raise exception 'Diesen Termin kannst du nicht ändern.';
  end if;
  if t.wiederholung = 'nie' then
    return;
  end if;
  if p_ende is not null and p_ende < t.datum then
    raise exception 'Das Ende liegt vor dem ersten Tag.';
  end if;
  delete from kalender_termin_ausnahmen where termin_id = p_id and ab;
  if p_ende is not null then
    -- Einzelne ausgelassene Tage nach dem Ende braucht es nicht mehr.
    delete from kalender_termin_ausnahmen where termin_id = p_id and datum > p_ende;
    insert into kalender_termin_ausnahmen (termin_id, datum, ab) values (p_id, p_ende + 1, true);
  end if;
end;
$$;
revoke all on function public.termin_serie_ende(uuid, date) from public, anon;
grant execute on function public.termin_serie_ende(uuid, date) to authenticated;

-- Fällige Erinnerungen (Stand 0251) – mit eigenen Zeiten, bis 14 Tage voraus.
create or replace function public.erinnerungen_im_fenster()
returns table(user_id uuid, art text, ref_id uuid, titel text, datum date, beginn text, ganztaegig boolean, faellig_am timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with tage as (
    select d::date as d from generate_series(public.heute() - 1, public.heute() + 15, interval '1 day') d
  ),
  termine as (
    select t.owner_id, t.id, t.titel, x.d, t.beginn, t.ganztaegig,
           _erinnerung_zeit(t.erinnerung, x.d, t.beginn) at time zone 'Europe/Berlin' as faellig
      from kalender_termine t
      join tage x on x.d >= t.datum
     where t.erinnerung is not null
       and (t.ganztaegig or t.beginn is not null or _erinnerung_ohne_beginn(t.erinnerung))
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
   where a.faellig is not null
     and a.faellig between now() - interval '15 minutes' and now() + interval '30 seconds'
     and not exists (select 1 from erinnerung_gesendet g
                      where g.art = a.art and g.ref_id = a.id and g.faellig_am = a.faellig);
$$;
