-- =============================================================
-- 0225 · Änderungsprotokoll im Betrieb: mehr Ereignisse
--
-- Bisher stand vor allem drin, was Personen betrifft (Urlaub, Abwesenheit,
-- Mitarbeiter, Anmeldung). Jetzt zusätzlich die Einstellungen, die den
-- ganzen Betrieb verändern, und Sicherheits-Ereignisse:
--
--   Schichten         angelegt / geändert (Name, Zeiten, Tage) / gelöscht
--   Schichtmuster     angelegt / geändert / gelöscht
--   Qualifikationen   angelegt / geändert / gelöscht
--   Feiertage         hinzugefügt / entfernt (eine Zeile je Vorgang)
--   Betriebsregeln    geändert (company_settings)
--   Hinweise          an eine Person gesendet / zurückgezogen (ohne Text)
--
-- (Mitteilungen, Sperre, Freischalten und Zwei-Faktor stehen schon drin.)
-- Inhalte bleiben draußen: kein Text von Hinweisen oder Mitteilungen,
-- nur was passiert ist, wann und durch wen (protokoll_schreiben, 0208).
-- Demo-Firmen schreibt protokoll_schreiben ohnehin nicht.
-- =============================================================

create or replace function public.protokoll_tabelle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  t text := tg_table_name;
  alt jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  neu jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  zeile jsonb := coalesce(neu, alt);
  firma uuid := (zeile ->> 'company_id')::uuid;
  eid uuid := nullif(zeile ->> 'id', '')::uuid;
  wort text := case tg_op when 'INSERT' then 'angelegt' when 'UPDATE' then 'geaendert' else 'geloescht' end;
begin
  if firma is null then
    return null;
  end if;

  if t = 'shifts' then
    -- Nur Änderungen, die man sieht; Besetzung protokolliert die App schon (shift.staffing_changed).
    if tg_op = 'UPDATE' and (alt -> 'name', alt -> 'start_time', alt -> 'end_time', alt -> 'weekdays', alt -> 'active')
        is not distinct from (neu -> 'name', neu -> 'start_time', neu -> 'end_time', neu -> 'weekdays', neu -> 'active') then
      return null;
    end if;
    perform protokoll_schreiben(firma, 'schicht.' || wort, 'shifts', eid, jsonb_build_object('name', zeile ->> 'name'));
  elsif t = 'rotation_patterns' then
    if tg_op = 'UPDATE' and (alt -> 'name', alt -> 'steps', alt -> 'anchor_date', alt -> 'active', alt -> 'team_offset_days')
        is not distinct from (neu -> 'name', neu -> 'steps', neu -> 'anchor_date', neu -> 'active', neu -> 'team_offset_days') then
      return null;
    end if;
    perform protokoll_schreiben(firma, 'muster.' || wort, 'rotation_patterns', eid, jsonb_build_object('name', zeile ->> 'name'));
  elsif t = 'qualifications' then
    if tg_op = 'UPDATE' and (alt -> 'label', alt -> 'active') is not distinct from (neu -> 'label', neu -> 'active') then
      return null;
    end if;
    perform protokoll_schreiben(firma, 'qualifikation.' || wort, 'qualifications', eid, jsonb_build_object('name', zeile ->> 'label'));
  elsif t = 'company_settings' then
    if tg_op <> 'UPDATE' then
      return null;
    end if;
    if exists (select 1 from jsonb_object_keys(neu) k where k not in ('updated_at', 'company_id') and (alt -> k) is distinct from (neu -> k)) then
      perform protokoll_schreiben(firma, 'regeln.geaendert', 'company_settings', null,
        (select jsonb_object_agg(k, neu -> k) from jsonb_object_keys(neu) k
          where k not in ('updated_at', 'company_id') and (alt -> k) is distinct from (neu -> k)));
    end if;
  elsif t = 'hinweise' then
    if tg_op = 'INSERT' then
      perform protokoll_schreiben(firma, 'hinweis.gesendet', 'hinweise', eid, jsonb_build_object('employee_id', zeile ->> 'employee_id'));
    elsif tg_op = 'UPDATE' and alt ->> 'zurueckgezogen_am' is null and neu ->> 'zurueckgezogen_am' is not null then
      perform protokoll_schreiben(firma, 'hinweis.zurueckgezogen', 'hinweise', eid, jsonb_build_object('employee_id', zeile ->> 'employee_id'));
    end if;
  end if;
  return null;
end;
$$;

-- Feiertage: oft viele auf einmal – eine Zeile je Vorgang.
create or replace function public.protokoll_feiertage()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  if tg_op = 'INSERT' then
    for r in select company_id, count(*) n, min(date) von, max(date) bis from neu where company_id is not null group by company_id loop
      perform protokoll_schreiben(r.company_id, 'feiertage.hinzugefuegt', 'holidays', null, jsonb_build_object('anzahl', r.n, 'von', r.von, 'bis', r.bis));
    end loop;
  else
    for r in select company_id, count(*) n, min(date) von, max(date) bis from alt where company_id is not null group by company_id loop
      perform protokoll_schreiben(r.company_id, 'feiertage.entfernt', 'holidays', null, jsonb_build_object('anzahl', r.n, 'von', r.von, 'bis', r.bis));
    end loop;
  end if;
  return null;
end;
$$;

revoke all on function public.protokoll_tabelle() from public, anon, authenticated;
revoke all on function public.protokoll_feiertage() from public, anon, authenticated;

drop trigger if exists protokoll on public.shifts;
create trigger protokoll after insert or update or delete on public.shifts for each row execute function public.protokoll_tabelle();
drop trigger if exists protokoll on public.rotation_patterns;
create trigger protokoll after insert or update or delete on public.rotation_patterns for each row execute function public.protokoll_tabelle();
drop trigger if exists protokoll on public.qualifications;
create trigger protokoll after insert or update or delete on public.qualifications for each row execute function public.protokoll_tabelle();
drop trigger if exists protokoll on public.company_settings;
create trigger protokoll after update on public.company_settings for each row execute function public.protokoll_tabelle();
drop trigger if exists protokoll on public.hinweise;
create trigger protokoll after insert or update on public.hinweise for each row execute function public.protokoll_tabelle();

drop trigger if exists protokoll_neu on public.holidays;
create trigger protokoll_neu after insert on public.holidays referencing new table as neu for each statement execute function public.protokoll_feiertage();
drop trigger if exists protokoll_weg on public.holidays;
create trigger protokoll_weg after delete on public.holidays referencing old table as alt for each statement execute function public.protokoll_feiertage();
