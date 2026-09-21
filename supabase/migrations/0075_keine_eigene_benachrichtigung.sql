-- Kein Hinweis auf den eigenen Urlaubsantrag.
--
-- Gemessen am Bestand: zu fünf Anträgen von Tarek Refai lagen zehn
-- Benachrichtigungen vor -- je eine für Matthias Lipfert UND eine für Tarek
-- Refai selbst. In der eigenen Glocke stand also "Tarek Refai hat Urlaub
-- beantragt".
--
-- Die Ursache steckt im Unterschied zwischen den beiden Einfügungen
-- derselben Funktion: der Mailversand filtert mit
-- `p.employee_id is distinct from new.employee_id`, die Benachrichtigung
-- nicht. Beide sollen dieselbe Regel haben.
--
-- Zusätzlich wird `p.active` geprüft, wie beim Mailversand auch: ein
-- deaktiviertes Konto muss keine Hinweise mehr sammeln.
--
-- Bewusst NICHT geändert: die Benachrichtigung geht weiterhin an jede
-- Schichtleitung, der Mailversand dagegen nur an die der betroffenen
-- Rotationsgruppe. Das ist ein zweiter Unterschied zwischen den beiden
-- Wegen, aber kein offensichtlicher Fehler -- wer darüber entscheidet,
-- soll das bewusst tun und nicht nebenbei hier.

create or replace function public.leave_requests_notify_leadership()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  antragsteller text;
  firma text;
  zeitraum text;
  tage text;
  art text;
  per_mail boolean;
  gruppe rotation_team;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select e.first_name || ' ' || e.last_name, e.rotation_team
    into antragsteller, gruppe
    from employees e where e.id = new.employee_id;

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    new.company_id, p.employee_id,
    'leave_submitted', 'Neuer Urlaubsantrag',
    antragsteller || ' hat Urlaub beantragt.',
    'leave_requests', new.id
  from profiles p
  where p.company_id = new.company_id
    and p.role in ('shift_leader', 'admin')
    and p.employee_id is not null
    and p.active
    -- Wer den Antrag stellt, braucht keinen Hinweis darauf.
    and p.employee_id is distinct from new.employee_id;

  select coalesce(s.notify_leave_email, true) into per_mail
    from company_settings s where s.company_id = new.company_id;
  if not coalesce(per_mail, true) then
    return new;
  end if;

  select c.name into firma from companies c where c.id = new.company_id;

  zeitraum := case
    when new.start_date = new.end_date then to_char(new.start_date, 'DD.MM.YYYY')
    else to_char(new.start_date, 'DD.MM.YYYY') || ' bis ' || to_char(new.end_date, 'DD.MM.YYYY')
  end;

  tage := case
    when new.requested_days = trunc(new.requested_days)
      then trunc(new.requested_days)::text
    else replace(to_char(new.requested_days, 'FM9990D0'), '.', ',')
  end;

  art := case new.kind when 'v_tag' then 'V-Tag' else 'Urlaub' end;

  insert into email_outbox (company_id, empfaenger, betreff, text_teil, html_teil, anlass, related_id)
  select
    new.company_id,
    p.email,
    'Neuer Urlaubsantrag: ' || antragsteller,
    'Hallo ' || coalesce(p.first_name, '') || ',' || chr(10) || chr(10) ||
      antragsteller || ' hat ' || art || ' beantragt.' || chr(10) ||
      'Zeitraum: ' || zeitraum || chr(10) ||
      'Tage: ' || tage || chr(10) ||
      coalesce('Kommentar: ' || nullif(trim(new.reason), '') || chr(10), '') || chr(10) ||
      'Der Antrag liegt im Schichtplan zur Entscheidung bereit.' || chr(10) || chr(10) ||
      firma || ' · Schichtplan',
    '<p>Hallo ' || coalesce(p.first_name, '') || ',</p>' ||
      '<p><strong>' || antragsteller || '</strong> hat ' || art || ' beantragt.</p>' ||
      '<ul>' ||
      '<li>Zeitraum: ' || zeitraum || '</li>' ||
      '<li>Tage: ' || tage || '</li>' ||
      coalesce('<li>Kommentar: ' || nullif(trim(new.reason), '') || '</li>', '') ||
      '</ul>' ||
      '<p>Der Antrag liegt im Schichtplan zur Entscheidung bereit.</p>' ||
      '<p style="color:#6b7280;font-size:12px">' || firma || ' · Schichtplan</p>',
    'urlaubsantrag',
    new.id
  from profiles p
  join employees pe on pe.id = p.employee_id
  where p.company_id = new.company_id
    and p.active
    and p.email is not null
    and p.email <> ''
    and p.employee_id is distinct from new.employee_id
    and (
      p.role = 'admin'
      or (p.role = 'shift_leader'
          and (gruppe is null or pe.rotation_team is null or pe.rotation_team = gruppe))
    );

  return new;
end;
$function$;
