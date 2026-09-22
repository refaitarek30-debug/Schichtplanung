-- Direkt im Schichtplan alle Antragsarten setzen können.
--
-- Bisher kannte set_leave_for_day nur 'clear', 'v_tag' und alles andere
-- als Urlaub. Mit Sonderurlaub, Bildungsurlaub, Gewerkschaftstag und
-- Altersfreizeit hiess das: die Fuehrung konnte sie im Plan nicht
-- eintragen, obwohl es sie gibt.
--
-- Bewusst KEIN neuer Statuswert: gesetzt wird dieselbe leave_kind, die auch
-- ein Antrag traegt. Dadurch greifen alle bestehenden Regeln unveraendert
-- weiter -- insbesondere leave_requests_check_kontingent, das eine
-- Altersfreizeit ohne Festlegung oder einen Bildungsurlaub ohne Haken auch
-- hier abweist. Die Fuehrung kann im Plan also nichts eintragen, was ueber
-- den Antragsweg unmoeglich waere.
--
-- Unbekannte Werte fallen weiterhin auf Urlaub zurueck, damit ein alter
-- Client nicht scheitert.
create or replace function public.set_leave_for_day(
  p_employee_id uuid,
  p_date date,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  e employees;
  r leave_requests;
  target leave_kind;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration duerfen das.';
  end if;
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;

  select * into r
    from leave_requests
   where employee_id = p_employee_id
     and status in ('approved', 'pending')
     and p_date between start_date and end_date
   order by start_date
   limit 1;

  if p_mode = 'clear' then
    if r.id is null then return; end if;
    perform split_leave_request_day(r, p_date, null);
    return;
  end if;

  target := case
    when p_mode in ('urlaub', 'v_tag', 'altersfreizeit', 'sonderurlaub',
                    'bildungsurlaub', 'gewerkschaftstag')
      then p_mode::leave_kind
    else 'urlaub'::leave_kind
  end;

  if r.id is null then
    insert into leave_requests (
      company_id, employee_id, start_date, end_date, status, kind,
      reason, reviewed_by, reviewed_at
    )
    values (
      e.company_id, p_employee_id, p_date, p_date, 'approved', target,
      'Direkt im Schichtplan eingetragen', auth.uid(), now()
    );
    return;
  end if;

  -- Schon die gewuenschte Art: nichts zu tun.
  if r.kind = target then return; end if;

  perform split_leave_request_day(r, p_date, target);
end;
$function$;

revoke all on function public.set_leave_for_day(uuid, date, text) from public, anon;
grant execute on function public.set_leave_for_day(uuid, date, text) to authenticated;
