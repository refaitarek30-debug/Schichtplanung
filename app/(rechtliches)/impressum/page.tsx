import {
  Abschnitt,
  Absatz,
  Hinweis,
  LegalPage,
  Liste,
  Platzhalter,
} from "@/components/legal/prose";

export const metadata = {
  title: "Impressum – Schichtplan",
  description: "Anbieterkennzeichnung nach § 5 DDG.",
};

/*
 * ACHTUNG – diese Seite ist noch nicht vollständig.
 *
 * Die mit <Platzhalter> markierten Stellen sind Pflichtangaben nach § 5 DDG
 * (Digitale-Dienste-Gesetz, vormals § 5 TMG). Sie dürfen nicht erfunden
 * werden: eine erfundene Anschrift ist schlimmer als eine fehlende, weil sie
 * wie eine echte aussieht. Eine unvollständige Anbieterkennzeichnung ist
 * abmahnfähig – bitte vor dem ersten echten Kunden ausfüllen.
 *
 * Wer die Anwendung betreibt und anbietet, ist Anbieter im Sinne von § 5 DDG –
 * auch als Einzelperson, sobald das Angebot geschäftsmäßig (nachhaltig, in der
 * Regel gegen Entgelt oder mit Gewinnerzielungsabsicht) erfolgt. Eine Aussage
 * wie „kein Unternehmen“ steht hier bewusst nicht.
 *
 * TODO (Betreiber): alle gelb markierten Stellen ausfüllen; nicht Zutreffendes
 * ersatzlos streichen (nicht leer stehen lassen).
 */
export default function ImpressumPage() {
  return (
    <LegalPage
      title="Impressum"
      intro="Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)."
      updated="30. September 2026"
    >
      <Hinweis titel="Diese Seite ist noch nicht vollständig">
        <p>
          Die gelb markierten Stellen sind gesetzliche Pflichtangaben und müssen vom
          Betreiber selbst eingetragen werden. Sie wurden bewusst offengelassen statt
          mit Beispielwerten gefüllt.
        </p>
      </Hinweis>

      <Abschnitt titel="Anbieter">
        <Liste>
          <li>
            Name bzw. Firma: <Platzhalter>vollständiger Name oder Firmenname</Platzhalter>
          </li>
          <li>
            Rechtsform: <Platzhalter>z. B. Einzelunternehmen, GmbH, UG (haftungsbeschränkt)</Platzhalter>
          </li>
          <li>
            Vertretungsberechtigte Person(en):{" "}
            <Platzhalter>nur bei juristischen Personen und Gesellschaften</Platzhalter>
          </li>
          <li>
            Ladungsfähige Anschrift: <Platzhalter>Straße, Hausnummer</Platzhalter>,{" "}
            <Platzhalter>Postleitzahl, Ort</Platzhalter>, Deutschland
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Ein Postfach genügt nicht – verlangt wird eine Anschrift, unter der Post
          zugestellt werden kann.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <Liste>
          <li>
            E-Mail: <Platzhalter>Kontaktadresse</Platzhalter>
          </li>
          <li>
            Zweiter Kommunikationsweg für eine schnelle Kontaktaufnahme:{" "}
            <Platzhalter>Telefonnummer oder Kontaktformular</Platzhalter>
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Anfragen per E-Mail werden in der Regel innerhalb weniger Werktage beantwortet.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Register und Umsatzsteuer">
        <Liste>
          <li>
            Registergericht und Registernummer:{" "}
            <Platzhalter>nur bei eingetragenen Unternehmen, sonst streichen</Platzhalter>
          </li>
          <li>
            Umsatzsteuer-Identifikationsnummer nach § 27a UStG:{" "}
            <Platzhalter>nur falls vorhanden, sonst streichen</Platzhalter>
          </li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="Aufsichtsbehörde und Berufsrecht">
        <Absatz>
          <Platzhalter>
            nur falls die Tätigkeit einer behördlichen Zulassung bedarf oder ein
            reglementierter Beruf ausgeübt wird – sonst diesen Abschnitt streichen
          </Platzhalter>
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Redaktionell verantwortlich">
        <Absatz>
          Die Anwendung enthält keine journalistisch-redaktionell gestalteten Inhalte. Eine
          Angabe nach § 18 Abs. 2 MStV ist daher nur nötig, falls der Betreiber solche
          Inhalte ergänzt:{" "}
          <Platzhalter>Name und Anschrift, falls zutreffend – sonst streichen</Platzhalter>
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Zielgruppe und Streitbeilegung">
        <Absatz>
          Das Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB,
          also an natürliche und juristische Personen, die in Ausübung ihrer gewerblichen
          oder selbstständigen beruflichen Tätigkeit handeln. Verträge mit Verbrauchern
          werden nicht geschlossen. Die Beschäftigten eines Kunden sind keine
          Vertragspartner des Betreibers.
        </Absatz>
        <Absatz>
          Ein Verfahren vor einer Verbraucherschlichtungsstelle ist deshalb nicht
          vorgesehen. Die frühere Online-Streitbeilegungsplattform der Europäischen
          Kommission wird nicht mehr betrieben, ein Verweis darauf entfällt.
        </Absatz>
        <Absatz className="text-[13px] text-ink-muted">
          <Platzhalter>
            Werden künftig auch Verträge mit Verbrauchern geschlossen: Angaben zur
            Bereitschaft zur Streitbeilegung nach § 36 VSBG ergänzen
          </Platzhalter>
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Weitere Rechtstexte">
        <Liste>
          <li>
            <a href="/datenschutz" className="font-medium text-brand-600 hover:underline">
              Datenschutzerklärung
            </a>
          </li>
          <li>
            <a href="/nutzungsbedingungen" className="font-medium text-brand-600 hover:underline">
              Nutzungsbedingungen
            </a>
          </li>
          <li>
            <a href="/avv" className="font-medium text-brand-600 hover:underline">
              Auftragsverarbeitungsvertrag (Art. 28 DSGVO)
            </a>
          </li>
        </Liste>
      </Abschnitt>
    </LegalPage>
  );
}
