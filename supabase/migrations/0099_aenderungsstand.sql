-- „Hat sich seit dem letzten Blick etwas geändert?" – in einer Abfrage.
--
-- Die App fragt das alle 60 Sekunden, solange sie offen und sichtbar ist,
-- und sofort, wenn sie aus dem Hintergrund zurückkommt. Nur wenn sich ein
-- Stempel ändert, wird der betroffene Bereich neu geladen. Das ist
-- deutlich billiger als den ganzen Plan in festen Abständen neu zu holen:
-- ein Schichtplan-Abruf kostet rund 50 ms Rechenzeit, dieser Stempel einen
-- Bruchteil davon, und die meiste Zeit ändert sich schlicht nichts.
--
-- Je Thema ein Prüfwert (md5). Er ändert sich bei jedem Einfügen, Ändern
-- und Löschen: `xmin` ist die Transaktionsnummer der Zeile und wird bei
-- jeder Änderung neu vergeben – auch dort, wo es keine updated_at-Spalte
-- gibt (absences, shift_assignments).
--
-- Datenschutz: in die Stempel fließen nur Zeilen ein, die die Person auch
-- im Schichtplan sieht – die Führung die ganze Firma, alle anderen sich
-- selbst und die eigene Schichtgruppe. Die Stempel verraten keinen Inhalt,
-- nur dass sich in diesem sichtbaren Ausschnitt etwas getan hat.
create or replace function public.aenderungsstand()
returns table (
  antraege text,
  abwesenheiten text,
  plan text,
  benachrichtigungen text,
  mitteilungen text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  firma uuid := auth_company_id();
  ich uuid := auth_employee_id();
  fuehrung boolean := is_leadership();
  mein_team rotation_team;
begin
  if firma is null then
    return;
  end if;

  select e.rotation_team into mein_team
    from employees e
   where e.id = ich and e.company_id = firma;

  return query
  with sichtbar as (
    select e.id
      from employees e
     where e.company_id = firma
       and (fuehrung or e.id = ich or (mein_team is not null and e.rotation_team = mein_team))
  )
  select
    md5(coalesce((select string_agg(r.id::text || ':' || r.xmin::text, ',' order by r.id)
                     from leave_requests r
                    where r.company_id = firma and r.employee_id in (select id from sichtbar)), '')),
    md5(coalesce((select string_agg(a.id::text || ':' || a.xmin::text, ',' order by a.id)
                     from absences a
                    where a.company_id = firma and a.employee_id in (select id from sichtbar)), '')),
    md5(coalesce((select string_agg(s.id::text || ':' || s.xmin::text, ',' order by s.id)
                     from shift_assignments s
                    where s.company_id = firma and s.employee_id in (select id from sichtbar)), '')),
    md5(coalesce((select string_agg(n.id::text || ':' || n.xmin::text, ',' order by n.id)
                     from notifications n
                    where n.employee_id = ich), '')),
    md5(coalesce((select string_agg(x.id::text || ':' || x.xmin::text, ',' order by x.id)
                     from announcements x where x.company_id = firma), '')
        || coalesce((select string_agg(x.id::text || ':' || x.xmin::text, ',' order by x.id)
                       from staffing_rules x where x.company_id = firma), ''));
end;
$$;

revoke all on function public.aenderungsstand() from public, anon;
grant execute on function public.aenderungsstand() to authenticated;
