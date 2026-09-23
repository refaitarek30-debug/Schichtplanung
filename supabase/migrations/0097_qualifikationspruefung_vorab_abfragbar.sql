-- Die Qualifikationsprüfung aus 0096 vorab abfragbar machen.
--
-- Bisher erfuhr man erst beim Absenden, dass ein Antrag nicht geht. Das
-- Formular soll den Grund schon zeigen, sobald der Zeitraum gewählt ist,
-- und den Knopf gar nicht erst anbieten.
--
-- Damit die Anzeige nie von der Sperre abweicht, gibt es die Regel nur
-- einmal: leave_qualification_block_reason() liefert den Grund oder null,
-- und der Trigger ruft genau diese Funktion auf. Inhaltlich unverändert
-- gegenüber 0096.

create or replace function public.leave_qualification_block_reason(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  emp employees;
  d date;
  s shifts;
  l record;
  luecken text[] := '{}';
  quali text[] := '{}';
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then
    return null;
  end if;
  -- Nur für sich selbst oder als Führung der eigenen Firma. Die Funktion
  -- verrät sonst, wer welche Qualifikation hat und wer wann fehlt.
  if emp.company_id is distinct from auth_company_id()
     or (p_employee_id is distinct from auth_employee_id() and not is_leadership()) then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 400 then
    return null;
  end if;

  d := p_start_date;
  while d <= p_end_date loop
    select sh.* into s
      from shifts sh
     where sh.id = effective_shift_id(p_employee_id, d)
       and sh.company_id = emp.company_id;

    if s.id is not null and shift_runs_on(s, d) then
      for l in
        select q.label,
               n.minimum,
               (select count(*)
                  from employees e2
                  join employee_qualifications eq2
                    on eq2.employee_id = e2.id and eq2.qualification_id = n.qualification_id
                 where e2.active
                   and e2.company_id = emp.company_id
                   and e2.id <> p_employee_id
                   and effective_shift_id(e2.id, d) = s.id
                   -- Nur genehmigte Abwesenheiten zählen (so entschieden):
                   -- zwei konkurrierende offene Anträge lassen sich beide
                   -- stellen, die Schichtleitung entscheidet.
                   and e2.id not in (select a.employee_id from employees_absent_on(d, false) a)
               )::int as ohne
          from shift_qualification_needs n
          join qualifications q on q.id = n.qualification_id and q.active
          join employee_qualifications eq
            on eq.qualification_id = n.qualification_id and eq.employee_id = p_employee_id
         where n.shift_id = s.id
           and n.company_id = emp.company_id
           and n.minimum > 0
         order by q.sort_order, q.label
      loop
        if l.ohne < l.minimum then
          luecken := luecken || format('%s %s (%s benötigt, ohne dich %s)',
                                       to_char(d, 'DD.MM.YYYY'), s.name, l.minimum, l.ohne);
          if not (l.label = any(quali)) then
            quali := quali || l.label;
          end if;
        end if;
      end loop;
    end if;

    d := d + 1;
  end loop;

  if cardinality(luecken) = 0 then
    return null;
  end if;

  return format('Antrag nicht möglich – sonst ist nicht genug %s da: %s%s.',
                array_to_string(quali, ' und '),
                array_to_string(luecken[1:3], '; '),
                case when cardinality(luecken) > 3
                     then format(' und an %s weiteren Tagen', cardinality(luecken) - 3)
                     else '' end);
end;
$$;

revoke all on function public.leave_qualification_block_reason(uuid, date, date) from public, anon;
grant execute on function public.leave_qualification_block_reason(uuid, date, date) to authenticated;

create or replace function public.leave_requests_check_qualifikation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grund text;
begin
  -- Nur Anträge, die jemand für sich selbst stellt. Einträge der Führung
  -- im Plan kommen als "approved" und bleiben unberührt.
  if new.status <> 'pending' or new.employee_id is distinct from auth_employee_id() then
    return new;
  end if;

  grund := public.leave_qualification_block_reason(new.employee_id, new.start_date, new.end_date);
  if grund is not null then
    raise exception '%', grund;
  end if;
  return new;
end;
$$;

revoke all on function public.leave_requests_check_qualifikation() from public, anon;
