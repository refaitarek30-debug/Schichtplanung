-- Kein Antrag, wenn dadurch eine geforderte Qualifikation fehlt.
--
-- Beispiel: In der Nachtschicht muss mindestens eine Person mit
-- "Messwarte" da sein. Wer als letzte Messwarte dieser Schicht frei haben
-- will, kann den Antrag nicht absenden und erfährt, warum:
--
--   Antrag nicht möglich – sonst ist nicht genug Messwarte da:
--   12.03.2027 Nachtschicht (1 benötigt, ohne dich 0).
--
-- Vom Betrieb so entschieden:
--
--   * Gezählt werden nur GENEHMIGTE Abwesenheiten (und Einträge aus
--     `absences`). Zwei offene Anträge, die um dieselbe Lücke konkurrieren,
--     lassen sich beide absenden -- die Schichtleitung entscheidet. Die
--     Sammelgenehmigung genehmigt in diesem Fall keinen der beiden
--     automatisch: shift_qualification_gaps zählt offene Anträge als
--     abwesend, jeder der beiden sieht also den anderen als fehlend.
--   * Die Sperre gilt für Anträge, die jemand für sich selbst stellt --
--     auch für die eigenen Anträge der Führung. Trägt die Schichtleitung
--     direkt im Plan ein (Status "approved"), wird nicht gesperrt: das ist
--     eine bewusste Entscheidung, etwa wenn ein Springer aus einem anderen
--     Team kommt.
--
-- Die Anforderungen kommen aus shift_qualification_needs, die Befähigungen
-- aus employee_qualifications. Nichts davon steht hier fest.
--
-- Gezählt wird nur an Tagen, an denen die Person tatsächlich Schicht hat --
-- dieselbe Regel wie calculate_leave_days_for_employee.
--
-- Vor dem Einspielen gegen den Bestand gemessen: 80 zukünftige offene oder
-- genehmigte Anträge, davon hätte keiner diese Prüfung verletzt.

create or replace function public.leave_requests_check_qualifikation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d date;
  s shifts;
  l record;
  luecken text[] := '{}';
  quali text[] := '{}';
begin
  -- Nur Anträge, die jemand für sich selbst stellt. Einträge der Führung
  -- im Plan kommen als "approved" und bleiben unberührt; ebenso das Teilen
  -- eines fremden Antrags durch die Führung.
  if new.status <> 'pending' or new.employee_id is distinct from auth_employee_id() then
    return new;
  end if;

  d := new.start_date;
  while d <= new.end_date loop
    select sh.* into s
      from shifts sh
     where sh.id = effective_shift_id(new.employee_id, d)
       and sh.company_id = new.company_id;

    if s.id is not null and shift_runs_on(s, d) then
      for l in
        select q.label,
               n.minimum,
               (select count(*)
                  from employees e2
                  join employee_qualifications eq2
                    on eq2.employee_id = e2.id and eq2.qualification_id = n.qualification_id
                 where e2.active
                   and e2.company_id = new.company_id
                   and e2.id <> new.employee_id
                   and effective_shift_id(e2.id, d) = s.id
                   and e2.id not in (select a.employee_id from employees_absent_on(d, false) a)
               )::int as ohne
          from shift_qualification_needs n
          join qualifications q on q.id = n.qualification_id and q.active
          -- Nur Qualifikationen, die die Person selbst hat: wer keinen
          -- B-Schein hat, reisst durch seinen Urlaub keine B-Schein-Lücke.
          join employee_qualifications eq
            on eq.qualification_id = n.qualification_id and eq.employee_id = new.employee_id
         where n.shift_id = s.id
           and n.company_id = new.company_id
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

  if cardinality(luecken) > 0 then
    raise exception '%',
      format('Antrag nicht möglich – sonst ist nicht genug %s da: %s%s.',
             array_to_string(quali, ' und '),
             array_to_string(luecken[1:3], '; '),
             case when cardinality(luecken) > 3
                  then format(' und an %s weiteren Tagen', cardinality(luecken) - 3)
                  else '' end);
  end if;

  return new;
end;
$$;

revoke all on function public.leave_requests_check_qualifikation() from public, anon;

drop trigger if exists leave_requests_check_qualifikation_trg on public.leave_requests;
create trigger leave_requests_check_qualifikation_trg
  before insert on public.leave_requests
  for each row execute function public.leave_requests_check_qualifikation();
