import {
  Abschnitt,
  Absatz,
  Hinweis,
  LegalPage,
  Liste,
  Platzhalter,
} from "@/components/legal/prose";
import { DATENSCHUTZ_VERSION } from "@/lib/legal/version";

export const metadata = {
  title: "Datenschutzerklärung – Schichtplan",
  description:
    "Welche personenbezogenen Daten Schichtplan verarbeitet, zu welchem Zweck, auf welcher Rechtsgrundlage und wie lange.",
};

const kode = "rounded bg-surface-muted px-1 py-0.5 text-[12px]";

/*
 * Fassung 2 (30.09.2026). Grundlage ist das, was die Anwendung tatsächlich
 * tut: Schema und Zugriffsregeln (supabase/migrations), Server-Aktionen,
 * Middleware und Browser-Speicher. Jede Aussage hier muss sich im Code
 * belegen lassen; was nicht aus dem Code kommen kann (Anbieter, Verträge,
 * Fristen des Betreibers), ist mit <Platzhalter> markiert.
 *
 * Bei inhaltlichen Änderungen: LEGAL_VERSIONS.datenschutz in
 * src/lib/legal/version.ts erhöhen UND eine Migration, die legal_versions
 * nachzieht. Die Abfrage zur Kenntnisnahme erscheint nur bei neu angelegten
 * Personen (privacy_settings.accepted_at ist leer), nicht bei jeder neuen Fassung.
 *
 * Kein Ersatz für eine rechtliche Prüfung.
 *
 * TODO (Betreiber): alle Platzhalter ausfüllen bzw. streichen.
 */
