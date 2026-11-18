-- =============================================================
-- 0235 · Einladung: Profil sicher anlegen
--
-- Fehler: Wer per Einladungslink eingeladen wurde, bekam kein Profil.
-- Der Trigger handle_new_user (0001) prüft beim ANLEGEN des Kontos
-- `invited_at`. Supabase Auth setzt diesen Zeitpunkt inzwischen erst in
-- einem zweiten Schritt (UPDATE) – beim Anlegen ist er noch leer, der
-- Trigger tat nichts. Ohne Profil liefen /start und /login im Kreis
-- („zu viele Weiterleitungen“).
--
-- 1. profil_aus_einladung(user): die bisherige Regel als eigene Funktion
--    (Einladung + passende E-Mail im Personalstamm, aktiver Mitarbeiter,
--    noch kein anderer Zugang für diesen Mitarbeiter).
-- 2. Trigger beim Anlegen UND wenn invited_at nachträglich gesetzt wird.
-- 3. profil_nachholen(): die angemeldete Person holt ihr fehlendes Profil
--    selbst nach (nur innerhalb von 14 Tagen nach der Einladung).
-- 4. Einmalig: fehlende Profile der letzten 14 Tage nachtragen.
-- =============================================================

create or replace function public.profil_aus_einladung(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  u auth.users;
  meta jsonb;
  ziel employees;
begin
  select * into u from auth.users where id = p_user;
  if u.id is null or u.invited_at is null then
    return false;
  end if;
  meta := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  if not (meta ? 'employee_id') then
    return false;
  end if;
  if exists (select 1 from profiles where id = u.id) then
    return true;
  end if;

  select * into ziel
    from employees
   where id = nullif(meta ->> 'employee_id', '')::uuid
     and email is not null
     and lower(email) = lower(u.email);
  if ziel.id is null or ziel.active is not true then
    return false;
  end if;
  -- Hat dieser Mitarbeiter schon einen anderen Zugang, bleibt es dabei.
  if exists (select 1 from profiles where employee_id = ziel.id) then
    return false;
  end if;

  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role)
  values (
    u.id,
    ziel.company_id,
    ziel.id,
    coalesce(nullif(meta ->> 'first_name', ''), ziel.first_name),
    coalesce(nullif(meta ->> 'last_name', ''),  ziel.last_name),
    u.email,
    ziel.role
  )
  on conflict (id) do nothing;
  return true;
end;
$$;

revoke all on function public.profil_aus_einladung(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invited_at is not null then
    perform public.profil_aus_einladung(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited
  after update of invited_at on auth.users
  for each row
  when (old.invited_at is null and new.invited_at is not null)
  execute function public.handle_new_user();

-- Die angemeldete Person holt ihr Profil nach (Sicherheitsnetz für /start).
create or replace function public.profil_nachholen()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    return false;
  end if;
  if not exists (
    select 1 from auth.users
     where id = ich and invited_at is not null and invited_at > now() - interval '14 days'
  ) then
    return false;
  end if;
  return public.profil_aus_einladung(ich);
end;
$$;

revoke all on function public.profil_nachholen() from public, anon;
grant execute on function public.profil_nachholen() to authenticated;

-- Einmalig: Einladungen der letzten 14 Tage ohne Profil nachtragen.
select public.profil_aus_einladung(u.id)
  from auth.users u
 where u.invited_at is not null
   and u.invited_at > now() - interval '14 days'
   and u.raw_user_meta_data ? 'employee_id'
   and not exists (select 1 from profiles p where p.id = u.id);
