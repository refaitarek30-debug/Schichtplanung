-- „Heute“ in deutscher Zeit (10.11.2026), Fund L-03 aus docs/review/01-logik.md.
--
-- Die Datenbank läuft in UTC. Funktionen mit current_date hielten deshalb zwischen 0 und 1 Uhr
-- (Winter) bzw. 0 und 2 Uhr (Sommer) noch den Vortag für „heute“ – genau in der Nachtschicht
-- und in der ersten Stunde des neuen Jahres.
--
-- Neu: heute() liefert das Datum in Europe/Berlin. Alle Funktionen und die Ansicht
-- leave_balances_view, die current_date benutzen, werden automatisch umgeschrieben: Ihre
-- aktuelle Definition wird aus der Datenbank gelesen, current_date durch heute() ersetzt und neu
-- angelegt (CREATE OR REPLACE behält Eigentümer und Rechte). Die Liste der umgeschriebenen
-- Funktionen erscheint als NOTICE.
--
-- Später für ein SaaS mit Kunden in anderen Zeitzonen: heute() bekommt einen Firmenparameter.
--
-- Nebenbei (Fund S-07): Testfunktion zz_test_shift_plan_grid_neu entfernen, _beitritt_code
-- bekommt einen festen Suchpfad.

create or replace function public.heute()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;
grant execute on function public.heute() to anon, authenticated, service_role;

do $$
declare
  f record;
  def text;
  neu text;
  n int := 0;
begin
  for f in
    select p.oid, p.oid::regprocedure::text as name
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname <> 'heute'
      and p.prokind = 'f'
      and p.prosrc ~* '\mcurrent_date\M'
  loop
    def := pg_get_functiondef(f.oid);
    neu := regexp_replace(def, '\mcurrent_date\M', 'public.heute()', 'gi');
    if neu <> def then
      execute neu;
      n := n + 1;
      raise notice 'heute(): %', f.name;
    end if;
  end loop;
  raise notice 'heute(): % Funktionen umgeschrieben', n;
end $$;

do $$
declare
  def text;
begin
  def := pg_get_viewdef('public.leave_balances_view'::regclass, true);
  if def ~* '\mcurrent_date\M' then
    execute 'create or replace view public.leave_balances_view with (security_invoker = true) as '
      || regexp_replace(def, '\mcurrent_date\M', 'public.heute()', 'gi');
    raise notice 'heute(): leave_balances_view umgeschrieben';
  end if;
end $$;

-- S-07: Aufräumen
do $$
declare
  f record;
begin
  for f in select oid::regprocedure as sig from pg_proc
           where pronamespace = 'public'::regnamespace and proname = 'zz_test_shift_plan_grid_neu'
  loop
    execute format('drop function %s', f.sig);
  end loop;
  for f in select oid::regprocedure as sig from pg_proc
           where pronamespace = 'public'::regnamespace and proname = '_beitritt_code'
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;
