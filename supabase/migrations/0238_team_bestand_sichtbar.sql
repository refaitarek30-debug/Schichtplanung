-- =============================================================
-- 0238 · Team-Sichtbarkeit für alle, die die App schon nutzen
--
-- Mit Freigabe des Unternehmens: Wer am 22.11.2026 schon ein Konto hat,
-- muss nicht neu zustimmen – Name und Schichten sind für die eigene und
-- die anderen Schichtgruppen sichtbar. Wer schon selbst geantwortet hat,
-- behält die eigene Wahl. Ändern geht jederzeit unter Einstellungen →
-- Was Kollegen sehen. Neue Konten werden weiterhin gefragt.
-- Datenschutzerklärung 2.42.
-- =============================================================

insert into public.privacy_settings (user_id, company_id, team_eigene, team_andere, team_gefragt_am)
select p.id, p.company_id, true, true, now()
  from public.profiles p
 where p.employee_id is not null
   and p.company_id is not null
on conflict (user_id) do update
   set team_eigene = true,
       team_andere = true,
       team_gefragt_am = now()
 where public.privacy_settings.team_gefragt_am is null;

update public.legal_versions set version = '2.42', valid_from = current_date where doc = 'datenschutz';
