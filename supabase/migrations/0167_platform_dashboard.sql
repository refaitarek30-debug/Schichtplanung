-- Betreiber-Dashboard: Registrierungen (mit E-Mail) und Gesamtzahlen.
--
-- Nur für den Betreiber (service_role, wie platform_overview). Die Seite
-- /plattform ruft die Funktion über den Service-Schlüssel auf und prüft
-- vorher is_platform_admin(). Demo-Konten (Live-Demo) sind ausgenommen.
-- Zahlen sind Summen; Inhalte von Terminen, To-dos oder Plänen gibt die
-- Funktion nicht heraus.

create or replace function public.platform_dashboard(p_limit integer default 30)
returns jsonb
language sql stable security definer set search_path = public, auth as $$
  with echte as (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at
      from auth.users u
     where not exists (
       select 1 from profiles p join companies c on c.id = p.company_id
        where p.id = u.id and c.is_demo)
  ),
  neu as (
    select e.email, e.created_at, e.last_sign_in_at, e.email_confirmed_at is not null as bestaetigt,
           case when k.user_id is not null then 'privat'
                when p.id is not null then 'firma'
                else 'ohne' end as art,
           c.name as firma
      from echte e
      left join privat_konten k on k.user_id = e.id
      left join profiles p on p.id = e.id
      left join companies c on c.id = p.company_id
     order by e.created_at desc
     limit greatest(1, least(coalesce(p_limit, 30), 200))
  )
  select jsonb_build_object(
    'konten', (select count(*) from echte),
    'neu_heute', (select count(*) from echte where created_at >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'),
    'neu_7', (select count(*) from echte where created_at >= now() - interval '7 days'),
    'neu_30', (select count(*) from echte where created_at >= now() - interval '30 days'),
    'privat', (select count(*) from privat_konten k join echte e on e.id = k.user_id),
    'firma', (select count(*) from profiles p join echte e on e.id = p.id),
    'angemeldet_24h', (select count(*) from echte where last_sign_in_at >= now() - interval '24 hours'),
    'angemeldet_7', (select count(*) from echte where last_sign_in_at >= now() - interval '7 days'),
    'neu', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from neu n), '[]'::jsonb),
    'summen', jsonb_build_object(
      'firmen', (select count(*) from companies where not is_demo),
      'mitarbeiter', (select count(*) from employees e join companies c on c.id = e.company_id where e.active and not c.is_demo),
      'plan_eintraege', (select count(*) from shift_assignments a join companies c on c.id = a.company_id where not c.is_demo),
      'urlaubsantraege', (select count(*) from leave_requests r join companies c on c.id = r.company_id where not c.is_demo),
      'offene_antraege', (select count(*) from leave_requests r join companies c on c.id = r.company_id where r.status = 'pending' and not c.is_demo),
      'privat_tage', (select count(*) from privat_tage),
      'eigene_tage', (select count(*) from kalender_eigene_tage),
      'termine', (select count(*) from kalender_termine),
      'todos', (select count(*) from kalender_todos),
      'personen', (select count(*) from kalender_personen),
      'verbindungen', (select count(*) from kalender_verbindungen),
      'gruppen', (select count(*) from kalender_gruppen)
    )
  );
$$;

revoke execute on function public.platform_dashboard(integer) from public, anon, authenticated;
grant execute on function public.platform_dashboard(integer) to service_role;
