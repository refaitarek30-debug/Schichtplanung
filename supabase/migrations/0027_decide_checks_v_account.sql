-- =============================================================
-- Phase 12a · Genehmigung prüft das richtige Konto
--
-- Bisher hat decide_leave_request() beim Genehmigen immer nur das
-- Urlaubskonto geprüft. Ein V-Tag-Antrag ging deshalb auch dann durch,
-- wenn die V-Tage längst aufgebraucht waren. Jetzt entscheidet die Art
-- des Antrags, welches Konto geprüft wird.
-- =============================================================

create or replace function decide_leave_request(
  p_request_id uuid,
  p_decision leave_status,
  p_rejection_reason text default null
)
returns leave_requests
language plpgsql security definer set search_path = public as $$
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
    -- Zwei getrennte Konten: der Antrag sagt, welches gilt.
    select r.kind,
           case when r.kind = 'v_tag' then v.v_remaining_days else v.remaining_days end
      into art, remaining
      from leave_requests r
      join leave_balances_view v
        on v.employee_id = r.employee_id
       and v.year = extract(year from r.start_date)
     where r.id = p_request_id;

    if remaining is not null and remaining < 0 then
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
    case when p_decision = 'approved'
      then case when result.kind = 'v_tag' then 'V-Tag genehmigt' else 'Urlaubsantrag genehmigt' end
      else case when result.kind = 'v_tag' then 'V-Tag abgelehnt' else 'Urlaubsantrag abgelehnt' end
    end,
    case when p_decision = 'approved'
      then 'Dein Antrag wurde genehmigt.'
      else 'Dein Antrag wurde abgelehnt: ' || coalesce(p_rejection_reason, '')
    end,
    'leave_requests', result.id
  from employees e where e.id = result.employee_id;

  return result;
end;
$$;

revoke execute on function decide_leave_request(uuid, leave_status, text) from public, anon;
grant execute on function decide_leave_request(uuid, leave_status, text) to authenticated;
