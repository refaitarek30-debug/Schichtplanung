-- Die persönliche Sichtbarkeitseinstellung gilt jetzt auch für die Liste
-- "Abwesend in meiner Schicht".
--
-- Bisher hielt sich nur `shift_plan_grid()` an `privacy_settings`.
-- `my_shift_leave()` gab dagegen jedem Mitglied der eigenen Schicht die
-- Urlaubszeiträume der Kolleginnen und Kollegen samt Namen heraus -- ohne die
-- Einstellung überhaupt zu lesen. Wer im Profil "Nur Abwesend" gewählt hatte,
-- stand damit trotzdem mit Urlaub in der Liste. Die Einstellung war an dieser
-- Stelle also wirkungslos.
--
-- Bewusst NICHT gemacht: die Zeile ganz ausblenden. Der Plan zeigt schon
-- heute ein "A" für eine Abwesenheit ohne freigegebenen Grund -- dass jemand
-- fehlt, bleibt sichtbar, nur der Grund wird maskiert. Dasselbe Verhalten
-- gilt jetzt hier: die Abwesenheit bleibt planbar, der Grund verschwindet.
-- Deshalb die neue Spalte `reason_visible` statt eines Filters.
--
-- Eine Ausnahme davon: ein NOCH NICHT genehmigter Antrag wird verdeckt gar
-- nicht ausgeliefert. "Abwesend" waere dort schlicht falsch -- entschieden
-- ist nichts -- und die blosse Zeile wuerde verraten, dass ein Urlaubsantrag
-- existiert. Genau das soll die Maskierung ja verhindern. Der Filter steht
-- hier in der Datenbank und nicht im Browser, damit kein Client ihn umgehen
-- kann.
--
-- `who_is_absent()` bleibt unverändert: die Funktion bricht für alle ohne
-- `is_leadership()` ab. Die Führung sieht Gründe ohnehin überall, sonst könnte
-- sie Urlaub nicht genehmigen und Krankmeldungen nicht erfassen.

drop function if exists public.my_shift_leave(date, date);

create function public.my_shift_leave(p_from date, p_to date)
returns table (
  employee_id uuid,
  employee_name text,
  start_date date,
  end_date date,
  status leave_status,
  is_me boolean,
  reason_visible boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth_employee_id();
  meine_firma uuid := auth_company_id();
  fuehrung boolean := is_leadership();
  my_shift uuid;
  my_pattern uuid;
begin
  if me is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  select e.shift_id, e.rotation_pattern_id into my_shift, my_pattern
  from employees e where e.id = me;

  return query
  with sichtbar as (
    select
      r.employee_id as emp_id,
      e.first_name || ' ' || e.last_name as emp_name,
      r.start_date as von,
      r.end_date as bis,
      r.status as stand,
      (r.employee_id = me) as ich,
      e.last_name as nachname,
      -- Eigene Einträge und die Führungssicht bleiben vollständig. Für alle
      -- anderen entscheidet ausschliesslich die Einstellung der betroffenen
      -- Person. Kein Login, keine Zeile in privacy_settings, kein 'shift'
      -- -> der Grund bleibt verdeckt. Die Vorgabe ist also Nichtanzeige.
      case
        when r.employee_id = me then true
        when fuehrung then true
        else exists (
          select 1
          from public.profiles sp
          join public.privacy_settings ps on ps.user_id = sp.id
          where sp.employee_id = r.employee_id
            and sp.company_id = meine_firma
            and ps.company_id = meine_firma
            and ps.absence_visibility = 'shift'
        )
      end as grund_sichtbar
    from leave_requests r
    join employees e on e.id = r.employee_id
    where e.company_id = meine_firma
      and e.active
      and r.status in ('approved', 'pending')
      and r.start_date <= p_to
      and r.end_date >= p_from
      and (
        (my_shift is not null and e.shift_id = my_shift)
        or (my_pattern is not null and e.rotation_pattern_id = my_pattern)
        or r.employee_id = me
      )
  )
  select emp_id, emp_name, von, bis, stand, ich, grund_sichtbar
  from sichtbar
  where grund_sichtbar or stand = 'approved'
  order by von, nachname;
end;
$$;

revoke all on function public.my_shift_leave(date, date) from public;
grant execute on function public.my_shift_leave(date, date) to authenticated;
