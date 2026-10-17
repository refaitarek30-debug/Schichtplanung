-- Einzelne Termine einer Wiederholung löschen: „nur dieser“ (ein Tag fällt
-- aus) und „dieser und alle folgenden“ (die Serie endet davor).
--   ab = false: an diesem Tag fällt der Termin aus
--   ab = true : ab diesem Tag (einschließlich) gibt es keine Wiederholungen mehr

create table if not exists public.kalender_termin_ausnahmen (
  termin_id uuid not null references public.kalender_termine(id) on delete cascade,
  datum date not null,
  ab boolean not null default false,
  primary key (termin_id, datum)
);
alter table public.kalender_termin_ausnahmen enable row level security;
revoke all on public.kalender_termin_ausnahmen from anon, authenticated;

-- Ausfalltage eines Termins als Liste.
create or replace function public.termin_ausfaelle(p_id uuid)
returns date[] language sql stable set search_path to 'public' as $$
  select coalesce(array_agg(a.datum order by a.datum) filter (where not a.ab), '{}')
    from kalender_termin_ausnahmen a where a.termin_id = p_id
$$;

-- Ab diesem Tag gibt es keine Wiederholungen mehr (sonst null).
create or replace function public.termin_serie_ab(p_id uuid)
returns date language sql stable set search_path to 'public' as $$
  select min(a.datum) filter (where a.ab) from kalender_termin_ausnahmen a where a.termin_id = p_id
$$;

-- Ein Tag oder „ab hier“ aus einer Wiederholung nehmen. Gibt true zurück,
-- wenn damit der ganze Termin gelöscht wurde (ab dem ersten Tag).
create or replace function public.termin_ausnahme(p_id uuid, p_datum date, p_ab boolean)
returns boolean language plpgsql volatile security definer set search_path to 'public' as $$
declare
  t kalender_termine;
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  select * into t from kalender_termine k
   where k.id = p_id and (k.owner_id = auth.uid() or (k.von_user = auth.uid() and k.owner_id <> auth.uid()));
  if t.id is null then
    raise exception 'Diesen Termin kannst du nicht ändern.';
  end if;
  if p_datum is null then
    raise exception 'Welcher Tag?';
  end if;
  if t.wiederholung = 'nie' then
    delete from kalender_termine where id = p_id;
    return true;
  end if;
  if p_ab then
    if p_datum <= t.datum then
      delete from kalender_termine where id = p_id;
      return true;
    end if;
    delete from kalender_termin_ausnahmen where termin_id = p_id and datum >= p_datum;
    insert into kalender_termin_ausnahmen (termin_id, datum, ab) values (p_id, p_datum, true);
  else
    if exists (select 1 from kalender_termin_ausnahmen where termin_id = p_id and ab and datum <= p_datum) then
      return false;
    end if;
    insert into kalender_termin_ausnahmen (termin_id, datum, ab) values (p_id, p_datum, false)
    on conflict (termin_id, datum) do nothing;
  end if;
  return false;
end;
$$;

revoke all on function public.termin_ausfaelle(uuid) from public, anon;
revoke all on function public.termin_serie_ab(uuid) from public, anon;
revoke all on function public.termin_ausnahme(uuid, date, boolean) from public, anon;
grant execute on function public.termin_ausnahme(uuid, date, boolean) to authenticated;

-- ---- Anzeige: Ausfälle mitliefern --------------------------------------------

drop function if exists public.meine_termine();
create function public.meine_termine()
returns table(id uuid, von_partner boolean, person_id uuid, von_user uuid, datum date, bis_datum date, titel text,
              ganztaegig boolean, beginn text, ende text, wiederholung text, notiz text, ort text, erinnerung text,
              ausfaelle date[], serie_ab date)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
    select t.id, t.von_partner, t.person_id, t.von_user, t.datum, t.bis_datum, t.titel, t.ganztaegig,
           to_char(t.beginn, 'HH24:MI'), to_char(t.ende, 'HH24:MI'), t.wiederholung, t.notiz, t.ort, t.erinnerung,
           termin_ausfaelle(t.id), termin_serie_ab(t.id)
      from kalender_termine t
     where t.owner_id = auth.uid()
     order by t.datum;
