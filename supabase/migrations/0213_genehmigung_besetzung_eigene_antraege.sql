-- Urlaub genehmigen: Mindestbesetzung und eigene Anträge (10.11.2026), Funde L-01 und L-04.
--
-- 1) Unterschreitet eine Genehmigung die Mindestbesetzung einer Schicht, lehnt die Datenbank
--    zunächst ab (Fehlercode SN001, „UNTERBESETZT:“ und die Tage). Die Oberfläche fragt dann
--    „Trotzdem genehmigen?“ – bei Ja wird mit p_trotz_unterbesetzung = true erneut entschieden.
--    Gezählt werden nur genehmigte Abwesenheiten und der Antrag selbst (nicht andere offene
--    Anträge). Im Protokoll steht bei der Genehmigung zusätzlich „trotz Unterbesetzung“ mit den
--    Tagen – keine weiteren Daten, kein Freitext.
--    Eine Sperre je Unternehmen sorgt dafür, dass zwei Genehmigungen im selben Moment
--    nacheinander geprüft werden.
--
-- 2) Schalter „Schichtleitung genehmigt eigene Anträge“ (company_settings.leitung_eigene_antraege).
--    Aus: Über eigene Anträge einer Schichtleitung entscheidet die Administration.
--    Vorgabe für neue Unternehmen: aus. Bestehende Unternehmen: an (wie bisher).

-- 2) ------------------------------------------------------------------------------------------
alter table public.company_settings
  add column if not exists leitung_eigene_antraege boolean not null default false;
update public.company_settings set leitung_eigene_antraege = true;

create or replace function public.leitung_eigene_antraege_erlaubt()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select cs.leitung_eigene_antraege from company_settings cs where cs.company_id = auth_company_id()),
    false);
$$;
revoke execute on function public.leitung_eigene_antraege_erlaubt() from public, anon;
grant execute on function public.leitung_eigene_antraege_erlaubt() to authenticated;

create or replace function public.set_leitung_eigene_antraege(p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_admin() then
    raise exception 'Nur die Administration darf diese Einstellung ändern.';
  end if;
  insert into company_settings (company_id, leitung_eigene_antraege, updated_at)
  values (v_firma, coalesce(p_value, false), now())
  on conflict (company_id)
  do update set leitung_eigene_antraege = excluded.leitung_eigene_antraege, updated_at = now();
  perform write_audit(v_firma, 'regel.leitung_eigene_antraege', 'company_settings', v_firma,
    jsonb_build_object('erlaubt', coalesce(p_value, false)));
end;
$$;
revoke execute on function public.set_leitung_eigene_antraege(boolean) from public, anon;
grant execute on function public.set_leitung_eigene_antraege(boolean) to authenticated;

create or replace function public.darf_urlaub_entscheiden(p_employee_id uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
  -- Eigene Anträge: nur wenn das Unternehmen es erlaubt, sonst entscheidet die Administration.
  if ich.id = ziel.id then
    return leitung_eigene_antraege_erlaubt();
  end if;
  if ich.rotation_team is not null then
    return ziel.rotation_team = ich.rotation_team;
  end if;
  return ziel.rotation_team is null and ich.shift_id is not null and ziel.shift_id = ich.shift_id;
end;
$function$;

-- 1) ------------------------------------------------------------------------------------------
-- Tage, an denen die Schicht mit dieser Antragsgruppe unter die Mindestbesetzung fiele.
create or replace function public.unterbesetzte_tage(p_gruppe uuid)
returns date[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r leave_requests;
  e employees;
  s shifts;
  d date;
  schicht uuid;
  geplant int;
  fehlt int;
  tage date[] := '{}';
begin
  for r in
    select * from leave_requests
    where coalesce(request_group_id, id) = p_gruppe and status = 'pending'
      and company_id = auth_company_id()
  loop
    select * into e from employees where id = r.employee_id;
    if e.id is null or not zaehlt_zur_besetzung(e) then
      continue;
    end if;
    d := r.start_date;
    while d <= r.end_date loop
      schicht := effective_shift_id(e.id, d);
      if schicht is not null then
        select * into s from shifts where id = schicht;
        if s.id is not null and s.target_staff > 0 and schicht_laeuft_fuer(e.id, d, s) then
          select count(*) into geplant from employees emp
           where emp.active and emp.company_id = e.company_id
             and zaehlt_zur_besetzung(emp)
             and effective_shift_id(emp.id, d) = schicht;
          select count(*) into fehlt from employees emp
           where emp.active and emp.company_id = e.company_id
             and zaehlt_zur_besetzung(emp)
             and effective_shift_id(emp.id, d) = schicht
             and emp.id in (select employee_id from employees_absent_on(d, false, r.id));
          if geplant - fehlt < s.minimum_staff then
            tage := array_append(tage, d);
          end if;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return tage;
end;
$$;
revoke execute on function public.unterbesetzte_tage(uuid) from public, anon, authenticated;

drop function if exists public.decide_leave_request(uuid, leave_status, text);

create or replace function public.decide_leave_request(
  p_request_id uuid,
  p_decision leave_status,
  p_rejection_reason text default null,
  p_trotz_unterbesetzung boolean default false
)
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
  v_unterbesetzt date[] := '{}';
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

  if not darf_urlaub_entscheiden((select r.employee_id from leave_requests r where r.id = p_request_id)) then
    if (select r.employee_id from leave_requests r where r.id = p_request_id) = auth_employee_id() then
      raise exception 'Über deine eigenen Anträge entscheidet die Administration.';
    end if;
    raise exception 'Du darfst nur Anträge deiner eigenen Schicht entscheiden.';
  end if;

  if p_decision = 'approved' then
    -- Genehmigungen im selben Unternehmen nacheinander prüfen.
    perform pg_advisory_xact_lock(hashtextextended('genehmigung:' || v_firma::text, 0));

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

    v_unterbesetzt := unterbesetzte_tage(v_gruppe);
    if cardinality(v_unterbesetzt) > 0 and not coalesce(p_trotz_unterbesetzung, false) then
      raise exception using
        errcode = 'SN001',
        message = 'UNTERBESETZT:' || array_to_string(
          array(select to_char(t, 'DD.MM.YYYY') from unnest(v_unterbesetzt) t order by t), ', ');
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
    ) || case when cardinality(v_unterbesetzt) > 0
              then jsonb_build_object('trotz_unterbesetzung', true, 'unterbesetzt_tage', to_jsonb(v_unterbesetzt))
              else '{}'::jsonb end
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
revoke execute on function public.decide_leave_request(uuid, leave_status, text, boolean) from public, anon;
grant execute on function public.decide_leave_request(uuid, leave_status, text, boolean) to authenticated;
