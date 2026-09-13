-- =============================================================
-- Phase 12d · Feiertage schon bei der Registrierung
--
-- Eine neue Firma soll nicht mit leerem Feiertagskalender starten. Dazu
-- lässt sich das Bundesland später umstellen – dann müssen die alten
-- Tage weichen, sonst bleibt Fronleichnam stehen, wenn jemand von
-- Nordrhein-Westfalen nach Hamburg wechselt.
-- =============================================================

drop function if exists ensure_holidays(uuid, int);

create or replace function ensure_holidays(
  p_company_id uuid,
  p_year int,
  p_replace boolean default false
)
returns int language plpgsql security definer set search_path = public as $$
declare
  bl text;
  n int;
begin
  if p_company_id is distinct from auth_company_id() and auth_company_id() is not null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_year < 2020 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  select coalesce(s.state, 'NW') into bl
    from company_settings s where s.company_id = p_company_id;
  bl := coalesce(bl, 'NW');

  if p_replace then
    -- Betriebsruhe bleibt stehen, die ist von Hand gepflegt.
    delete from holidays
     where company_id = p_company_id
       and extract(year from date) = p_year
       and not company_closure;
  end if;

  with neu as (
    insert into holidays (company_id, date, name, region)
    select p_company_id, h.tag, h.bezeichnung, bl
      from german_holidays(p_year, bl) h
    on conflict (company_id, date) do nothing
    returning 1
  )
  select count(*) into n from neu;

  return n;
end;
$$;

revoke execute on function ensure_holidays(uuid, int, boolean) from public, anon;
grant execute on function ensure_holidays(uuid, int, boolean) to authenticated;

-- Bundesland umstellen und die Feiertage der nächsten Jahre neu setzen.
create or replace function set_company_state(p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare
  firma uuid := auth_company_id();
  jahr int := extract(year from current_date)::int;
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf das.';
  end if;
  if upper(p_state) not in
     ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH') then
    raise exception 'Unbekanntes Bundesland.';
  end if;

  insert into company_settings (company_id, state) values (firma, upper(p_state))
  on conflict (company_id) do update set state = upper(p_state), updated_at = now();

  perform ensure_holidays(firma, jahr, true);
  perform ensure_holidays(firma, jahr + 1, true);
  perform ensure_holidays(firma, jahr + 2, true);
end;
$$;

revoke execute on function set_company_state(text) from public, anon;
grant execute on function set_company_state(text) to authenticated;

-- Registrierung: Einstellungen und Feiertage gleich mit anlegen.
create or replace function register_company(
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_email text
)
returns table (company_id uuid, employee_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid;
  v_employee_id uuid;
  jahr int := extract(year from current_date)::int;
begin
  if coalesce(trim(p_company_name), '') = '' then raise exception 'Bitte einen Unternehmensnamen angeben.'; end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then raise exception 'Bitte Vor- und Nachnamen angeben.'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'Bitte eine E-Mail-Adresse angeben.'; end if;

  insert into companies (name) values (trim(p_company_name)) returning id into v_company_id;

  insert into employees (company_id, personnel_number, first_name, last_name, email, role, department)
  values (v_company_id, '10000', trim(p_first_name), trim(p_last_name), trim(p_email), 'admin', 'Verwaltung')
  returning id into v_employee_id;

  insert into shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values
    (v_company_id, 'Frühschicht', 'F', '06:00', '14:00', '#F59E0B', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Spätschicht', 'S', '14:00', '22:00', '#16A34A', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Nachtschicht', 'N', '22:00', '06:00', '#2F5BEA', 1, 1, '{0,1,2,3,4,5,6}');

  insert into company_settings (company_id, state) values (v_company_id, 'NW')
  on conflict (company_id) do nothing;

  -- Ohne Feiertage rechnet die Urlaubsberechnung falsch, darum sofort.
  perform ensure_holidays(v_company_id, jahr, false);
  perform ensure_holidays(v_company_id, jahr + 1, false);

  return query select v_company_id, v_employee_id;
end;
$$;
