-- Protokoll: betroffene Person auch dann finden, wenn eine Funktion sie
-- direkt als entity_id einträgt (z. B. „V-Tage gebucht“).

create or replace function public.protokoll_liste(
  p_tage integer default 7,
  p_art text default null,
  p_vor timestamptz default null,
  p_limit integer default 150
)
returns table(id uuid, zeit timestamptz, aktion text, akteur text, betroffen text, details jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  firma uuid := protokoll_firma();
begin
  if firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  with eintrag as (
    select l.*,
           case
             when l.payload->>'employee_id' ~ '^[0-9a-f-]{36}$' then (l.payload->>'employee_id')::uuid
             when l.entity = 'employees' then l.entity_id
             when l.entity = 'leave_requests' then (select r.employee_id from leave_requests r where r.id = l.entity_id)
             when l.entity = 'absences' then (select x.employee_id from absences x where x.id = l.entity_id)
             when l.entity = 'fehlzeiten' then (select f.employee_id from fehlzeiten f where f.id = l.entity_id)
             when l.entity = 'leave_balances' then (select b.employee_id from leave_balances b where b.id = l.entity_id)
             when l.entity = 'age_leave_grants' then (select g.employee_id from age_leave_grants g where g.id = l.entity_id)
           end as person_aus_eintrag
      from audit_logs l
     where l.company_id = firma
       and l.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_tage, 7), 730)))
       and (p_vor is null or l.created_at < p_vor)
       and (
         p_art is null
         or (p_art = 'anmeldung' and (l.action like 'anmeldung%' or l.action like 'abmeldung%'))
         or (p_art = 'fehler' and l.action like 'fehler.%')
         or (p_art = 'aenderung' and l.action not like 'anmeldung%' and l.action not like 'abmeldung%'
                                 and l.action not like 'fehler.%')
       )
     order by l.created_at desc
     limit greatest(1, least(coalesce(p_limit, 150), 500))
  )
  select e.id,
         e.created_at,
         e.action,
         nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
         nullif(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), ''),
         e.payload
    from eintrag e
    left join profiles p on p.id = e.actor_id
    left join employees m on m.id = coalesce(
      e.person_aus_eintrag,
      -- Manche Funktionen tragen die Person direkt als entity_id ein
      -- (z. B. V-Tage buchen).
      (select x.id from employees x where x.id = e.entity_id and x.company_id = firma)
    )
   order by e.created_at desc;
end;
$$;

revoke all on function public.protokoll_liste(integer, text, timestamptz, integer) from public, anon;
grant execute on function public.protokoll_liste(integer, text, timestamptz, integer) to authenticated;
