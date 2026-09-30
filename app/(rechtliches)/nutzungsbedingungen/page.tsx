import {
  Abschnitt,
  Absatz,
  Hinweis,
  LegalPage,
  Liste,
  Platzhalter,
} from "@/components/legal/prose";
import { NUTZUNGSBEDINGUNGEN_VERSION } from "@/lib/legal/version";

export const metadata = {
  title: "Nutzungsbedingungen – Schichtplan",
  description:
    "Bedingungen für die Nutzung von Schichtplan durch Unternehmen: Leistung, Pflichten, Verfügbarkeit, Haftung.",
};

/*
 * Nutzungsbedingungen (AGB) für Firmenkunden. Fassung 1, Stand 30.09.2026.
 *
 * Grundsätze beim Schreiben:
 *  - keine pauschalen Haftungsausschlüsse; Vorsatz, grobe Fahrlässigkeit sowie
 *    Verletzung von Leben, Körper und Gesundheit bleiben immer erfasst
 *  - keine Zusage, dass gesetzliche oder tarifliche Regeln automatisch richtig
 *    abgebildet werden – der Kunde prüft und konfiguriert
 *  - keine Zustimmungsfiktion bei Änderungen
 *
 * Bei inhaltlichen Änderungen LEGAL_VERSIONS.nutzungsbedingungen in
 * src/lib/legal/version.ts erhöhen und legal_versions per Migration nachziehen.
 *
 * Kein Ersatz für eine rechtliche Prüfung.
 * TODO (Betreiber): Platzhalter ausfüllen (Vergütung, Gerichtsstand, Kontakt).
 */
