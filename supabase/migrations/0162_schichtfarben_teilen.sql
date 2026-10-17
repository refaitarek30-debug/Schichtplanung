-- Schichtfarben der Person mitliefern: Wer fremde Schichten sieht (Partner-
-- Link, verbundene Konten, Gruppen), sieht sie in den Farben der Person
-- selbst. Fehlt eine Farbe, nimmt die App die Standardfarbe.

create or replace function public.kalender_farben_codes(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  erg jsonb;
begin
  if ist_privatkonto(p_user) then
    select jsonb_object_agg(x.code, x.farbe) into erg
      from (select distinct on (privat_code(s.art, s.beginn)) privat_code(s.art, s.beginn) as code, s.farbe
              from privat_schichtarten s
             where s.user_id = p_user
             order by privat_code(s.art, s.beginn), s.reihenfolge) x;
  else
    select jsonb_object_agg(x.code, x.farbe) into erg
      from (select case f.schluessel
                     when 'schicht:F' then 'F' when 'schicht:S' then 'S' when 'schicht:N' then 'N'
                     when 'abw:U' then 'U' when 'frei' then 'X' end as code, f.farbe
              from kalender_farben f
             where f.user_id = p_user
               and f.schluessel in ('schicht:F', 'schicht:S', 'schicht:N', 'abw:U', 'frei')) x;
  end if;
  return coalesce(erg, '{}'::jsonb);
end;
$$;
revoke all on function public.kalender_farben_codes(uuid) from public, anon, authenticated;

create or replace function public.gruppe_tage(p_gruppe uuid, p_von date, p_tage integer)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  m record;
  liste jsonb := '[]'::jsonb;
begin
  if not ist_gruppenmitglied(p_gruppe) then
    raise exception 'Du bist nicht in dieser Gruppe.';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  for m in
    select x.user_id, x.user_id = auth.uid() as ich from kalender_gruppen_mitglieder x
     where x.gruppe_id = p_gruppe
     order by x.user_id = auth.uid() desc, x.beigetreten_am
  loop
    liste := liste || jsonb_build_array(jsonb_build_object(
      'id', m.user_id,
      'name', inhaber_vorname(m.user_id),
      'ich', m.ich,
      'tage', kalender_codes(m.user_id, p_von, p_tage),
      'farben', kalender_farben_codes(m.user_id)));
  end loop;
  return liste;
end;
$$;

create or replace function public.meine_gruppen_tage(p_von date, p_tage integer)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare
  m record;
  ich uuid := auth.uid();
  liste jsonb := '[]'::jsonb;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  for m in
    select x.user_id, jsonb_agg(x.gruppe_id) as gruppen
      from kalender_gruppen_mitglieder x
      join kalender_gruppen_mitglieder meine on meine.gruppe_id = x.gruppe_id and meine.user_id = ich
     where x.user_id <> ich
     group by x.user_id
  loop
    liste := liste || jsonb_build_array(jsonb_build_object(
      'id', m.user_id,
      'name', inhaber_vorname(m.user_id),
      'gruppen', m.gruppen,
      'tage', kalender_codes(m.user_id, p_von, p_tage),
      'farben', kalender_farben_codes(m.user_id)));
  end loop;
  return liste;
end;
$$;

create or replace function public.verbundene_tage(p_von date, p_tage integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  v record;
  liste jsonb := '[]'::jsonb;
begin
  if not kalender_nutzer() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  for v in select case when x.a = ich then x.b else x.a end as partner
             from kalender_verbindungen x where x.a = ich or x.b = ich
  loop
    liste := liste || jsonb_build_array(jsonb_build_object(
      'id', v.partner, 'tage', kalender_codes(v.partner, p_von, p_tage),
      'farben', kalender_farben_codes(v.partner)));
  end loop;
  return liste;
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
           'farben', kalender_farben_codes(person.owner_id),
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
