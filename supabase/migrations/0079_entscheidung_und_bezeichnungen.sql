-- Entscheidung und Bezeichnungen fuer die neuen Antragsarten.
--
-- Zwei Dinge:
--
--   * leave_kind_label() gibt den Klartextnamen einer Art. Damit steht der
--     Name an EINER Stelle und nicht verstreut in Triggern, Mailtexten und
--     Benachrichtigungen.
--   * decide_leave_request() prueft das Urlaubskonto nur noch fuer Urlaub
--     und V-Tage. Vorher galt "alles ausser v_tag ist Urlaub" -- eine
--     Altersfreizeit waere damit an einem leeren Urlaubskonto gescheitert,
--     obwohl sie damit nichts zu tun hat. Fuer die neuen Arten prueft
--     leave_requests_check_kontingent (0077), und zwar auch beim
--     Genehmigen: zwischen Antrag und Entscheidung kann ein anderer
--     Antrag durchgegangen sein.

create or replace function public.leave_kind_label(p_kind leave_kind)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'urlaub'           then 'Urlaub'
    when 'v_tag'            then 'V-Tag'
    when 'altersfreizeit'   then 'Altersfreizeit'
    when 'sonderurlaub'     then 'Sonderurlaub'
    when 'bildungsurlaub'   then 'Bildungsurlaub'
    when 'gewerkschaftstag' then 'Gewerkschaftstag'
  end;
$$;

revoke all on function public.leave_kind_label(leave_kind) from public, anon;
grant execute on function public.leave_kind_label(leave_kind) to authenticated;

create or replace function public.decide_leave_request(
  p_request_id uuid,
  p_decision leave_status,
  p_rejection_reason text default null
)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $function$
declare
  result leave_requests;
  remaining numeric(4, 1);
  art leave_kind;
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

  if p_decision = 'approved' then
    select r.kind,
           case when r.kind = 'v_tag'  then v.v_remaining_days
                when r.kind = 'urlaub' then v.remaining_days
                else null end
      into art, remaining
      from leave_requests r
      left join leave_balances_view v
        on v.employee_id = r.employee_id
       and v.year = extract(year from r.start_date)
     where r.id = p_request_id;

    if art in ('urlaub', 'v_tag') and remaining is not null and remaining < 0 then
      if art = 'v_tag' then
        raise exception 'Fuer diesen Antrag stehen nicht genuegend V-Tage zur Verfuegung.';
      else
        raise exception 'Fuer diesen Antrag stehen nicht genuegend Urlaubstage zur Verfuegung.';
      end if;
    end if;
  end if;

  update leave_requests
  set status = p_decision,
      rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id
    and company_id = auth_company_id()
    and status = 'pending'
  returning * into result;

  if result.id is null then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    result.company_id, auth.uid(),
    case when p_decision = 'approved' then 'leave.approved' else 'leave.rejected' end,
    'leave_requests', result.id,
    jsonb_build_object('reason', p_rejection_reason, 'kind', result.kind)
  );

  insert into notifications (company_id, employee_id, type, title, body, related_entity, related_id)
  select
    result.company_id, e.id,
    case when p_decision = 'approved' then 'leave_approved' else 'leave_rejected' end,
    leave_kind_label(result.kind) ||
      case when p_decision = 'approved' then ' genehmigt' else ' abgelehnt' end,
    case when p_decision = 'approved'
      then 'Dein Antrag wurde genehmigt.'
      else 'Dein Antrag wurde abgelehnt: ' || coalesce(p_rejection_reason, '')
    end,
    'leave_requests', result.id
  from employees e where e.id = result.employee_id;

  return result;
end;
$function$;

revoke all on function public.decide_leave_request(uuid, leave_status, text) from public, anon;
grant execute on function public.decide_leave_request(uuid, leave_status, text) to authenticated;
