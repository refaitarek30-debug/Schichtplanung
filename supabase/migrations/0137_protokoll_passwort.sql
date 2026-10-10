-- Protokoll: auch „Neues Passwort gesetzt“ zulassen.
-- Anmeldungen über Einladungs- oder „Passwort vergessen“-Links schreibt die
-- App jetzt ebenfalls als „anmeldung“ (vorher fehlten sie im Protokoll).

create or replace function public.protokoll_melden(p_art text, p_text text default null, p_seite text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  firma uuid := auth_company_id();
begin
  if auth.uid() is null or firma is null then
    return;
  end if;
  if p_art not in ('anmeldung', 'anmeldung.passwort', 'abmeldung', 'abmeldung.inaktiv', 'fehler.anzeige', 'fehler.absturz') then
    return;
  end if;
  if (select count(*) from audit_logs l
       where l.actor_id = auth.uid()
         and l.created_at > now() - interval '10 minutes'
         and (l.action like 'fehler.%' or l.action like 'anmeldung%' or l.action like 'abmeldung%')) >= 40 then
    return;
  end if;
  perform protokoll_schreiben(firma, p_art, null, null,
    jsonb_build_object('text', left(p_text, 500), 'seite', left(p_seite, 200)));
end;
$$;

revoke all on function public.protokoll_melden(text, text, text) from public, anon;
grant execute on function public.protokoll_melden(text, text, text) to authenticated;
