-- Bezeichnung für „V-Tag“ je Unternehmen (zum Beispiel „Zeitausgleichstag“).
-- Wird bei der Registrierung festgelegt; nur die Anzeige ändert sich, nicht die Berechnung.
alter table public.companies
  add column if not exists v_tag_name text not null default 'V-Tag' check (char_length(btrim(v_tag_name)) between 1 and 40),
  add column if not exists v_tage_name text not null default 'V-Tage' check (char_length(btrim(v_tage_name)) between 1 and 40);
