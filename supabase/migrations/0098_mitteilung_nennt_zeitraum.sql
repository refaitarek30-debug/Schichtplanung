-- Die Mitteilung in der Glocke nennt den Zeitraum.
--
-- Bisher stand da nur „Stephan Krüger hat Urlaub beantragt." Stellte
-- jemand mehrere Anträge, lagen gleich lautende Zeilen untereinander, die
-- wie Doppel aussahen -- es waren aber verschiedene Anträge. Jetzt:
--
--   Stephan Krüger hat Urlaub beantragt: 16.07.2027.
--   Stephan Krüger hat Urlaub beantragt: 14.06.2027 bis 16.06.2027.
--
-- Sonst unverändert gegenüber 0088/0089: dieselben Empfänger, dieselbe
-- E-Mail. Bestehende Mitteilungen werden nicht umgeschrieben.
create or replace function public.notify_leave_submitted(
  p_company_id uuid,
  p_employee_id uuid,
  p_request_id uuid,
  p_antragsteller text,
  p_gruppe rotation_team,
  p_art text,
  p_von date,
  p_bis date,
  p_tage numeric,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  firma text;
  zeitraum text;
  tage text;
  per_mail boolean;
begin
  -- Früher erst für die E-Mail berechnet, jetzt auch für die Glocke.
  zeitraum := case
    when p_von = p_bis then to_char(p_von, 'DD.MM.YYYY')
    else to_char(p_von, 'DD.MM.YYYY') || ' bis ' || to_char(p_bis, 'DD.MM.YYYY')
  end;

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    p_company_id, p.employee_id,
    'leave_submitted', 'Neuer Antrag: ' || p_art,
    p_antragsteller || ' hat ' || p_art || ' beantragt: ' || zeitraum || '.',
    'leave_requests', p_request_id
  from profiles p
  where p.company_id = p_company_id
    and p.role in ('shift_leader', 'admin')
    and p.employee_id is not null
    and p.active
    and p.employee_id is distinct from p_employee_id;

  select coalesce(s.notify_leave_email, true) into per_mail
    from company_settings s where s.company_id = p_company_id;
  if not coalesce(per_mail, true) then
    return;
  end if;

  select c.name into firma from companies c where c.id = p_company_id;

  tage := case
    when p_tage = trunc(p_tage) then trunc(p_tage)::text
    else replace(to_char(p_tage, 'FM9990D0'), '.', ',')
  end;

  insert into email_outbox (company_id, empfaenger, betreff, text_teil, html_teil, anlass, related_id)
  select
    p_company_id,
    p.email,
    'Neuer Antrag (' || p_art || '): ' || p_antragsteller,
    'Hallo ' || coalesce(p.first_name, '') || ',' || chr(10) || chr(10) ||
      p_antragsteller || ' hat ' || p_art || ' beantragt.' || chr(10) ||
      'Zeitraum: ' || zeitraum || chr(10) ||
      'Tage: ' || tage || chr(10) ||
      coalesce('Kommentar: ' || nullif(trim(p_reason), '') || chr(10), '') || chr(10) ||
      'Der Antrag liegt im Schichtplan zur Entscheidung bereit.' || chr(10) || chr(10) ||
      firma || ' · Schichtplan',
    '<p>Hallo ' || coalesce(p.first_name, '') || ',</p>' ||
      '<p><strong>' || p_antragsteller || '</strong> hat ' || p_art || ' beantragt.</p>' ||
      '<ul>' ||
      '<li>Zeitraum: ' || zeitraum || '</li>' ||
      '<li>Tage: ' || tage || '</li>' ||
      coalesce('<li>Kommentar: ' || nullif(trim(p_reason), '') || '</li>', '') ||
      '</ul>' ||
      '<p>Der Antrag liegt im Schichtplan zur Entscheidung bereit.</p>' ||
      '<p style="color:#6b7280;font-size:12px">' || firma || ' · Schichtplan</p>',
    'urlaubsantrag',
    p_request_id
  from profiles p
  join employees pe on pe.id = p.employee_id
  where p.company_id = p_company_id
    and p.active
    and p.email is not null
    and p.email <> ''
    and p.employee_id is distinct from p_employee_id
    and (
      p.role = 'admin'
      or (p.role = 'shift_leader'
          and (p_gruppe is null or pe.rotation_team is null or pe.rotation_team = p_gruppe))
    );
end;
$function$;
