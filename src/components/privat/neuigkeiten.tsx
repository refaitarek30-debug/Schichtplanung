"use client";

import { useState } from "react";
import { NeuigkeitenBasis, useNeuigkeitenStand } from "@/components/layout/neuigkeiten";
import { usePrivat } from "@/components/privat/kontext";
import { createClient } from "@/lib/supabase/client";

/** Glühbirne im Privatbereich: eigene Einträge, „gelesen“ in `privat_konten` (Migration 0194). */
export function PrivatNeuigkeiten({ rund = true, nurWennNeu = false, className }: { rund?: boolean; nurWennNeu?: boolean; className?: string }) {
  const { konto } = usePrivat();
  const [gesehen, setGesehen] = useState<string | null>(konto.neuigkeitenGesehen);
  const stand = useNeuigkeitenStand(`${konto.userId}:privat`, "privat", gesehen, () => {
    setGesehen(new Date().toISOString());
    void createClient().rpc("privat_neuigkeiten_gelesen");
  });
  return <NeuigkeitenBasis rund={rund} nurWennNeu={nurWennNeu} className={className} {...stand} />;
}
