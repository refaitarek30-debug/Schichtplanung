-- Betriebsregeln als Daten, nicht als Zahl im Code.
--
-- Ruhezeit, Einsatzdauer, Stundenumrechnung und der Zielwert der
-- Gesundheitsrate gehören dem Betrieb, nicht dem Programm. Sie kommen in
-- die vorhandene Tabelle staffing_rules, die schon die Urlaubssperren
-- trägt -- eine eigene Tabelle wäre eine zweite Wahrheit für dasselbe.
--
-- Die beiden Zeitwerte sind Vorgaben des Betriebs. In der Oberfläche
-- erscheinen sie als „eure Regel", nicht als gesetzliche Vorschrift; ob
-- Ausnahmen oder Tarifregelungen greifen, entscheidet der Betrieb.

-- Achtung beim Einfügen: staffing_rules hat `unique (company_id,
-- shift_id, key)`, und NULL gilt in einem UNIQUE als verschieden. Ein
-- `on conflict` greift für betriebsweite Regeln (shift_id is null) also
-- nicht -- deshalb `where not exists`.
insert into staffing_rules (company_id, shift_id, key, value)
select c.id, null, v.key, v.value
  from companies c
  cross join (values
    ('ruhezeit_stunden',         '{"stunden": 11}'::jsonb),
    ('max_schichtdauer_stunden', '{"stunden": 8}'::jsonb),
    ('stunden_pro_arbeitstag',   '{"stunden": 8}'::jsonb),
    ('gesundheitsrate_ziel',     '{"prozent": 96}'::jsonb)
  ) as v(key, value)
 where not exists (
   select 1 from staffing_rules r
    where r.company_id = c.id and r.shift_id is null and r.key = v.key
 );

-- Eine Regel lesen, mit Rückfallwert. Betriebsweite Regeln stehen mit
-- shift_id is null; eine Regel für eine einzelne Schicht sticht sie.
create or replace function company_rule_number(
  p_key text,
  p_field text,
  p_default numeric,
  p_shift_id uuid default null
)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (r.value ->> p_field)::numeric
       from staffing_rules r
      where r.company_id = auth_company_id()
        and r.key = p_key
        and r.active
        and (r.shift_id = p_shift_id or r.shift_id is null)
      order by r.shift_id nulls last
      limit 1),
    p_default
  );
$$;

comment on function company_rule_number(text, text, numeric, uuid) is
  'Liest einen Zahlenwert aus staffing_rules. Eine Regel für eine '
  'einzelne Schicht sticht die betriebsweite; fehlt beides, gilt der '
  'übergebene Rückfallwert.';

revoke execute on function company_rule_number(text, text, numeric, uuid) from public, anon;
grant execute on function company_rule_number(text, text, numeric, uuid) to authenticated;
