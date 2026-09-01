-- Erlaubt Schichtleitung und Administration, den Urlaubsanspruch (Jahres-
-- entitlement) von Mitarbeitenden des eigenen Unternehmens zu setzen. Die
-- Tabellen-Policy "Urlaubskonto pflegt Admin" bleibt bewusst unveraendert
-- (nur Admin darf carried_over, used_days etc. direkt anfassen); diese
-- Funktion oeffnet gezielt nur das Setzen des Anspruchs fuer is_leadership().
create or replace function public.set_leave_entitlement(
  p_employee_id uuid,
  p_entitlement numeric,
  p_year smallint default extract(year from now())::smallint
)
returns leave_balances
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result leave_balances;
  emp_company uuid;
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung fuer diesen Bereich.';
  end if;
  if p_entitlement is null or p_entitlement < 0 then
    raise exception 'Der Urlaubsanspruch muss eine Zahl ab 0 sein.';
  end if;

  select company_id into emp_company from employees where id = p_employee_id;
  if emp_company is null or emp_company is distinct from auth_company_id() then
    raise exception 'Der Mitarbeiter wurde nicht gefunden.';
  end if;

  insert into leave_balances (company_id, employee_id, year, entitlement)
  values (emp_company, p_employee_id, p_year, p_entitlement)
  on conflict (employee_id, year)
  do update set entitlement = excluded.entitlement, updated_at = now()
  returning * into result;

  insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
  values (
    emp_company, auth.uid(), 'leave_balance.entitlement_updated', 'leave_balances', result.id,
    jsonb_build_object('year', p_year, 'entitlement', p_entitlement)
  );

  return result;
end;
$function$;

-- Wichtiger Fund aus einer frueheren Session: Supabase vergibt EXECUTE
-- zusaetzlich direkt an anon/authenticated, REVOKE FROM PUBLIC allein
-- reicht nicht.
revoke all on function public.set_leave_entitlement(uuid, numeric, smallint) from public;
revoke all on function public.set_leave_entitlement(uuid, numeric, smallint) from anon;
grant execute on function public.set_leave_entitlement(uuid, numeric, smallint) to authenticated;
