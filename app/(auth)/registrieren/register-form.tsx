"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswortInput } from "@/components/ui/passwort-input";
import { SchrittFolge, Wahl, type Schritt } from "@/components/ui/schritte";
import { VersionTag } from "@/components/legal/prose";
import { registerCompany } from "@/lib/auth/company-actions";
import type { FormState } from "@/lib/auth/form-state";
import { AVV_VERSION, DATENSCHUTZ_VERSION, NUTZUNGSBEDINGUNGEN_VERSION } from "@/lib/legal/version";

const initialState: FormState = {};

type Bezeichnung = "vtag" | "zeitausgleich" | "freischicht" | "eigen";

const NAMEN: Record<Exclude<Bezeichnung, "eigen">, { einzahl: string; mehrzahl: string; titel: string; text: string }> = {
  vtag: { einzahl: "V-Tag", mehrzahl: "V-Tage", titel: "V-Tag", text: "So heißt es in der App standardmäßig." },
  zeitausgleich: {
    einzahl: "Zeitausgleichstag",
    mehrzahl: "Zeitausgleichstage",
    titel: "Zeitausgleich",
    text: "„Zeitausgleichstag“ und „Zeitausgleichstage“",
  },
  freischicht: { einzahl: "Freischicht", mehrzahl: "Freischichten", titel: "Freischicht", text: "„Freischicht“ und „Freischichten“" },
};

/**
 * Registrierung eines Unternehmens in Schritten: eine Frage pro Bildschirm.
 * Abgeschickt wird erst am Ende, mit allen Angaben auf einmal – die
 * Server-Aktion prüft alles noch einmal selbst.
 */
