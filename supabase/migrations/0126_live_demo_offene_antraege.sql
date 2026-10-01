-- Live-Demo: offene Beispielanträge.
--
-- Die Vorlage enthält nur entschiedene Anträge. Damit Besucher die
-- Genehmigung ausprobieren können, legt diese Funktion in einer frischen
-- Demo einige offene Urlaubsanträge in den kommenden Wochen an. Die
-- Server-Aktion ruft sie direkt nach demo_create auf.

create or replace function public.demo_seed_pending(p_company uuid, p_user uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  k int := 0;
  n int := 0;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  if auth.role() <> 'service_role' then
    raise exception 'Nicht erlaubt.';
  end if;
  if not exists (
    select 1 from companies c join profiles p on p.company_id = c.id
     where c.id = p_company and c.is_demo and p.id = p_user
  ) then
    raise exception 'Keine Demo.';
  end if;

  -- Tagesberechnung braucht einen angemeldeten Kontext im Mandanten.
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('schichtplan.sammelantrag', 'an', true);

  for r in
    select e.id from employees e
     where e.company_id = p_company and e.active and e.shift_worker and e.role = 'employee'
     order by e.rotation_team, e.last_name
     limit 6
  loop
    begin
      insert into leave_requests (company_id, employee_id, start_date, end_date, status, kind)
      values (p_company, r.id, current_date + 14 + k * 4, current_date + 18 + k * 4, 'pending', 'urlaub');
      n := n + 1;
    exception when others then
      null;
    end;
    k := k + 1;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return n;
end;
$$;

revoke all on function public.demo_seed_pending(uuid, uuid) from public, anon, authenticated;
grant execute on function public.demo_seed_pending(uuid, uuid) to service_role;
