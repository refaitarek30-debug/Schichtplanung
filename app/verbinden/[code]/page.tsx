import type { Metadata } from "next";
import { Verbinden } from "./verbinden";

/**
 * Link aus dem QR-Code zum Verbinden zweier Konten. Verbinden kann nur, wer
 * selbst einen Kalender hat – geprüft in der Datenbank (Migration 0157).
 */
export const metadata: Metadata = {
  title: "Kalender verbinden – Schichtplan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerbindenSeite({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Verbinden code={code} />;
}
