-- =============================================================
-- 0223 · Betreiber-Konsole: Team und Protokoll
--
-- 1. Das Betreiber-Protokoll (plattform_protokoll, 0182) merkt sich
--    zusätzlich, WER vom Betreiber-Team eine Aktion ausgeführt hat.
--    Weiterhin ohne Inhalte und ohne betroffene Personen – nur Art,
--    Aktion und Zeitpunkt.
-- 2. platform_team(): Liste des Betreiber-Teams für die Konsole.
-- 3. platform_nutzer_id(): Konto zu einer E-Mail – für „Person ins
--    Team holen“, wenn sie schon ein Konto hat.
-- 4. platform_protokoll_liste(): die letzten Einträge für die Konsole.
--
-- Alles nur für service_role. Die Konsole ruft es serverseitig auf,
-- nachdem sie Betreiber-Recht und Zwei-Faktor-Code geprüft hat.
-- =============================================================

alter table public.plattform_protokoll
  add column if not exists wer uuid references auth.users (id) on delete set null;

create or replace function public.platform_team()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', a.user_id,
           'email', u.email,
           'nur_lesen', a.nur_lesen,
           'notiz', a.notiz,
           'seit', a.created_at,
           'zuletzt', u.last_sign_in_at,
           'zwei_faktor', exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified')
         ) order by a.created_at), '[]'::jsonb)
    from platform_admins a
    join auth.users u on u.id = a.user_id;
$$;

create or replace function public.platform_nutzer_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;

create or replace function public.platform_protokoll_liste(p_limit int default 100)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('am', z.am, 'aktion', z.aktion, 'art', z.art, 'wer', z.email) order by z.am desc), '[]'::jsonb)
    from (
      select p.am, p.aktion, p.art, u.email
        from plattform_protokoll p
        left join auth.users u on u.id = p.wer
       order by p.am desc
       limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) z;
$$;

revoke all on function public.platform_team() from public, anon, authenticated;
revoke all on function public.platform_nutzer_id(text) from public, anon, authenticated;
revoke all on function public.platform_protokoll_liste(int) from public, anon, authenticated;
grant execute on function public.platform_team() to service_role;
grant execute on function public.platform_nutzer_id(text) to service_role;
grant execute on function public.platform_protokoll_liste(int) to service_role;
