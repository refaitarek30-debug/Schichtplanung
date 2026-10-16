import type { Metadata } from "next";
import { GruppeBeitreten } from "./beitreten";

/**
 * Einladung in eine Gruppe (Familie, Freunde). Beitreten kann nur, wer
 * selbst einen Schichtkalender hat – geprüft in der Datenbank
 * (`gruppe_info`, `gruppe_beitreten`).
 */
export const metadata: Metadata = {
  title: "Einladung – Schichtplan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function GruppenSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GruppeBeitreten token={token} />;
}
