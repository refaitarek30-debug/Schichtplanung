import Link from "next/link";

/**
 * Impressum und Datenschutz müssen von jeder Seite aus erreichbar sein –
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
        </Link>
      </div>
    </footer>
  );
}
