-- Notfallzugang für die Betreiber-Seite: ein zweites Betreiber-Konto, das nur
-- lesen darf.
--
-- Fällt der Betreiber aus, kann eine Vertrauensperson (Umschlag mit Zugang und
-- Zwei-Faktor-Schlüssel) die Betreiber-Seite öffnen und sehen, was los ist:
-- Firmen, Zählwerte, Sperren. Ändern, löschen, Codes erzeugen oder Zugänge
-- freischalten kann dieses Konto nicht. Jede Öffnung wird protokolliert und
-- dem Betreiber auf seiner Seite angezeigt.
--
-- Eintragen (nur per SQL, es gibt bewusst keine Oberfläche):
--   insert into public.platform_admins (user_id, notiz, nur_lesen)
--   select id, 'Notfallzugang', true from auth.users where email = '<adresse>';

alter table public.platform_admins add column if not exists nur_lesen boolean not null default false;

-- Darf dieser Betreiber etwas ändern (nicht nur lesen)?
create or replace function public.platform_darf_aendern(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins a where a.user_id = p_user_id and not a.nur_lesen);
$$;

-- Öffnung durch den Notfallzugang festhalten (ohne Namen, wie das übrige Betreiber-Protokoll).
create or replace function public.platform_notfall_merken()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into plattform_protokoll (aktion, art) values ('notfallzugang', 'geoeffnet');
$$;

-- Die letzten Öffnungen für den Betreiber.
create or replace function public.platform_notfall_zugriffe()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(z.am order by z.am desc), '[]'::jsonb)
    from (select am from plattform_protokoll where aktion = 'notfallzugang' order by am desc limit 20) z;
$$;

revoke all on function public.platform_darf_aendern(uuid) from public, anon, authenticated;
revoke all on function public.platform_notfall_merken() from public, anon, authenticated;
revoke all on function public.platform_notfall_zugriffe() from public, anon, authenticated;
grant execute on function public.platform_darf_aendern(uuid) to service_role;
grant execute on function public.platform_notfall_merken() to service_role;
grant execute on function public.platform_notfall_zugriffe() to service_role;
