# ShiftNexo als iPhone-App

Die App ist eine Hülle (Capacitor) um shiftnexo.de. Alles, was auf der Webseite
neu kommt, ist sofort auch in der App – ein neues App-Update ist nur für
Änderungen an der Hülle selbst nötig (Symbol, Mitteilungen, Rechte).

## Was im Projekt liegt

| Datei/Ordner | Wofür |
|---|---|
| `capacitor.config.json` | App-Name, Bundle-ID `de.shiftnexo.app`, Startadresse `https://shiftnexo.de/start` |
| `capacitor/www/` | Seite „Keine Verbindung“, falls das Handy offline ist |
| `ios/` | Das Xcode-Projekt (Symbol, Startbild, Rechte-Texte) |
| `src/lib/app-huelle.ts` | Erkennt die App (keine Safari-Hinweise in der App) |

## Einmalig am MacBook einrichten

1. **Xcode** aus dem Mac App Store installieren und einmal öffnen (Zusatzkomponenten bestätigen).
2. **Node.js** (LTS) von https://nodejs.org installieren.
3. Programm **Terminal** öffnen und nacheinander eingeben:

   ```
   git clone https://github.com/refaitarek30-debug/Schichtplanung.git
   cd Schichtplanung
   npm install
   npx cap sync ios
   npx cap open ios
   ```

   Danach öffnet sich Xcode mit dem Projekt.

## In Xcode (ohne Apple-Entwicklerkonto – nur zum Testen auf dem eigenen iPhone)

1. Links oben auf **App** (blaues Symbol) klicken → Reiter **Signing & Capabilities**.
2. **Team**: „Add an Account…“ → mit deiner Apple-ID anmelden → dein Name („Personal Team“) wählen.
3. iPhone per Kabel anschließen, am iPhone „Diesem Computer vertrauen“.
4. Oben in der Mitte statt „Any iOS Device“ dein iPhone wählen.
5. **▶** (Run) drücken.
6. Beim ersten Mal am iPhone: Einstellungen → Datenschutz & Sicherheit → **Entwicklermodus** an (Neustart),
   danach Einstellungen → Allgemein → VPN & Geräteverwaltung → deinem Entwicklerzertifikat vertrauen.

Ohne bezahltes Entwicklerkonto läuft die App 7 Tage, dann einfach erneut auf ▶ drücken.

## Später: in den App Store (mit Apple Developer Program, 99 $/Jahr)

1. In Xcode beim **Team** das Entwicklerkonto wählen.
2. **Product → Archive** → **Distribute App** → **App Store Connect** → Upload.
3. Auf https://appstoreconnect.apple.com die App anlegen (Bundle-ID `de.shiftnexo.app`),
   Texte, Screenshots, Datenschutz-Angaben ausfüllen, Build wählen.
4. Zuerst **TestFlight**, danach **Zur Prüfung einreichen**.

## Nach Änderungen an der Hülle

```
git pull
npm install
npx cap sync ios
```

Dann in Xcode erneut ▶ bzw. Archive. Vor jedem Upload die **Build-Nummer** erhöhen
(App → General → Identity → Build).

## Schneller Start und ohne Netz

`WKAppBoundDomains` (Info.plist) und `limitsNavigationsToAppBoundDomains` (capacitor.config.json)
erlauben der Seite im App-Fenster einen Service Worker: der Kalender öffnet sofort vom Gerät,
die eigenen Schichten der nächsten 5 Jahre sind vorab gemerkt. Startet die App danach nicht
mehr richtig, diese beiden Einträge wieder entfernen und erneut `npx cap sync ios`.

## Noch offen (nächste Schritte)

- Mitteilungen nativ (Apple Push) – braucht das Entwicklerkonto (Push-Schlüssel).
- Store-Texte, Screenshots und Datenschutz-Angaben vorbereiten.
