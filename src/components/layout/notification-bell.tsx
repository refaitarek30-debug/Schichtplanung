"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const { mode, profile } = useSession();
  const employeeId = profile.employeeId;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LiveNotification[] | null>(null);
  const wurzel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (mode !== "live") return;
    // Ohne verknüpften Mitarbeiter gibt es keine eigenen Benachrichtigungen
    // -- sie werden je Mitarbeiter angelegt.
    if (!employeeId) {
      setItems([]);
      return;
    }
    try {
      setItems(await fetchNotifications(employeeId));
    } catch {
      setItems([]);
    }
  }, [mode, employeeId]);

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

  // Schließen, wenn daneben getippt oder Escape gedrückt wird. Auf dem
  // Handy deckt das Feld sonst den halben Bildschirm ab und es gibt keinen
  // offensichtlichen Weg zurück.
  useEffect(() => {
    if (!open) return;
    function beiKlick(e: MouseEvent) {
      if (!wurzel.current?.contains(e.target as Node)) setOpen(false);
    }
    function beiTaste(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
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
    <div className="relative" ref={wurzel}>
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
        // Auf dem Handy sass das Feld rechtsbuendig an der Glocke -- und die
        // steht nicht am Bildschirmrand, sondern links vom Benutzerknopf.
        // Bei 320 px Breite ragte es dadurch 30 px links aus dem Bild;
        // gemessen auf einem 390 px breiten Geraet. Deshalb spannt es sich
        // dort jetzt fest zwischen beide Raender, statt an der Glocke zu
        // haengen. Ab sm bleibt alles wie gehabt.
        <div className="fixed inset-x-2 top-[60px] z-30 rounded-2xl border border-line bg-surface p-2 shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
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
