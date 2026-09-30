-- Selbstregistrierung nur noch über den Server.
--
-- Erst anwenden, NACHDEM die Anwendung mit dem neuen Registrierungsablauf
-- (signUp ohne Zuordnung, danach register_company_for_user mit dem
-- Service-Key) ausgeliefert ist – sonst schlägt die Registrierung der alten
-- Anwendung fehl.
--
-- 1. register_company() (bisher für anon freigegeben) wird entzogen. Damit kann
--    niemand mehr über die öffentliche Schnittstelle Firmen anlegen.
-- 2. handle_new_user() verknüpft ein neues Konto nur noch dann mit einem
--    bestehenden Mitarbeiter-Stammsatz, wenn es EINGELADEN wurde
--    (auth.users.invited_at ist gesetzt – das geschieht nur über die
--    Auth-Admin-API mit dem Service-Key). Ein Selbst-Signup bekommt nie ein
--    Profil, auch nicht mit passender E-Mail-Adresse und Mitarbeiter-ID in den
--    Metadaten. Das schließt den Weg, sich vor der eingeladenen Person mit
--    deren Adresse zu registrieren („Pre-Hijacking“).

revoke all on function public.register_company(text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.register_company(text, text, text, text, boolean) to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ziel employees;
begin
  -- Kein Profil ohne Einladung. Firmenregistrierung: register_company_for_user.
  if new.invited_at is null then
    return new;
  end if;

  if not (meta ? 'employee_id') then
    return new;
  end if;

  select * into ziel
    from employees
   where id = nullif(meta ->> 'employee_id', '')::uuid
     and email is not null
     and lower(email) = lower(new.email);

  if ziel.id is null then
    return new;
  end if;

  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
  values (
    new.id,
    ziel.company_id,                       -- aus der Datenbank, nicht vom Client
    ziel.id,
    coalesce(nullif(meta ->> 'first_name', ''), ziel.first_name),
    coalesce(nullif(meta ->> 'last_name', ''),  ziel.last_name),
    new.email,
    ziel.role                              -- aus der Datenbank, nicht vom Client
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
