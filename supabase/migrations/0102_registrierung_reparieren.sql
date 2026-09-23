-- Selbstregistrierung war seit 0064 kaputt: register_company() legt den
-- ersten Mitarbeiter an, der Trigger employees_audit schreibt dazu einen
-- Protokolleintrag, und write_audit() verlangte, dass die Firma die eigene
-- ist. Bei der Registrierung gibt es aber noch kein Profil (anon), also
-- scheiterte jede Registrierung mit „Ungültiger Mandant für Audit-Log".
-- Zusätzlich erlaubt ist jetzt genau dieser Fall: ein eben angelegtes
-- Unternehmen, das noch niemandem gehört. write_audit() ist nicht direkt
-- aufrufbar, sondern läuft nur aus Triggern und Funktionen heraus.
create or replace function public.write_audit(p_company_id uuid, p_action text, p_entity text, p_entity_id uuid default null::uuid, p_payload jsonb default null::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_company_id is distinct from auth_company_id()
     and auth.role() <> 'service_role'
     and not (
       auth_company_id() is null
       and exists (
         select 1 from companies c
          where c.id = p_company_id
            and c.created_at > now() - interval '15 minutes'
            and not exists (select 1 from profiles p where p.company_id = c.id)
       )
     )
  then
    raise exception 'Ungültiger Mandant für Audit-Log.';
  end if;

  insert into public.audit_logs
    (company_id, actor_id, action, entity, entity_id, payload)
  values
    (p_company_id, auth.uid(), p_action, p_entity, p_entity_id, p_payload);
end;
$function$;
