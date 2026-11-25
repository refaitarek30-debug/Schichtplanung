/**
 * CAPTCHA-Token aus dem Formular (Cloudflare Turnstile, siehe
 * src/components/auth/turnstile.tsx) für die Anmelde-Aufrufe bei Supabase.
 * Leer = kein Token; dann prüft Supabase nur, solange CAPTCHA dort aus ist.
 */
export function captchaOptionen(formData: FormData): { captchaToken?: string } {
  const t = String(formData.get("captcha") ?? "").trim();
  return t ? { captchaToken: t } : {};
}

/** Supabase-Fehler „captcha …“ in einen verständlichen Satz übersetzen. */
export function istCaptchaFehler(meldung: string | undefined | null): boolean {
  return !!meldung && /captcha/i.test(meldung);
}

export const CAPTCHA_HINWEIS =
  "Die Sicherheitsprüfung ist noch nicht fertig. Bitte kurz warten und noch einmal tippen.";
