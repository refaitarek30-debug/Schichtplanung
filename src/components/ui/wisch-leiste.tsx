"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { useWischZu, type WischModus } from "@/components/privat/blatt";

/**
 * Feld, das sich nach unten wischen lässt – für die Leisten und Fenster, die
 * nicht als `Blatt` gebaut sind (z. B. im Schichtplan). Verhalten wie beim
 * Blatt: Das Feld folgt dem Finger und gleitet hinaus oder federt zurück;
 * ist sein Inhalt gescrollt, scrollt er erst. Wischt man in einem
 * Eingabefeld, passiert nichts (dort wird getippt und markiert).
 */
export function WischLeiste({
  onClose,
  modus = true,
  children,
  ...rest
}: { onClose: () => void; modus?: WischModus; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useWischZu(ref, modus, onClose);
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}
