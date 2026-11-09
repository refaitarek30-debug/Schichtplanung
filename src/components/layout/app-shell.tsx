import type { ReactNode } from "react";
import { DataModeNotice } from "./data-mode-notice";
import { InstallHint } from "./install-hint";
import { LegalFooter } from "./legal-footer";
import { LadeSperre } from "./lade-sperre";
import { LiveRefresh } from "./live-refresh";
import { NeueVersionHinweis } from "./neue-version";
import { AbsturzMelder } from "@/components/protokoll/fehler-melder";
import { HinweisPopup } from "@/components/hinweise/hinweis-popup";
import { LeisteHalten } from "./leiste-halten";
import { MobileNav } from "./mobile-nav";
import { ShellMain } from "./shell-main";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    // Handy: Der Rahmen steht fest (fixed, inset-0), nur der Inhalt darin
    // scrollt (data-app-scroller). Seit iOS 26 verschiebt Safari feste
    // Leisten, wenn sich beim Scrollen der Seite die Richtung ändert – die
    // untere Leiste stand dann mitten im Bild. Scrollt die Seite selbst nie,
    // kann nichts verrutschen. Siehe src/lib/app-scroller.ts.
    // Computer: wie bisher, die Seite scrollt (`min-h-dvh` statt
    // `min-h-screen`, weil `100vh` mit der größten Adressleiste rechnet).
    <div className="fixed inset-0 flex lg:static lg:min-h-dvh">
      <Sidebar />
      <div
        data-app-scroller
        className="flex min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:overflow-visible lg:overscroll-auto"
      >
        <Topbar />
        <ShellMain>
          <InstallHint />
          <DataModeNotice />
          {children}
        </ShellMain>
        {/* Impressum und Datenschutz aus jeder Seite erreichbar. Der
            untere Rand liegt über der Handy-Navigation, damit der Footer
            dort nicht darunter verschwindet. */}
        <LegalFooter className="border-t border-line px-5 pb-28 pt-4 text-[12px] text-ink-faint lg:pb-4" />
      </div>
      <MobileNav />
      <LeisteHalten />
      {/* Prüft still, ob sich etwas geändert hat – siehe live-refresh.ts. */}
      <LiveRefresh />
      <NeueVersionHinweis />
      {/* Hinweise der Schichtleitung an diese Person – beim Öffnen als Fenster. */}
      <HinweisPopup />
      {/* Technische Fehler im Browser ins Protokoll. */}
      <AbsturzMelder />
      {/* Blockiert Klicks, solange etwas gespeichert wird. */}
      <LadeSperre />
    </div>
  );
}
