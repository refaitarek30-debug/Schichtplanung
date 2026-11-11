-- „Meine Zahlen“: eigene Statistik im Betrieb (Arbeitstage, Sonntage, Feiertage, Nächte …).
--
-- Die Funktion liefert ausschließlich die Tage der angemeldeten Person (is_me) – ein Jahr,
-- je Tag Schicht, genehmigte Abwesenheit und die Stunden je Arbeitstag des Unternehmens.
-- Gerechnet wird in der App beim Öffnen; gespeichert wird nichts, und niemand sonst
-- (auch nicht Schichtleitung oder Administration) kann die Zahlen einer anderen Person abrufen.

create or replace function public.meine_statistik_tage(p_jahr integer)
returns table (tag date, schicht text, kuerzel text, abwesenheit text, stunden numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  firma uuid := auth_company_id();
  ab date;
  bis date;
  n int;
  std numeric;
begin
  if firma is null or auth_employee_id() is null then
    return;
  end if;
  if p_jahr is null or p_jahr < 2000 or p_jahr > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;
  ab := make_date(p_jahr, 1, 1);
  bis := make_date(p_jahr, 12, 31);
  std := company_rule_number('stunden_pro_arbeitstag', 'stunden', 8);
  while ab <= bis loop
    n := least(62, bis - ab + 1);
    return query
      select g.day,
             g.shift_name,
             g.shift_code,
             -- nur genehmigte Abwesenheiten (Großbuchstaben); beantragte zählen nicht
             case when g.absence_code is not null and g.absence_code = upper(g.absence_code) then g.absence_code end,
             std
        from shift_plan_grid(firma, ab, n) g
       where g.is_me;
    ab := ab + n;
  end loop;
end;
$function$;

revoke all on function public.meine_statistik_tage(integer) from public, anon;
grant execute on function public.meine_statistik_tage(integer) to authenticated;

-- Datenschutzerklärung 2.30: eigene Statistik „Meine Zahlen“.
update public.legal_versions set version = '2.30', valid_from = current_date where doc = 'datenschutz';
