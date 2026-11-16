-- =============================================================
-- 0230 · Geteilter Kalender: Schichten trotz Zwei-Faktor sichtbar
--
-- kalender_codes() liest den Betriebsplan „als“ die Person, deren Kalender
-- geteilt ist. Seit zugang_ok() (Zwei-Faktor) fehlte dabei die Stufe aal2:
-- hatte die Person Zwei-Faktor eingerichtet, schlug shift_plan_grid() fehl
-- und der Partner sah gar keine Schichten mehr (die ganze Abfrage brach ab).
--
-- Die Funktion ist nur intern aufrufbar (kein execute für anon/authenticated);
-- die Berechtigung prüft der Aufrufer (Verbindung bzw. Link). Sie gibt nur
-- die Kürzel der eigenen Tage zurück. Ist die Person gesperrt, bleibt der
-- geteilte Kalender leer statt die Abfrage des Partners abzubrechen.
-- =============================================================

create or replace function public.kalender_codes(p_user uuid, p_von date, p_tage integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  firma uuid;
  vorher text := current_setting('request.jwt.claims', true);
  vorher_sub text := current_setting('request.jwt.claim.sub', true);
  codes jsonb;
begin
  if p_tage < 1 or p_tage > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;
  if nur_privatkonto(p_user) then
    select jsonb_object_agg(x.tag::text, x.code) into codes
      from (select distinct on (t.tag) t.tag, privat_code(s.art, s.beginn) as code
              from privat_tage t
              join privat_schichtarten s on s.id = t.schichtart_id
             where t.user_id = p_user and t.tag between p_von and p_von + (p_tage - 1)
             order by t.tag, t.ebene desc) x;
    return coalesce(codes, '{}'::jsonb);
  end if;

  select p.company_id into firma from profiles p where p.id = p_user and p.active and p.employee_id is not null;
  if firma is null then
    return '{}'::jsonb;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  begin
    if auth_company_id() is distinct from firma then
      -- z. B. Konto gesperrt: nichts zeigen, aber nicht abbrechen.
      codes := '{}'::jsonb;
    else
      select jsonb_object_agg(
               g.day::text,
               case
                 when g.absence_code is not null and g.absence_code = upper(g.absence_code) then 'U'
                 when g.shift_code in ('F', 'S', 'N') then g.shift_code
                 when g.shift_name is not null then 'T'
                 else 'X'
               end)
        into codes
        from shift_plan_grid(firma, p_von, p_tage) g
       where g.is_me;
    end if;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(vorher, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(vorher_sub, ''), true);
  return coalesce(codes, '{}'::jsonb);
end;
$$;

revoke all on function public.kalender_codes(uuid, date, integer) from public, anon, authenticated;
