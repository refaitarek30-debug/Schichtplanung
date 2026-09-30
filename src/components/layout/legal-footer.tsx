import Link from "next/link";
import { VersionTag } from "@/components/legal/prose";
import { AVV_VERSION, DATENSCHUTZ_VERSION, NUTZUNGSBEDINGUNGEN_VERSION } from "@/lib/legal/version";

/**
 * Impressum, Datenschutz, Nutzungsbedingungen und AV-Vertrag müssen von jeder Seite aus erreichbar sein –
 * auch von der Anmeldung und der Registrierung, weil dort bereits
 * personenbezogene Daten erhoben werden.
 */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={
        className ??
        "border-t border-line px-5 py-4 text-[12px] text-ink-faint"
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <span>Schichtplan</span>
        <Link href="/impressum" className="hover:text-ink-muted hover:underline">
          Impressum
        </Link>
        <Link href="/datenschutz" className="hover:text-ink-muted hover:underline">
          Datenschutz
          <VersionTag version={DATENSCHUTZ_VERSION} dokument="Datenschutzerklärung" />
        </Link>
        <Link href="/nutzungsbedingungen" className="hover:text-ink-muted hover:underline">
          Nutzungsbedingungen
          <VersionTag version={NUTZUNGSBEDINGUNGEN_VERSION} dokument="Nutzungsbedingungen" />
        </Link>
        <Link href="/avv" className="hover:text-ink-muted hover:underline">
          AV-Vertrag
          <VersionTag version={AVV_VERSION} dokument="Auftragsverarbeitungsvertrag" />
        </Link>
      </div>
    </footer>
  );
}
