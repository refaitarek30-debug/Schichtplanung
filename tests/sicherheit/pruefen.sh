#!/usr/bin/env bash
# Sicherheitstest komplett: Prüf-Datenbank aufbauen, angreifen, Ergebnis bewerten.
# Ende mit Fehlercode 1, wenn es einen Fund gibt, der nicht in erlaubt.txt begründet ist.
set -euo pipefail
HIER="$(cd "$(dirname "$0")" && pwd)"
DB="${1:-pruef}"
"$HIER/aufbau.sh" "$DB"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HIER/angriff.sql"
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HIER/kontouebernahme.sql"
# Begründete Ausnahmen (eine je Zeile: angreifer|ziel), Kommentare mit #
ERLAUBT="$(awk -F'|' '!/^[[:space:]]*(#|$)/ { gsub(/'"'"'/, "'"'"''"'"'"); printf "%s('"'"'%s'"'"','"'"'%s'"'"')", (n++ ? "," : ""), $1, $2 }' "$HIER/erlaubt.txt")"
OFFEN="$(psql -X -At -d "$DB" -c "select count(*) from pruef.fund f where (f.angreifer, f.ziel) not in (values ${ERLAUBT:-('','')})")"
FUELL="$(psql -X -At -d "$DB" -c "select count(*) from pruef.fuell_bericht")"
echo "Offene Funde: $OFFEN · nicht befüllbare Tabellen: $FUELL"
[ "$OFFEN" = "0" ] && [ "$FUELL" = "0" ]
