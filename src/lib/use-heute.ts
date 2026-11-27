"use client";

import { useState } from "react";
import { heuteInBerlin } from "./dates";

/**
 * Heute in deutscher Zeit, beim ersten Zeichnen bestimmt – auf dem Server je
 * Aufruf, nicht einmal beim Start (eine Server-Instanz kann über Mitternacht
 * laufen). So zeigen Server und Browser denselben Tag.
 */
export function useHeute(): string {
  const [heute] = useState(heuteInBerlin);
  return heute;
}
