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
    <div className="flex min-h-screen flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
