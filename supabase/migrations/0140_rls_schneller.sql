-- Zugriffsregeln (RLS) schneller
--
-- Die Regeln riefen auth_company_id(), is_leadership() usw. für JEDE Zeile
-- neu auf. Bei 700 Urlaubsanträgen waren das tausende Funktionsaufrufe pro
-- Abfrage (gemessen ~100 ms). In „(SELECT f())“ verpackt rechnet Postgres
-- den Wert einmal je Abfrage aus (InitPlan) – gemessen ~2 ms.
--
-- Inhaltlich ändert sich nichts: dieselben Funktionen, dieselben
-- Bedingungen. Vor dem Einspielen geprüft: für Admin, Mitarbeiter,
-- Schichtleitung (Demo), einen frischen Zugang und anonym liefern alle 28
-- Tabellen mit Regeln vor und nach der Änderung exakt dieselbe Zeilenzahl.
-- (Empfehlung „auth_rls_initplan“ des Supabase-Advisors.)

do $$
declare
  p record;
  neu_q text;
  neu_c text;
  befehl text;
  re constant text := '(?<!SELECT )\m(auth_company_id|is_admin|is_leadership|auth_employee_id|auth\.uid|auth_role|protokoll_firma)\(\)';
begin
  set local lock_timeout = '3s';
  for p in select * from pg_policies where schemaname = 'public' loop
    neu_q := regexp_replace(p.qual, re, '(SELECT \1())', 'g');
    neu_c := regexp_replace(p.with_check, re, '(SELECT \1())', 'g');
    if neu_q is distinct from p.qual or neu_c is distinct from p.with_check then
      befehl := format('alter policy %I on public.%I', p.policyname, p.tablename);
      if p.qual is not null then befehl := befehl || ' using (' || neu_q || ')'; end if;
      if p.with_check is not null then befehl := befehl || ' with check (' || neu_c || ')'; end if;
      execute befehl;
    end if;
  end loop;
end $$;
