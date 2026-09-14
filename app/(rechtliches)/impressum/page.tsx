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
 * Die mit <Platzhalter> markierten Stellen sind Pflichtangaben nach
 * § 5 DDG (bis 2024 § 5 TMG). Sie dürfen nicht erfunden werden: eine
 * erfundene Anschrift ist schlimmer als eine fehlende, weil sie wie eine
 * echte aussieht. Eine unvollständige Anbieterkennzeichnung ist
 * abmahnfähig – bitte vor dem ersten echten Kunden ausfüllen.
 *
 * TODO: von Tarek auszufüllen
 */
export default function ImpressumPage() {
  return (
    <LegalPage
      title="Impressum"
      intro="Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz, vormals § 5 TMG)."
      updated="14. September 2026"
    >
      <Hinweis titel="Diese Seite ist noch nicht vollständig">
        <p>
          Die gelb markierten Stellen sind gesetzliche Pflichtangaben und müssen vom
          Betreiber selbst eingetragen werden. Sie wurden bewusst offengelassen statt
          mit Beispielwerten gefüllt.
        </p>
      </Hinweis>

      <Abschnitt titel="Anbieter">
        {/* TODO: von Tarek auszufüllen */}
        <Liste>
          <li>
            Name bzw. Firma: <Platzhalter>vollständiger Name oder Firmenname</Platzhalter>
          </li>
          <li>
            Rechtsform: <Platzhalter>z. B. Einzelunternehmen, GmbH, UG</Platzhalter>
          </li>
          <li>
            Anschrift: <Platzhalter>Straße, Hausnummer</Platzhalter>{" "}
            <Platzhalter>Postleitzahl, Ort</Platzhalter>
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Ein Postfach genügt nicht – § 5 DDG verlangt eine ladungsfähige Anschrift.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <Liste>
          <li>
            E-Mail: <Platzhalter>Kontaktadresse</Platzhalter>
          </li>
          <li>
            Telefon: <Platzhalter>Rufnummer</Platzhalter>
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Verlangt wird eine „unmittelbare und effiziente" Kontaktmöglichkeit. Eine
          E-Mail-Adresse allein reicht dafür in der Regel nicht; üblich ist eine
          Rufnummer oder ein Kontaktformular mit zugesicherter Antwortzeit.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Registereintrag und Umsatzsteuer">
        <Liste>
          <li>
            Registergericht und Registernummer:{" "}
            <Platzhalter>nur bei eingetragenen Unternehmen</Platzhalter>
          </li>
          <li>
            Umsatzsteuer-Identifikationsnummer nach § 27a UStG:{" "}
            <Platzhalter>falls vorhanden</Platzhalter>
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Beides entfällt, wenn es nicht zutrifft – Kleinunternehmer nach § 19 UStG
          haben keine USt-IdNr. Dann diesen Abschnitt ersatzlos streichen, statt ihn
          leer stehen zu lassen.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Verantwortlich für den Inhalt">
        <Absatz>
          <Platzhalter>Name</Platzhalter>, Anschrift wie oben.
        </Absatz>
        <Absatz className="text-[13px] text-ink-muted">
          Nach § 18 Abs. 2 MStV nur nötig, wenn journalistisch-redaktionelle Inhalte
          angeboten werden. Für eine reine Anwendung ist die Angabe freiwillig, aber
          üblich.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Streitbeilegung">
        <Absatz>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
          bereit:{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            className="font-medium text-brand-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            ec.europa.eu/consumers/odr
          </a>
          .
        </Absatz>
        <Absatz>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor
          einer Verbraucherschlichtungsstelle teilzunehmen.
        </Absatz>
        <Absatz className="text-[13px] text-ink-muted">
          Diese Angabe richtet sich an Verbraucher. Wird die Anwendung ausschließlich an
          Unternehmen vermietet, kann der Abschnitt entfallen.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="Datenschutz">
        <Absatz>
          Wie personenbezogene Daten in dieser Anwendung verarbeitet werden, steht in der{" "}
          <a href="/datenschutz" className="font-medium text-brand-600 hover:underline">
            Datenschutzerklärung
          </a>
          .
        </Absatz>
      </Abschnitt>
    </LegalPage>
  );
}