export function RegisterForm({ disabled }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(registerCompany, initialState);
  const [, startTransition] = useTransition();
  const [zeitausgleich, setZeitausgleich] = useState<"ja" | "nein" | null>(null);
  const [bezeichnung, setBezeichnung] = useState<Bezeichnung>("vtag");

  const namen = bezeichnung === "eigen" ? null : NAMEN[bezeichnung];

  const schritte: Schritt[] = [
    {
      name: "Betrieb",
      frage: "Wie heißt euer Betrieb?",
      hinweis: "So erscheint er später in der App. Ihr bekommt einen eigenen, von anderen getrennten Bereich.",
      inhalt: (
        <Field label="Name des Unternehmens">
          <Input name="company_name" required maxLength={200} placeholder="Muster GmbH" disabled={disabled} />
        </Field>
      ),
    },
    {
      name: "Du",
      frage: "Wer richtet ShiftNexo ein?",
      hinweis: "Du wirst automatisch Administrator und kannst später weitere Personen einladen.",
      inhalt: (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vorname">
            <Input name="first_name" required maxLength={100} autoComplete="given-name" disabled={disabled} />
          </Field>
          <Field label="Nachname">
            <Input name="last_name" required maxLength={100} autoComplete="family-name" disabled={disabled} />
          </Field>
        </div>
      ),
    },
    {
      name: "Zeitausgleich",
      frage: "Gibt es bei euch Zeitausgleich?",
      hinweis: "Freie Tage, die über ein eigenes Konto laufen – neben dem Urlaub. Zum Beispiel V-Tage oder Freischichten.",
      pruefen: () => (zeitausgleich === null ? "Bitte wähle Ja oder Nein." : null),
      inhalt: (
        <>
          <input type="hidden" name="zeitausgleich" value={zeitausgleich ?? ""} />
          {namen ? (
            <>
              <input type="hidden" name="v_tag_name" value={namen.einzahl} />
              <input type="hidden" name="v_tage_name" value={namen.mehrzahl} />
            </>
          ) : null}
          <Wahl
            name="Gibt es Zeitausgleich?"
            wert={zeitausgleich}
            onWahl={setZeitausgleich}
            werte={[
              { wert: "ja", titel: "Ja", text: "Die App führt dafür ein eigenes Konto je Person." },
              { wert: "nein", titel: "Nein", text: "Dann gibt es nur Urlaub und die übrigen Abwesenheiten." },
            ]}
          />
          {zeitausgleich === "ja" ? (
            <div className="space-y-3 rounded-xl bg-surface-muted p-3.5">
              <p className="text-[14px] font-semibold">Wie nennt ihr das?</p>
              <Wahl
                name="Bezeichnung"
                wert={bezeichnung}
                onWahl={setBezeichnung}
                werte={[
                  ...(Object.keys(NAMEN) as Exclude<Bezeichnung, "eigen">[]).map((k) => ({
                    wert: k as Bezeichnung,
                    titel: NAMEN[k].titel,
                    text: NAMEN[k].text,
                  })),
                  { wert: "eigen", titel: "Anders", text: "Eigenen Namen eintragen" },
                ]}
              />
              {bezeichnung === "eigen" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Ein Tag heißt …">
                    <Input name="v_tag_name" required maxLength={40} placeholder="z. B. Ausgleichstag" />
                  </Field>
                  <Field label="Mehrere Tage heißen …">
                    <Input name="v_tage_name" required maxLength={40} placeholder="z. B. Ausgleichstage" />
                  </Field>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ),
    },
    {
      name: "Zugang",
      frage: "Wie meldest du dich an?",
      hinweis: "An diese Adresse schicken wir einen Link zur Bestätigung.",
      pruefen: (form) => {
        const a = (form.elements.namedItem("password") as HTMLInputElement | null)?.value ?? "";
        const b = (form.elements.namedItem("password_repeat") as HTMLInputElement | null)?.value ?? "";
        return a !== b ? "Die beiden Passwörter stimmen nicht überein." : null;
      },
      inhalt: (
        <>
          <Field label="E-Mail">
            <Input type="email" name="email" autoComplete="email" required placeholder="du@unternehmen.de" disabled={disabled} />
          </Field>
          <Field label="Passwort" hint="Mindestens 8 Zeichen.">
            <PasswortInput name="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={disabled} />
          </Field>
          <Field label="Passwort wiederholen">
            <PasswortInput name="password_repeat" autoComplete="new-password" required minLength={8} maxLength={72} disabled={disabled} />
          </Field>
        </>
      ),
    },
    {
      name: "Bestätigen",
      frage: "Fast geschafft",
      hinweis: "Bitte bestätige noch drei Punkte. Danach führt dich die App durch die Einrichtung.",
      inhalt: (
        /* Die Zeitpunkte und Fassungen der Zustimmungen setzt der Server bzw.
           die Datenbank (register_company_for_user) – was der Browser schickt,
           ist kein Nachweis. */
        <div className="space-y-2">
          <Bestaetigung name="business_confirmed" disabled={disabled}>
            Ich registriere mich für ein Unternehmen bzw. im Rahmen meiner beruflichen Tätigkeit
            (nicht als Verbraucher) und bin berechtigt, das Unternehmen zu vertreten.
          </Bestaetigung>
          <Bestaetigung name="terms_accepted" disabled={disabled}>
            Ich akzeptiere die{" "}
            <TextLink href="/nutzungsbedingungen">
              Nutzungsbedingungen
              <VersionTag version={NUTZUNGSBEDINGUNGEN_VERSION} />
            </TextLink>{" "}
            und den{" "}
            <TextLink href="/avv">
              Auftragsverarbeitungsvertrag (Art. 28 DSGVO)
              <VersionTag version={AVV_VERSION} />
            </TextLink>
            .
          </Bestaetigung>
          <Bestaetigung name="privacy_read" disabled={disabled}>
            Ich habe die{" "}
            <TextLink href="/datenschutz">
              Datenschutzerklärung
              <VersionTag version={DATENSCHUTZ_VERSION} />
            </TextLink>{" "}
            zur Kenntnis genommen.
          </Bestaetigung>
          <p className="pt-1 text-[12px] leading-snug text-ink-faint">
            Die Daten jedes Unternehmens werden technisch getrennt gespeichert und durch
            Zugriffsregeln in der Datenbank geschützt. Einzelheiten stehen in der
            Datenschutzerklärung.
          </p>
        </div>
      ),
    },
  ];

  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        // Selbst abschicken statt über `action`: so bleiben alle Eingaben
        // stehen, falls der Server einen Fehler meldet.
        e.preventDefault();
        const daten = new FormData(e.currentTarget);
        startTransition(() => formAction(daten));
      }}
    >
      <SchrittFolge
        schritte={schritte}
        disabled={disabled}
        meldung={
          <>
            {state.error ? <Alert tone="error">{state.error}</Alert> : null}
            {state.success ? <Alert tone="success">{state.success}</Alert> : null}
          </>
        }
        abschluss={
          <Button type="submit" className="h-11 w-full" disabled={pending || disabled}>
            {pending ? "Wird angelegt …" : "Unternehmen anlegen"}
          </Button>
        }
      />
    </form>
  );
}

function Bestaetigung({
  name,
  disabled,
  children,
}: {
  name: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-3">
      <input
        type="checkbox"
        name={name}
        required
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-brand-500"
      />
      <span className="text-[13px] leading-snug text-ink">{children}</span>
    </label>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" className="font-medium text-brand-600 hover:underline">
      {children}
    </Link>
  );
}
