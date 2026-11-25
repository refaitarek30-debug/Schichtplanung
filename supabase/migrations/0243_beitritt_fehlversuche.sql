-- =============================================================
-- 0243 · Beitritts-Code: höchstens 15 Fehlversuche pro Stunde
--
-- Gefunden im Kontoübernahme-Test (tests/sicherheit/kontouebernahme.sql):
-- Verbindungscodes im Privatbereich sind nach 15 Fehlversuchen pro Stunde
-- gesperrt, Beitritts-Codes für einen Betrieb hatten keine Grenze. Erraten war
-- bei rund einer Billion möglicher Codes ohnehin aussichtslos; jetzt gilt dieselbe
-- Grenze (gemeinsamer Zähler mit den Verbindungscodes).
--
-- beitritt_annehmen liefert jetzt true/false: Ein falscher Code löst keine
-- Ausnahme mehr aus, damit der Fehlversuch gespeichert bleibt. Die App zeigt bei
-- false den bekannten Hinweis „ungültig oder abgelaufen“.
-- =============================================================

create or replace function public.beitritt_versuche_pruefen()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from kalender_code_versuche where user_id = auth.uid() and zeit < now() - interval '1 day';
  if (select count(*) from kalender_code_versuche
       where user_id = auth.uid() and zeit > now() - interval '1 hour') >= 15 then
    raise exception 'Zu viele Versuche. Bitte in einer Stunde noch einmal.';
  end if;
end;
$$;
revoke all on function public.beitritt_versuche_pruefen() from public, anon, authenticated;

-- Rückgabetyp ändert sich: alte Fassung entfernen.
drop function if exists public.beitritt_annehmen(text, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.beitritt_annehmen(p_code text, p_termine boolean, p_todos boolean, p_schichten boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich uuid := auth.uid();
  b betrieb_beitritte;
  e employees;
  vorher profiles;
  u auth.users;
  art record;
  neu uuid;
begin
  if ich is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  perform beitritt_versuche_pruefen();
  select * into b from betrieb_beitritte where code = _beitritt_code(p_code) and gueltig_bis > now() for update;
  if b.code is null then
    -- Fehlversuch merken (ohne Ausnahme, sonst wäre er wieder weg); die App meldet „ungültig“.
    insert into kalender_code_versuche (user_id) values (ich);
    return false;
  end if;
  if exists (select 1 from profiles where id = ich) then
    raise exception 'Dein Konto gehört bereits zu einem Betrieb.';
  end if;
  select * into e from employees where id = b.employee_id and company_id = b.company_id;
  if e.id is null or not e.active then
    raise exception 'Diese Einladung gilt nicht mehr. Bitte frag im Betrieb nach.';
  end if;
  if exists (select 1 from companies c where c.id = b.company_id and (c.is_demo or c.geloescht_am is not null)) then
    raise exception 'Diese Einladung gilt nicht mehr. Bitte frag im Betrieb nach.';
  end if;

  -- Für diese Person gibt es schon einen Zugang aus der Einladung per Link? Ist er
  -- nie benutzt worden, tritt das bestehende Konto an seine Stelle.
  select * into vorher from profiles where employee_id = e.id;
  if vorher.id is not null then
    select * into u from auth.users where id = vorher.id;
    if u.last_sign_in_at is not null then
      raise exception 'Für diese Person gibt es schon einen Zugang. Bitte frag im Betrieb nach.';
    end if;
    delete from auth.users where id = vorher.id;
    delete from profiles where id = vorher.id;
  end if;

  select * into u from auth.users where id = ich;
  insert into profiles (id, company_id, employee_id, first_name, last_name, email, role, start_ansicht, neuigkeiten_gesehen)
  values (ich, e.company_id, e.id, e.first_name, e.last_name,
          coalesce(nullif(e.email, ''), u.email), e.role, 'kompakt', now());

  -- Nicht übernommen: bleibt nur im Privatbereich.
  if not coalesce(p_termine, true) then
    update kalender_termine set nur_privat = true where owner_id = ich;
  end if;
  if not coalesce(p_todos, true) then
    update kalender_todos set nur_privat = true where owner_id = ich;
  end if;
  -- Eigene Schichten ab heute als eigene Einträge in den Betriebskalender (je Tag die erste).
  if coalesce(p_schichten, false) then
    for art in
      select distinct s.* from privat_schichtarten s
        join privat_tage t on t.user_id = ich and t.schichtart_id = s.id and t.tag >= public.heute()
       where s.user_id = ich and s.art = 'arbeit'
    loop
      insert into kalender_eigene_arten (user_id, name, kuerzel, farbe, beginn, ende, reihenfolge)
      values (ich, art.name, art.kuerzel, art.farbe, art.beginn, art.ende, art.reihenfolge)
      returning id into neu;
      insert into kalender_eigene_tage (user_id, tag, art_id)
      select ich, t.tag, neu from privat_tage t
       where t.user_id = ich and t.schichtart_id = art.id and t.tag >= public.heute()
      on conflict (user_id, tag) do nothing;
    end loop;
  end if;

  delete from betrieb_beitritte where employee_id = e.id;
  perform write_audit(e.company_id, 'zugang.beitritt', 'employees', e.id, '{}'::jsonb);
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.beitritt_vorschau(p_code text)
 RETURNS TABLE(firma text, name text, termine integer, todos integer, eigene_schichten integer)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b betrieb_beitritte;
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich zuerst an.';
  end if;
  perform beitritt_versuche_pruefen();
  select * into b from betrieb_beitritte where code = _beitritt_code(p_code) and gueltig_bis > now();
  if b.code is null then
    insert into kalender_code_versuche (user_id) values (auth.uid());
    return;  -- keine Zeile = ungültig (die Seite zeigt den Hinweis)
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Dein Konto gehört bereits zu einem Betrieb.';
  end if;
  return query
    select c.name,
           btrim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')),
           (select count(*)::int from kalender_termine t where t.owner_id = auth.uid() and not t.von_partner and t.person_id is null),
           (select count(*)::int from kalender_todos t where t.owner_id = auth.uid() and not t.erledigt),
           (select count(*)::int from privat_tage t where t.user_id = auth.uid() and t.tag >= public.heute())
      from companies c, employees e
     where c.id = b.company_id and e.id = b.employee_id;
end;
$function$;

revoke all on function public.beitritt_annehmen(text, boolean, boolean, boolean) from public, anon;
grant execute on function public.beitritt_annehmen(text, boolean, boolean, boolean) to authenticated;
revoke all on function public.beitritt_vorschau(text) from public, anon;
grant execute on function public.beitritt_vorschau(text) to authenticated;
