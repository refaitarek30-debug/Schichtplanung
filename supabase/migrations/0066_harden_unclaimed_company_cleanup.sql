-- Cleanup helper is internal-only. Client roles must never be able to
-- delete arbitrary companies, even if the predicate is restrictive.
create or replace function public.discard_unclaimed_company(p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_treffer int;
begin
  delete from companies c
   where c.id = p_company_id
     and not exists (select 1 from profiles p where p.company_id = c.id)
     and c.created_at > now() - interval '15 minutes';
  get diagnostics v_treffer = row_count;
  return v_treffer > 0;
end;
$$;

revoke all on function public.discard_unclaimed_company(uuid) from public, anon, authenticated;
grant execute on function public.discard_unclaimed_company(uuid) to service_role;
