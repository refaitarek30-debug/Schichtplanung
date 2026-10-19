import type { Metadata } from "next";
import { PartnerAnsicht } from "@/components/kalender/partner-ansicht";

/**
 * Einladungslink für den Partner – ohne Anmeldung. Der Schlüssel in der
 * Adresse ist der Zugang; geprüft wird er in der Datenbank
 * (`partner_kalender`, `partner_tage_setzen`).
 */
export const metadata: Metadata = {
  title: "ShiftNexo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PartnerSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PartnerAnsicht token={token} />;
}
