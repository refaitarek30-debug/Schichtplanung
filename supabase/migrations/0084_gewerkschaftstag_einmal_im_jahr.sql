-- Gewerkschaftstag: ein Tag je Person und Kalenderjahr.
--
-- Der Startwert stand auf 3. Das war eine Annahme von mir beim Einführen
-- der Art und nicht abgestimmt. Richtig ist 1.
--
-- Geändert wird nur, was noch auf dem unveränderten Startwert steht. Hätte
-- ein Betrieb den Wert bewusst auf etwas anderes gesetzt, bliebe der
-- erhalten -- die Regel ist einstellbar und soll es bleiben.
--
-- Gebuchte Gewerkschaftstage gibt es zum Zeitpunkt dieser Migration keine
-- (geprüft: 0 Zeilen in leave_requests mit kind = 'gewerkschaftstag'),
-- es kann also kein bestehender Antrag nachträglich ungültig werden.
-- Bestehende Anträge werden ohnehin nicht angefasst: die Obergrenze wirkt
-- über leave_requests_check_kontingent beim Anlegen und beim Genehmigen,
-- nicht rückwirkend.
update public.staffing_rules
   set value = '{"tage": 1}'::jsonb
 where key = 'gewerkschaftstag_tage_jahr'
   and shift_id is null
   and value = '{"tage": 3}'::jsonb;

-- Betriebe, die nach 0076 angelegt wurden, haben die drei Regeln nicht.
-- Ohne Zeile fällt company_rule_number auf den übergebenen Rückfallwert
-- zurück, und der ist in leave_kind_kontingent bewusst 0 -- die Art stünde
-- dort also gar nicht zur Wahl. Deshalb hier nachziehen, aber nur wo nichts
-- steht: ein vorhandener Wert wird nicht überschrieben.
insert into staffing_rules (company_id, shift_id, key, value)
select c.id, null, v.key, v.value
  from companies c
  cross join (values
    ('sonderurlaub_tage_jahr',     '{"tage": 3}'::jsonb),
    ('bildungsurlaub_tage_jahr',   '{"tage": 5}'::jsonb),
    ('gewerkschaftstag_tage_jahr', '{"tage": 1}'::jsonb)
  ) as v(key, value)
 where not exists (
   select 1 from staffing_rules r
    where r.company_id = c.id and r.shift_id is null and r.key = v.key
 );
