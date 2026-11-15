"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/context/session";
import { roleLabels } from "@/lib/nav";
import { cn } from "@/lib/utils";

const BEREICHE = [
  { id: "daten", text: "Persönliche Daten", kurz: "Daten", href: "/profil" },
  { id: "sicherheit", text: "Sicherheit", kurz: "Sicherheit", href: "/profil?bereich=sicherheit" },
  { id: "datenschutz", text: "Datenschutz & Daten", kurz: "Datenschutz", href: "/profil/datenschutz" },
] as const;

/**
 * Rahmen der Profil-Seiten (Entwurf B): oben wer man ist, links die Bereiche,
 * rechts der Inhalt. Auf dem Handy stehen die Bereiche als Reiter oben.
 */
export function ProfilRahmen({ aktiv, children }: { aktiv: (typeof BEREICHE)[number]["id"]; children: ReactNode }) {
  const { profile, company } = useSession();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex items-center gap-4">
        <Avatar employee={profile} className="h-14 w-14 text-[18px] sm:h-16 sm:w-16 sm:text-[20px]" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[21px] font-bold tracking-tight sm:text-[24px]">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="truncate text-[13.5px] text-ink-muted sm:text-[14px]">
            {[roleLabels[profile.role], company.name, profile.shiftName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="hidden sm:block">
          <Badge tone={profile.active ? "ok" : "critical"}>{profile.active ? "Konto aktiv" : "Konto deaktiviert"}</Badge>
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Profil" className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:px-0" data-profil-reiter>
          {BEREICHE.map((b) => {
            const an = b.id === aktiv;
            return (
              <Link
                key={b.id}
                href={b.href}
                aria-current={an ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-[10px] px-3 py-2 text-[14px]",
                  an ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                <span className="lg:hidden">{b.kurz}</span>
                <span className="hidden lg:inline">{b.text}</span>
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </div>
  );
}
