import type { ReactNode } from "react";
import { DataModeNotice } from "./data-mode-notice";
import { InstallHint } from "./install-hint";
import { LegalFooter } from "./legal-footer";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-8 pt-6 sm:px-6">
          <InstallHint />
          <DataModeNotice />
          {children}
        </main>
        {/* Impressum und Datenschutz aus jeder Seite erreichbar. Der
            untere Rand liegt über der Handy-Navigation, damit der Footer
            dort nicht darunter verschwindet. */}
        <LegalFooter className="border-t border-line px-5 pb-28 pt-4 text-[12px] text-ink-faint lg:pb-4" />
      </div>
      <MobileNav />
    </div>
  );
}
