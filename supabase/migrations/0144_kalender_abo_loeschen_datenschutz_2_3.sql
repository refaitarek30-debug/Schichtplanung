-- Kalender-Abo und Freischaltungen hängen am Konto: wird es gelöscht,
-- verschwinden sie mit (wie beim Partner-Link, 0138).
alter table public.kalender_abo
  add constraint kalender_abo_user_fk foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.funktionen_zugang
  add constraint funktionen_zugang_user_fk foreign key (user_id) references auth.users (id) on delete cascade;

-- Datenschutzerklärung Fassung 2.3: persönlicher Kalender, Partner-Link,
-- Kalender-Abo (Abschnitt 8). Löst bei bestehenden Personen keine erneute
-- Abfrage aus.
update public.legal_versions
   set version = '2.3', valid_from = current_date
 where doc = 'datenschutz';
