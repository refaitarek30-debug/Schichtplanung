"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useSession } from "@/context/session";
import { navForRole, navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Untere Tab-Leiste mit den vier Hauptbereichen plus Menü für den Rest. */
export function MobileNav() {
  const pathname = usePathname();
  const { role } = useSession();
  const [open, setOpen] = useState(false);

  const primary = navItems.filter((i) => i.primary && i.roles.includes(role));
  const groups = navForRole(role);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-ink/30"
            aria-label="Menü schließen"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-surface p-5 pb-24 shadow-pop">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Alle Bereiche</p>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
                aria-label="Menü schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {groups.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                            pathname === item.href
                              ? "bg-brand-50 font-medium text-brand-700"
                              : "text-ink-muted",
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                    active ? "text-brand-600" : "text-ink-faint",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                  {item.short ?? item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setOpen(true)}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] text-ink-faint"
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} />
              Mehr
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
