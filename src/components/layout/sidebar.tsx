"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/context/session";
import { navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { role, company, mode } = useSession();
  const groups = navForRole(role);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
          SP
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Schichtplan</span>
          <span className="block truncate text-[11px] text-ink-faint">{company.name}</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-brand-50 font-medium text-brand-700"
                          : "text-ink-muted hover:bg-surface-muted hover:text-ink",
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
      </nav>

      <div className="border-t border-line px-5 py-3">
        <p className="truncate text-[12px] font-medium">{company.name}</p>
        <p className="text-[11px] text-ink-faint">
          {mode === "demo" ? "Demo-Modus – ohne Backend" : "Angemeldet"}
        </p>
      </div>
    </aside>
  );
}
