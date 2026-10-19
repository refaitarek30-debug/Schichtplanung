import type { ReactNode } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * Öffentlicher Produktbereich (Landingpage, Demo-Hinweis). Liegt bewusst
 * außerhalb von `(app)`: hier wird keine Sitzung gelesen und kein
 * Mandantendatum geladen – alles ist statischer Inhalt.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-statisch privat-schrift relative isolate flex min-h-screen flex-col">
      {/* Hintergrund wie in der App: weiche Farbflächen, fest hinter der Seite.
          Eine eigene feste Ebene statt background-attachment: fixed – die
          wird nicht bei jedem Scrollschritt neu gezeichnet. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-surface-muted [background-image:var(--glas-hinter)]" />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