end;
$$;
revoke all on function public.meine_termine() from public, anon;
grant execute on function public.meine_termine() to authenticated;

create or replace function public.verbundene_termine()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'inhaber', t.owner_id, 'von_user', t.von_user,
             'datum', t.datum, 'bis_datum', t.bis_datum, 'titel', t.titel, 'ganztaegig', t.ganztaegig,
             'beginn', to_char(t.beginn, 'HH24:MI'), 'ende', to_char(t.ende, 'HH24:MI'),
             'wiederholung', t.wiederholung, 'notiz', t.notiz, 'ort', t.ort,
             'ausfaelle', to_jsonb(termin_ausfaelle(t.id)), 'serie_ab', termin_serie_ab(t.id)) order by t.datum)
      from kalender_termine t
      join kalender_verbindungen v
        on (v.a = ich and v.b = t.owner_id) or (v.b = ich and v.a = t.owner_id)
     where t.von_user = ich
        or (verbunden_termine_sichtbar(t.owner_id, ich) and not t.von_partner)), '[]'::jsonb);
end;
$$;

create or replace function public.partner_kalender(p_token text, p_von date, p_tage integer)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  person kalender_personen := person_zum_link(p_token);
  eigene jsonb;
  termine jsonb;
  ergebnis jsonb;
begin
  if person.id is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  eigene := kalender_codes(person.owner_id, p_von, p_tage);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'vonPartner', t.person_id is not null, 'datum', t.datum, 'titel', t.titel,
           'ganztaegig', t.ganztaegig, 'von', coalesce(to_char(t.beginn, 'HH24:MI'), ''),
           'bis', coalesce(to_char(t.ende, 'HH24:MI'), ''), 'wiederholung', t.wiederholung,
           'notiz', t.notiz, 'ort', t.ort,
           'ausfaelle', to_jsonb(termin_ausfaelle(t.id)), 'serieAb', termin_serie_ab(t.id)) order by t.datum), '[]'::jsonb)
    into termine
    from kalender_termine t
   where t.owner_id = person.owner_id
     and ((t.person_id = person.id and person.darf_eintragen)
          or (not t.von_partner and person.termine_sehen))
     and t.datum <= p_von + (p_tage - 1)
     and (t.wiederholung <> 'nie' or t.datum >= p_von);

  select jsonb_build_object(
           'name', inhaber_vorname(person.owner_id),
           'gast', person.name,
           'darfEintragen', person.darf_eintragen,
           'termineGeteilt', person.termine_sehen,
           'termine', termine,
           'tage', coalesce(jsonb_agg(jsonb_build_array(d::date, eigene ->> (d::date)::text,
                                                         case when person.darf_eintragen then t.schicht end) order by d), '[]'::jsonb))
    into ergebnis
    from generate_series(p_von, p_von + (p_tage - 1), interval '1 day') d
    left join kalender_personen_tage t on t.person_id = person.id and t.tag = d::date;

  update kalender_personen set zuletzt_genutzt = now()
   where id = person.id and (zuletzt_genutzt is null or zuletzt_genutzt < now() - interval '5 minutes');

  return ergebnis;
end;
$$;

create or replace function public.abo_termine(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  inhaber uuid := abo_inhaber(p_token);
  ergebnis jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'datum', t.datum,
           'bis', t.bis_datum,
           'titel', t.titel,
           'ganztaegig', t.ganztaegig,
           'beginn', to_char(t.beginn, 'HH24:MI'),
           'ende', to_char(t.ende, 'HH24:MI'),
           'wiederholung', t.wiederholung,
           'notiz', t.notiz,
           'ort', t.ort,
           'ausfaelle', to_jsonb(termin_ausfaelle(t.id)), 'serie_ab', termin_serie_ab(t.id)) order by t.datum), '[]'::jsonb)
    into ergebnis
    from (select * from kalender_termine k
           where k.owner_id = inhaber and not k.von_partner
             and (coalesce(k.bis_datum, k.datum) >= current_date - 60 or k.wiederholung <> 'nie')
           order by k.datum desc
           limit 500) t;

  return ergebnis;
end;
$$;

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