export default function DatenschutzPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      intro="Diese Erklärung beschreibt, welche personenbezogenen Daten in Schichtplan verarbeitet werden, wer dafür verantwortlich ist und welche Rechte betroffene Personen haben."
      updated="30. September 2026"
      version={DATENSCHUTZ_VERSION}
    >
      <Hinweis titel="Wer ist wofür verantwortlich?">
        <p>
          Schichtplan wird Unternehmen (Kunden) als Anwendung zur technischen Schicht- und
          Personalplanung zur Verfügung gestellt. Für die Daten <strong>der Beschäftigten</strong>{" "}
          ist das jeweilige Unternehmen als Arbeitgeber die verantwortliche Stelle. Der
          Betreiber von Schichtplan verarbeitet diese Daten insoweit als{" "}
          <strong>Auftragsverarbeiter</strong> nach Art. 28 DSGVO ausschließlich auf
          Weisung des Unternehmens (siehe{" "}
          <a href="/avv" className="font-medium text-brand-600 hover:underline">
            Auftragsverarbeitungsvertrag
          </a>
          ).
        </p>
        <p>
          Eigenverantwortlich verarbeitet der Betreiber nur die Daten, die für den Vertrag
          mit dem Kunden und für den sicheren Betrieb der Anwendung selbst anfallen
          (Abschnitt 1).
        </p>
      </Hinweis>

      <Abschnitt titel="1. Verantwortlicher für den Betrieb der Anwendung">
        <Absatz>
          <Platzhalter>Name oder Firma des Betreibers</Platzhalter>,{" "}
          <Platzhalter>Anschrift</Platzhalter>, E-Mail:{" "}
          <Platzhalter>Kontaktadresse</Platzhalter>. Die vollständigen Angaben stehen im{" "}
          <a href="/impressum" className="font-medium text-brand-600 hover:underline">
            Impressum
          </a>
          .
        </Absatz>
        <Absatz>Der Betreiber verantwortet eigenständig:</Absatz>
        <Liste>
          <li>
            das Kundenkonto: Name, E-Mail-Adresse und Unternehmensname der Person, die ein
            Unternehmen registriert, sowie die Nachweise der Zustimmung zu Nutzungsbedingungen,
            Auftragsverarbeitungsvertrag und die Kenntnisnahme dieser Erklärung (Zeitpunkt und
            Fassung)
          </li>
          <li>
            technische Betriebs- und Sicherheitsdaten: Zugriffsprotokolle der
            Hosting-Dienstleister, Ratenbegrenzung gegen automatisiertes Ausprobieren
            (Abschnitt 3)
          </li>
        </Liste>
        <Absatz>
          Ein Datenschutzbeauftragter ist{" "}
          <Platzhalter>benannt (Kontakt) / nicht benannt – Pflicht nach § 38 BDSG prüfen</Platzhalter>.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="2. Verantwortlicher für die Beschäftigtendaten">
        <Absatz>
          Das Unternehmen, das den Zugang eingerichtet hat (Ihr Arbeitgeber). An diese
          Stelle richten Beschäftigte Auskunfts-, Berichtigungs-, Lösch- und sonstige
          Betroffenenanfragen zu ihren Schicht-, Urlaubs- und Abwesenheitsdaten. Erreicht
          ein solches Verlangen den Betreiber, leitet er es unverzüglich an das Unternehmen
          weiter, unterstützt dieses bei der Beantwortung und beantwortet es nicht selbst.
        </Absatz>
        <Absatz>
          Das Unternehmen ist auch dafür zuständig, seine Beschäftigten nach Art. 13 DSGVO zu
          informieren, die Rechtmäßigkeit der Verarbeitung im eigenen Betrieb sicherzustellen
          (einschließlich einer etwaigen Beteiligung von Betriebsrat oder Personalvertretung)
          und die Angaben richtig zu halten. Diese Erklärung ergänzt, ersetzt aber nicht die
          Information durch den Arbeitgeber.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="3. Welche Daten verarbeitet werden">
        <Absatz>
          <strong>Erforderliche Angaben zur Person</strong> (ohne sie lässt sich eine Person
          nicht in den Schichtplan aufnehmen):
        </Absatz>
        <Liste>
          <li>Vor- und Nachname, Personalnummer, Rolle in der Anwendung (Mitarbeiter, Schichtleitung, Administration)</li>
          <li>Schichtgruppe bzw. Rotationsmuster, Eintritts- und ggf. Austrittsdatum, Kennzeichen „Auszubildende/r“</li>
          <li>
            E-Mail-Adresse – nur, wenn für die Person ein Zugang eingerichtet werden soll
            (Anmeldung, Benachrichtigungen)
          </li>
        </Liste>

        <Absatz className="pt-1">
          <strong>Freiwillige Angaben</strong> (ohne Nachteil verzichtbar; Änderung oder
          Löschung jederzeit beim Arbeitgeber bzw. – soweit vorgesehen – im eigenen Profil):
        </Absatz>
        <Liste>
          <li>Telefonnummer, Abteilung</li>
          <li>
            Geburtsdatum im Profil. Es wird für die rechnerische Ermittlung des
            Anspruchs auf Altersfreizeit (Sonderurlaub ab dem Jahr nach dem 55. Geburtstag)
            verwendet und ist für Schichtleitung und Administration sichtbar
          </li>
          <li>Begründung bei einem Urlaubsantrag (Freitext) und Notizen bei Fehlzeiten (höchstens 200 Zeichen)</li>
          <li>Kommentare im Schichtplan (Freitext, siehe Abschnitt 7)</li>
          <li>Freigaben zur Sichtbarkeit von Abwesenheitsgründen (Abschnitt 5)</li>
          <li>Darstellungseinstellungen, etwa ausgeblendete Kacheln auf der Startseite</li>
        </Liste>

        <Absatz className="pt-1">
          <strong>Planungs- und Abwesenheitsdaten:</strong>
        </Absatz>
        <Liste>
          <li>Schichtzuordnung je Tag, Besetzungsvorgaben, Qualifikationen, soweit für die Besetzungsplanung hinterlegt</li>
          <li>
            Urlaubsanspruch, genommene, geplante und beantragte Tage; V-Tage, Altersfreizeit
            und Stundenkonten einschließlich Korrekturen
          </li>
          <li>Anträge mit Zeitraum, Art, Status, Bearbeiter und Zeitpunkten</li>
          <li>
            Abwesenheiten mit Art (z. B. Urlaub, Freischicht, Schulung, <em>krank</em>)
          </li>
          <li>
            Fehlzeiten („früher gegangen“, „später gekommen“) mit Datum und Stunden; sie
            mindern V- oder Altersfreizeit-Konto. Diese Funktion ist derzeit auf die
            Administration beschränkt
          </li>
          <li>Benachrichtigungen in der Anwendung (z. B. zu Antragsentscheidungen)</li>
        </Liste>

        <Absatz className="pt-1">
          <strong>Datenschutz-Einstellungen:</strong> gewählte Sichtbarkeit, Fassung dieser
          Erklärung und Zeitpunkt der Kenntnisnahme sowie Zeitpunkte, zu denen eine Freigabe
          erteilt oder zurückgenommen wurde.
        </Absatz>

        <Absatz className="pt-1">
          <strong>Zugangs- und Sicherheitsdaten:</strong>
        </Absatz>
        <Liste>
          <li>
            E-Mail-Adresse, Passwort-Hash (das Passwort selbst wird nicht gespeichert),
            Sitzungs-Token, Zeitpunkt der letzten Anmeldung
          </li>
          <li>
            Änderungsprotokoll (Audit-Log): sicherheits- und datenschutzrelevante Änderungen
            wie Rollen- und Aktivstatus-Änderungen, Löschungen, Änderungen der
            Datenschutz-Einstellungen und die Registrierung eines Unternehmens – jeweils mit
            Zeitpunkt und handelnder Person. Inhalte von Abwesenheitsgründen, Notizen oder
            Gesundheitsangaben werden nicht protokolliert
          </li>
          <li>
            Ratenbegrenzung: für Anmeldung, Passwort-Zurücksetzen und Registrierung werden
            die Versuche mit einem gesalzenen Hashwert der IP-Adresse bzw. E-Mail-Adresse
            gezählt, nicht mit Klartext. Die Einträge werden nach spätestens einem Tag gelöscht
          </li>
          <li>
            Zugriffsprotokolle der Hosting-Dienstleister mit IP-Adresse, Zeitpunkt,
            aufgerufenem Pfad und Browserkennung
          </li>
        </Liste>

        <Absatz className="pt-1">
          <strong>E-Mails:</strong> Systemmails (Bestätigung, Einladung, Passwort
          zurücksetzen) versendet der Authentifizierungsdienst über den dort eingerichteten
          Mailserver. Benachrichtigungen zu Anträgen werden zunächst in einem Postausgang
          (Empfänger, Betreff, Text, Status) zwischengespeichert und von dort versendet.
          Versanddienstleister: <Platzhalter>SMTP-Anbieter eintragen und Region prüfen</Platzhalter>.
        </Absatz>

        <Absatz className="text-[13px] text-ink-muted">
          Es findet keine Reichweitenmessung, kein Tracking und keine Werbung statt. Es werden
          keine Daten verkauft oder für fremde Zwecke ausgewertet.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="4. Gesundheitsdaten (Krankheit)">
        <Absatz>
          Die Angabe, dass eine Person krank ist, kann ein Gesundheitsdatum im Sinne von
          Art. 9 DSGVO sein. Die Anwendung ist deshalb bewusst datensparsam gebaut:
        </Absatz>
        <Liste>
          <li>
            Gespeichert wird ausschließlich die <strong>Tatsache der Abwesenheit</strong> („krank“).
            Es gibt <strong>kein Feld für Diagnosen, Bescheinigungen oder Freitext</strong>; die
            Datenbank weist Notizen bei Krankheit ab
          </li>
          <li>
            Standardmäßig sehen Kolleginnen und Kollegen nur, dass jemand „abwesend“ ist –
            nicht den Grund
          </li>
          <li>
            Die Art der Abwesenheit einschließlich „krank“ sehen Schichtleitung und
            Administration des eigenen Unternehmens. Das ist technisch nicht auf die eigene
            Schichtgruppe beschränkt
          </li>
          <li>
            Im Änderungsprotokoll und in Benachrichtigungen an Dritte werden keine
            Krankheitsangaben ausgeschrieben
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Bitte tragen Sie in Freitextfeldern (Kommentare, Begründungen, Notizen) keine
          Gesundheitsangaben ein. Das Unternehmen sollte seine Beschäftigten entsprechend
          anweisen.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="5. Zwecke und Rechtsgrundlagen">
        <Absatz>
          <strong>Beschäftigtendaten (Verantwortlicher: Ihr Arbeitgeber)</strong>
        </Absatz>
        <Liste>
          <li>
            <strong>Schicht-, Urlaubs- und Stundenkontenplanung, Antragsbearbeitung,
            Mindestbesetzung:</strong> Art. 6 Abs. 1 lit. b DSGVO (Durchführung des
            Beschäftigungsverhältnisses) und lit. f (berechtigtes Interesse an einer
            geordneten Betriebsorganisation), soweit anwendbar in Verbindung mit § 26 BDSG und
            Art. 88 DSGVO sowie kollektivrechtlichen Regelungen
          </li>
          <li>
            <strong>Abwesenheit „krank“:</strong> Art. 9 Abs. 2 lit. b DSGVO in Verbindung
            mit § 26 Abs. 3 BDSG (Ausübung von Rechten und Erfüllung von Pflichten aus dem
            Arbeitsrecht, z. B. Entgeltfortzahlung und Personalplanung)
          </li>
          <li>
            <strong>Freigabe von Abwesenheitsgründen für die eigene Schichtgruppe:</strong>{" "}
            freiwillige Einwilligung, Art. 6 Abs. 1 lit. a DSGVO, für Krankheit zusätzlich
            Art. 9 Abs. 2 lit. a DSGVO in Verbindung mit § 26 Abs. 2 BDSG. Ohne Freigabe (Voreinstellung)
            entstehen keine Nachteile. Sie können jede Freigabe jederzeit unter{" "}
            <em>Profil → Datenschutz</em> mit Wirkung für die Zukunft zurücknehmen; die
            Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt
            (Art. 7 Abs. 3 DSGVO)
          </li>
          <li>
            <strong>Sicherheit und Nachvollziehbarkeit (Protokoll):</strong> Art. 6 Abs. 1
            lit. f DSGVO
          </li>
        </Liste>

        <Absatz className="pt-2">
          <strong>Daten, für die der Betreiber verantwortlich ist</strong>
        </Absatz>
        <Liste>
          <li>
            <strong>Kundenkonto und Nachweise der Zustimmung:</strong> Art. 6 Abs. 1 lit. b
            DSGVO (Vertrag mit dem Kunden), Art. 6 Abs. 1 lit. f DSGVO (Nachweis der
            Vertragsannahme)
          </li>
          <li>
            <strong>Zugriffsprotokolle, Ratenbegrenzung, Missbrauchs- und Angriffsabwehr:</strong>{" "}
            Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und
            funktionsfähigen Betrieb)
          </li>
          <li>
            <strong>Aufbewahrungspflichten:</strong> Art. 6 Abs. 1 lit. c DSGVO
          </li>
        </Liste>

        <Absatz className="pt-2 text-[13px] text-ink-muted">
          Die Abfrage beim ersten Anmelden einer neu angelegten Person dient nur dazu, die
          Kenntnisnahme dieser Erklärung festzuhalten (Art. 13 DSGVO). Sie ist{" "}
          <strong>keine Einwilligung</strong> in die Verarbeitung.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="6. Wer welche Daten sehen kann">
        <Absatz>
          Die Trennung der Unternehmen und die Rechte der Rollen werden nicht (nur) in der
          Oberfläche, sondern in der Datenbank durchgesetzt (Row Level Security in
          PostgreSQL): jede Abfrage wird serverseitig auf das Unternehmen der angemeldeten
          Person eingegrenzt. Kein technisches System ist vollkommen unangreifbar; die
          Maßnahmen in Abschnitt 12 verringern das Risiko, ohne es auszuschließen.
        </Absatz>
        <Absatz>Innerhalb eines Unternehmens gilt:</Absatz>
        <Liste>
          <li>
            <strong>Alle Beschäftigten</strong> sehen ihre eigenen Daten sowie im Schichtplan,
            wer in welcher Schicht eingeteilt ist, Feiertage und Schulferien und – bei
            Kolleginnen und Kollegen – dass jemand abwesend ist. Den Grund sehen sie nur, wenn
            die betroffene Person ihn für ihre Schichtgruppe freigegeben hat <em>und</em> das
            Unternehmen diese Anzeige zulässt (Betriebseinstellung; solange sie aus ist, sehen
            Gründe nur Schichtleitung und Administration). Krankheit ist getrennt einstellbar
            und standardmäßig privat
          </li>
          <li>
            <strong>Schichtleitung</strong> sieht unternehmensweit Anträge, Abwesenheiten
            einschließlich Art, Stammdaten (auch Telefon, E-Mail, Geburtsdatum) und Konten
            und kann Anträge bearbeiten sowie Abwesenheiten pflegen
          </li>
          <li>
            <strong>Administration</strong> sieht und verwaltet alle Daten des eigenen
            Unternehmens, einschließlich Fehlzeiten, Änderungsprotokoll und
            Benachrichtigungen im Unternehmen
          </li>
          <li>
            <strong>Der Betreiber</strong> nutzt keinen routinemäßigen Zugriff auf
            Beschäftigtendaten. Technischer Zugriff auf die Datenbank ist möglich und erfolgt
            nur zu Wartung, Support und Fehleranalyse auf Weisung des Kunden. Die
            Betreiber-Übersicht zeigt je Unternehmen Name, Anlagezeitpunkt, Stand der
            Zustimmungen und Zählwerte (z. B. Anzahl Mitarbeiter und Anträge) – keine
            Namen von Beschäftigten und keine Abwesenheitsinhalte
          </li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="7. Kommentare im Schichtplan">
        <Absatz>
          Kommentare zu einem Tag können alle angemeldeten Personen des Unternehmens schreiben
          und lesen; gelöscht werden sie von der Autorin bzw. dem Autor sowie von
          Schichtleitung und Administration. Gespeichert werden Text, Datum, Name und
          Zeitpunkt. Ein Kommentar ist damit für das gesamte Unternehmen sichtbar. Bitte keine
          Gesundheitsangaben oder sonstigen sensiblen Informationen über Dritte eintragen.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="8. Empfänger, Dienstleister und Drittlandbezug">
        <Absatz>
          Für Betrieb und Auslieferung setzt der Betreiber Dienstleister als
          Unterauftragsverarbeiter ein:
        </Absatz>
        <Liste>
          <li>
            <strong>Supabase</strong> (Supabase, Inc.) – Datenbank, Authentifizierung,
            Serverfunktionen für den Mailversand. Die Datenbank dieses Projekts liegt in der
            Region <code className={kode}>eu-west-1</code> (Irland, Europäische Union).
          </li>
          <li>
            <strong>Vercel</strong> (Vercel, Inc.) – Auslieferung der Anwendung. Die
            Serverfunktionen laufen in der Region <code className={kode}>dub1</code> (Dublin,
            Irland). Anfragen werden über das Edge-Netzwerk von Vercel geleitet; dort
            entstehen übliche Zugriffsprotokolle. Vercel speichert keine Stamm-, Planungs-
            oder Abwesenheitsdaten der Anwendung.
          </li>
          <li>
            <strong>Mailversand:</strong>{" "}
            <Platzhalter>SMTP-Anbieter, Sitz, Region – oder streichen, falls kein externer Anbieter</Platzhalter>
          </li>
        </Liste>
        <Absatz>
          <strong>Drittlandbezug:</strong> Supabase, Inc. und Vercel, Inc. haben Sitz in den
          USA. Die Verarbeitung erfolgt in der EU; soweit ein Zugriff aus einem Drittland nicht
          ausgeschlossen werden kann, stützt er sich auf einen Angemessenheitsbeschluss der
          Europäischen Kommission (EU-US Data Privacy Framework) oder auf
          Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO.{" "}
          <Platzhalter>
            Betreiber: Abschluss der Auftragsverarbeitungsverträge mit Supabase, Vercel und
            Mailanbieter sowie aktuellen Zertifizierungs-/Klauselstand prüfen und bestätigen
          </Platzhalter>
        </Absatz>
        <Absatz>
          Eine Weitergabe an sonstige Dritte findet nicht statt, außer aufgrund einer
          gesetzlichen Pflicht.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="9. Speicherdauer und Löschung">
        <Liste>
          <li>
            Stamm-, Planungs- und Abwesenheitsdaten bleiben gespeichert, solange das
            Unternehmen die Anwendung nutzt und die Daten benötigt. Scheidet eine Person aus,
            wird sie üblicherweise auf <em>inaktiv</em> gesetzt, damit vergangene Pläne
            nachvollziehbar bleiben; über das endgültige Löschen entscheidet das Unternehmen.
            Beim Löschen einer Person entfernt die Anwendung Stammdaten, Zugang, Profil,
            Anträge, Abwesenheiten, Konten und Schichtzuordnungen; im Änderungsprotokoll
            bleibt nur vermerkt, dass gelöscht wurde, ohne Namen.
          </li>
          <li>
            Urlaubs- und Stundenkonten werden je Kalenderjahr geführt. Aufbewahrungsfristen
            aus Arbeits-, Steuer- und Handelsrecht legt das Unternehmen fest.
          </li>
          <li>
            Automatische Löschung: Ratenbegrenzungs-Zähler nach 1 Tag, Postausgang nach
            30 Tagen, Benachrichtigungen nach 180 Tagen, Kommentare im Schichtplan 12 Monate
            nach dem Tag, auf den sie sich beziehen, Änderungsprotokoll nach 24 Monaten.
          </li>
          <li>
            Nach Ende des Vertrags mit dem Betreiber werden die Daten des Unternehmens nach
            dessen Wahl herausgegeben und gelöscht (siehe Auftragsverarbeitungsvertrag).
            Sicherungskopien des Datenbankanbieters laufen turnusmäßig aus:{" "}
            <Platzhalter>Aufbewahrungsdauer der Sicherungen laut gebuchtem Tarif eintragen</Platzhalter>.
          </li>
          <li>
            Zugriffsprotokolle der Hosting-Dienstleister werden nach deren Vorgaben nach
            kurzer Zeit automatisch gelöscht.
          </li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="10. Cookies und lokale Speicherung">
        <Absatz>
          Es werden keine Cookies oder Speicher für Werbung, Analyse oder Reichweitenmessung
          verwendet. Gespeichert wird nur, was für den ausdrücklich gewünschten Dienst oder
          eine vom Nutzer gewählte Einstellung nötig ist:
        </Absatz>
        <Liste>
          <li>
            <code className={kode}>sb-…</code> (Cookie) – Sitzung der Anmeldung
            (Authentifizierungsdienst)
          </li>
          <li>
            <code className={kode}>sp_letzte_aktivitaet</code> (Cookie, bis zu 7 Tage) –
            Zeitpunkt der letzten Aktivität; die Sitzung endet nach 10 Minuten ohne Nutzung
            automatisch
          </li>
          <li>
            <code className={kode}>schichtplan.theme</code>,{" "}
            <code className={kode}>schichtplan.install-hint</code>,{" "}
            <code className={kode}>seitenleiste-eingeklappt</code> (lokaler Speicher, bis zum
            Löschen) – Farbdarstellung, ein einmaliger Installationshinweis, Zustand der
            Seitenleiste
          </li>
          <li>
            <code className={kode}>schichtplan:…</code> und{" "}
            <code className={kode}>sp_ansicht</code> (Sitzungsspeicher, endet mit dem
            Browser-Tab) – Scrollposition, gewählte Ansicht
          </li>
        </Liste>
        <Absatz>
          Diese Zugriffe sind nach § 25 Abs. 2 Nr. 2 TDDDG ohne Einwilligung zulässig; ein
          Cookie-Banner ist nicht erforderlich. Die anschließende Verarbeitung stützt sich auf
          Art. 6 Abs. 1 lit. b bzw. f DSGVO.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="11. Rechte der betroffenen Personen">
        <Absatz>Gegenüber der jeweils verantwortlichen Stelle bestehen die Rechte auf</Absatz>
        <Liste>
          <li>Auskunft (Art. 15 DSGVO)</li>
          <li>Berichtigung (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>
            Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen
            (Art. 21 DSGVO)
          </li>
          <li>
            Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3
            DSGVO) – für die Freigaben unter <em>Profil → Datenschutz</em> jederzeit
            selbst möglich
          </li>
        </Liste>
        <Absatz>
          Sie haben außerdem das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde
          (Art. 77 DSGVO), etwa am Wohnort, am Arbeitsplatz oder am Ort des mutmaßlichen
          Verstoßes. Für den Betreiber ist zuständig:{" "}
          <Platzhalter>zuständige Aufsichtsbehörde nach Sitz des Betreibers eintragen</Platzhalter>.
        </Absatz>
        <Absatz>
          Anfragen zu Beschäftigtendaten richten Sie an Ihren Arbeitgeber (Abschnitt 2),
          Anfragen zum Betrieb der Anwendung an <Platzhalter>Kontaktadresse</Platzhalter>.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="12. Schutzmaßnahmen">
        <Absatz>
          Der Betreiber trifft angemessene technische und organisatorische Maßnahmen nach
          Art. 32 DSGVO, unter anderem:
        </Absatz>
        <Liste>
          <li>verschlüsselte Übertragung (HTTPS mit HSTS) und Sicherheits-Header im Browser</li>
          <li>Mandantentrennung und Rollenrechte in der Datenbank (Row Level Security), serverseitige Prüfung aller Aktionen</li>
          <li>Passwörter nur als Hash; Begrenzung von Anmelde-, Zurücksetzen- und Registrierungsversuchen</li>
          <li>automatische Abmeldung nach 10 Minuten Inaktivität</li>
          <li>Datenschutz durch Voreinstellung: Gründe für Kollegen aus, Krankheit privat, keine Gesundheitsfreitexte</li>
          <li>Änderungsprotokoll für sicherheitsrelevante Änderungen ohne Gesundheitsinhalte</li>
          <li>automatisierte Prüfskripte für Zugriffsregeln und Mandantentrennung</li>
        </Liste>
        <Absatz>
          <strong>Sicherheitsvorfälle:</strong> Ein Vorfall, der personenbezogene Daten eines
          Kunden betrifft, wird dem Kunden unverzüglich gemeldet, damit dieser seinen Pflichten
          nach Art. 33 und 34 DSGVO nachkommen kann.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="13. Berechnungen sind Hilfsmittel, keine automatisierte Entscheidung">
        <Absatz>
          Die Anwendung rechnet Kontostände, prüft, ob ein Antrag die Mindestbesetzung
          unterschreiten würde, und zeigt das Ergebnis an. Über Genehmigung oder Ablehnung
          entscheidet immer ein Mensch – Schichtleitung oder Administration. Eine
          ausschließlich automatisierte Entscheidung mit Rechtswirkung im Sinne des Art. 22
          DSGVO und ein Profiling finden nicht statt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="14. Änderungen dieser Erklärung">
        <Absatz>
          Diese Erklärung wird angepasst, wenn sich die Verarbeitung ändert. Maßgeblich ist die
          hier veröffentlichte Fassung. Wird sie inhaltlich geändert, erhöht sich die
          Fassungsnummer, und die Änderung wird hier mit Datum veröffentlicht. Bereits
          angemeldete Personen werden dafür nicht erneut abgefragt; der Arbeitgeber informiert
          seine Beschäftigten selbst (Abschnitt 2). Die Zustimmung des Kunden zu Nutzungsbedingungen und
          Auftragsverarbeitungsvertrag wird dadurch nicht ersetzt.
        </Absatz>
      </Abschnitt>

      <Hinweis titel="Hinweis zur rechtlichen Prüfung">
        <p>
          Dieser Text beschreibt die Verarbeitung, wie sie in der Anwendung umgesetzt ist. Er
          ersetzt keine Rechtsberatung. Kunden mit Besonderheiten – Betriebsrat und
          Mitbestimmung (§ 87 Abs. 1 Nr. 6 BetrVG), Betriebsvereinbarungen, Tarifbindung,
          zusätzliche Datenkategorien oder eine erforderliche
          Datenschutz-Folgenabschätzung – sollten ihn vor dem produktiven Einsatz fachkundig
          prüfen lassen.
        </p>
      </Hinweis>
    </LegalPage>
  );
}
