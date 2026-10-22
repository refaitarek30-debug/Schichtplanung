-- Privatkonto: freiwillige Kontakt-E-Mail für den Support, eigene Spalte statt
-- der Anmeldeadresse. Vorher wurde die Anmeldeadresse geändert: das schickte
-- Bestätigungsmails (auch an die interne Adresse @privat.invalid, die es nicht
-- gibt) und scheiterte; außerdem hätte danach die Anmeldung mit Spitznamen
-- nicht mehr funktioniert.
alter table public.privat_konten
  add column if not exists kontakt_email text
  check (kontakt_email is null or (length(kontakt_email) <= 320 and kontakt_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'));

grant select (kontakt_email), update (kontakt_email) on public.privat_konten to authenticated;

-- Support (/plattform): Code auch über die hinterlegte Kontakt-E-Mail finden.
create or replace function public.plattform_passwort_code(p_email text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  ziel uuid;
begin
  select u.id into ziel from auth.users u
   where lower(u.email) = lower(btrim(p_email)) and ist_privatkonto(u.id);
  if ziel is null then
    select k.user_id into ziel from privat_konten k
     where lower(k.kontakt_email) = lower(btrim(p_email))
     limit 1;
  end if;
  if ziel is null then
    raise exception 'Kein Privatkonto mit diesem Spitznamen oder dieser Adresse.';
  end if;
  return _passwort_code_setzen(ziel, 'support', interval '24 hours');
end;
$function$;
