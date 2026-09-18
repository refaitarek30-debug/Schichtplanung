"use client";

import { useEffect, useState } from "react";
import { PrivacySettingsForm } from "@/components/privacy/privacy-settings-form";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export function PrivacySettingsPanel() {
  const [settings, setSettings] = useState<{
    absence_visibility: "minimal" | "shift";
    sickness_visibility: "private" | "shift";
    accepted_at: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const { data, error: loadError } = await supabase
          .from("privacy_settings")
          .select("absence_visibility, sickness_visibility, accepted_at")
          .maybeSingle();

        if (loadError) throw loadError;
        if (active) setSettings(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Datenschutzeinstellungen konnten nicht geladen werden.",
          );
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-crit-fg">
        {error}
      </p>
    );
  }

  if (!settings) {
    return <p className="text-sm text-ink-muted">Datenschutzeinstellungen werden geladen …</p>;
  }

  return (
    <PrivacySettingsForm
      absenceVisibility={settings.absence_visibility}
      sicknessVisibility={settings.sickness_visibility}
      acknowledged={Boolean(settings.accepted_at)}
    />
  );
}
