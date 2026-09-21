-- Geburtsdatum in der Teamübersicht.
--
-- Das Geburtsdatum liegt in `personal_details` und ist freiwillig: eintragen,
-- ändern und löschen darf es ausschliesslich die betroffene Person selbst.
-- Wer nichts einträgt, steht überall ohne Datum da -- das bleibt so.
--
-- Lesen darf die Führung es bereits (Richtlinie "personal_details leadership
-- select" aus 0071). Es fehlte nur ein Weg, das Datum zusammen mit der
-- Mitarbeiterliste abzurufen, ohne jedem Browser die ganze Tabelle
-- freizugeben. Genau das macht diese Funktion: sie gibt Mitarbeiter-Id und
-- Datum heraus, sonst nichts.
--
-- Bewusst NICHT über age_leave_overview(): die Funktion ist seit 0073 der
-- Administration vorbehalten, und das soll sie bleiben. Die Teamübersicht
-- sieht auch die Schichtleitung.

create or replace function public.team_birth_dates()
returns table (employee_id uuid, birth_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_firma uuid := auth_company_id();
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if v_firma is null then
    raise exception 'Kein aktives Benutzerprofil gefunden.';
  end if;

  return query
  select e.id, pd.birth_date
  from public.employees e
  join public.profiles p
    on p.employee_id = e.id and p.company_id = v_firma
  join public.personal_details pd
    on pd.user_id = p.id and pd.company_id = v_firma
  where e.company_id = v_firma
    and e.active
    -- Zeilen ohne Datum gar nicht erst ausliefern: "kein Datum" ist keine
    -- Angabe und muss nicht über die Leitung gehen.
    and pd.birth_date is not null;
end;
$$;

comment on function public.team_birth_dates() is
  'Freiwillig hinterlegte Geburtsdaten der eigenen Firma fuer die Teamuebersicht. Nur fuer Schichtleitung und Administration; Personen ohne Eintrag kommen nicht vor.';

revoke all on function public.team_birth_dates() from public, anon;
grant execute on function public.team_birth_dates() to authenticated;
