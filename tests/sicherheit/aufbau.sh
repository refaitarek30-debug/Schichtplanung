#!/usr/bin/env bash
# Baut die Prüf-Datenbank für den Sicherheitstest:
#   1. Ersatz für die Supabase-Teile (auth, storage, cron, net, vault, Rollen)
#   2. Aufbau der Live-Datenbank (schema-stand.sql, nur Struktur, keine Daten)
#   3. alle Migrationen, die neuer sind als dieser Stand
# Aufruf: PGHOST=… PGPORT=… PGUSER=postgres tests/sicherheit/aufbau.sh [datenbank]
set -euo pipefail
DB="${1:-pruef}"
HIER="$(cd "$(dirname "$0")" && pwd)"
MIG="$HIER/../../supabase/migrations"
STAND="$HIER/schema-stand.sql"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
STRENG=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${STRENG[@]}" -f "$HIER/supabase-ersatz.sql" >/dev/null

# Abschnitte des Stands einzeln ablegen (Trenner: "-- ##NAME").
awk -v d="$TMP" '/^-- ##/ { name = substr($0, 6); next } name != "" { print > (d "/" name ".sql") }' "$STAND"
for f in "$TMP"/*.sql; do sed -i '1i set check_function_bodies = off;' "$f"; done

"${STRENG[@]}" -f "$TMP/TYPEN.sql" -f "$TMP/TABELLEN.sql" >/dev/null
# Funktionen und Ansichten hängen gegenseitig voneinander ab: erst locker, dann streng.
psql -X -q -d "$DB" -f "$TMP/FUNKTIONEN.sql" >/dev/null 2>&1 || true
for _ in 1 2 3; do psql -X -q -d "$DB" -f "$TMP/VIEWS.sql" >/dev/null 2>&1 || true; done
"${STRENG[@]}" -f "$TMP/FUNKTIONEN.sql" -f "$TMP/VIEWS.sql" >/dev/null
"${STRENG[@]}" -f "$TMP/CONSTRAINTS.sql" -f "$TMP/INDEXE.sql" -f "$TMP/TRIGGER.sql" -f "$TMP/RLS.sql" -f "$TMP/POLICIES.sql" >/dev/null
# Rechte genau wie live: erst alles entziehen, was die Standardrechte vergeben haben.
"${STRENG[@]}" >/dev/null <<'SQL'
revoke all on all tables in schema public from public, anon, authenticated, service_role;
revoke all on all sequences in schema public from public, anon, authenticated, service_role;
revoke all on all functions in schema public from public, anon, authenticated, service_role;
SQL
sed -i "/^grant MAINTAIN /d" "$TMP/RECHTE.sql"  # gibt es erst ab PostgreSQL 17
"${STRENG[@]}" -f "$TMP/RECHTE.sql" -f "$TMP/BUCKETS.sql" >/dev/null

# Neuere Migrationen (nach dem Stand) obendrauf.
LETZTE="$(sed -n 's/^-- Stand bis Migration \([0-9]*\).*/\1/p' "$STAND")"
for f in $(ls "$MIG"/*.sql | sort); do
  nr="$(basename "$f" | cut -c1-4)"
  if [ "$nr" \> "$LETZTE" ]; then
    "${STRENG[@]}" -f "$f" >/dev/null || { echo "Migration fehlgeschlagen: $(basename "$f")"; exit 1; }
    echo "  + $(basename "$f")"
  fi
done
echo "Prüf-Datenbank $DB steht (Live-Stand bis $LETZTE + neuere Migrationen)."
