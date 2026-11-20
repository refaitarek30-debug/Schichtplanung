import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Name einer Schichtgruppe: „Schicht A“ – aber nicht „Schicht Schicht A“, wenn sie schon so heißt. */
export function gruppenName(team: string): string {
  const t = team.trim();
  return /^schicht\b/i.test(t) ? t : `Schicht ${t}`;
}
