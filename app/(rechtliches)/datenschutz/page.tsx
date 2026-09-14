import {
  Abschnitt,
  Absatz,
  Hinweis,
  LegalPage,
  Liste,
  Platzhalter,
} from "@/components/legal/prose";

export const metadata = {
  title: "Datenschutzerklärung – Schichtplan",
  description:
    "Welche personenbezogenen Daten Schichtplan verarbeitet, zu welchem Zweck und auf welcher Rechtsgrundlage.",
};

/*
 * Fundierter Entwurf, kein Ersatz für eine rechtliche Prüfung.
 *
 * Die inhaltlichen Angaben – welche Felder es gibt, wo sie liegen, wie lange
 * sie bleiben – stammen aus dem Schema und aus der Projektkonfiguration und
 * sind insoweit belastbar. Was NICHT aus dem Code kommen kann, ist mit
 * <Platzhalter> markiert.
 *
 * TODO: von Tarek auszufüllen
 */
export default function DatenschutzPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      intro="Diese Erklärung beschreibt, welche personenbezogenen Daten in Schichtplan verarbeitet werden, wer dafür verantwortlich ist und welche Rechte betroffene Personen haben."
      updated="14. September 2026"
    >
      <Hinweis titel="Zwei Verantwortliche – bitte nicht verwechseln">
        <p>
          Schichtplan wird Unternehmen als Anwendung zur Verfügung gestellt. Für die
          Daten <strong>der Beschäftigten</strong> ist das jeweilige Unternehmen als
          Arbeitgeber die verantwortliche Stelle; der Betreiber von Schichtplan ist
          insoweit nur <strong>Auftragsverarbeiter</strong> nach Art. 28 DSGVO und
          handelt ausschließlich auf Weisung des Unternehmens.
        </p>
        <p>
          Eigenverantwortlich verarbeitet der Betreiber nur die Daten, die für den
          Betrieb der Anwendung selbst anfallen – etwa das Konto der Person, die ein
          Unternehmen registriert, und technische Protokolldaten.
        </p>
      </Hinweis>

      <Abschnitt titel="1. Verantwortlicher für den Betrieb der Anwendung">
        <Absatz>
          <Platzhalter>Name oder Firma</Platzhalter>,{" "}
          <Platzhalter>Anschrift</Platzhalter>, E-Mail:{" "}
          <Platzhalter>Kontaktadresse</Platzhalter>. Die vollständigen Angaben stehen
          im{" "}
          <a href="/impressum" className="font-medium text-brand-600 hover:underline">
            Impressum
          </a>
          .
        </Absatz>
        <Absatz>
          Ein Datenschutzbeauftragter ist{" "}
          <Platzhalter>benannt / nicht benannt – bitte prüfen</Platzhalter>. Die
          Benennung ist nach § 38 BDSG unter anderem dann Pflicht, wenn in der Regel
          mindestens 20 Personen ständig mit automatisierter Verarbeitung beschäftigt
          sind.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="2. Verantwortlicher für die Beschäftigtendaten">
        <Absatz>
          Das Unternehmen, das den Zugang eingerichtet hat. Beschäftigte richten
          Auskunfts-, Berichtigungs- und Löschverlangen zu ihren Schicht-, Urlaubs- und
          Abwesenheitsdaten an ihren Arbeitgeber – in der Regel an die Personalabteilung
          oder die Betriebsleitung. Erreicht ein solches Verlangen den Betreiber, leitet
          er es an das Unternehmen weiter und beantwortet es nicht selbst.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="3. Welche Daten verarbeitet werden">
        <Absatz>
          <strong>Stammdaten der Beschäftigten:</strong>
        </Absatz>
        <Liste>
          <li>Vor- und Nachname</li>
          <li>E-Mail-Adresse (nur wenn ein Zugang eingerichtet werden soll)</li>
          <li>Telefonnummer, sofern das Unternehmen sie einträgt</li>
          <li>Personalnummer</li>
          <li>Abteilung</li>
          <li>Rolle in der Anwendung (Mitarbeiter, Schichtleitung, Administration)</li>
          <li>Qualifikationen, soweit für die Besetzungsplanung hinterlegt</li>
        </Liste>

        <Absatz className="pt-1">
          <strong>Planungs- und Abwesenheitsdaten:</strong>
        </Absatz>
        <Liste>
          <li>Schichtzuordnung, Rotationsgruppe und einzelne Schichtzuweisungen je Tag</li>
          <li>Urlaubsanspruch, genommene und beantragte Urlaubstage, Resturlaub</li>
          <li>V-Tage (Freischichten) mit demselben Kontostand</li>
          <li>Urlaubsanträge samt Zeitraum, Art, Status und freiwilligem Kommentar</li>
          <li>
            Abwesenheiten mit Grund in der Kategorie <em>krank</em>, <em>Urlaub</em>,{" "}
            <em>Freischicht</em> oder <em>frei</em>
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Zu Krankheitstagen wird ausschließlich die Tatsache der Abwesenheit
          gespeichert – <strong>keine Diagnose, keine ärztliche Bescheinigung und kein
          sonstiger Gesundheitsbefund</strong>. Die Anwendung sieht für solche Angaben
          bewusst kein Feld vor.
        </Absatz>

        <Absatz className="pt-1">
          <strong>Zugangs- und technische Daten:</strong>
        </Absatz>
        <Liste>
          <li>
            E-Mail-Adresse und ein Passwort-Hash für die Anmeldung; das Passwort selbst
            wird nicht gespeichert
          </li>
          <li>Zeitpunkt der letzten Anmeldung und der letzten Aktivität</li>
          <li>
            Server-Protokolle der eingesetzten Dienstleister mit IP-Adresse, Zeitpunkt,
            aufgerufenem Pfad und Browserkennung
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Es findet keine Reichweitenmessung, kein Tracking und keine Werbung statt. Es
          werden keine Daten an Dritte verkauft oder für fremde Zwecke ausgewertet.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="4. Zwecke der Verarbeitung">
        <Liste>
          <li>Schicht- und Urlaubsplanung einschließlich Prüfung der Mindestbesetzung</li>
          <li>Bearbeitung und Genehmigung von Urlaubsanträgen</li>
          <li>Führung der Urlaubs- und Freischichtkonten</li>
          <li>Einrichtung und Absicherung der Zugänge</li>
          <li>Betrieb, Fehlersuche und Absicherung der Anwendung</li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="5. Rechtsgrundlagen">
        <Liste>
          <li>
            <strong>Beschäftigtendaten:</strong> § 26 Abs. 1 BDSG in Verbindung mit
            Art. 88 DSGVO – die Verarbeitung ist für die Durchführung des
            Beschäftigungsverhältnisses erforderlich. Ergänzend Art. 6 Abs. 1 lit. b
            DSGVO.
          </li>
          <li>
            <strong>Abwesenheit wegen Krankheit:</strong> Art. 9 Abs. 2 lit. b DSGVO in
            Verbindung mit § 26 Abs. 3 BDSG – Erfüllung arbeitsrechtlicher Pflichten.
            Der Zugriff ist auf Schichtleitung und Administration des eigenen
            Unternehmens beschränkt.
          </li>
          <li>
            <strong>Konto des registrierenden Unternehmens:</strong> Art. 6 Abs. 1
            lit. b DSGVO – Erfüllung des Nutzungsvertrags.
          </li>
          <li>
            <strong>Protokolldaten und technische Absicherung:</strong> Art. 6 Abs. 1
            lit. f DSGVO – berechtigtes Interesse an einem sicheren und funktionsfähigen
            Betrieb.
          </li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="6. Wer die Daten zu sehen bekommt">
        <Absatz>
          Innerhalb der Anwendung ist jedes Unternehmen technisch vollständig von allen
          anderen getrennt. Die Trennung wird nicht im Browser, sondern in der Datenbank
          durchgesetzt (Row Level Security in PostgreSQL): jede Abfrage wird serverseitig
          auf das Unternehmen der angemeldeten Person eingegrenzt. Eine Abfrage über
          Unternehmensgrenzen hinweg ist damit auch dann nicht möglich, wenn jemand die
          Anfrage manipuliert.
        </Absatz>
        <Absatz>Innerhalb eines Unternehmens gilt:</Absatz>
        <Liste>
          <li>
            Beschäftigte sehen ihre eigenen Daten und den Schichtplan ihrer eigenen
            Schichtgruppe
          </li>
          <li>
            die Schichtleitung sieht zusätzlich die Anträge und Abwesenheiten ihres
            Bereichs
          </li>
          <li>die Administration sieht alle Daten des eigenen Unternehmens</li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="7. Auftragsverarbeiter">
        <Absatz>
          Für Betrieb und Auslieferung werden zwei Dienstleister eingesetzt. Mit beiden
          bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO.
        </Absatz>
        <Liste>
          <li>
            <strong>Supabase</strong> (Supabase, Inc.) – Datenbank, Anmeldung und
            Dateiablage. Die Datenbank dieses Projekts liegt in der Region{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5 text-[12px]">
              eu-west-1
            </code>{" "}
            (Irland, Europäische Union). Hier liegen alle oben genannten Stamm-,
            Planungs- und Abwesenheitsdaten.
          </li>
          <li>
            <strong>Vercel</strong> (Vercel, Inc.) – Auslieferung der Anwendung. Die
            Serverfunktionen dieses Projekts laufen derzeit in der Region{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5 text-[12px]">iad1</code>{" "}
            (Washington, D.C., USA). Dabei werden die zur Beantwortung einer Anfrage
            nötigen Daten in den USA verarbeitet.
          </li>
        </Liste>
        <Absatz>
          <strong>Übermittlung in die USA:</strong> Die Verarbeitung durch Vercel stützt
          sich auf einen Angemessenheitsbeschluss der Europäischen Kommission
          (EU-US Data Privacy Framework) beziehungsweise auf Standardvertragsklauseln
          nach Art. 46 Abs. 2 lit. c DSGVO.
        </Absatz>
        <Hinweis titel="Anmerkung an den Betreiber">
          <p>
            Die Region der Serverfunktionen lässt sich in Vercel auf{" "}
            <code>fra1</code> (Frankfurt) umstellen. Dann findet keine Übermittlung in
            ein Drittland mehr statt und dieser Abschnitt kann entfallen – das ist für
            deutsche Kunden mit Betriebsrat regelmäßig ein Thema.
          </p>
        </Hinweis>
      </Abschnitt>

      <Abschnitt titel="8. Speicherdauer">
        <Liste>
          <li>
            Stammdaten, Planungs- und Abwesenheitsdaten bleiben gespeichert, solange das
            Unternehmen die Anwendung nutzt. Scheidet eine Person aus, wird ihr
            Personalstammsatz üblicherweise auf <em>inaktiv</em> gesetzt, damit
            vergangene Pläne nachvollziehbar bleiben; das endgültige Löschen entscheidet
            das Unternehmen.
          </li>
          <li>
            Urlaubskonten werden je Kalenderjahr geführt und für die Nachvollziehbarkeit
            vergangener Jahre aufbewahrt. Aufbewahrungsfristen ergeben sich aus dem
            Arbeits-, Steuer- und Handelsrecht und legt das Unternehmen fest.
          </li>
          <li>
            Nach Ende des Vertrags mit dem Betreiber werden die Daten des Unternehmens
            nach Wahl des Unternehmens herausgegeben oder gelöscht (siehe
            Auftragsverarbeitungsvertrag).
          </li>
          <li>
            Server-Protokolle der Dienstleister werden nach deren Vorgaben nach kurzer
            Zeit automatisch gelöscht.
          </li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="9. Cookies und lokale Speicherung">
        <Absatz>
          Die Anwendung setzt keine Cookies zu Werbe- oder Analysezwecken. Gespeichert
          wird nur, was für den Betrieb nötig ist:
        </Absatz>
        <Liste>
          <li>
            <code className="rounded bg-surface-muted px-1 py-0.5 text-[12px]">sb-…</code>{" "}
            – Sitzungscookies von Supabase, ohne die keine Anmeldung möglich ist
          </li>
          <li>
            <code className="rounded bg-surface-muted px-1 py-0.5 text-[12px]">
              sp_letzte_aktivitaet
            </code>{" "}
            – Zeitpunkt der letzten Aktivität, damit die Sitzung nach 30 Minuten ohne
            Nutzung automatisch endet
          </li>
          <li>
            <code className="rounded bg-surface-muted px-1 py-0.5 text-[12px]">
              schichtplan.theme
            </code>{" "}
            und{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5 text-[12px]">
              schichtplan.install-hint
            </code>{" "}
            – im lokalen Speicher des Browsers, für die Farbdarstellung und einen
            einmaligen Installationshinweis
          </li>
        </Liste>
        <Absatz>
          Alle genannten Einträge sind für den ausdrücklich gewünschten Dienst
          erforderlich. Eine Einwilligung ist dafür nach § 25 Abs. 2 Nr. 2 TDDDG nicht
          nötig; ein Cookie-Banner entfällt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="10. Rechte der betroffenen Personen">
        <Absatz>Gegenüber der jeweils verantwortlichen Stelle bestehen die Rechte auf</Absatz>
        <Liste>
          <li>Auskunft über die verarbeiteten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>
            Widerspruch gegen eine Verarbeitung auf Grundlage berechtigter Interessen
            (Art. 21 DSGVO)
          </li>
        </Liste>
        <Absatz>
          Unabhängig davon besteht ein Beschwerderecht bei einer
          Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO). Zuständig ist die Behörde am
          Wohnsitz, am Arbeitsplatz oder am Sitz der verantwortlichen Stelle.
        </Absatz>
        <Absatz>
          Anfragen zu Beschäftigtendaten richten Sie bitte an Ihren Arbeitgeber
          (Abschnitt 2), Anfragen zum Betrieb der Anwendung an{" "}
          <Platzhalter>Kontaktadresse</Platzhalter>.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="11. Keine automatisierte Entscheidung im Einzelfall">
        <Absatz>
          Die Anwendung prüft rechnerisch, ob durch einen Urlaubsantrag die
          Mindestbesetzung einer Schicht unterschritten würde, und zeigt das Ergebnis an.
          Über Genehmigung oder Ablehnung entscheidet immer ein Mensch – Schichtleitung
          oder Administration. Eine automatisierte Entscheidung im Sinne des Art. 22
          DSGVO findet nicht statt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="12. Änderungen dieser Erklärung">
        <Absatz>
          Diese Erklärung wird angepasst, wenn sich die Verarbeitung ändert – etwa beim
          Wechsel eines Dienstleisters oder einer Serverregion. Maßgeblich ist die hier
          veröffentlichte Fassung mit dem oben genannten Stand.
        </Absatz>
      </Abschnitt>

      <Hinweis titel="Bitte vor dem produktiven Einsatz prüfen lassen">
        <p>
          Dieser Text ist ein fundierter Entwurf auf Grundlage dessen, was die Anwendung
          tatsächlich verarbeitet. Er ersetzt keine Rechtsberatung. Unternehmen mit
          eigenen Besonderheiten – Betriebsrat und Mitbestimmung nach § 87 Abs. 1 Nr. 2
          und 6 BetrVG, Betriebsvereinbarungen, Tarifbindung, zusätzliche
          Datenkategorien oder eine erforderliche Datenschutz-Folgenabschätzung – sollten
          ihn vor dem produktiven Einsatz durch eine fachkundige Stelle prüfen lassen.
        </p>
      </Hinweis>
    </LegalPage>
  );
}
