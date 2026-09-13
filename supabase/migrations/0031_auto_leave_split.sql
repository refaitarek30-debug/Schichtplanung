-- =============================================================
-- Phase 13 · Urlaub automatisch auf die richtigen Konten verteilen
--
-- Im Schichtbetrieb lohnt sich Urlaub an Tagen mit Zuschlag – Sonntag,
-- Feiertag, Nachtschicht – weil der Zuschlag dann mitbezahlt wird. An
-- allen anderen Tagen ist der V-Tag günstiger. Bisher musste die Person
-- das selbst je Antrag entscheiden.
--
-- Jetzt wählt sie nur den Zeitraum. Die Datenbank geht ihn Tag für Tag
-- durch, entscheidet je Tag und legt für jeden zusammenhängenden Block
-- einen eigenen Antrag an. Ist ein Konto leer, wird auf das andere
-- ausgewichen; sind beide leer, bricht der ganze Vorgang ab.
-- =============================================================

-- Wer im Schichtsystem arbeitet, bekommt die Automatik. Für alle anderen
-- gibt es keine Zuschläge und damit auch nichts zu optimieren.
alter table employees
  add column if not exists shift_worker boolean not null default true;

comment on column employees.shift_worker is
  'Arbeitet im Schichtsystem: Sonn-, Feiertags- und Nachtzuschläge. Steuert die automatische Verteilung auf Urlaub und V-Tage.';

/**
 * Ist dieser Tag für diese Person ein Zuschlagstag?
 * Sonntag, gesetzlicher Feiertag oder Nachtschicht.
 */
create or replace function is_premium_day(p_employee_id uuid, p_date date)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
  sname text;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return false; end if;

  if extract(dow from p_date) = 0 then return true; end if;

  if exists (
    select 1 from holidays h
     where h.date = p_date
       and (h.company_id = e.company_id or h.company_id is null)
  ) then
    return true;
  end if;

  select s.name into sname from shifts s where s.id = effective_shift_id(p_employee_id, p_date);
  return coalesce(sname ilike 'Nacht%', false);
end;
$$;

revoke execute on function is_premium_day(uuid, date) from public, anon;
grant execute on function is_premium_day(uuid, date) to authenticated;
