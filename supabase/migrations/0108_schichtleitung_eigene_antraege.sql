-- Schichtleitung darf die eigenen Anträge selbst genehmigen.
--
-- Bisher (0107) entschied über Anträge einer Schichtleitung nur die
-- Administration. Jetzt entscheidet die Schichtleitung ihre eigenen Anträge
-- selbst – weiterhin nur innerhalb der eigenen Schichtgruppe, nie über
-- andere Schichten. Die Sammelgenehmigung und das Eintragen im Plan folgen
-- automatisch, weil sie dieselbe Regel (darf_urlaub_entscheiden) nutzen.
--
-- set_leave_for_day und decide_leave_request werden unverändert neu
-- angelegt, nur mit angepasster Fehlermeldung.

create or replace function public.darf_urlaub_entscheiden(p_employee_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ich employees;
  ziel employees;
begin
  select * into ziel from employees where id = p_employee_id;
  if ziel.id is null or ziel.company_id is distinct from auth_company_id() then
    return false;
  end if;
  if is_admin() then
    return true;
  end if;
  if auth_role() is distinct from 'shift_leader' then
    return false;
  end if;
  select * into ich from employees where id = auth_employee_id();
  if ich.id is null then
    return false;
  end if;
  -- Die eigenen Anträge entscheidet die Schichtleitung selbst.
  if ich.id = ziel.id then
    return true;
  end if;
  if ich.rotation_team is not null then
    return ziel.rotation_team = ich.rotation_team;
  end if;
  return ziel.rotation_team is null and ich.shift_id is not null and ziel.shift_id = ich.shift_id;
end;
$$;

revoke all on function public.darf_urlaub_entscheiden(uuid) from public, anon;
grant execute on function public.darf_urlaub_entscheiden(uuid) to authenticated;

revoke all on function public.darf_urlaub_entscheiden(uuid) from public, anon;
grant execute on function public.darf_urlaub_entscheiden(uuid) to authenticated;

create or replace function public.set_leave_for_day(p_employee_id uuid, p_date date, p_mode text)
returns void
language plpgsql
security definer
set search_path to 'public'
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
  if not darf_urlaub_entscheiden(p_employee_id) then
    raise exception 'Urlaub eintragen darfst du nur für deine eigene Schicht.';
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

  if r.kind = target then return; end if;

  perform split_leave_request_day(r, p_date, target);
end;
$function$;

create or replace function public.decide_leave_request(p_request_id uuid, p_decision leave_status, p_rejection_reason text default null::text)
returns leave_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result leave_requests;
  v_firma uuid := auth_company_id();
  v_gruppe uuid;
  v_anzahl int;
  fehlend text;
  arten text;
  v_von date;
  v_bis date;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Ungueltige Entscheidung.';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_rejection_reason), '') = '' then
    raise exception 'Fuer eine Ablehnung ist eine Begruendung erforderlich.';
  end if;
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;

  select coalesce(r.request_group_id, r.id) into v_gruppe
  from leave_requests r
  where r.id = p_request_id and r.company_id = v_firma;

  if v_gruppe is null then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  -- Schichtleitung entscheidet über Anträge der eigenen Schicht, die
  -- eigenen eingeschlossen. Die Administration über alle.
  if not darf_urlaub_entscheiden((select r.employee_id from leave_requests r where r.id = p_request_id)) then
    raise exception 'Du darfst nur Anträge deiner eigenen Schicht entscheiden.';
  end if;

  -- Nur das Urlaubskonto darf nicht ins Minus. V-Tage dürfen es: wer alles
  -- verbraucht hat, bekommt trotzdem noch einen V-Tag.
  if p_decision = 'approved' then
    select string_agg(distinct x.konto, ' und ') into fehlend
    from (
      select 'Urlaubstage' as konto
      from leave_requests r
      join leave_balances_view v
        on v.employee_id = r.employee_id
       and v.year = extract(year from r.start_date)
      where coalesce(r.request_group_id, r.id) = v_gruppe
        and r.status = 'pending'
        and r.kind = 'urlaub'
        and v.remaining_days < 0
    ) x;

    if fehlend is not null then
      raise exception 'Fuer diesen Antrag stehen nicht genuegend % zur Verfuegung.', fehlend;
    end if;
  end if;

  update leave_requests
  set status = p_decision,
      rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where coalesce(request_group_id, id) = v_gruppe
    and company_id = v_firma
    and status = 'pending';

  get diagnostics v_anzahl = row_count;
  if v_anzahl = 0 then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  select * into result from leave_requests where id = p_request_id;

  select min(start_date), max(end_date),
         string_agg(distinct leave_kind_label(kind), ' und ')
    into v_von, v_bis, arten
  from leave_requests
  where coalesce(request_group_id, id) = v_gruppe and company_id = v_firma;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    result.company_id, auth.uid(),
    case when p_decision = 'approved' then 'leave.approved' else 'leave.rejected' end,
    'leave_requests', result.id,
    jsonb_build_object(
      'reason', p_rejection_reason,
      'kind', result.kind,
      'gruppe', v_gruppe,
      'zeilen', v_anzahl,
      'von', v_von,
      'bis', v_bis
    )
  );

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    result.company_id, e.id,
    case when p_decision = 'approved' then 'leave_approved' else 'leave_rejected' end,
    arten || case when p_decision = 'approved' then ' genehmigt' else ' abgelehnt' end,
    case when v_von = v_bis
         then to_char(v_von, 'DD.MM.YYYY')
         else to_char(v_von, 'DD.MM.YYYY') || ' bis ' || to_char(v_bis, 'DD.MM.YYYY') end
    || case when p_decision = 'approved'
            then ': genehmigt.'
            else ': abgelehnt. ' || coalesce(p_rejection_reason, '') end,
    'leave_requests', result.id
  from employees e where e.id = result.employee_id;

  return result;
end;
$function$;
