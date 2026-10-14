-- Termin per Sprache (0145) wieder entfernt – keine KI in der Anwendung.
delete from public.funktionen_zugang where funktion = 'termin_sprache';
delete from public.funktionen where funktion = 'termin_sprache';

-- Datenschutzerklärung Fassung 2.5: Abschnitt zu Termin per Sprache und
-- Anthropic als Dienstleister gestrichen.
update public.legal_versions
   set version = '2.5', valid_from = current_date
 where doc = 'datenschutz';
