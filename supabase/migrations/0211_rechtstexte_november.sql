-- Datenschutzerklärung 2.28 und AV-Vertrag 1.4 (10.11.2026).
-- Lohnabrechnungen abgeschaltet, eigener Wiederherstellungs-Code für alle, Mails ohne Inhalte,
-- Brevo als Versanddienstleister der Anmelde-Mails, Verantwortung für den persönlichen Kalender.
update public.legal_versions set version = '2.28', valid_from = current_date where doc = 'datenschutz';
update public.legal_versions set version = '1.4', valid_from = current_date where doc = 'avv';
