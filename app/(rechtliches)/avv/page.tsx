import {
  Abschnitt,
  Absatz,
  Hinweis,
  LegalPage,
  Liste,
  Platzhalter,
} from "@/components/legal/prose";
import { AVV_VERSION } from "@/lib/legal/version";

export const metadata = {
  title: "Auftragsverarbeitungsvertrag – Schichtplan",
  description: "Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO zwischen Kunde und Betreiber.",
};

const kode = "rounded bg-surface-muted px-1 py-0.5 text-[12px]";

/*
 * Auftragsverarbeitungsvertrag (Art. 28 DSGVO), Fassung 1, Stand 30.09.2026.
 * Abgeleitet aus docs/avv-muster.md und an die tatsächliche Technik
 * angepasst (Inaktivitäts-Abmeldung 10 Minuten, Region der Serverfunktionen
 * dub1, aktuelle Datenkategorien).
 *
 * Abschluss: elektronisch bei der Registrierung (Art. 28 Abs. 9 DSGVO
 * verlangt Schrift- oder elektronisches Format). Zeitpunkt und Fassung werden
 * von der Datenbank gespeichert (companies.avv_accepted_at, avv_version).
 *
 * Bei inhaltlichen Änderungen LEGAL_VERSIONS.avv in src/lib/legal/version.ts
 * erhöhen und legal_versions per Migration nachziehen.
 *
 * Kein Ersatz für eine rechtliche Prüfung.
 * TODO (Betreiber): Platzhalter ausfüllen.
 */
