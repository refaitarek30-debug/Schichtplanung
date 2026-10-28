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
  title: "Datenschutzerklärung – ShiftNexo",
  description:
    "Welche personenbezogenen Daten ShiftNexo verarbeitet, zu welchem Zweck, auf welcher Rechtsgrundlage und wie lange.",
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
      intro="Diese Erklärung beschreibt, welche personenbezogenen Daten in ShiftNexo verarbeitet werden, wer dafür verantwortlich ist und welche Rechte betroffene Personen haben."
      updated="28. Oktober 2026"
      version={DATENSCHUTZ_VERSION}
    >
      <Hinweis titel="Wer ist wofür verantwortlich?">
        <p>
          ShiftNexo wird Unternehmen (Kunden) als Anwendung zur technischen Schicht- und
          Personalplanung zur Verfügung gestellt. Für die Daten <strong>der Beschäftigten</strong>{" "}
          ist das jeweilige Unternehmen als Arbeitgeber die verantwortliche Stelle. Der
          Betreiber von ShiftNexo verarbeitet diese Daten insoweit als{" "}
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
          Tarek Oussama Refai, Herselerstraße 9, 53332 Bornheim, E-Mail:{" "}
          <a href="mailto:shiftfornexo@gmail.com" className="font-medium text-brand-600 hover:underline">shiftfornexo@gmail.com</a>. Die vollständigen Angaben stehen im{" "}
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
          Ein Datenschutzbeauftragter ist nicht benannt, da keine Pflicht nach Art. 37 DSGVO
          und § 38 BDSG besteht. Fragen zum Datenschutz beantwortet der Betreiber unter der
          oben genannten Adresse.
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
          <li>
            Vor- und Nachname, Personalnummer, Rolle in der Anwendung (Mitarbeiter, Schichtleitung, Administration).
            Personalnummer und Abteilung kann die Person auch selbst eintragen; die Administration sieht und ändert
            sie ebenfalls, jede Änderung wird protokolliert
          </li>
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
            verwendet und ist für Schichtleitung und Administration sichtbar. Die Person kann es jederzeit
            selbst ändern; nach einer eigenen Änderung zählt es erst für den Sonderurlaub, wenn die
            Administration es bestätigt hat (Bestätigung und Änderung werden protokolliert)
          </li>
          <li>Begründung bei einem Urlaubsantrag (Freitext) und Notizen bei Fehlzeiten (höchstens 200 Zeichen)</li>
          <li>Kommentare im Schichtplan (Freitext, siehe Abschnitt 7)</li>
          <li>Freigaben zur Sichtbarkeit von Abwesenheitsgründen (Abschnitt 5)</li>
          <li>
            Darstellungseinstellungen, etwa ausgeblendete Kacheln auf der Startseite, die beim Öffnen gewählte
            Startseite, deren Aufbau (klassisch oder kompakt) und wann die Neuigkeiten (Glühbirne) zuletzt geöffnet
            wurden
          </li>
          <li>
            Persönlicher Kalender: eigene Termine, eigene Farben und eigene Einträge, geteilte Links
            mit eingeladenen Personen, Gruppen und Kalender-Abo (Abschnitt 8)
          </li>
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
          <li>
            Hinweise der Schichtleitung oder Administration an einzelne Personen: Text, Absender,
            Empfänger, gewählter Knopf, ob und ab wann eine Mitteilung aufs Handy geht, Zeitpunkt
            des Sendens und des Lesens („Verstanden“). Absender und Leitung des Betriebs sehen, ob
            ein Hinweis gelesen wurde; eine Antwort gibt es nicht. Zur Wahl „zur nächsten Schicht“
            wird aus dem Schichtplan berechnet, wann die Person das nächste Mal arbeitet (Urlaub und
            Abwesenheiten ausgenommen). Gelöscht nach 90 Tagen
          </li>
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
            Änderungsprotokoll (Audit-Log): Änderungen an Anträgen, Urlaub und Abwesenheiten,
            Schichtwechseln, Konten, Mitteilungen, Urlaubssperren und Stammdaten, Rollen- und
            Aktivstatus-Änderungen, Löschungen, Änderungen der Datenschutz-Einstellungen und
            die Registrierung eines Unternehmens – jeweils mit Zeitpunkt, handelnder und
            betroffener Person. Inhalte von Kommentaren, Abwesenheitsgründen, Notizen oder
            Gesundheitsangaben werden nicht protokolliert; bei Krankmeldungen steht nur
            „Abwesenheit“
          </li>
          <li>
            Anmeldeprotokoll: Anmeldung und Abmeldung mit Zeitpunkt und grobem Gerätetyp (z. B.
            „iPhone · Safari“), automatische Abmeldung wegen Inaktivität, fehlgeschlagene
            Anmeldungen bei einem bestehenden Konto (mit der eingegebenen E-Mail-Adresse) sowie
            Fehlermeldungen, die in der Anwendung angezeigt wurden (Meldungstext und Seite). Es
            wird nicht protokolliert, welche Seiten jemand aufruft oder worauf geklickt wird
          </li>
          <li>
            Einsehen kann das Protokoll nur eine vom Unternehmen ausdrücklich dafür
            freigeschaltete Person der Administration, nicht jede Administration
          </li>
          <li>
            Passwort-Code: Wer sein Passwort vergessen hat, setzt es mit einem Code neu. Im
            Unternehmen erzeugt ihn die Administration oder Schichtleitung für die betroffene
            Person (24 Stunden gültig, einmal verwendbar); bei Privatkonten erzeugt die Person ihn
            selbst, im Ausnahmefall der Betreiber auf ihre Anfrage. Gespeichert werden nur ein
            Prüfwert (SHA-256) des Codes, Art, Zeitpunkt, Gültigkeit, wer ihn erzeugt hat und die
            Zahl falscher Eingaben – nie der Code selbst. Nach fünf falschen Eingaben ist das
            Zurücksetzen 15 Minuten gesperrt. Ein neuer Code ersetzt den alten; mit dem Konto wird
            alles gelöscht
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

        <Absatz className="pt-1">
          <strong>Live-Demo:</strong> Wer die Live-Demo startet, erhält ein befristetes Konto mit
          einer zufälligen Platzhalter-Adresse und einen eigenen Demo-Bereich mit Beispieldaten.
          Verarbeitet werden dabei nur Sitzungscookies (Abschnitt 11) und zur Begrenzung von
          Missbrauch ein gesalzener Hashwert der IP-Adresse (höchstens ein Tag). Konto und
          Demo-Bereich werden nach 24 Stunden automatisch gelöscht. Verantwortlich ist der
          Betreiber; Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. f DSGVO.
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
          Maßnahmen in Abschnitt 13 verringern das Risiko, ohne es auszuschließen.
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

      <Abschnitt titel="8. Persönlicher Kalender, Teilen, Gruppen und Kalender-Abo">
        <Absatz>
          Unter <em>Mein Kalender</em> sieht jede Person ihren eigenen Plan und kann freiwillig
          zusätzliche Angaben machen. Alle diese Funktionen sind freiwillig; wer sie nicht nutzt,
          hat keinen Nachteil, und es werden dafür keine Daten gespeichert.
        </Absatz>
        <Absatz>
          <strong>Eigene Termine:</strong> Titel, Datum (bei ganztägigen Terminen auf Wunsch bis
          zu einem Enddatum), Uhrzeit oder ganztägig, Wiederholung, Ort, Notiz (je mit
          Längenbegrenzung) und auf Wunsch eine Erinnerung. Die Termine sieht nur die Person selbst und –
          wenn sie das beim Teilen für eine eingeladene Person ausdrücklich einschaltet – diese
          Person. Kolleginnen und
          Kollegen, Schichtleitung und Administration des Unternehmens haben keinen Zugriff; die
          Datenbank lässt Abfragen darauf nur für die Person selbst zu.
        </Absatz>
        <Absatz>
          <strong>To-dos:</strong> Eine Person kann sich Aufgaben notieren (Text, auf Wunsch ein
          Tag und eine Uhrzeit für die Erinnerung, erledigt ja/nein). To-dos sieht nur die Person
          selbst; sie erscheinen weder in geteilten Links noch in Gruppen noch im Kalender-Abo.
          Erledigte To-dos werden nach 30 Tagen automatisch gelöscht.
        </Absatz>
        <Absatz>
          <strong>Vorschläge:</strong> Auf Wunsch gibt eine Person an, wofür sie den Kalender
          nutzt (Schule, Studium, angestellt, Schichtarbeit, Eltern, Sonstiges), und kann eigene
          Vorlagen für Termine speichern (Name, Symbol, Dauer). Das dient nur dazu, passende
          Vorschläge anzuzeigen; die Vorschläge stehen fest in der Anwendung, es gibt keine
          Auswertung und keine künstliche Intelligenz. Sieht nur die Person selbst.
        </Absatz>
        <Absatz>
          <strong>Mitteilungen aufs Handy:</strong> Wer auf einem Gerät Mitteilungen erlaubt,
          bekommt als Push-Mitteilung: Erinnerungen an Termine und To-dos, die Benachrichtigungen
          der Glocke (z. B. Urlaub genehmigt oder abgelehnt, neuer Antrag für die Leitung,
          eingetragene Fehlzeit, Frage zum Einspringen), Änderungen des eigenen Plans durch die
          Schichtleitung (Datum und neue Schicht, mehrere Tage zusammengefasst), Hinweise der
          Schichtleitung an die Person (Absender und Text; je nach Wahl der Leitung sofort oder erst
          zu Beginn der nächsten eigenen Schicht) und Hinweise, wenn
          eingeladene oder verbundene Personen etwas eintragen, sich verbinden oder einer Gruppe
          beitreten. Jede Art außer den Hinweisen der Schichtleitung lässt sich einzeln abschalten. Bis zum Versand (meist unter einer
          Minute) liegen Mitteilungen in einer Warteschlange, die nach 7 Tagen gelöscht wird. Dafür speichert die
          Anwendung je Gerät die vom Browser vergebene Zustelladresse mit den zugehörigen
          Schlüsseln und die Gerätart (z. B. „iPhone“), höchstens 10 Geräte je Person, sowie
          welche Erinnerung wann verschickt wurde (nach 3 Tagen gelöscht). Zugestellt wird über
          den Push-Dienst des Browser- bzw. Geräteherstellers (z. B. Apple, Google, Mozilla); an
          diesen geht der Inhalt der Mitteilung – Titel des Termins bzw. To-dos und der Zeitpunkt –
          verschlüsselt (Web-Push-Verschlüsselung nach RFC 8291), sodass der Dienst ihn nicht
          lesen kann. Mitteilungen lassen sich jederzeit unter den Einstellungen des Kalenders
          oder in den Einstellungen des Geräts abschalten; dann wird die Adresse gelöscht.
        </Absatz>
        <Absatz>
          <strong>Anzeige-Einstellungen:</strong> Jede Person kann für sich festlegen, ob Samstag
          und Sonntag in Kalender und Schichtplan hervorgehoben werden, ob der Schichtplan kompakt
          oder groß erscheint und ob er ihre eigenen Kalenderfarben zeigt. Diese drei Werte werden
          mit dem Konto gespeichert, damit sie auf allen Geräten gleich sind, und zusätzlich auf
          dem Gerät (<code className={kode}>schichtplan.anzeige</code>). Sie sieht nur die Person
          selbst; sie ändern nichts am Schichtplan der anderen und werden mit dem Konto gelöscht.
        </Absatz>
        <Absatz>
          <strong>Eigene Farben und eigene Einträge:</strong> In der neueren Ansicht von{" "}
          <em>Mein Kalender</em> kann eine Person die Farben ihrer Schichten und Abwesenheiten für
          sich ändern und eigene Einträge anlegen, zum Beispiel „Nebenjob“ oder „Schicht getauscht“
          (Name, Kürzel, Farbe, auf Wunsch eine Uhrzeit), und einzelnen Tagen zuordnen. Das ist
          eine rein persönliche Ergänzung: Der Schichtplan, die Besetzung, die Urlaubs- und
          Stundenkonten und die Auswertungen des Unternehmens werden davon nicht verändert. Die
          Farben und Einträge sieht nur die Person selbst – keine Kolleginnen und Kollegen, keine
          Schichtleitung und keine Administration des Unternehmens; die Datenbank lässt Abfragen
          und Änderungen darauf nur für die Person selbst zu. Sie erscheinen weder in geteilten
          Links noch in Gruppen. Nur im eigenen Kalender-Abo der Person erscheinen sie
          (siehe unten). Eigene Einträge sollten keine Gesundheitsangaben und keine Namen
          oder Angaben zu anderen Personen enthalten.
        </Absatz>
        <Absatz>
          <strong>Teilen mit Personen (Partner, Familie, Freunde, Kollegen):</strong> Eine Person
          kann bis zu 20 Personen ihres Vertrauens einladen. Dafür speichert sie einen frei
          gewählten Namen (z. B. „Mama“), die Art der Beziehung und für jede Person, ob sie{" "}
          <em>nur ansehen</em> oder <em>ansehen und eintragen</em> darf und ob sie die eigenen
          Termine sieht. Die eingeladene Person öffnet einen Einladungslink, legt damit ein eigenes
          Konto an (Spitzname und Passwort) oder meldet sich an und ist danach mit der einladenden
          Person verbunden (siehe „Verbundene Konten“); die gewählten Rechte werden übernommen. Bis
          dahin ist sie als „eingeladen“ vermerkt. Früher verschickte Links ohne Konto gelten
          weiter, bis sie beendet werden; neue werden nicht mehr erstellt. Wer einen solchen
          früheren Link öffnet, braucht kein Konto und sieht ohne Anmeldung:
        </Absatz>
        <Liste>
          <li>den Vornamen der einladenden Person und deren Schichten (Früh, Spät, Nacht, frei)</li>
          <li>
            Abwesenheiten nur als „Urlaub“ bzw. frei – <strong>ohne Grund</strong>; eine
            Krankheit ist nicht erkennbar
          </li>
          <li>die eigenen Termine der einladenden Person nur, wenn diese es für diese Person erlaubt hat</li>
        </Liste>
        <Absatz>
          Darf die eingeladene Person eintragen, kann sie über ihren Link eigene Arbeitstage
          (Kürzel wie Früh, Spät, Nacht, Urlaub) und eigene Termine eintragen. Diese Angaben sind
          nur für sie und die einladende Person sichtbar – nicht für andere eingeladene Personen.
          Gespeichert werden außerdem Zeitpunkt der Erstellung und der letzten Nutzung des Links
          (höchstens alle 5 Minuten aktualisiert). Keine IP-Adresse. Wird eine Person entfernt,
          werden auch die Tage und Termine gelöscht, die sie eingetragen hat. In der eigenen
          Ansicht lässt sich auswählen, wessen Schichten und Termine eingeblendet werden; diese
          Auswahl wird nur im Browser des Geräts gespeichert.
        </Absatz>
        <Absatz>
          <strong>Gruppen:</strong> Personen, die selbst einen Schichtkalender nutzen (mit Konto
          eines Unternehmens oder als Privatperson), können eine Gruppe bilden (z. B. Familie,
          Freunde; bis zu 20 Personen) und per Einladungslink beitreten. In der Gruppe sehen die
          Mitglieder gegenseitig den Vornamen und für jeden Tag nur, ob gearbeitet wird (Früh,
          Spät, Nacht oder Arbeit) oder frei ist – Abwesenheiten <strong>ohne Grund</strong>,
          keine Termine, keine Kolleginnen und Kollegen. Gespeichert werden Name der Gruppe,
          Mitglieder und Beitrittszeitpunkt. Jede Person kann jederzeit austreten; tritt die
          letzte Person aus, wird die Gruppe gelöscht. Das Unternehmen hat keinen Zugriff auf
          Gruppen.
        </Absatz>
        <Absatz>
          <strong>Verbundene Konten:</strong> Zwei Personen, die beide einen eigenen Kalender nutzen
          (mit Konto eines Unternehmens oder als Privatperson), können ihre Konten per Code, QR-Code
          oder Link verbinden. Der Code hat 6 Zeichen, gilt 24 Stunden – als Einladungslink an eine
          eingeladene Person 7 Tage – und nur einmal und wird nur als Hashwert gespeichert;
          Fehleingaben werden je Konto gezählt (gegen Durchprobieren) und nach einem Tag gelöscht.
          Die Einladungsseite zeigt ohne Anmeldung nur, ob der Link gilt, und den Vornamen der
          einladenden Person; die Aufrufe werden dafür je Netzwerkadresse als Hashwert gezählt
          (gegen Durchprobieren). Schichten erscheinen bei Verbundenen, in Gruppen und über
          frühere Links in den Farben, die die jeweilige Person dafür gewählt hat. Verbundene sehen gegenseitig den Vornamen und für jeden Tag, ob
          gearbeitet wird (Früh, Spät, Nacht oder Arbeit), frei ist oder Urlaub –{" "}
          <strong>ohne Grund</strong>. Jede Seite stellt selbst ein, ob die andere ihre Termine sieht
          und ob sie Termine bei ihr eintragen darf; solche Termine stehen im Kalender der Person, bei
          der eingetragen wurde, mit dem Vermerk, wer eingetragen hat. War die Person vorher über
          einen Link eingeladen, werden die über den Link eingetragenen Termine übernommen und die
          dort eingetragenen Schichten in ihr eigenes Privatkonto kopiert, wo dort noch nichts
          steht; der Link endet. Jede Seite kann die Verbindung jederzeit beenden. Das Unternehmen
          hat keinen Zugriff auf Verbindungen.
        </Absatz>
        <Absatz>
          <strong>Kalender-Abo:</strong> Eine Person kann ihren Plan als Kalender-Link
          (iCalendar) in die Kalender-App ihres Handys übernehmen. Der Link enthält Schichten
          mit Uhrzeit sowie Urlaub, Schulung und sonstige Abwesenheit – letztere nur als
          „Abwesend“, <strong>ohne Grund</strong>, sowie die eigenen Termine aus{" "}
          <em>Mein Kalender</em> (nicht die eingeladener Personen) und die eigenen Einträge
          aus <em>Mein Kalender</em> (Name und Uhrzeit, z. B. „Nebenjob“). Keine Kolleginnen
          und Kollegen. Die Kalender-App ruft den Link regelmäßig ab; gespeichert wird nur, wann
          der Link erstellt, zuletzt abgerufen und beendet wurde. Was die Kalender-App des
          Handys bzw. deren Anbieter (z. B. Apple, Google) mit den abgerufenen Daten macht,
          richtet sich nach deren Bedingungen; die Daten verlassen dabei die Anwendung.
        </Absatz>
        <Absatz>
          <strong>Schutz der Links:</strong> Geteilte Links und Kalender-Abo funktionieren ohne
          Anmeldung, der Link selbst ist der Schlüssel (Gruppen-Einladungen setzen zusätzlich ein
          eigenes Konto voraus). Er ist zufällig (192 Bit) und wird in der Datenbank nur als
          Hashwert gespeichert. Jeder Link lässt sich jederzeit erneuern (der alte wird sofort
          ungültig) oder beenden. Wer den Link kennt,
          sieht die genannten Daten – er sollte deshalb nicht weitergegeben werden.
        </Absatz>
        <Absatz>
          <strong>Rechtsgrundlage:</strong> Einwilligung bzw. Wunsch der Person, Art. 6 Abs. 1
          lit. a DSGVO; die Nutzung lässt sich jederzeit durch Beenden des Links und Löschen der
          Einträge zurücknehmen.{" "}
          <Platzhalter>
            Verantwortlichkeit für diese freiwilligen Kalenderdaten (Arbeitgeber oder Betreiber)
            festlegen und mit Betriebsrat abstimmen
          </Platzhalter>
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="8a. Persönlicher Schichtkalender ohne Unternehmen">
        <Absatz>
          Wer sich ohne Unternehmen für den persönlichen Schichtkalender registriert, nutzt
          ShiftNexo als Privatperson. <strong>Verantwortlich ist dann der Betreiber</strong>{" "}
          (Abschnitt 1), nicht ein Arbeitgeber; ein Arbeitgeber hat keinen Zugriff auf diese
          Daten.
        </Absatz>
        <Liste>
          <li>
            frei gewählter Spitzname (ein Klarname ist nicht nötig), Passwort (nur als Hash) und
            Zeitpunkt der Registrierung. Eine E-Mail-Adresse ist <strong>nicht erforderlich</strong>;
            wer möchte, hinterlegt sie freiwillig, damit der Support das Konto leichter erkennt. Ein
            vergessenes Passwort wird mit dem eigenen Wiederherstellungs-Code zurückgesetzt (siehe
            „Passwort-Code“ in Abschnitt 3)
          </li>
          <li>
            die eigenen Schichtarten (Name, Kürzel, Farbe, Uhrzeit, Stunden) und die eingetragenen
            Tage, Bundesland für die Feiertage, optional die Wochenstunden für die Auswertung
          </li>
          <li>
            optional Termine, geteilte Links, Gruppen und Kalender-Abo wie in Abschnitt 8
            beschrieben. Ein Eintrag „Krank“ ist eine freiwillige eigene Angabe; eingeladene
            Personen und Gruppen sehen ihn nur als „Urlaub“ bzw. frei, das Kalender-Abo als
            „Abwesend“
          </li>
        </Liste>
        <Absatz>
          Rechtsgrundlage ist die Bereitstellung des gewünschten Dienstes (Art. 6 Abs. 1 lit. b
          DSGVO), für eigene Angaben zu Krankheit die ausdrückliche Einwilligung durch das
          Eintragen selbst (Art. 9 Abs. 2 lit. a DSGVO), jederzeit widerrufbar durch Löschen des
          Eintrags. Die Daten bleiben gespeichert, bis die Person sie oder ihr Konto löscht;
          das Konto lässt sich unter <em>Mehr → Konto löschen</em> jederzeit selbst endgültig
          löschen. Es gibt keine Werbung, kein Tracking und keine Weitergabe.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="8b. Ein Konto für Betrieb und Privatbereich">
        <Absatz>
          Mitarbeiter können sich mit demselben Login zusätzlich einen persönlichen
          Privatbereich (Abschnitt 8a) einrichten – freiwillig, mit einem Tipp. Für den
          Privatbereich ist der Betreiber verantwortlich, nicht der Arbeitgeber.{" "}
          <strong>Der Arbeitgeber erfährt nicht, ob und wie jemand den Privatbereich nutzt</strong>;
          es entsteht dafür kein Eintrag im Protokoll des Unternehmens.
        </Absatz>
        <Liste>
          <li>
            Im Privatbereich erscheinen, solange der Zugang zum Betrieb besteht, die eigenen
            Schichten aus dem Schichtplan – nur für die Person selbst und nur zum Ansehen.
            Urlaub, Krankheit und andere Abwesenheiten aus dem Betrieb erscheinen dort nicht.
            Eingeladene Personen, Gruppen und das Kalender-Abo sehen wie bisher die Schichten aus
            dem Betrieb, nicht die privaten Einträge
          </li>
          <li>
            Termine und To-dos gehören zum Login und sind in beiden Bereichen dieselben; der
            Arbeitgeber sieht sie in keinem der beiden Bereiche
          </li>
          <li>
            <strong>Austritt:</strong> Deaktiviert das Unternehmen den Zugang, ist der Betrieb
            gesperrt. Beim nächsten Anmelden fragt ShiftNexo, ob die Person privat weitermachen
            möchte. Nur mit „Ja“ werden Termine, To-dos, eigene Einträge und die eigenen Farben in
            den Privatbereich übernommen; Schichten aus dem Betrieb sowie Krank- und
            Urlaubsanträge bleiben beim Unternehmen. Löscht das Unternehmen die Person danach
            endgültig, bleiben Login und Privatbereich bestehen, wenn es einen Privatbereich gibt;
            die Daten im Unternehmen (Personalstamm, Profil, Geburtsdatum, Einstellungen) werden
            gelöscht
          </li>
          <li>
            <strong>Beitritt mit bestehendem Konto:</strong> Hat eine Person schon einen
            ShiftNexo-Kalender, erzeugt das Unternehmen beim Einrichten des Zugangs einen Link bzw.
            einen Code (7 Tage gültig). Erst nach Anmeldung mit dem eigenen Konto und einer
            ausdrücklichen Bestätigung wird das Konto dem Unternehmen zugeordnet. Die Person wählt
            vorher, ob bisherige Termine, To-dos und eigene Schichten im Betriebskalender erscheinen
            sollen; das Unternehmen sieht diese Inhalte nicht. Im Protokoll des Unternehmens steht
            nur, dass die Person beigetreten ist
          </li>
          <li>
            Mit Zugang zum Betrieb gilt auch im Privatbereich die kürzere Abmeldefrist der Rolle im
            Betrieb. Unter <em>Mehr → Privatbereich löschen</em> lässt sich der Privatbereich
            jederzeit löschen, ohne dass der Zugang zum Betrieb berührt wird
          </li>
        </Liste>
        <Absatz>
          Rechtsgrundlage ist die Bereitstellung des gewünschten Dienstes (Art. 6 Abs. 1 lit. b
          DSGVO); die Übernahme beim Austritt und beim Beitritt geschieht nur auf ausdrücklichen
          Wunsch der Person.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="9. Empfänger, Dienstleister und Drittlandbezug">
        <Absatz>
          Für Betrieb und Auslieferung setzt der Betreiber Dienstleister als
          Unterauftragsverarbeiter ein:
        </Absatz>
        <Liste>
          <li>
            <strong>Supabase</strong> (Supabase, Inc.) – Datenbank, Authentifizierung,
            Serverfunktionen für den Mailversand. Die Datenbank dieses Projekts liegt in der
            Region <code className={kode}>eu-west-1</code> (Irland, Europäische Union).
            Supabase setzt seinerseits Unterauftragnehmer ein, nach eigener Auskunft u. a. Amazon Web
            Services (Datenbank), Google Cloud (Protokolle), Fly.io, Cloudflare und Upstash; die
            aktuelle Liste führt Supabase unter supabase.com/legal/customer-resources/subprocessor-list.
          </li>
          <li>
            <strong>Vercel</strong> (Vercel, Inc.) – Auslieferung der Anwendung. Die
            Serverfunktionen laufen in der Region <code className={kode}>dub1</code> (Dublin,
            Irland). Anfragen werden über das Edge-Netzwerk von Vercel geleitet; dort
            entstehen übliche Zugriffsprotokolle. Vercel speichert keine Stamm-, Planungs-
            oder Abwesenheitsdaten der Anwendung.
          </li>
          <li>
            <strong>Push-Dienste</strong> der Geräte- bzw. Browserhersteller (z. B. Apple, Google,
            Mozilla) – nur, wenn eine Person auf ihrem Gerät Mitteilungen erlaubt; der Inhalt geht
            verschlüsselt durch (Abschnitt 8). Diese Dienste können ihren Sitz auch außerhalb der
            EU haben.
          </li>
          <li>
            <strong>GitHub</strong> (GitHub, Inc.) – Aufbewahrung der nächtlichen
            Datensicherung. Die Sicherung wird vorher mit einem Schlüssel verschlüsselt, den nur
            der Betreiber kennt; GitHub kann den Inhalt nicht lesen. Jede Sicherung wird nach
            14 Tagen automatisch gelöscht.
          </li>
          <li>
            <strong>Mailversand:</strong>{" "}
            <Platzhalter>SMTP-Anbieter, Sitz, Region – oder streichen, falls kein externer Anbieter</Platzhalter>
          </li>
        </Liste>
        <Absatz>
          <strong>Drittlandbezug:</strong> Supabase, Inc., Vercel, Inc. und GitHub, Inc. haben
          Sitz in den USA. Die Verarbeitung erfolgt in der EU; soweit ein Zugriff aus einem Drittland nicht
          ausgeschlossen werden kann, stützt er sich auf einen Angemessenheitsbeschluss der
          Europäischen Kommission (EU-US Data Privacy Framework) oder auf
          Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO. Mit Supabase besteht eine
          Vereinbarung zur Auftragsverarbeitung einschließlich Standardvertragsklauseln; für den
          Datentransfer liegt eine Transfer-Folgenabschätzung vor. Mit Vercel und GitHub gelten
          die in deren Bedingungen enthaltenen Auftragsverarbeitungsvereinbarungen.
        </Absatz>
        <Absatz>
          Eine Weitergabe an sonstige Dritte findet nicht statt, außer aufgrund einer
          gesetzlichen Pflicht.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="10. Speicherdauer und Löschung">
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
            Automatische Löschung: Demo-Bereiche der Live-Demo nach 24 Stunden,
            Ratenbegrenzungs-Zähler nach 1 Tag, Postausgang nach
            30 Tagen, Benachrichtigungen nach 180 Tagen, Kommentare im Schichtplan 12 Monate
            nach dem Tag, auf den sie sich beziehen, Anmeldeprotokoll und angezeigte
            Fehlermeldungen nach 90 Tagen, Hinweise an einzelne Personen nach 90 Tagen,
            Änderungsprotokoll nach 24 Monaten.
          </li>
          <li>
            Persönlicher Kalender (Abschnitt 8): eigene Termine, To-dos, Vorlieben für Vorschläge,
            eigene Farben und eigene Einträge sowie die Einträge eingeladener Personen bleiben, bis die Person sie löscht,
            die eingeladene Person entfernt oder ihr Zugang gelöscht wird. Die Mitgliedschaft in
            einer Gruppe endet mit dem Austreten.
            Ein beendeter Link oder ein beendetes Kalender-Abo funktioniert sofort nicht mehr.
          </li>
          <li>
            Nach Ende des Vertrags mit dem Betreiber werden die Daten des Unternehmens nach
            dessen Wahl herausgegeben und gelöscht (siehe Auftragsverarbeitungsvertrag).
            Wird ein Unternehmen gelöscht, liegen seine Daten zunächst bis zu 14 Tage in einem
            Papierkorb: Die Zugänge sind gesperrt und die Daten nicht mehr nutzbar, bei einem
            Versehen lässt sich alles zurückholen. Danach werden Unternehmen und alle zugehörigen
            Zugänge endgültig gelöscht. Die verschlüsselten nächtlichen Sicherungen (Abschnitt 9)
            werden nach 14 Tagen automatisch gelöscht; spätestens 28 Tage nach dem Löschauftrag
            sind die Daten deshalb auch aus allen Sicherungen entfernt. Privatkonten werden auf
            Wunsch der Person sofort gelöscht, ebenfalls ohne Papierkorb.
          </li>
          <li>
            Zugriffsprotokolle der Hosting-Dienstleister werden nach deren Vorgaben nach
            kurzer Zeit automatisch gelöscht.
          </li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="11. Cookies und lokale Speicherung">
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
            <code className={kode}>sp_letzte_aktivitaet</code> (Cookie, bis zu 31 Tage) –
            Zeitpunkt der letzten Aktivität; die Sitzung endet je nach Rolle automatisch nach
            Inaktivität (Administration 15 Minuten, Schichtleitung 8 Stunden, Mitarbeiter 12 Stunden,
            Privatkonten ohne Firma 30 Tage)
          </li>
          <li>
            <code className={kode}>sp_frist</code> (Cookie, bis zu 31 Tage) – die für die eigene
            Rolle geltende Zeit bis zur automatischen Abmeldung
          </li>
          <li>
            <code className={kode}>sp_start</code> (Cookie, bis zu 1 Jahr) – die gewählte
            Startseite (mit der Benutzer-Kennung, nur für diese Person gültig), damit die App
            beim Öffnen gleich dorthin führt
          </li>
          <li>
            <code className={kode}>sp_geraet:…</code> (lokaler Speicher, bis zu 14 Tage; wird beim
            Abmelden und auf der Anmeldeseite gelöscht) – der zuletzt geladene Stand der{" "}
            <em>eigenen</em> Schichten und Einträge im Kalender, bei Privatkonten außerdem die
            eigenen Schichtarten, die Feiertage und die eigenen To-dos; dazu die eigenen Termine (ohne
            Termine anderer), damit der Kalender beim Öffnen sofort erscheint und danach aufgefrischt
            wird – und damit er ohne Netz den zuletzt geladenen Stand zeigen kann. Ohne Netz neu
            angelegte eigene Termine liegen bis zum Hochladen unter{" "}
            <code className={kode}>sp_offline_termine:…</code>; sie gehen hoch, sobald wieder Netz
            da ist, und werden beim Abmelden gelöscht. Es werden weder Daten anderer Personen noch
            Anträge oder Krankheitsgründe so gespeichert, und nichts davon wird an einen Server
            gesendet. Wer ein Gerät mit anderen teilt, sollte sich nach der Nutzung abmelden.
          </li>
          <li>
            <code className={kode}>schichtplan-kalender-v1</code> (Zwischenspeicher des Browsers, bis
            zu 14 Tage; wird beim Abmelden und auf der Anmeldeseite gelöscht) – nur die zuletzt
            geöffnete Seite des eigenen Kalenders (Privatkalender bzw. „Mein Kalender“), damit er
            auch ohne Netz startet. Andere Seiten, Schichtpläne anderer Personen, Anträge oder
            Krankheitsgründe werden nicht so gespeichert.
            Sie enthält denselben Stand wie <code className={kode}>sp_geraet:…</code>; sie wird
            nicht an einen Server gesendet. Wer ein Gerät mit anderen teilt, sollte sich nach der
            Nutzung abmelden.
          </li>
          <li>
            <code className={kode}>sp_gehalt:…</code> und <code className={kode}>sp_urlaub:…</code>{" "}
            (lokaler Speicher, bis zum Löschen der Browserdaten; mit der Benutzer-Kennung, nur für
            diese Person gültig) – bei Privatkonten die freiwillig eingetragenen Angaben für die
            Gehalts-Schätzung (Stundenlohn, Zuschläge in Prozent, ob in Schicht gearbeitet wird)
            und für den Urlaubs-Planer (übrige Urlaubstage, gewählte Arbeitsweise). Die Berechnung
            läuft nur im Browser; diese Angaben werden weder an einen Server gesendet noch im Konto
            gespeichert. Wer ein Gerät mit anderen teilt, kann sie in den Browserdaten löschen.
          </li>
          <li>
            <code className={kode}>schichtplan.theme</code>,{" "}
            <code className={kode}>schichtplan.anzeige</code>,{" "}
            <code className={kode}>schichtplan.install-hint</code>,{" "}
            <code className={kode}>seitenleiste-eingeklappt</code> (lokaler Speicher, bis zum
            Löschen) – Farbdarstellung (Hell, Dunkel, Graphit, Sand), Anzeige-Einstellungen
            (Wochenende, Schichtplan), ein einmaliger Installationshinweis, Zustand der
            Seitenleiste
          </li>
          <li>
            <code className={kode}>schichtplan.kalender-…</code>,{" "}
            <code className={kode}>schichtplan.partner-zeigen.…</code>,{" "}
            <code className={kode}>schichtplan.neu-gesehen.…</code> (lokaler Speicher, bis zum
            Löschen) – ob die Einführung zum Kalender gesehen wurde, ob Partnereinträge
            angezeigt werden, Hinweis „Neu“ gesehen
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

      <Abschnitt titel="12. Rechte der betroffenen Personen">
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
          die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen
          (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf.
        </Absatz>
        <Absatz>
          Anfragen zu Beschäftigtendaten richten Sie an Ihren Arbeitgeber (Abschnitt 2),
          Anfragen zum Betrieb der Anwendung an <a href="mailto:shiftfornexo@gmail.com" className="font-medium text-brand-600 hover:underline">shiftfornexo@gmail.com</a>.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="13. Schutzmaßnahmen">
        <Absatz>
          Der Betreiber trifft angemessene technische und organisatorische Maßnahmen nach
          Art. 32 DSGVO, unter anderem:
        </Absatz>
        <Liste>
          <li>verschlüsselte Übertragung (HTTPS mit HSTS) und Sicherheits-Header im Browser</li>
          <li>Mandantentrennung und Rollenrechte in der Datenbank (Row Level Security), serverseitige Prüfung aller Aktionen</li>
          <li>Partner- und Kalender-Links nur als Hashwert gespeichert, jederzeit erneuer- und beendbar</li>
          <li>Passwörter nur als Hash; Begrenzung von Anmelde-, Zurücksetzen- und Registrierungsversuchen</li>
          <li>automatische Abmeldung nach Inaktivität, je nach Rolle (Administration 15 Minuten, Schichtleitung 8 Stunden, Mitarbeiter 12 Stunden, Privatkonten ohne Firma 30 Tage)</li>
          <li>Datenschutz durch Voreinstellung: Gründe für Kollegen aus, Krankheit privat, keine Gesundheitsfreitexte</li>
          <li>Änderungs- und Anmeldeprotokoll ohne Gesundheitsinhalte, einsehbar nur für ausdrücklich freigeschaltete Personen</li>
          <li>automatisierte Prüfskripte für Zugriffsregeln und Mandantentrennung</li>
        </Liste>
        <Absatz>
          <strong>Sicherheitsvorfälle:</strong> Ein Vorfall, der personenbezogene Daten eines
          Kunden betrifft, wird dem Kunden unverzüglich gemeldet, damit dieser seinen Pflichten
          nach Art. 33 und 34 DSGVO nachkommen kann.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="14. Berechnungen sind Hilfsmittel, keine automatisierte Entscheidung">
        <Absatz>
          Die Anwendung rechnet Kontostände, prüft, ob ein Antrag die Mindestbesetzung
          unterschreiten würde, und zeigt das Ergebnis an. Über Genehmigung oder Ablehnung
          entscheidet immer ein Mensch – Schichtleitung oder Administration. Eine
          ausschließlich automatisierte Entscheidung mit Rechtswirkung im Sinne des Art. 22
          DSGVO und ein Profiling finden nicht statt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="15. Änderungen dieser Erklärung">
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