export default function NutzungsbedingungenPage() {
  return (
    <LegalPage
      title="Nutzungsbedingungen"
      intro="Diese Bedingungen gelten für die Nutzung von Schichtplan durch Unternehmen."
      updated="30. September 2026"
      version={NUTZUNGSBEDINGUNGEN_VERSION}
    >
      <Hinweis titel="Entwurf zur rechtlichen Prüfung">
        <p>
          Diese Bedingungen sind sorgfältig formuliert, aber nicht anwaltlich geprüft. Vor dem
          produktiven Einsatz sollten sie fachkundig durchgesehen werden. Gelb markierte
          Stellen sind vom Betreiber auszufüllen.
        </p>
      </Hinweis>

      <Abschnitt titel="1. Geltungsbereich und Vertragspartner">
        <Absatz>
          (1) Vertragspartner ist der Betreiber von Schichtplan (
          <Platzhalter>Name oder Firma</Platzhalter>, Angaben im{" "}
          <a href="/impressum" className="font-medium text-brand-600 hover:underline">
            Impressum
          </a>
          ; nachfolgend „Betreiber“) und das Unternehmen, das sich registriert (nachfolgend
          „Kunde“).
        </Absatz>
        <Absatz>
          (2) Das Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB. Mit
          der Registrierung bestätigt die registrierende Person, dass sie für ein Unternehmen
          bzw. im Rahmen einer gewerblichen oder selbstständigen beruflichen Tätigkeit handelt
          und zur Vertretung des Kunden berechtigt ist. Beschäftigte des Kunden sind keine
          Vertragspartner des Betreibers.
        </Absatz>
        <Absatz>
          (3) Entgegenstehende oder abweichende Bedingungen des Kunden gelten nur, wenn der
          Betreiber ihnen in Textform zugestimmt hat.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="2. Leistung">
        <Absatz>
          (1) Der Betreiber stellt dem Kunden Schichtplan als internetgestützte Anwendung für
          die technische Schicht- und Personalplanung bereit: Schichtpläne, Urlaubs- und
          Abwesenheitsverwaltung, Konten (Urlaub, V-Tage, Altersfreizeit, Stunden),
          Besetzungsprüfung und Benachrichtigungen. Der jeweils verfügbare Funktionsumfang
          ergibt sich aus der Anwendung.
        </Absatz>
        <Absatz>
          (2) Schichtplan ist ein Hilfsmittel für die Planung. Es ist <strong>keine
          Rechtsberatung</strong> und ersetzt weder die arbeits-, tarif- und
          datenschutzrechtliche Prüfung durch den Kunden noch die Entscheidung der dafür
          zuständigen Personen.
        </Absatz>
        <Absatz>
          (3) Der Betreiber darf die Anwendung weiterentwickeln und ändern, soweit die
          vereinbarten Kernfunktionen für den Kunden erhalten bleiben und die Änderung zumutbar
          ist.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="3. Registrierung, Konto und Zugangsdaten">
        <Absatz>
          (1) Die Registrierung erfordert wahrheitsgemäße und vollständige Angaben. Der Vertrag
          kommt zustande, wenn der Kunde die Registrierung abschließt und den Zugang erhält.
          Die registrierende Person wird Administrator des Kunden und kann weitere Personen
          einladen und deren Rollen verwalten.
        </Absatz>
        <Absatz>
          (2) Zugangsdaten sind vertraulich zu behandeln und nicht weiterzugeben. Konten sind
          personengebunden. Der Kunde stellt sicher, dass nur berechtigte Personen Zugang
          haben, vergibt Rollen (Mitarbeiter, Schichtleitung, Administration) zurückhaltend
          und entzieht sie, wenn sie nicht mehr gebraucht werden. Der Kunde meldet dem
          Betreiber unverzüglich, wenn er einen Missbrauch von Zugangsdaten vermutet.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="4. Pflichten des Kunden">
        <Absatz>(1) Der Kunde ist für die von ihm und seinen Beschäftigten eingegebenen Daten verantwortlich. Er stellt insbesondere sicher, dass</Absatz>
        <Liste>
          <li>die Daten richtig und aktuell sind und rechtmäßig verarbeitet werden dürfen,</li>
          <li>
            seine Beschäftigten nach Art. 13 DSGVO informiert sind und – soweit erforderlich –
            Betriebsrat oder Personalvertretung beteiligt wurden,
          </li>
          <li>
            in Freitextfeldern (Kommentare, Begründungen, Notizen) keine Gesundheitsangaben oder
            sonstigen sensiblen Angaben eingetragen werden,
          </li>
          <li>
            die Konfiguration (Schichten, Rotationen, Mindestbesetzung, Ansprüche, Regeln) zu
            den geltenden gesetzlichen, tariflichen und betrieblichen Vorgaben passt.
          </li>
        </Liste>
        <Absatz>
          (2) Der Kunde nutzt die Anwendung nur im Rahmen der Gesetze und dieser Bedingungen. Er
          unterlässt insbesondere Angriffe auf die Anwendung, das Umgehen von Zugriffsregeln,
          automatisiertes Abgreifen von Daten, den Zugriff auf Daten anderer Kunden und das
          Einbringen von Schadcode.
        </Absatz>
        <Absatz>
          (3) Der Kunde stellt den Betreiber von Ansprüchen Dritter frei, die darauf beruhen,
          dass der Kunde Daten rechtswidrig eingibt oder die Anwendung rechtswidrig nutzt,
          soweit der Kunde dies zu vertreten hat.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="5. Berechnungen und Ergebnisse">
        <Absatz>
          (1) Kontostände, Anspruchsberechnungen, Besetzungsprüfungen und sonstige Ergebnisse
          der Anwendung beruhen auf den Daten und Einstellungen des Kunden und auf den
          hinterlegten Rechenregeln. Sie sind Entscheidungshilfen.
        </Absatz>
        <Absatz>
          (2) Der Betreiber gibt <strong>keine Zusicherung</strong>, dass gesetzliche,
          tarifliche oder betriebliche Regelungen im Einzelfall automatisch vollständig und
          richtig abgebildet werden. Der Kunde prüft die Ergebnisse vor Entscheidungen mit
          Auswirkungen auf Beschäftigte (z. B. Genehmigung von Urlaub, Gutschrift oder
          Abzug von Stunden, Lohnabrechnung) und korrigiert sie bei Bedarf. Über
          Genehmigung und Ablehnung entscheidet immer eine Person des Kunden.
        </Absatz>
        <Absatz>
          (3) Meldet der Kunde einen Rechenfehler, bemüht sich der Betreiber, ihn in
          angemessener Zeit zu beheben.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="6. Datenschutz und Auftragsverarbeitung">
        <Absatz>
          (1) Für die Daten der Beschäftigten ist der Kunde Verantwortlicher, der Betreiber
          Auftragsverarbeiter. Es gilt der{" "}
          <a href="/avv" className="font-medium text-brand-600 hover:underline">
            Auftragsverarbeitungsvertrag
          </a>
          , den der Kunde bei der Registrierung gemeinsam mit diesen Bedingungen abschließt.
        </Absatz>
        <Absatz>
          (2) Wie der Betreiber Daten verarbeitet, steht in der{" "}
          <a href="/datenschutz" className="font-medium text-brand-600 hover:underline">
            Datenschutzerklärung
          </a>
          . Bei Widersprüchen zwischen dem AV-Vertrag und diesen Bedingungen gilt für die
          Verarbeitung personenbezogener Daten der AV-Vertrag.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="7. Verfügbarkeit und Wartung">
        <Absatz>
          (1) Der Betreiber bemüht sich um eine hohe Verfügbarkeit der Anwendung. Eine
          bestimmte Verfügbarkeit wird nur zugesagt, soweit sie ausdrücklich in Textform
          vereinbart ist.{" "}
          <Platzhalter>ggf. Verfügbarkeitszusage, Support-Zeiten und Reaktionszeiten ergänzen</Platzhalter>
        </Absatz>
        <Absatz>
          (2) Wartung, Sicherheitsupdates und Weiterentwicklung können zu kurzen
          Unterbrechungen führen; der Betreiber legt sie nach Möglichkeit auf Zeiten geringer
          Nutzung. Störungen bei Drittanbietern (Abschnitt 8), höhere Gewalt und Angriffe
          Dritter können die Verfügbarkeit beeinträchtigen; der Betreiber ergreift in
          diesen Fällen zumutbare Maßnahmen zur Behebung.
        </Absatz>
        <Absatz>
          (3) Der Kunde sollte für den Fall eines Ausfalls einen Ersatzweg für die
          Bekanntgabe der Schichtpläne vorhalten.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="8. Drittanbieter">
        <Absatz>
          Der Betreiber nutzt für Betrieb und Auslieferung Dienstleister, insbesondere für
          Datenbank und Authentifizierung, Hosting und Mailversand (siehe Datenschutzerklärung
          und AV-Vertrag). Deren Leistungen sind Voraussetzung für die Nutzung; für ihre
          Bedingungen und Ausfälle gilt Abschnitt 7 und Abschnitt 12.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="9. Vergütung">
        <Absatz>
          <Platzhalter>
            Vergütung, Abrechnungszeitraum, Zahlungsziel und Preisänderung – oder Hinweis auf
            kostenlose Testphase – vom Betreiber festzulegen
          </Platzhalter>
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="10. Sperrung und Missbrauch">
        <Absatz>
          (1) Der Betreiber darf Konten oder den Zugang des Kunden vorübergehend sperren, wenn
          ein begründeter Verdacht auf Missbrauch, ein Sicherheitsvorfall oder ein Verstoß
          gegen diese Bedingungen vorliegt und die Sperrung zur Abwehr erforderlich und
          verhältnismäßig ist. Der Kunde wird unverzüglich informiert, soweit dadurch der
          Zweck der Sperrung nicht gefährdet wird. Die Sperre wird aufgehoben, sobald der Grund
          entfallen ist.
        </Absatz>
        <Absatz>
          (2) Das Recht zur außerordentlichen Kündigung bleibt unberührt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="11. Laufzeit, Kündigung, Datenrückgabe">
        <Absatz>
          (1) Der Vertrag läuft auf unbestimmte Zeit. Er kann von beiden Seiten mit einer Frist
          von <Platzhalter>Frist, z. B. 1 Monat zum Monatsende</Platzhalter> in Textform
          gekündigt werden. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund
          bleibt unberührt.
        </Absatz>
        <Absatz>
          (2) Nach Vertragsende gibt der Betreiber die Daten des Kunden nach dessen Wahl
          heraus oder löscht sie, wie im AV-Vertrag geregelt. Gesetzliche Aufbewahrungspflichten
          bleiben unberührt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="12. Haftung">
        <Absatz>
          (1) Der Betreiber haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit, für
          Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, für
          arglistig verschwiegene Mängel, nach dem Produkthaftungsgesetz, aus einer
          übernommenen Garantie sowie in allen anderen Fällen, in denen das Gesetz eine
          Haftung zwingend vorschreibt. Ansprüche aus Art. 82 DSGVO bleiben unberührt.
        </Absatz>
        <Absatz>
          (2) Bei einfacher Fahrlässigkeit haftet der Betreiber nur, wenn er eine wesentliche
          Vertragspflicht verletzt, also eine Pflicht, deren Erfüllung die ordnungsgemäße
          Durchführung des Vertrags erst ermöglicht und auf deren Einhaltung der Kunde
          regelmäßig vertrauen darf. Die Haftung ist in diesem Fall auf den vorhersehbaren,
          vertragstypischen Schaden begrenzt.
        </Absatz>
        <Absatz>
          (3) Im Übrigen ist die Haftung bei einfacher Fahrlässigkeit ausgeschlossen. Die
          vorstehenden Regelungen gelten auch für Mitarbeiter und Erfüllungsgehilfen des
          Betreibers.
        </Absatz>
        <Absatz>
          (4) Der Kunde bleibt für die Richtigkeit der von ihm eingegebenen Daten und
          Einstellungen, die Prüfung der Ergebnisse (Abschnitt 5) und die Einhaltung der
          arbeits-, tarif- und datenschutzrechtlichen Pflichten gegenüber seinen Beschäftigten
          selbst verantwortlich. Ein Mitverschulden des Kunden wird nach § 254 BGB
          berücksichtigt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="13. Änderungen dieser Bedingungen">
        <Absatz>
          Der Betreiber kann diese Bedingungen mit Wirkung für die Zukunft ändern, wenn dies
          aus sachlichen Gründen (z. B. Gesetzesänderung, neue Funktionen, Anpassung an
          Rechtsprechung) erforderlich ist. Er teilt Änderungen mindestens vier Wochen vor
          Inkrafttreten in Textform oder in der Anwendung mit. Die geänderte Fassung gilt, wenn
          der Kunde ihr zustimmt (auch durch Bestätigung in der Anwendung). Stimmt er nicht zu,
          gilt die bisherige Fassung bis zum Vertragsende weiter; der Betreiber kann den Vertrag
          in diesem Fall mit angemessener Frist kündigen, wenn ihm die Fortführung zu den
          bisherigen Bedingungen nicht zumutbar ist.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="14. Schlussbestimmungen">
        <Absatz>
          (1) Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Ist der Kunde
          Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches
          Sondervermögen, ist Gerichtsstand{" "}
          <Platzhalter>Sitz des Betreibers</Platzhalter>; gesetzliche ausschließliche
          Gerichtsstände bleiben unberührt.
        </Absatz>
        <Absatz>
          (2) Ist eine Bestimmung unwirksam, bleibt die Wirksamkeit der übrigen unberührt. Für
          die Lücke gilt, was dem wirtschaftlichen Zweck der unwirksamen Bestimmung am
          nächsten kommt und gesetzlich zulässig ist.
        </Absatz>
      </Abschnitt>
    </LegalPage>
  );
}