export default function AvvPage() {
  return (
    <LegalPage
      title="Auftragsverarbeitungsvertrag"
      intro="Vertrag über die Verarbeitung personenbezogener Daten im Auftrag nach Art. 28 DSGVO."
      updated="30. September 2026"
      version={AVV_VERSION}
    >
      <Hinweis titel="Abschluss und Entwurfsstatus">
        <p>
          Der Vertrag kommt zustande, wenn das Unternehmen bei der Registrierung die
          Nutzungsbedingungen und diesen Vertrag akzeptiert (elektronische Form,
          Art. 28 Abs. 9 DSGVO). Zeitpunkt und Fassung werden gespeichert. Der Text ist
          sorgfältig formuliert, aber nicht anwaltlich geprüft; gelb markierte Stellen
          füllt der Betreiber aus.
        </p>
      </Hinweis>

      <Abschnitt titel="Parteien">
        <Liste>
          <li>
            <strong>Auftraggeber (Verantwortlicher):</strong> das Unternehmen, das sich bei
            Schichtplan registriert hat (Name und Vertretungsberechtigte laut Registrierung).
          </li>
          <li>
            <strong>Auftragnehmer (Auftragsverarbeiter):</strong>{" "}
            <Platzhalter>Name oder Firma, Anschrift, vertretungsberechtigte Person des Betreibers</Platzhalter>
          </li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="§ 1 Gegenstand und Dauer">
        <Absatz>
          (1) Der Auftragnehmer stellt dem Auftraggeber die Anwendung Schichtplan zur
          technischen Schicht- und Personalplanung bereit (Hauptvertrag: die
          Nutzungsbedingungen). Gegenstand dieses Vertrags ist die Verarbeitung
          personenbezogener Daten, die der Auftragnehmer dabei im Auftrag des Auftraggebers
          vornimmt.
        </Absatz>
        <Absatz>
          (2) Die Dauer entspricht der Laufzeit des Hauptvertrags. Die Pflichten aus § 10
          (Löschung und Rückgabe) bestehen darüber hinaus fort.
        </Absatz>
        <Absatz>
          (3) Der Auftraggeber kann diesen Vertrag ohne Einhaltung einer Frist kündigen, wenn
          ein schwerwiegender Verstoß des Auftragnehmers gegen datenschutzrechtliche
          Vorschriften oder gegen diesen Vertrag vorliegt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 2 Art und Zweck der Verarbeitung">
        <Absatz>
          <strong>Art:</strong> Erheben, Erfassen, Organisieren, Ordnen, Speichern, Anpassen,
          Auslesen, Abfragen, Verwenden, Übermitteln an den Auftraggeber, Löschen und
          Vernichten personenbezogener Daten mittels automatisierter Verfahren.
        </Absatz>
        <Absatz>
          <strong>Zweck:</strong>
        </Absatz>
        <Liste>
          <li>Planung und Darstellung von Schichten, Rotationsgruppen und Einzelzuweisungen</li>
          <li>Beantragung, Prüfung und Genehmigung von Urlaub, V-Tagen und weiteren Abwesenheiten</li>
          <li>Führung der Urlaubs-, V-Tage-, Altersfreizeit- und Stundenkonten</li>
          <li>Erfassung von Abwesenheiten und Fehlzeiten</li>
          <li>Prüfung der Mindest- und Sollbesetzung je Schicht und Tag</li>
          <li>Benachrichtigungen zu Anträgen und Änderungen</li>
          <li>Einrichtung, Verwaltung und Absicherung der Benutzerzugänge</li>
        </Liste>
        <Absatz>
          Eine Verarbeitung zu eigenen Zwecken des Auftragnehmers – insbesondere zu Werbe-,
          Analyse- oder Profilbildungszwecken oder zur Weitergabe an Dritte – findet nicht
          statt. Eigene Verantwortlichkeit des Auftragnehmers besteht nur für die in Abschnitt 1
          der Datenschutzerklärung genannten Betriebs- und Vertragsdaten.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 3 Betroffene Personen">
        <Liste>
          <li>Beschäftigte des Auftraggebers, deren Arbeitszeit über die Anwendung geplant wird</li>
          <li>Führungskräfte (Schichtleitung) und Administratoren des Auftraggebers</li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="§ 4 Kategorien personenbezogener Daten">
        <Liste>
          <li>
            <strong>Stammdaten:</strong> Vor- und Nachname, Personalnummer, Rolle, Schichtgruppe,
            Eintritts-/Austrittsdatum, Kennzeichen Auszubildende/r, Qualifikationen, Status
            aktiv/inaktiv; E-Mail-Adresse (bei eingerichtetem Zugang); freiwillig: Telefon,
            Abteilung, Geburtsdatum
          </li>
          <li>
            <strong>Planungs- und Abwesenheitsdaten:</strong> Schichtzuordnung je Tag,
            Urlaubsansprüche und -konten, V-Tage, Altersfreizeit und Stundenkonten,
            Anträge mit Zeitraum, Art, Status, Entscheidung und freiwilliger Begründung,
            Abwesenheiten mit Art, Fehlzeiten mit Stunden und freiwilliger Notiz,
            Kommentare im Schichtplan, Benachrichtigungen
          </li>
          <li>
            <strong>Datenschutz-Einstellungen:</strong> Sichtbarkeitswahl, Fassung und
            Zeitpunkt der Kenntnisnahme, Zeitpunkte von Freigabe und Widerruf
          </li>
          <li>
            <strong>Zugangs- und Protokolldaten:</strong> E-Mail-Adresse, Passwort-Hash,
            Sitzungsdaten, Zeitpunkt der letzten Anmeldung, Änderungsprotokoll,
            gesalzene Hashwerte für die Ratenbegrenzung, technische Zugriffsprotokolle der
            Dienstleister (IP-Adresse, Zeitstempel, Pfad, Browserkennung)
          </li>
          <li>
            <strong>Besondere Kategorien (Art. 9 DSGVO):</strong> Zu Krankheit wird
            ausschließlich die Tatsache der Abwesenheit („krank“) gespeichert. Diagnosen,
            Bescheinigungen und sonstige Gesundheitsangaben sind nicht vorgesehen und vom
            Auftraggeber nicht einzutragen, auch nicht in Freitextfeldern
          </li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="§ 5 Weisungen">
        <Absatz>
          (1) Der Auftragnehmer verarbeitet Daten ausschließlich auf dokumentierte Weisung des
          Auftraggebers. Dieser Vertrag und die Nutzung der Anwendung durch den Auftraggeber
          sind die Erstweisung.
        </Absatz>
        <Absatz>
          (2) Weitere Weisungen erteilt der Auftraggeber in Textform an{" "}
          <Platzhalter>Kontaktadresse des Auftragnehmers</Platzhalter>. Mündliche Weisungen
          sind unverzüglich in Textform zu bestätigen. Weisungsberechtigt sind die
          Administratoren des Auftraggebers.
        </Absatz>
        <Absatz>
          (3) Der Auftragnehmer weist den Auftraggeber unverzüglich darauf hin, wenn er eine
          Weisung für datenschutzrechtswidrig hält, und darf sie bis zur Bestätigung oder
          Änderung aussetzen.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 6 Pflichten des Auftragnehmers">
        <Absatz>Der Auftragnehmer verpflichtet sich,</Absatz>
        <Liste>
          <li>Daten nur im Rahmen dieses Vertrags und der Weisungen zu verarbeiten;</li>
          <li>
            alle zur Verarbeitung befugten Personen zur Vertraulichkeit zu verpflichten
            (Art. 28 Abs. 3 lit. b DSGVO);
          </li>
          <li>die technischen und organisatorischen Maßnahmen nach § 8 zu treffen und aufrechtzuerhalten;</li>
          <li>den Auftraggeber bei Betroffenenrechten (§ 9), Datenschutz-Folgenabschätzungen und Konsultationen (Art. 35, 36 DSGVO) zu unterstützen;</li>
          <li>den Auftraggeber unverzüglich zu informieren, wenn eine Aufsichtsbehörde beim Auftragnehmer Maßnahmen ergreift, die ihn betreffen können;</li>
          <li>Nachweise nach § 11 zu erbringen;</li>
          <li>nach Vertragsende Daten nach Wahl des Auftraggebers herauszugeben oder zu löschen (§ 10);</li>
          <li>ein Verzeichnis nach Art. 30 Abs. 2 DSGVO zu führen.</li>
        </Liste>
      </Abschnitt>

      <Abschnitt titel="§ 7 Unterauftragsverarbeiter">
        <Absatz>(1) Der Auftraggeber stimmt dem Einsatz folgender Unterauftragsverarbeiter zu:</Absatz>
        <Liste>
          <li>
            <strong>Supabase, Inc.</strong> (USA) – Datenbank, Authentifizierung,
            Serverfunktionen für den Mailversand. Ort der Verarbeitung: Region{" "}
            <code className={kode}>eu-west-1</code> (Irland, EU).
          </li>
          <li>
            <strong>Vercel, Inc.</strong> (USA) – Auslieferung der Anwendung,
            Serverfunktionen. Ort der Verarbeitung der Serverfunktionen: Region{" "}
            <code className={kode}>dub1</code> (Dublin, Irland, EU); Anfragen laufen über
            das Edge-Netzwerk des Anbieters.
          </li>
          <li>
            <strong>Mailversand:</strong>{" "}
            <Platzhalter>SMTP-Anbieter mit Sitz und Region eintragen – oder streichen</Platzhalter>
          </li>
        </Liste>
        <Absatz>
          (2) Stamm-, Planungs- und Abwesenheitsdaten werden in der Datenbank bei Supabase in
          Irland gespeichert.
        </Absatz>
        <Absatz>
          (3) Soweit ein Unterauftragsverarbeiter Daten in einem Drittland verarbeitet oder ein
          Zugriff von dort möglich ist, stützt sich die Übermittlung auf einen
          Angemessenheitsbeschluss (EU-US Data Privacy Framework) oder Standardvertragsklauseln
          nach Art. 46 Abs. 2 lit. c DSGVO mit ergänzenden Maßnahmen.{" "}
          <Platzhalter>
            Betreiber: Abschluss der Auftragsverarbeitungsverträge mit den genannten Anbietern
            und aktuellen Zertifizierungs-/Klauselstand bestätigen
          </Platzhalter>
        </Absatz>
        <Absatz>
          (4) Der Auftragnehmer schließt mit jedem Unterauftragsverarbeiter einen Vertrag, der
          diesem im Wesentlichen dieselben Pflichten auferlegt wie diesen Vertrag.
        </Absatz>
        <Absatz>
          (5) Beabsichtigte Änderungen der Unterauftragsverarbeiter teilt der Auftragnehmer
          mindestens vier Wochen vorher in Textform mit. Der Auftraggeber kann innerhalb von
          zwei Wochen aus wichtigem datenschutzrechtlichem Grund widersprechen; dann steht
          ihm ein Sonderkündigungsrecht nach § 1 Abs. 3 zu.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 8 Technische und organisatorische Maßnahmen (Art. 32 DSGVO)">
        <Liste>
          <li>
            <strong>Zutritt:</strong> Die Verarbeitung findet in Rechenzentren der
            Unterauftragsverarbeiter statt; der Auftragnehmer betreibt keine eigenen Server.
            Zutrittsschutz und Zertifizierungen der Rechenzentren richten sich nach den
            Angaben der Anbieter.
          </li>
          <li>
            <strong>Zugang:</strong> Anmeldung über persönliche Konten mit E-Mail und Passwort
            (Passwörter nur als Hash); Begrenzung von Anmelde-, Zurücksetzen- und
            Registrierungsversuchen; automatische Abmeldung nach 10 Minuten ohne Aktivität.
          </li>
          <li>
            <strong>Zugriff und Trennung:</strong> Mandantentrennung durch eine
            Unternehmenskennung in jedem Datensatz, durchgesetzt in der Datenbank
            (Row Level Security in PostgreSQL), nicht nur in der Oberfläche; abgestuftes
            Rollenmodell (Mitarbeiter, Schichtleitung, Administration); kritische Änderungen
            (Rollen, Zuordnungen) nur serverseitig mit Prüfung.
          </li>
          <li>
            <strong>Weitergabe:</strong> Übertragung ausschließlich verschlüsselt (TLS,
            HSTS); keine Übermittlung an Dritte außer den Unterauftragsverarbeitern.
          </li>
          <li>
            <strong>Eingabe:</strong> Anträge und Entscheidungen werden mit Zeitstempel und
            entscheidender Person gespeichert; sicherheitsrelevante Änderungen werden ohne
            Gesundheitsinhalte im Änderungsprotokoll festgehalten.
          </li>
          <li>
            <strong>Verfügbarkeit:</strong> Sicherungen der Datenbank durch den Dienstleister;
            Wiederherstellbarkeit im Rahmen des gebuchten Tarifs.
          </li>
          <li>
            <strong>Datenminimierung und Voreinstellung:</strong> keine Diagnosen oder
            Gesundheitsfreitexte, Abwesenheitsgründe für Kolleginnen und Kollegen standardmäßig
            verborgen, Krankheit standardmäßig privat.
          </li>
          <li>
            <strong>Überprüfung:</strong> automatisierte Prüfskripte für Zugriffsregeln und
            Mandantentrennung sowie die Sicherheitshinweise des Datenbankanbieters nach
            Änderungen am Schema.
          </li>
        </Liste>
        <Absatz className="text-[13px] text-ink-muted">
          Der Auftragnehmer entwickelt die Maßnahmen weiter. Änderungen sind zulässig, solange
          das Schutzniveau nicht unterschritten wird.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 9 Betroffenenrechte">
        <Absatz>
          (1) Der Auftragnehmer unterstützt den Auftraggeber mit geeigneten technischen und
          organisatorischen Maßnahmen bei Anträgen betroffener Personen auf Auskunft,
          Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch.
        </Absatz>
        <Absatz>
          (2) Wendet sich eine betroffene Person unmittelbar an den Auftragnehmer, leitet
          dieser das Anliegen unverzüglich an den Auftraggeber weiter und beantwortet es nicht
          selbst. Berichtigung, Löschung oder Einschränkung erfolgen nur auf Weisung.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 10 Löschung und Rückgabe">
        <Absatz>
          (1) Nach Vertragsende gibt der Auftragnehmer nach Wahl des Auftraggebers alle Daten in
          einem gängigen maschinenlesbaren Format heraus oder löscht sie.
        </Absatz>
        <Absatz>
          (2) Der Auftraggeber teilt seine Wahl innerhalb von 30 Tagen nach Vertragsende in
          Textform mit. Ohne Mitteilung werden die Daten nach Ablauf weiterer 30 Tage gelöscht.
        </Absatz>
        <Absatz>
          (3) Sicherungskopien werden im Rahmen der üblichen Aufbewahrungszyklen des
          Dienstleisters überschrieben. Gesetzliche Aufbewahrungspflichten bleiben unberührt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 11 Nachweise und Überprüfung">
        <Absatz>
          (1) Der Auftragnehmer weist die Einhaltung dieses Vertrags auf Anfrage nach –
          vorrangig durch Auskunft, Dokumentation der Maßnahmen und Zertifikate oder
          Prüfberichte der Unterauftragsverarbeiter.
        </Absatz>
        <Absatz>
          (2) Reichen diese Nachweise nicht aus, kann der Auftraggeber nach Ankündigung
          (mindestens zwei Wochen) zu üblichen Geschäftszeiten selbst oder durch einen zur
          Verschwiegenheit verpflichteten Prüfer, der kein Wettbewerber des Auftragnehmers
          ist, prüfen. Überprüfungen finden höchstens einmal jährlich statt, außer bei
          konkretem Anlass.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 12 Verletzungen des Schutzes personenbezogener Daten">
        <Absatz>
          (1) Der Auftragnehmer informiert den Auftraggeber unverzüglich nach Kenntniserlangung,
          regelmäßig innerhalb von 48 Stunden, über jede Verletzung des Schutzes
          personenbezogener Daten.
        </Absatz>
        <Absatz>
          (2) Die Meldung enthält, soweit bekannt: Art der Verletzung, betroffene Kategorien und
          ungefähre Zahl der Personen und Datensätze, wahrscheinliche Folgen sowie ergriffene
          und vorgeschlagene Maßnahmen. Der Auftragnehmer unterstützt den Auftraggeber bei
          Meldungen nach Art. 33 und 34 DSGVO; die Meldung an die Aufsichtsbehörde und an
          betroffene Personen obliegt dem Auftraggeber.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 13 Haftung">
        <Absatz>
          Es gilt Art. 82 DSGVO. Im Übrigen richtet sich die Haftung nach den Nutzungsbedingungen
          (Abschnitt „Haftung“); die dort genannten unbeschränkten Haftungstatbestände bleiben
          unberührt.
        </Absatz>
      </Abschnitt>

      <Abschnitt titel="§ 14 Schlussbestimmungen">
        <Absatz>
          (1) Änderungen und Ergänzungen bedürfen der Textform. (2) Ist eine Bestimmung
          unwirksam, bleibt die Wirksamkeit der übrigen unberührt. (3) Bei Widersprüchen zu den
          Nutzungsbedingungen gilt für die Verarbeitung personenbezogener Daten dieser Vertrag.
          (4) Es gilt deutsches Recht.
        </Absatz>
      </Abschnitt>
    </LegalPage>
  );
}
