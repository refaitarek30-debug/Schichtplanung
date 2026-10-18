import { PrivatSchichtenSeite } from "@/components/privat/schichten-seite";

/** Schichten und Auswertung; „?reiter=liste“ öffnet gleich „Meine Schichten“. */
export default async function Seite({ searchParams }: { searchParams: Promise<{ reiter?: string }> }) {
  const { reiter } = await searchParams;
  return <PrivatSchichtenSeite start={reiter === "liste" ? "liste" : "uebersicht"} />;
}
