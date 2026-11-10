#!/usr/bin/env bash
# Prüft eine ausgepackte Datensicherung (Ordner mit rollen.sql, schema.sql, daten.sql):
# alle drei Dateien da und nicht leer, wichtige Tabellen im Aufbau und mit Zeilen in den Daten.
# Gibt nur Tabellennamen und Anzahlen aus – keine Inhalte.
set -euo pipefail
ordner="${1:-sicherung}"
fehler=0
melde() { echo "::error::$1"; fehler=1; }

for d in rollen.sql schema.sql daten.sql; do
  if [ -s "$ordner/$d" ]; then echo "✓ $d ($(wc -c < "$ordner/$d") Bytes)"; else melde "$d fehlt oder ist leer."; fi
done
[ "$fehler" = 0 ] || exit 1

# Zeilen je Tabelle aus den COPY-Blöcken zählen.
zaehlung=$(awk '
  /^COPY / { t=$2; gsub(/"/, "", t); n[t]=0; drin=1; next }
  drin && /^\\\.$/ { drin=0; next }
  drin { n[t]++ }
  END { for (t in n) print n[t] "\t" t }
' "$ordner/daten.sql" | sort -k2)

echo
echo "Zeilen je Tabelle (Schema public):"
echo "$zaehlung" | awk -F'\t' '$2 ~ /^public\./ { printf "  %8d  %s\n", $1, $2 }'
echo

gesamt=$(echo "$zaehlung" | awk -F'\t' '$2 ~ /^public\./ { s+=$1 } END { print s+0 }')
tabellen=$(echo "$zaehlung" | awk -F'\t' '$2 ~ /^public\./' | wc -l)
echo "Zusammen: $tabellen Tabellen mit Daten-Block, $gesamt Zeilen."

# Ohne diese Tabellen wäre die Sicherung wertlos.
for t in companies employees profiles; do
  grep -q "CREATE TABLE IF NOT EXISTS \"public\".\"$t\"\|CREATE TABLE \"public\".\"$t\"\|CREATE TABLE public.$t\|CREATE TABLE IF NOT EXISTS public.$t" "$ordner/schema.sql" \
    || melde "Tabelle $t fehlt im Aufbau (schema.sql)."
  z=$(echo "$zaehlung" | awk -F'\t' -v t="public.$t" '$2 == t { print $1 }')
  [ "${z:-0}" -gt 0 ] || melde "Tabelle $t hat in der Sicherung keine Zeilen."
done
# Anmeldungen (auth.users) gehören dazu – sonst kann sich nach dem Einspielen niemand anmelden.
z=$(echo "$zaehlung" | awk -F'\t' '$2 == "auth.users" { print $1 }')
[ "${z:-0}" -gt 0 ] && echo "✓ Anmeldekonten: $z" || melde "auth.users fehlt oder ist leer."

[ "$fehler" = 0 ] && echo "✓ Die Sicherung lässt sich öffnen und enthält die erwarteten Daten."
exit "$fehler"
