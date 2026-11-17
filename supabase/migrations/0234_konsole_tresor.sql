-- =============================================================
-- 0234 · Betreiber-Konsole: Unterlagen & Tresor
--
-- Wichtige Unterlagen (PDFs, Bilder) und Zugangsdaten des Betreiber-Teams.
-- Alles wird IM BROWSER mit einem eigenen Master-Passwort verschlüsselt
-- (PBKDF2 → AES-GCM 256). Die Datenbank und der Speicher bekommen nur
-- Geheimtext – auch wir als Betreiber können ohne Master-Passwort nichts
-- lesen. Das Master-Passwort wird nirgends gespeichert.
--
-- Aufbau:
--   konsole_tresor_schluessel  genau eine Zeile: Salz, Runden und der mit
--                              dem Master-Passwort verpackte Datenschlüssel
--   konsole_tresor             Einträge (Zugangsdaten, Notizen) und
--                              Dateien; Titel, Inhalt, Dateiname – alles
--                              steckt verschlüsselt in „daten“
--   Bucket konsole-tresor      die verschlüsselten Dateien
--
-- Zugriff: nur service_role. Keine Richtlinien für anon/authenticated –
-- die Konsole liest serverseitig, nachdem sie Betreiber-Recht (voll),
-- und Zwei-Faktor-Code geprüft hat.
-- =============================================================

create table if not exists public.konsole_tresor_schluessel (
  id smallint primary key default 1 check (id = 1),
  salz text not null,
  runden int not null check (runden >= 100000),
  schluessel text not null,
  geaendert_von uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.konsole_tresor (
  id uuid primary key default gen_random_uuid(),
  art text not null check (art in ('eintrag', 'datei')),
  daten text not null check (length(daten) <= 200000),
  datei_pfad text unique,
  groesse bigint,
  erstellt_von uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((art = 'datei') = (datei_pfad is not null))
);

alter table public.konsole_tresor_schluessel enable row level security;
alter table public.konsole_tresor enable row level security;
revoke all on public.konsole_tresor_schluessel from public, anon, authenticated;
revoke all on public.konsole_tresor from public, anon, authenticated;
grant all on public.konsole_tresor_schluessel to service_role;
grant all on public.konsole_tresor to service_role;

-- Privater Bucket, 25 MB je Datei. Bewusst ohne Richtlinien auf
-- storage.objects: nur service_role (und kurzlebige, signierte Links,
-- die die Konsole nach der Prüfung ausstellt) kommt heran.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('konsole-tresor', 'konsole-tresor', false, 26214400, array['application/octet-stream'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
