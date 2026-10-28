-- Privatbereich (28.10.2026): Freie Tage aus dem Betriebsplan mit anzeigen –
-- sonst wirkt der Kalender leer. Weiterhin ohne Urlaub, Krank und andere
-- genehmigte Abwesenheiten. Freie Tage kommen als name 'Frei', kuerzel 'FREI'.
create or replace function public.meine_betriebsschichten(p_von date, p_bis date)
returns table(tag date, name text, kuerzel text)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  firma uuid := auth_company_id();
  ab date := p_von;
  n int;
begin
  if firma is null or auth_employee_id() is null or p_von is null or p_bis is null then
    return;
  end if;
  if p_bis < p_von or p_bis - p_von > 400 then
    raise exception 'Zeitraum zu groß.';
  end if;
  while ab <= p_bis loop
    n := least(62, p_bis - ab + 1);
    return query
      select g.day,
             coalesce(g.shift_name, 'Frei'),
             case when g.shift_name is null then 'FREI' else g.shift_code end
        from shift_plan_grid(firma, ab, n) g
       where g.is_me
         and (g.absence_code is null or g.absence_code <> upper(g.absence_code));
    ab := ab + n;
  end loop;
end;
$$;
revoke execute on function public.meine_betriebsschichten(date, date) from public, anon;
grant execute on function public.meine_betriebsschichten(date, date) to authenticated;
