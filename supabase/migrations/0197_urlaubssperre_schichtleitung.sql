-- Urlaubssperren: auch die Schichtleitung darf sie anlegen und entfernen.
--
-- Bisher pflegte nur die Administration alles in staffing_rules (Policy
-- "Regeln pflegt Admin", unverändert). Neu kommen zwei Policies NUR für
-- Zeilen mit key = 'urlaubssperre' dazu – Ruhezeit, Schichtdauer, Soll &
-- Mindest, Jahresobergrenzen usw. bleiben allein bei der Administration.
-- Ändern (UPDATE) braucht es nicht: die App legt an und entfernt.
-- Wer was angelegt oder entfernt hat, steht wie bisher im Protokoll
-- (Trigger protokoll_staffing_rules).

-- Schichtleitung: Urlaubssperre anlegen – im eigenen Betrieb, und eine
-- angegebene Schicht muss zum eigenen Betrieb gehören.
create policy "Urlaubssperre anlegen Schichtleitung" on staffing_rules
  for insert
  with check (
    company_id = (select auth_company_id())
    and (select auth_role()) = 'shift_leader'
    and key = 'urlaubssperre'
    and (
      shift_id is null
      or exists (select 1 from shifts s where s.id = shift_id and s.company_id = (select auth_company_id()))
    )
  );

-- Schichtleitung: Urlaubssperre entfernen – nur Sperren des eigenen Betriebs.
create policy "Urlaubssperre entfernen Schichtleitung" on staffing_rules
  for delete
  using (
    company_id = (select auth_company_id())
    and (select auth_role()) = 'shift_leader'
    and key = 'urlaubssperre'
  );
