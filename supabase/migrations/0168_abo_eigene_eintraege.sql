-- Kalender-Abo: eigene Einträge aus „Mein Kalender“ (Firma) kommen mit in den
-- Gesamtkalender. Nur der eigene Abo-Link der Person liefert sie (Schlüssel im
-- Link). Datenschutzerklärung Fassung 2.13.
--
-- Zusätzlich: beim Privatkonto feste Reihenfolge, wenn ein Tag zwei Einträge hat.

create or replace function public.abo_plan(p_token text, p_von date, p_tage integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  inhaber uuid := abo_inhaber(p_token);
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  ergebnis jsonb;
begin
  if inhaber is null then
    raise exception 'Dieser Link ist nicht mehr gültig.' using errcode = 'PT404';
  end if;
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  if ist_privatkonto(inhaber) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'tag', t.tag,
             'art', case s.art when 'urlaub' then 'urlaub' when 'krank' then 'abwesend' else 'schicht' end,
             'name', s.name,
             'von', to_char(s.beginn, 'HH24:MI'),
             'bis', to_char(s.ende, 'HH24:MI')) order by t.tag, t.ebene), '[]'::jsonb)
      into ergebnis
      from privat_tage t
      join privat_schichtarten s on s.id = t.schichtart_id
     where t.user_id = inhaber and s.art <> 'frei'
       and t.tag between p_von and p_von + (p_tage - 1);
  else
    select p.company_id into firma from profiles p where p.id = inhaber;

    perform set_config('request.jwt.claims', json_build_object('sub', inhaber, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', inhaber::text, true);

    select coalesce(jsonb_agg(z.j order by z.tag, z.reihe), '[]'::jsonb)
      into ergebnis
      from (
        select g.day as tag, 1 as reihe, jsonb_build_object(
                 'tag', g.day,
                 'art', case
                          when g.absence_code is not null and g.absence_code = upper(g.absence_code) then
                            case when g.absence_code = 'FB' then 'schulung'
                                 when g.absence_code in ('U', 'V', 'AF', 'SU', 'BU', 'G') then 'urlaub'
                                 else 'abwesend' end
                          else 'schicht' end,
                 'name', g.shift_name,
                 'von', to_char(s.start_time, 'HH24:MI'),
                 'bis', to_char(s.end_time, 'HH24:MI')) as j
          from shift_plan_grid(firma, p_von, p_tage) g
          left join lateral (select sh.start_time, sh.end_time from shifts sh
                              where sh.company_id = firma and sh.name = g.shift_name limit 1) s on true
         where g.is_me
           and (g.shift_name is not null
                or (g.absence_code is not null and g.absence_code = upper(g.absence_code)))
        union all
        select e.tag, 2, jsonb_build_object(
                 'tag', e.tag,
                 'art', 'eigen',
                 'name', a.name,
                 'von', to_char(a.beginn, 'HH24:MI'),
                 'bis', to_char(a.ende, 'HH24:MI'))
          from kalender_eigene_tage e
          join kalender_eigene_arten a on a.user_id = e.user_id and a.id = e.art_id
         where e.user_id = inhaber
           and e.tag between p_von and p_von + (p_tage - 1)
      ) z;

    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  end if;

  update kalender_abo set zuletzt_abgerufen = now()
   where user_id = inhaber and beendet_am is null
     and (zuletzt_abgerufen is null or zuletzt_abgerufen < now() - interval '5 minutes');

  return ergebnis;
end;
$$;
