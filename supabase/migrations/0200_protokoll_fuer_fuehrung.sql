-- Protokoll für die Führung (09.11.2026).
--
-- Bisher: nur eine ausdrücklich freigeschaltete Person der Administration
-- (protokoll_zugang). Neu:
--   * Jede aktive Schichtleitung und Administration sieht die ÄNDERUNGEN
--     (wer hat was geändert: Plan, Urlaub, Anträge, Stammdaten …).
--   * Anmeldungen, Abmeldungen, Fehlanmeldungen und Fehlermeldungen sieht
--     weiter nur die freigeschaltete Administration. Grund: Anmeldezeiten je
--     Person wären eine Verhaltens-/Leistungskontrolle (§ 87 Abs. 1 Nr. 6
--     BetrVG) und gehören nicht in die Hand jeder Schichtleitung.
--
-- protokoll_umfang(): 'voll' | 'aenderungen' | null.

create or replace function public.protokoll_umfang()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when public.protokoll_firma() is not null then 'voll'
    when exists (
      select 1 from profiles p
       where p.id = auth.uid() and p.active and p.company_id is not null
         and p.role in ('admin', 'shift_leader')
    ) then 'aenderungen'
  end;
$$;
revoke execute on function public.protokoll_umfang() from public, anon;
grant execute on function public.protokoll_umfang() to authenticated;

create or replace function public.darf_protokoll()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.protokoll_umfang() is not null;
$$;

create or replace function public.protokoll_liste(
  p_tage integer default 7,
  p_art text default null,
  p_vor timestamp with time zone default null,
  p_limit integer default 150
)
returns table(id uuid, zeit timestamp with time zone, aktion text, akteur text, betroffen text, details jsonb)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  umfang text := protokoll_umfang();
  voll boolean := umfang = 'voll';
  firma uuid := case when umfang = 'voll' then protokoll_firma()
                     when umfang = 'aenderungen' then auth_company_id() end;
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
       -- Ohne Freischaltung nur Änderungen.
       and (voll or (l.action not like 'anmeldung%' and l.action not like 'abmeldung%'
                     and l.action not like 'fehler.%'))
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
      (select x.id from employees x where x.id = e.entity_id and x.company_id = firma)
    )
   order by e.created_at desc;
end;
$$;

create or replace function public.protokoll_zahlen(p_tage integer default 7)
returns table(anmeldungen bigint, personen bigint, aenderungen bigint, fehler bigint, fehlanmeldungen bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  umfang text := protokoll_umfang();
  voll boolean := umfang = 'voll';
  firma uuid := case when umfang = 'voll' then protokoll_firma()
                     when umfang = 'aenderungen' then auth_company_id() end;
begin
  if firma is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  return query
  select case when voll then count(*) filter (where l.action = 'anmeldung') else 0 end,
         case when voll then count(distinct l.actor_id) filter (where l.action = 'anmeldung') else 0 end,
         count(*) filter (where l.action not like 'anmeldung%' and l.action not like 'abmeldung%' and l.action not like 'fehler.%'),
         case when voll then count(*) filter (where l.action like 'fehler.%') else 0 end,
         case when voll then count(*) filter (where l.action = 'anmeldung.fehlgeschlagen') else 0 end
    from audit_logs l
   where l.company_id = firma
     and l.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_tage, 7), 730)));
end;
$$;
