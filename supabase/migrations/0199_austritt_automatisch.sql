-- Austritt automatisch: Am Tag nach dem letzten Arbeitstag (employees.exit_date)
-- endet der Zugang zum Betrieb – ohne dass jemand „Deaktivieren“ drücken muss.
--
-- Umgesetzt über denselben Weg wie „Deaktivieren“ (Migration 0194): das Konto
-- (profiles.active) wird gesperrt. Damit gibt auth_company_id() nichts mehr
-- zurück, alle Betriebsdaten sind per RLS zu, und beim nächsten Anmelden geht
-- es in den Privatbereich. Der Mitarbeitereintrag selbst (employees) bleibt
-- unverändert, damit die Person in vergangenen Plänen und Auswertungen
-- weiter steht.
--
-- Stichtag in deutscher Zeit. Läuft stündlich (pg_cron); so greift es spätestens
-- kurz nach Mitternacht. Die letzte aktive Administration eines Betriebs wird
-- nie gesperrt – sonst käme niemand mehr hinein.

create or replace function public.austritte_vollziehen()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  heute date := (now() at time zone 'Europe/Berlin')::date;
  n int := 0;
  r record;
begin
  for r in
    select p.id, p.company_id, p.role, e.id as employee_id, e.exit_date
      from profiles p
      join employees e on e.id = p.employee_id and e.company_id = p.company_id
     where p.active
       and e.exit_date is not null
       and e.exit_date < heute
  loop
    if r.role = 'admin' and not exists (
      select 1 from profiles q
       where q.company_id = r.company_id and q.active and q.role = 'admin' and q.id <> r.id
    ) then
      continue;
    end if;

    update profiles set active = false where id = r.id and active;
    if found then
      insert into audit_logs (company_id, actor_id, action, entity, entity_id, payload)
      values (r.company_id, null, 'mitarbeiter.austritt', 'employees', r.employee_id,
              jsonb_build_object('employee_id', r.employee_id, 'austritt', r.exit_date, 'automatisch', true));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.austritte_vollziehen() from public, anon, authenticated;

-- Austrittsdatum wieder entfernt oder in die Zukunft gelegt (z. B. Fehleingabe,
-- Weiterbeschäftigung): Hat der automatische Austritt das Konto gesperrt, ist
-- es wieder offen. Ein von Hand deaktivierter Mitarbeiter (employees.active =
-- false) bleibt gesperrt.
create or replace function public.employees_austritt_zurueck()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.exit_date is distinct from old.exit_date
     and new.active
     and (new.exit_date is null or new.exit_date >= (now() at time zone 'Europe/Berlin')::date)
  then
    update profiles
       set active = true,
           austritt_uebernommen_am = null
     where employee_id = new.id
       and company_id = new.company_id
       and not active;
  end if;
  return new;
end;
$$;
revoke execute on function public.employees_austritt_zurueck() from public, anon, authenticated;

drop trigger if exists employees_austritt_zurueck on public.employees;
create trigger employees_austritt_zurueck
  after update of exit_date on public.employees
  for each row execute function public.employees_austritt_zurueck();

-- Stündlich, Minute 7.
do $$
begin
  perform cron.unschedule('austritte-stuendlich')
   where exists (select 1 from cron.job where jobname = 'austritte-stuendlich');
  perform cron.schedule('austritte-stuendlich', '7 * * * *', 'select public.austritte_vollziehen();');
end $$;

-- Schon vergangene Austritte sofort.
select public.austritte_vollziehen();
