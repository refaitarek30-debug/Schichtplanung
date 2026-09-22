-- Ein Hinweis je Einreichung, nicht je Zeile.
--
-- Gemessen: eine Einreichung über drei Wochen erzeugte 5 Zeilen und damit
-- 10 Benachrichtigungen plus ebenso viele Mails. Der Auslöser sitzt an der
-- Zeile, und eine Einreichung besteht seit jeher aus mehreren.
--
-- Für den Mitarbeiter ist es ein Antrag; die Führung soll ihn auch einmal
-- angekündigt bekommen, mit dem GANZEN Zeitraum darin.
--
-- Lösung ohne Umbau: submit_leave_auto setzt eine Markierung für die Dauer
-- der Transaktion (0089). Der Zeilen-Auslöser schweigt dann, und die
-- Funktion meldet am Ende einmal -- da kennt sie den vollständigen
-- Zeitraum, den die erste Zeile noch gar nicht kennen konnte.
--
-- Der Weg über das Formular mit ausdrücklicher Art legt weiterhin genau
-- eine Zeile an und läuft unverändert über den Zeilen-Auslöser.

create or replace function public.leave_requests_notify_leadership()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  antragsteller text;
  gruppe rotation_team;
  art text;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  -- Sammeleinreichung: der Hinweis kommt gebuendelt aus submit_leave_auto.
  if coalesce(current_setting('schichtplan.sammelantrag', true), '') = 'an' then
    return new;
  end if;

  select e.first_name || ' ' || e.last_name, e.rotation_team
    into antragsteller, gruppe
    from employees e where e.id = new.employee_id;

  art := leave_kind_label(new.kind);

  perform notify_leave_submitted(
    new.company_id, new.employee_id, new.id, antragsteller, gruppe,
    art, new.start_date, new.end_date, new.requested_days, new.reason
  );

  return new;
end;
$function$;

-- Der gemeinsame Kern: einmal benachrichtigen, einmal mailen.
-- Bisher stand dieser Text zweimal im Auslöser; jetzt an einer Stelle,
-- damit Sammel- und Einzelantrag nicht auseinanderlaufen können.
--
-- Unveraendert uebernommen: der Ausschluss des Antragstellers, die Pruefung
-- auf ein aktives Konto und die Beschraenkung der Mail auf die
-- Schichtleitung der betroffenen Rotationsgruppe.
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
set search_path = public
as $function$
declare
  firma text;
  zeitraum text;
  tage text;
  per_mail boolean;
begin
  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    p_company_id, p.employee_id,
    'leave_submitted', 'Neuer Antrag: ' || p_art,
    p_antragsteller || ' hat ' || p_art || ' beantragt.',
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

  zeitraum := case
    when p_von = p_bis then to_char(p_von, 'DD.MM.YYYY')
    else to_char(p_von, 'DD.MM.YYYY') || ' bis ' || to_char(p_bis, 'DD.MM.YYYY')
  end;

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

-- Nur die Datenbank ruft sie auf, kein Client.
revoke all on function public.notify_leave_submitted(uuid, uuid, uuid, text, rotation_team, text, date, date, numeric, text) from public, anon, authenticated;
