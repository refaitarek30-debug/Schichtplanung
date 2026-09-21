-- Die Art steht im Hinweis und in der Schichtliste.
--
-- Zwei Stellen nannten bisher pauschal "Urlaub":
--
--   * der Hinweis an die Führung ("X hat Urlaub beantragt") samt Mail
--   * die Liste "Abwesend in meiner Schicht"
--
-- Mit vier weiteren Arten wäre das schlicht falsch. Beide nennen jetzt
-- leave_kind_label().
--
-- Wichtig bei der Schichtliste: die Art kommt NUR mit, wenn die betroffene
-- Person ihren Grund freigegeben hat. Ohne Freigabe bleibt sie leer und die
-- Liste zeigt weiterhin nur "Abwesend" -- sonst würde die Art genau das
-- verraten, was die Maskierung verbergen soll.

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

  art := leave_kind_label(new.kind);

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    new.company_id, p.employee_id,
    'leave_submitted', 'Neuer Antrag: ' || art,
    antragsteller || ' hat ' || art || ' beantragt.',
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

  insert into email_outbox (company_id, empfaenger, betreff, text_teil, html_teil, anlass, related_id)
  select
    new.company_id,
    p.email,
    'Neuer Antrag (' || art || '): ' || antragsteller,
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

drop function if exists public.my_shift_leave(date, date);

create function public.my_shift_leave(p_from date, p_to date)
returns table (
  employee_id uuid,
  employee_name text,
  start_date date,
  end_date date,
  status leave_status,
  is_me boolean,
  reason_visible boolean,
  kind leave_kind
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth_employee_id();
  meine_firma uuid := auth_company_id();
  fuehrung boolean := is_leadership();
  my_shift uuid;
  my_pattern uuid;
begin
  if me is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  select e.shift_id, e.rotation_pattern_id into my_shift, my_pattern
  from employees e where e.id = me;

  return query
  with sichtbar as (
    select
      r.employee_id as emp_id,
      e.first_name || ' ' || e.last_name as emp_name,
      r.start_date as von,
      r.end_date as bis,
      r.status as stand,
      (r.employee_id = me) as ich,
      e.last_name as nachname,
      r.kind as art,
      case
        when r.employee_id = me then true
        when fuehrung then true
        else exists (
          select 1
          from public.profiles sp
          join public.privacy_settings ps on ps.user_id = sp.id
          where sp.employee_id = r.employee_id
            and sp.company_id = meine_firma
            and ps.company_id = meine_firma
            and ps.absence_visibility = 'shift'
        )
      end as grund_sichtbar
    from leave_requests r
    join employees e on e.id = r.employee_id
    where e.company_id = meine_firma
      and e.active
      and r.status in ('approved', 'pending')
      and r.start_date <= p_to
      and r.end_date >= p_from
      and (
        (my_shift is not null and e.shift_id = my_shift)
        or (my_pattern is not null and e.rotation_pattern_id = my_pattern)
        or r.employee_id = me
      )
  )
  select emp_id, emp_name, von, bis, stand, ich, grund_sichtbar,
         case when grund_sichtbar then art else null end
  from sichtbar
  where grund_sichtbar or stand = 'approved'
  order by von, nachname;
end;
$$;

revoke all on function public.my_shift_leave(date, date) from public, anon;
grant execute on function public.my_shift_leave(date, date) to authenticated;
