-- Schichtleitung entscheidet nur über die eigene Schicht.
--
-- Eine Schichtleitung genehmigt oder lehnt nur Anträge von Personen ihrer
-- eigenen Schichtgruppe ab (Schicht C nur Schicht C) – und nie ihre eigenen.
-- Dasselbe gilt für das direkte Eintragen von Urlaub im Plan und für die
-- Sammelgenehmigung. Die Administration entscheidet über alle.
--
-- Grundlage ist die Schichtgruppe (rotation_team). Wer keine hat, wird über
-- die feste Schicht (shift_id) zugeordnet.

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
  if ich.id is null or ich.id = ziel.id then
    return false;
  end if;
  if ich.rotation_team is not null then
    return ziel.rotation_team = ich.rotation_team;
  end if;
  return ziel.rotation_team is null and ich.shift_id is not null and ziel.shift_id = ich.shift_id;
end;
$$;

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
    raise exception 'Urlaub eintragen darfst du nur für deine eigene Schicht – und nicht für dich selbst.';
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

  -- Schichtleitung entscheidet nur über Anträge der eigenen Schicht – und
  -- nie über die eigenen. Die Administration über alle.
  if not darf_urlaub_entscheiden((select r.employee_id from leave_requests r where r.id = p_request_id)) then
    raise exception 'Du darfst nur Anträge deiner eigenen Schicht entscheiden – und nicht deine eigenen.';
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

create or replace function public.sammelgenehmigung_kandidaten(p_jahr integer default null)
returns table (antrag_id uuid, employee_id uuid, von date, bis date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select (array_agg(lr.id order by lr.start_date))[1],
         (array_agg(lr.employee_id order by lr.start_date))[1],
         min(lr.start_date),
         max(lr.end_date)
    from leave_requests lr
   where lr.company_id = v_firma
     and lr.status = 'pending'
     and darf_urlaub_entscheiden(lr.employee_id)
   group by coalesce(lr.request_group_id, lr.id)
  having p_jahr is null
      or extract(year from min(lr.start_date))::int = p_jahr
      or extract(year from max(lr.end_date))::int = p_jahr
   order by min(lr.created_at), min(lr.start_date);
end;
$$;

create or replace function public.sicher_genehmigen(p_request_id uuid)
returns table (ergebnis text, grund text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
  r record;
  v_sicher boolean;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  select coalesce(x.request_group_id, x.id) as gruppe
    into r
    from leave_requests x
   where x.id = p_request_id and x.company_id = v_firma and x.status = 'pending';
  if r.gruppe is null then
    return query select 'uebersprungen'::text, 'bereits entschieden'::text;
    return;
  end if;
  if not darf_urlaub_entscheiden((select x.employee_id from leave_requests x where x.id = p_request_id)) then
    return query select 'uebersprungen'::text, 'andere Schicht'::text;
    return;
  end if;

  select (array_agg(lr.id order by lr.start_date))[1] as erste_id,
         (array_agg(lr.employee_id order by lr.start_date))[1] as employee_id,
         min(lr.start_date) as von,
         max(lr.end_date) as bis
    into r
    from leave_requests lr
   where coalesce(lr.request_group_id, lr.id) = r.gruppe
     and lr.status = 'pending';

  select not exists (
    select 1 from public.check_leave_staffing_impact(r.employee_id, r.von, r.bis) i
    where i.status <> 'ok'
  ) into v_sicher;
  if not v_sicher then
    return query select 'uebersprungen'::text, 'Besetzung wäre knapp'::text;
    return;
  end if;

  select not exists (
    select 1
    from generate_series(r.von, r.bis, interval '1 day') d
    cross join lateral (select effective_shift_id(r.employee_id, d::date) as sid) x
    cross join lateral public.qualifikation_besetzung(x.sid, d::date, null, true, r.employee_id) m
    join lateral public.qualifikation_besetzung(x.sid, d::date, r.employee_id, true, null) o
      on o.qualification_id = m.qualification_id
    where x.sid is not null
      and o.fehlt > m.fehlt
  ) into v_sicher;
  if not v_sicher then
    return query select 'uebersprungen'::text, 'Qualifikation fehlt sonst'::text;
    return;
  end if;

  begin
    perform public.decide_leave_request(r.erste_id, 'approved');
  exception when others then
    return query select 'uebersprungen'::text, sqlerrm;
    return;
  end;

  return query select 'genehmigt'::text, null::text;
end;
$$;

create or replace function public.approve_safe_leave_requests()
returns table(genehmigt integer, uebersprungen integer, geprueft integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_genehmigt int := 0;
  v_uebersprungen int := 0;
  v_geprueft int := 0;
  k record;
  e record;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  -- Gleiche Prüfung wie Antrag für Antrag – nur die eigene Schicht.
  for k in select * from sammelgenehmigung_kandidaten(null) loop
    v_geprueft := v_geprueft + 1;
    select * into e from sicher_genehmigen(k.antrag_id);
    if e.ergebnis = 'genehmigt' then
      v_genehmigt := v_genehmigt + 1;
    else
      v_uebersprungen := v_uebersprungen + 1;
    end if;
  end loop;
  return query select v_genehmigt, v_uebersprungen, v_geprueft;
end;
$function$;

-- Über wessen Anträge darf ich entscheiden? Dieselbe Regel wie beim
-- Genehmigen selbst – die Genehmigungsseite zeigt damit nur, was man auch
-- entscheiden darf.
create or replace function public.entscheidbare_mitarbeiter()
returns table (employee_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select e.id
    from employees e
   where e.company_id = auth_company_id()
     and is_leadership()
     and darf_urlaub_entscheiden(e.id);
$$;

revoke all on function public.entscheidbare_mitarbeiter() from public, anon;
grant execute on function public.entscheidbare_mitarbeiter() to authenticated;
