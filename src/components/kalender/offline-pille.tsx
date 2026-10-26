"use client";

import { CloudUpload, WifiOff } from "lucide-react";
import { useOnline } from "@/lib/netz";

/**
 * Kleine Anzeige über der unteren Leiste: ohne Netz „Offline“, danach kurz,
 * solange offline angelegte Termine hochgeladen werden. Schwebt über dem
 * Kalender und nimmt ihm keinen Platz weg.
 */
export function OfflinePille({ wartend = 0 }: { wartend?: number }) {
  const online = useOnline();
  if (online && wartend === 0) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+5.2rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/85 px-3 py-1.5 text-[12px] font-medium text-white shadow-lg backdrop-blur"
    >
      {online ? <CloudUpload className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {online
        ? `${wartend === 1 ? "1 Termin wird" : `${wartend} Termine werden`} hochgeladen …`
        : `Offline · letzter Stand${wartend ? ` · ${wartend} ${wartend === 1 ? "Termin wartet" : "Termine warten"}` : ""}`}
    </div>
  );
}
