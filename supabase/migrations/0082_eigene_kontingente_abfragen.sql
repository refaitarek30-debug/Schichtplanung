-- Die eigenen Kontingente auf einen Schlag.
--
-- Das Antragsformular braucht für jede der vier neuen Arten drei Zahlen und
-- die Angabe, ob sie überhaupt zur Wahl steht. Vier einzelne Aufrufe wären
-- vier Runden zum Server; diese Funktion liefert alles in einer.
--
-- "erlaubt" fasst zwei Dinge zusammen: bei Bildungsurlaub den Haken am
-- Mitarbeiter, bei allen den Anspruch selbst. Was hier auf false steht,
-- gehört im Formular gar nicht erst in die Auswahl -- massgeblich bleibt
-- aber die Prüfung in leave_requests_check_kontingent.
create or replace function public.my_leave_kind_quotas(p_year int)
returns table (kind leave_kind, anspruch numeric, verbraucht numeric, rest numeric, erlaubt boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth_employee_id();
  darf_bu boolean;
begin
  if me is null then
    raise exception 'Dein Konto ist keinem Personalstammsatz zugeordnet.';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  select e.bildungsurlaub_erlaubt into darf_bu
  from public.employees e where e.id = me;

  return query
  select a.art,
         k.anspruch, k.verbraucht, k.rest,
         (k.anspruch > 0
          and (a.art <> 'bildungsurlaub' or coalesce(darf_bu, false))) as erlaubt
  from (values
    ('altersfreizeit'::leave_kind),
    ('sonderurlaub'::leave_kind),
    ('bildungsurlaub'::leave_kind),
    ('gewerkschaftstag'::leave_kind)
  ) as a(art)
  cross join lateral public.leave_kind_kontingent(me, a.art, p_year) k;
end;
$$;

revoke all on function public.my_leave_kind_quotas(int) from public, anon;
grant execute on function public.my_leave_kind_quotas(int) to authenticated;
