"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useSession } from "@/context/session";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type LiveNotification,
} from "@/lib/data/notifications";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tg.`;
}

export function NotificationBell() {
  const { mode } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LiveNotification[] | null>(null);

  const load = useCallback(async () => {
    if (mode !== "live") return;
    try {
      setItems(await fetchNotifications());
    } catch {
      setItems([]);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  // Beim Öffnen die aktuell ungelesenen serverseitig als gelesen markieren.
  useEffect(() => {
    if (!open || !items) return;
    const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
    if (unreadIds.length === 0) return;
    markAllNotificationsRead(unreadIds).catch(() => {});
    setItems((current) =>
      (current ?? []).map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (mode !== "live") {
    return (
      <button
        className="rounded-xl p-2 text-ink-muted hover:bg-surface-muted"
        aria-label="Benachrichtigungen"
        title="Benachrichtigungen kommen aus Supabase – im Demo-Modus ohne Inhalt"
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} />
      </button>
    );
  }

  const unreadCount = (items ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-ink-muted hover:bg-surface-muted"
        aria-label={`Benachrichtigungen${unreadCount > 0 ? `, ${unreadCount} ungelesen` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-crit-dot" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-line bg-surface p-2 shadow-pop">
          <p className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Benachrichtigungen
          </p>
          <div className="max-h-80 overflow-y-auto">
            {items === null ? (
              <p className="px-2.5 py-6 text-center text-sm text-ink-muted">wird geladen …</p>
            ) : items.length === 0 ? (
              <EmptyState title="Noch keine Benachrichtigungen." />
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (!item.readAt) {
                      markNotificationRead(item.id).catch(() => {});
                      setItems((current) =>
                        (current ?? []).map((n) =>
                          n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n,
                        ),
                      );
                    }
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-muted",
                    !item.readAt && "bg-brand-50/60",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">{item.title}</span>
                    <span className="shrink-0 text-[11px] text-ink-faint">
                      {timeAgo(item.createdAt)}
                    </span>
                  </span>
                  <span className="text-[12px] leading-snug text-ink-muted">{item.body}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
