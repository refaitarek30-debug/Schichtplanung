"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { fetchNotifyLeaveEmail } from "@/lib/data/notifications";
import { setNotifyLeaveEmail } from "@/lib/auth/settings-actions";

/**
 * Firmenweite Benachrichtigungs-Einstellung (nur Admin).
 * Die App-Benachrichtigung (Glocke) läuft immer; hier wird nur die
 * zusätzliche E-Mail an die Schichtleitung an- und ausgeschaltet.
 */
export function NotificationSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchNotifyLeaveEmail()
      .then(setEnabled)
      .catch(() => setEnabled(true));
  }, []);

  function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setEnabled(next);
    setMsg({});
    startTransition(async () => {
      const result = await setNotifyLeaveEmail(next);
      setMsg(result);
      if (result.error) setEnabled(!next);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Benachrichtigungen"
        hint="Wie die Schichtleitung über neue Urlaubsanträge informiert wird."
      />
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">E-Mail bei neuem Urlaubsantrag</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Die Schichtleitung bekommt zusätzlich zur Benachrichtigung in der App eine
              E-Mail. Die App-Benachrichtigung (Glocke) bleibt immer aktiv.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={enabled ?? false}
            disabled={enabled === null || pending}
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              enabled ? "bg-brand-500" : "bg-surface-sunken"
            } disabled:opacity-50`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {msg.error ? <Alert tone="error">{msg.error}</Alert> : null}
        {msg.success ? <Alert tone="success">{msg.success}</Alert> : null}
      </CardBody>
    </Card>
  );
}
