import { PrivatSchichtenSeite } from "@/components/privat/schichten-seite";
import { reiterAus } from "@/lib/privat/reiter";

/** Schichten mit Kacheln; „?reiter=liste“, „geld“, „urlaub“ oder „gemeinsam“ öffnet gleich den Bereich. */
export default async function Seite({ searchParams }: { searchParams: Promise<{ reiter?: string }> }) {
  const { reiter } = await searchParams;
  return <PrivatSchichtenSeite start={reiterAus(reiter)} />;
}
