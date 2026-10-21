import {
  Abschnitt,
  Absatz,
  LegalPage,
  Liste,
} from "@/components/legal/prose";

export const metadata = {
  title: "Impressum – ShiftNexo",
  description: "Anbieterkennzeichnung nach § 5 DDG.",
};

/*
 * Anbieterkennzeichnung nach § 5 DDG (Digitale-Dienste-Gesetz, vormals § 5 TMG).
 * Angaben vom Betreiber selbst.
 * Pflichtangaben nie erfinden – eine erfundene Anschrift ist schlimmer als
 * eine fehlende, weil sie wie eine echte aussieht.
 *
 * Wer die Anwendung betreibt und anbietet, ist Anbieter im Sinne von § 5 DDG –
 * auch als Einzelperson, sobald das Angebot geschäftsmäßig (nachhaltig, in der
 * Regel gegen Entgelt oder mit Gewinnerzielungsabsicht) erfolgt. Eine Aussage
 * wie „kein Unternehmen“ steht hier bewusst nicht.
 *
 * Kommen Gewerbe, Registereintrag oder USt-IdNr. hinzu, hier ergänzen.
 */
export default function ImpressumPage() {
  return (
    <LegalPage
      title="Impressum"
      intro="Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)."
      updated="21. Oktober 2026"
    >
      <Abschnitt titel="Anbieter">
        <Liste>
          <li>Tarek Oussama Refai</li>
          <li>Herselerstraße 9, 53332 Bornheim, Deutschland</li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <Liste>
          <li>
            E-Mail: <a href="mailto:shiftfornexo@gmail.com" className="font-medium text-brand-600 hover:underline">shiftfornexo@gmail.com</a>
          </li>
          <li>
            Telefon:{" "}
            <a href="tel:+491743376978" className="font-medium text-brand-600 hover:underline">
              +49 174 3376978
            </a>
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Anfragen per E-Mail werden in der Regel innerhalb weniger Werktage beantwortet.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Redaktionell verantwortlich">
        <Absatz>
          Die Anwendung enthält keine journalistisch-redaktionell gestalteten Inhalte; eine
          Angabe nach § 18 Abs. 2 MStV entfällt.
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
