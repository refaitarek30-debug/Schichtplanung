"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthBridgePage() {
  const [error, setError] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) {
        window.location.replace("/login?fehler=link");
        return;
      }

      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      const nextParam = new URLSearchParams(window.location.search).get("weiter");
      const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
        ? nextParam
        : type === "invite" || type === "recovery" ? "/passwort-neu" : "/dashboard";

      if (!accessToken || !refreshToken) {
        window.location.replace("/login?fehler=abgelaufen");
        return;
      }

      try {
        const supabase = createClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
        window.history.replaceState(null, "", "/auth/weiter");
        window.location.replace(next);
      } catch {
        setError(true);
      }
    };
    void run();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <p className="text-sm text-ink-muted" role={error ? "alert" : undefined}>
        {error ? "Der Link konnte nicht eingelöst werden. Bitte fordere einen neuen Link an." : "Anmeldung wird vorbereitet …"}
      </p>
    </main>
  );
}
