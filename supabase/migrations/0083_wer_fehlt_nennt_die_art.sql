-- "Wer fehlt heute" nennt die Art statt pauschal "Urlaub".
--
-- Die Funktion schrieb für jeden Antrag fest 'Urlaub'. Solange es nur
-- Urlaub und V-Tag gab, war das schon ungenau; mit Sonderurlaub,
-- Bildungsurlaub, Altersfreizeit und Gewerkschaftstag wäre es schlicht
-- falsch. Der Rest bleibt unverändert, auch die Beschränkung auf die
-- Führung.
--
-- Nicht geändert: employees_absent_on(). Die Funktion fragt nur, WER an
-- einem Tag fehlt, nicht warum, und ist damit schon richtig. Sie ist der
-- Grund, warum die neuen Arten ohne weiteres Zutun in die
-- Mindestbesetzungsprüfung eingehen.
create or replace function public.who_is_absent(p_date date)
returns table (employee_id uuid, employee_name text, shift_name text, reason text)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select e.id, e.first_name || ' ' || e.last_name,
         s.name, leave_kind_label(r.kind)
  from leave_requests r
  join employees e on e.id = r.employee_id
  left join shifts s on s.id = effective_shift_id(e.id, p_date)
  where e.company_id = auth_company_id()
    and e.active
    and r.status = 'approved'
    and p_date between r.start_date and r.end_date

  union all

  select e.id, e.first_name || ' ' || e.last_name,
         s.name,
         case a.type
           when 'krank' then 'Krankheit'
           when 'schulung' then 'Schulung'
           else 'Sonstiges'
         end
  from absences a
  join employees e on e.id = a.employee_id
  left join shifts s on s.id = effective_shift_id(e.id, p_date)
  where e.company_id = auth_company_id()
    and e.active
    and a.date = p_date

  order by 2;
end;
$function$;

revoke all on function public.who_is_absent(date) from public, anon;
grant execute on function public.who_is_absent(date) to authenticated;
