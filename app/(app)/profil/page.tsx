"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useSession } from "@/context/session";
import { roleLabels } from "@/lib/nav";
import { ProfileForm } from "./profile-form";
import { PersonalDetailsForm } from "./personal-details-form";
import { StammdatenForm } from "./stammdaten-form";
import { PasswortAendernForm } from "./passwort-aendern-form";
import { WiederherstellungsCodeKarte } from "./wiederherstellungs-code-karte";
import { ZweiFaktorKarte } from "./zwei-faktor-karte";
import { ProfilRahmen } from "./rahmen";

type Bereich = "daten" | "sicherheit";

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilInhalt />
    </Suspense>
  );
}

/**
 * Profil (Entwurf B): oben wer man ist, links die Bereiche, rechts der Inhalt.
 * Auf dem Handy stehen die Bereiche als Reiter oben.
 */
function ProfilInhalt() {
  const { profile, company, mode } = useSession();

  const details = [
    { label: "E-Mail", value: profile.email },
    { label: "Rolle", value: roleLabels[profile.role] },
    { label: "Unternehmen", value: company.name },
    { label: "Schicht", value: profile.shiftName ?? "keine Zuordnung" },
  ];

  const bereich: Bereich = useSearchParams().get("bereich") === "sicherheit" ? "sicherheit" : "daten";

  return (
    <div>
      <ProfilRahmen aktiv={bereich}>
        <div className="min-w-0 space-y-4">
          {bereich === "daten" ? (
            <>
              <ProfileForm profile={profile} readOnly={mode === "demo"} />
              <PersonalDetailsForm readOnly={mode === "demo"} istAdmin={profile.role === "admin"} />
              {profile.employeeId ? (
                <StammdatenForm
                  personalnummer={profile.personnelNumber ?? null}
                  abteilung={profile.department ?? null}
                  readOnly={mode === "demo"}
                />
              ) : null}
              <Card>
                <CardHeader title="Vom Betrieb vergeben" />
                <CardBody className="py-0">
                  <dl className="divide-y divide-line">
                    {details.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-[13.5px] text-ink-muted">{item.label}</dt>
                        <dd className="min-w-0 truncate text-right text-[14px] font-medium">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
            </>
          ) : (
            <>
              <PasswortAendernForm readOnly={mode === "demo"} />
              {mode === "live" && !company.isDemo ? <ZweiFaktorKarte /> : null}
              {mode === "live" ? <WiederherstellungsCodeKarte /> : null}
            </>
          )}
        </div>
      </ProfilRahmen>
    </div>
  );
}
