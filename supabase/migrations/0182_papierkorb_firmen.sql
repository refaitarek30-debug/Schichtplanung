-- Betreiber: Firmen und Privatkonten löschen.
--  * Firmen kommen zuerst 14 Tage in den Papierkorb (companies.geloescht_am). Währenddessen
--    sind die Zugänge der Firma gesperrt (auth.users.banned_until), die Daten bleiben
--    unverändert und lassen sich mit einem Klick zurückholen.
--  * Nach 14 Tagen löscht ein täglicher Job die Firma endgültig, samt allen Zugängen.
--  * Der Betreiber kann eine Firma im Papierkorb auch sofort endgültig löschen.
--  * Nur der Dienstschlüssel (Server) darf diese Funktionen aufrufen; die Berechtigung
--    „Betreiber“ prüft die Anwendung zusätzlich über is_platform_admin().

alter table public.companies add column if not exists geloescht_am timestamptz;

-- Protokoll ohne Namen und ohne Inhalte: nur dass etwas gelöscht wurde.
create table if not exists public.plattform_protokoll (
  id bigint generated always as identity primary key,
  am timestamptz not null default now(),
  aktion text not null,
  art text not null
);
alter table public.plattform_protokoll enable row level security;
revoke all on public.plattform_protokoll from anon, authenticated;

-- Liste für die Betreiber-Seite.
create or replace function public.plattform_loeschliste()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'auth'
as $function$
  select jsonb_build_object(
    'firmen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'angelegt_am', c.created_at,
        'geloescht_am', c.geloescht_am,
        'endgueltig_am', c.geloescht_am + interval '14 days',
        'mitarbeiter', (select count(*) from employees e where e.company_id = c.id),
        'zugaenge', (select count(*) from profiles p where p.company_id = c.id),
        'plan_eintraege', (select count(*) from shift_assignments s where s.company_id = c.id),
        'urlaubsantraege', (select count(*) from leave_requests r where r.company_id = c.id),
        'betreiber', exists (select 1 from profiles p join platform_admins a on a.user_id = p.id where p.company_id = c.id)
      ) order by c.geloescht_am nulls first, c.created_at)
      from companies c where not c.is_demo
    ), '[]'::jsonb),
    'privat', coalesce((
      select jsonb_agg(x order by x->>'erstellt_am' desc) from (
        select jsonb_build_object(
          'user_id', k.user_id,
          'name', k.name,
          'erstellt_am', k.erstellt_am,
          'letzter_login', u.last_sign_in_at,
          'betreiber', exists (select 1 from platform_admins a where a.user_id = k.user_id)
        ) x
        from privat_konten k join auth.users u on u.id = k.user_id
        order by k.erstellt_am desc limit 500
      ) t
    ), '[]'::jsonb)
  );
$function$;

-- Firma in den Papierkorb legen (p_in = true) oder zurückholen (false).
create or replace function public.plattform_firma_papierkorb(p_company uuid, p_in boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
begin
  if not exists (select 1 from companies c where c.id = p_company and not c.is_demo) then
    raise exception 'Firma nicht gefunden.';
  end if;
  if p_in and exists (select 1 from profiles p join platform_admins a on a.user_id = p.id where p.company_id = p_company) then
    raise exception 'Diese Firma enthält ein Betreiber-Konto und kann nicht gelöscht werden.';
  end if;

  update companies set geloescht_am = case when p_in then now() else null end where id = p_company;
  update auth.users u
     set banned_until = case when p_in then 'infinity'::timestamptz else null end
   where u.id in (select p.id from profiles p where p.company_id = p_company);

  insert into plattform_protokoll (aktion, art) values (case when p_in then 'papierkorb' else 'zurueckgeholt' end, 'firma');
end;
$function$;

-- Endgültig löschen. Gelöscht wird nur, was im Papierkorb liegt.
create or replace function public.firma_endgueltig_loeschen(p_company uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t text;
  pass int;
begin
  if not exists (select 1 from companies c where c.id = p_company and not c.is_demo and c.geloescht_am is not null) then
    raise exception 'Nur Firmen im Papierkorb können endgültig gelöscht werden.';
  end if;
  if exists (select 1 from profiles p join platform_admins a on a.user_id = p.id where p.company_id = p_company) then
    raise exception 'Diese Firma enthält ein Betreiber-Konto und kann nicht gelöscht werden.';
  end if;

  -- Zugänge mitsamt ihren persönlichen Einträgen (hängen am Konto)
  delete from auth.users u where u.id in (select p.id from profiles p where p.company_id = p_company);

  -- Reste mit Firmenkennung, falls etwas nicht automatisch mitgeht
  for pass in 1..4 loop
    for t in
      select col.table_name
        from information_schema.columns col
        join information_schema.tables tab
          on tab.table_schema = col.table_schema and tab.table_name = col.table_name and tab.table_type = 'BASE TABLE'
       where col.table_schema = 'public' and col.column_name = 'company_id' and col.table_name <> 'companies'
    loop
      begin
        execute format('delete from public.%I where company_id = $1', t) using p_company;
      exception when others then
        null;
      end;
    end loop;
  end loop;

  delete from companies where id = p_company;
  insert into plattform_protokoll (aktion, art) values ('endgueltig', 'firma');
end;
$function$;

-- Täglicher Job: nach 14 Tagen endgültig löschen.
create or replace function public.papierkorb_leeren()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c record;
  n int := 0;
begin
  for c in select id from companies where not is_demo and geloescht_am < now() - interval '14 days' limit 20 loop
    begin
      perform firma_endgueltig_loeschen(c.id);
      n := n + 1;
    exception when others then
      null;
    end;
  end loop;
  return n;
end;
$function$;

revoke all on function public.plattform_loeschliste() from public, anon, authenticated;
revoke all on function public.plattform_firma_papierkorb(uuid, boolean) from public, anon, authenticated;
revoke all on function public.firma_endgueltig_loeschen(uuid) from public, anon, authenticated;
revoke all on function public.papierkorb_leeren() from public, anon, authenticated;
grant execute on function public.plattform_loeschliste() to service_role;
grant execute on function public.plattform_firma_papierkorb(uuid, boolean) to service_role;
grant execute on function public.firma_endgueltig_loeschen(uuid) to service_role;

select cron.schedule('papierkorb-taeglich', '41 3 * * *', 'select public.papierkorb_leeren();');

-- Aufräumen: Testfunktion aus der Fehlersuche
drop function if exists public.zz_test_delete();
