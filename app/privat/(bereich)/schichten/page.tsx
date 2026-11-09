import { PrivatSchichtenSeite } from "@/components/privat/schichten-seite";
import { reiterAus } from "@/lib/privat/reiter";

/** Schichten: Liste; „?reiter=uebersicht“, „liste“, „geld“, „urlaub“ oder „gemeinsam“ öffnet den Bereich auf eigener Seite. */
export default async function Seite({ searchParams }: { searchParams: Promise<{ reiter?: string }> }) {
  const { reiter } = await searchParams;
  return <PrivatSchichtenSeite start={reiter ? reiterAus(reiter) : null} />;
}
