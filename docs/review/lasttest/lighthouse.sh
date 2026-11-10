#!/usr/bin/env bash
# Ladezeiten mit gedrosseltem Netz messen.
#
# ENTWURF aus dem Review vom 10.11.2026. NICHT ausgeführt.
# Nur öffentliche Seiten oder eine Vorschau-Adresse messen, die auf ein Testprojekt zeigt.
#
# Aufruf:  ./lighthouse.sh https://<vorschau-adresse>
#
# Gemessen wird wie ein Mittelklasse-Handy im langsamen 4G-Netz
# (1,6 Mbit/s herunter, 150 ms Verzögerung, Prozessor 4-fach gebremst).

set -euo pipefail

ADRESSE="${1:?Bitte eine Adresse angeben, z. B. https://vorschau.example}"
ZIEL="lighthouse-ergebnis"
mkdir -p "$ZIEL"

for SEITE in "/" "/login" "/betriebe" "/registrieren"; do
  NAME=$(echo "$SEITE" | tr '/' '_')
  npx --yes lighthouse "${ADRESSE}${SEITE}" \
    --only-categories=performance \
    --form-factor=mobile \
    --throttling-method=simulate \
    --throttling.rttMs=150 \
    --throttling.throughputKbps=1638 \
    --throttling.cpuSlowdownMultiplier=4 \
    --chrome-flags="--headless --no-sandbox" \
    --output=json --output=html \
    --output-path="${ZIEL}/seite${NAME}" \
    --quiet
  echo "Fertig: ${SEITE}"
done

echo
echo "Ergebnisse in ${ZIEL}/. Wichtig sind:"
echo "  - Largest Contentful Paint (Ziel: unter 3 s)"
echo "  - Time to Interactive      (Ziel: unter 5 s)"
echo "  - Total Byte Weight        (Ziel: unter 500 kB beim ersten Aufruf)"
echo
echo "Angemeldete Seiten (Schichtplan, Urlaub) lassen sich so nicht messen."
echo "Dafür in Chrome: Entwicklerwerkzeuge → Lighthouse → Modus 'Zeitspanne', im Testprojekt angemeldet."
