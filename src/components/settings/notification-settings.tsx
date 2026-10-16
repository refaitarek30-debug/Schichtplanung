"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { fetchNotifyLeaveEmail } from "@/lib/data/notifications";
import { setNotifyLeaveEmail } from "@/lib/auth/settings-actions";
import { Gruppe, Schalter, Zeile } from "./gruppe";

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
    <>
      <Gruppe titel="Benachrichtigungen" hinweis="Die Benachrichtigung in der App (Glocke) bleibt immer aktiv.">
        <Zeile
          titel="E-Mail bei neuem Urlaubsantrag"
          text="Die Schichtleitung bekommt zusätzlich eine E-Mail."
          rechts={<Schalter an={enabled ?? false} onClick={toggle} disabled={enabled === null || pending} label="E-Mail bei neuem Urlaubsantrag" />}
          inline
        />
      </Gruppe>
      {msg.error ? <Alert tone="error">{msg.error}</Alert> : null}
      {msg.success ? <Alert tone="success">{msg.success}</Alert> : null}
    </>
  );
}
