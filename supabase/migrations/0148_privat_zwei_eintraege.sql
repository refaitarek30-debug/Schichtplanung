-- Privatbereich: bis zu zwei Einträge je Tag.
--   ebene 1 = Schicht (z. B. aus der Schichtfolge)
--   ebene 2 = Zusatz (z. B. Urlaub an einem Spät-Tag) – die Schicht bleibt
--             sichtbar, bis sie jemand ausdrücklich entfernt.
alter table public.privat_tage add column if not exists ebene smallint not null default 1;
alter table public.privat_tage drop constraint if exists privat_tage_ebene_check;
alter table public.privat_tage add constraint privat_tage_ebene_check check (ebene in (1, 2));
alter table public.privat_tage drop constraint if exists privat_tage_pkey;
alter table public.privat_tage add primary key (user_id, tag, ebene);

-- Schichtfolge schreibt nur Ebene 1; Zusätze bleiben unberührt.
create or replace function public.privat_rotation_anwenden(
  p_start date, p_bis date, p_muster uuid[], p_ueberschreiben boolean
)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  ich uuid := auth.uid();
  laenge integer := coalesce(array_length(p_muster, 1), 0);
  anzahl integer;
begin
  if not ist_privatkonto(ich) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if laenge < 1 or laenge > 56 then
    raise exception 'Das Muster muss 1 bis 56 Tage lang sein.';
  end if;
  if p_start is null or p_bis is null or p_bis < p_start or p_bis - p_start > 1100 then
    raise exception 'Bitte einen Zeitraum von höchstens drei Jahren wählen.';
  end if;
  if exists (select 1 from unnest(p_muster) m
              where m is not null
                and not exists (select 1 from privat_schichtarten s where s.id = m and s.user_id = ich)) then
    raise exception 'Unbekannte Schichtart im Muster.';
  end if;

  if p_ueberschreiben then
    delete from privat_tage
     where user_id = ich and ebene = 1 and tag between p_start and p_bis
       and p_muster[((tag - p_start) % laenge) + 1] is null;
  end if;

  insert into privat_tage (user_id, tag, ebene, schichtart_id)
  select ich, d::date, 1, p_muster[(((d::date) - p_start) % laenge) + 1]
    from generate_series(p_start, p_bis, interval '1 day') d
   where p_muster[(((d::date) - p_start) % laenge) + 1] is not null
  on conflict (user_id, tag, ebene) do update
     set schichtart_id = excluded.schichtart_id
   where p_ueberschreiben;
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

-- partner_kalender: je Tag ein Kürzel – der Zusatz (z. B. Urlaub) hat Vorrang.
-- (Nur der Privat-Zweig ändert sich; siehe 0147.)

create or replace function public.partner_kalender(p_token text, p_von date, p_tage integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  inhaber uuid := partner_inhaber(p_token);
  teilen boolean;
  firma uuid;
  vorname text;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  eigene jsonb;
  ergebnis jsonb;
  termine jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select k.termine_teilen into teilen from kalender_partner k where k.owner_id = inhaber and k.beendet_am is null;

  if ist_privatkonto(inhaber) then
    select split_part(btrim(k.name), ' ', 1) into vorname from privat_konten k where k.user_id = inhaber;
    -- Je Tag ein Kürzel; der Zusatz (Ebene 2, z. B. Urlaub) hat Vorrang.
    select jsonb_object_agg(x.tag::text, x.code)
      into eigene
      from (select distinct on (t.tag) t.tag, privat_code(s.art, s.beginn) as code
              from privat_tage t
              join privat_schichtarten s on s.id = t.schichtart_id
             where t.user_id = inhaber and t.tag between p_von and p_von + (p_tage - 1)
             order by t.tag, t.ebene desc) x;
  else
    select p.company_id, p.first_name into firma, vorname from profiles p where p.id = inhaber;

    perform set_config('request.jwt.claims', json_build_object('sub', inhaber, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', inhaber::text, true);

    select jsonb_object_agg(
             g.day::text,
             case
               when g.absence_code is not null and g.absence_code = upper(g.absence_code) then 'U'
               when g.shift_code in ('F', 'S', 'N') then g.shift_code
               when g.shift_name is not null then 'T'
               else 'X'
             end)
      into eigene
      from shift_plan_grid(firma, p_von, p_tage) g
     where g.is_me;

    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'vonPartner', t.von_partner, 'datum', t.datum, 'titel', t.titel,
           'ganztaegig', t.ganztaegig, 'von', coalesce(to_char(t.beginn, 'HH24:MI'), ''),
           'bis', coalesce(to_char(t.ende, 'HH24:MI'), ''), 'wiederholung', t.wiederholung,
           'notiz', t.notiz, 'ort', t.ort) order by t.datum), '[]'::jsonb)
    into termine
    from kalender_termine t
   where t.owner_id = inhaber
     and (t.von_partner or coalesce(teilen, false))
     and t.datum <= p_von + (p_tage - 1)
     and (t.wiederholung <> 'nie' or t.datum >= p_von);

  select jsonb_build_object(
           'name', vorname,
           'termineGeteilt', coalesce(teilen, false),
           'termine', termine,
           'tage', coalesce(jsonb_agg(jsonb_build_array(d::date, eigene ->> (d::date)::text, t.schicht) order by d), '[]'::jsonb))
    into ergebnis
    from generate_series(p_von, p_von + (p_tage - 1), interval '1 day') d
    left join kalender_partner_tage t on t.owner_id = inhaber and t.tag = d::date;

  update kalender_partner set zuletzt_genutzt = now()
   where owner_id = inhaber and beendet_am is null
     and (zuletzt_genutzt is null or zuletzt_genutzt < now() - interval '5 minutes');

  return ergebnis;
end;
$$;


