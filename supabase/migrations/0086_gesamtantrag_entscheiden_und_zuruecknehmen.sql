-- Entscheiden und Zurückziehen gelten für den ganzen Zeitraum.
--
-- Die Zeilen einer Einreichung tragen seit 0085 dieselbe
-- request_group_id. Wer eine davon genehmigt, genehmigt alle; wer eine
-- ablehnt, lehnt alle ab. Eine Teilablehnung einzelner Tage oder einzelner
-- Arten gibt es nicht mehr -- der Mitarbeiter stellt nach einer Ablehnung
-- einen neuen Antrag.
--
-- Rückwärtskompatibel: ein Antrag ohne Gruppe (request_group_id is null)
-- bildet seine eigene Gruppe. Für ihn ändert sich nichts. Die Signaturen
-- bleiben gleich, der Aufruf aus dem Frontend ebenfalls.

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

  -- Die Klammer bestimmen. Ohne Gruppe ist der Antrag seine eigene.
  select coalesce(r.request_group_id, r.id) into v_gruppe
  from leave_requests r
  where r.id = p_request_id and r.company_id = v_firma;

  if v_gruppe is null then
    raise exception 'Der Antrag wurde bereits entschieden oder existiert nicht.';
  end if;

  -- Kontopruefung ueber den ganzen Zeitraum, je Konto einmal. Das Jahr
  -- kommt aus dem jeweiligen Teilzeitraum, nicht aus dem ersten Tag der
  -- Gruppe: ein Antrag ueber den Jahreswechsel trifft zwei Konten.
  if p_decision = 'approved' then
    select string_agg(distinct x.konto, ' und ') into fehlend
    from (
      select case when r.kind = 'v_tag' then 'V-Tage' else 'Urlaubstage' end as konto
      from leave_requests r
      join leave_balances_view v
        on v.employee_id = r.employee_id
       and v.year = extract(year from r.start_date)
      where coalesce(r.request_group_id, r.id) = v_gruppe
        and r.status = 'pending'
        and r.kind in ('urlaub', 'v_tag')
        and case when r.kind = 'v_tag' then v.v_remaining_days else v.remaining_days end < 0
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

  -- Ein Protokolleintrag je Entscheidung, nicht je Zeile.
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

  -- Ebenso eine Benachrichtigung, mit dem ganzen Zeitraum darin.
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

revoke all on function public.decide_leave_request(uuid, leave_status, text) from public, anon;
grant execute on function public.decide_leave_request(uuid, leave_status, text) to authenticated;

-- Zurueckziehen ebenfalls fuer den ganzen Zeitraum.
create or replace function public.withdraw_leave_request(p_request_id uuid)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $function$
declare
  result leave_requests;
  v_gruppe uuid;
  v_anzahl int;
begin
  select coalesce(r.request_group_id, r.id) into v_gruppe
  from leave_requests r
  where r.id = p_request_id and r.employee_id = auth_employee_id();

  if v_gruppe is null then
    raise exception 'Der Antrag laesst sich nicht mehr zurueckziehen.';
  end if;

  update leave_requests
  set status = 'withdrawn'
  where coalesce(request_group_id, id) = v_gruppe
    and employee_id = auth_employee_id()
    and status = 'pending';

  get diagnostics v_anzahl = row_count;
  if v_anzahl = 0 then
    raise exception 'Der Antrag laesst sich nicht mehr zurueckziehen.';
  end if;

  select * into result from leave_requests where id = p_request_id;
  return result;
end;
$function$;

revoke all on function public.withdraw_leave_request(uuid) from public, anon;
grant execute on function public.withdraw_leave_request(uuid) to authenticated;
