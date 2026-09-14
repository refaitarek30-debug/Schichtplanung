-- ---------------------------------------------------------------
-- Phase A · Zustimmung zu Datenschutzerklaerung und AVV
--
-- Sobald fremde Unternehmen echte Beschaeftigtendaten eintragen, muss
-- dokumentiert sein, dass sie die Datenschutzerklaerung gelesen und den
-- Auftragsverarbeitungsvertrag akzeptiert haben -- und wann. Ohne
-- Zeitstempel ist die Zustimmung im Streitfall nicht belegbar.
--
-- Der Zeitstempel entsteht in register_company(), nicht im Browser: was
-- der Client schickt, ist kein Nachweis. Die Funktion verweigert die
-- Registrierung, wenn nicht zugestimmt wurde.
--
-- Beim Testen der neuen Fassung ist ausserdem aufgefallen, dass die
-- Selbstregistrierung seit 0030 ueberhaupt nicht mehr funktioniert hat --
-- siehe die Anmerkung bei company_settings weiter unten.
-- ---------------------------------------------------------------

alter table companies
  add column if not exists avv_accepted_at timestamptz;

comment on column companies.avv_accepted_at is
  'Zeitpunkt, zu dem bei der Registrierung der Datenschutzerklaerung und dem AVV zugestimmt wurde. Null = Altbestand vor Einfuehrung der Pflichtangabe.';

-- Der neue Parameter kommt mit Vorgabewert dazu, damit ein noch nicht
-- aktualisierter Client die Funktion weiterhin aufrufen kann -- er laeuft
-- dann in die Fehlermeldung statt in einen 404.
drop function if exists register_company(text, text, text, text);

create or replace function register_company(
  p_company_name text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_avv_accepted boolean default false
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
  if not coalesce(p_avv_accepted, false) then
    raise exception 'Bitte die Datenschutzerklärung und den Auftragsverarbeitungsvertrag bestätigen.';
  end if;

  insert into companies (name, avv_accepted_at)
  values (trim(p_company_name), now())
  returning id into v_company_id;

  insert into employees (company_id, personnel_number, first_name, last_name, email, role, department)
  values (v_company_id, '10000', trim(p_first_name), trim(p_last_name), trim(p_email), 'admin', 'Verwaltung')
  returning id into v_employee_id;

  insert into shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values
    (v_company_id, 'Frühschicht', 'F', '06:00', '14:00', '#F59E0B', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Spätschicht', 'S', '14:00', '22:00', '#16A34A', 1, 1, '{0,1,2,3,4,5,6}'),
    (v_company_id, 'Nachtschicht', 'N', '22:00', '06:00', '#2F5BEA', 1, 1, '{0,1,2,3,4,5,6}');

  -- Kein "on conflict (company_id)": diese Funktion gibt eine Spalte
  -- company_id zurueck, und die Inferenzklausel wird als Ausdruck geparst.
  -- Seit 0030 ist deshalb *jede* Selbstregistrierung mit
  -- "column reference company_id is ambiguous" abgebrochen -- ein neues
  -- Unternehmen konnte sich seitdem gar nicht mehr anlegen. Die Pruefung
  -- per if-not-exists ist eindeutig und tut dasselbe; das Unternehmen ist
  -- ohnehin gerade erst entstanden, ein Konflikt ist nicht moeglich.
  if not exists (select 1 from company_settings cs where cs.company_id = v_company_id) then
    insert into company_settings (company_id, state) values (v_company_id, 'NW');
  end if;

  -- Ohne Feiertage rechnet die Urlaubsberechnung falsch, darum sofort.
  perform ensure_holidays(v_company_id, jahr, false);
  perform ensure_holidays(v_company_id, jahr + 1, false);

  return query select v_company_id, v_employee_id;
end;
$$;

-- Die Selbstregistrierung ist der einzige bewusst anonyme Einstiegspunkt
-- im ganzen Schema -- ohne ihn koennte sich kein neues Unternehmen anlegen.
revoke execute on function register_company(text, text, text, text, boolean) from public;
grant execute on function register_company(text, text, text, text, boolean) to anon, authenticated;
