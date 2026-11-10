"use client";

/**
 * Letzte Rettung, wenn selbst der Rahmen der App abstürzt (Fund P-14 aus docs/review).
 * Ersetzt die Standardseite von Next.js. Ohne globale Styles (die stehen hier nicht zur
 * Verfügung) – daher schlichte Inline-Styles, hell und dunkel nach Geräteeinstellung.
 */
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const nochmal = retry ?? reset ?? (() => window.location.reload());
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "Canvas",
          color: "CanvasText",
          colorScheme: "light dark",
        }}
      >
        <title>ShiftNexo – Störung</title>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>Da ist etwas schiefgelaufen.</p>
          <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 20px", opacity: 0.75 }}>
            ShiftNexo konnte gerade nicht geladen werden. Deine Daten sind davon nicht betroffen. Bitte versuche es
            gleich noch einmal.
            {error.digest ? <span style={{ display: "block", fontSize: 12, marginTop: 8 }}>Kennung: {error.digest}</span> : null}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => nochmal()}
              style={{
                border: 0,
                borderRadius: 12,
                padding: "10px 18px",
                fontSize: 15,
                fontWeight: 600,
                background: "#2F5BEA",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Erneut versuchen
            </button>
            {/* Bewusst ein echter Link: nach einem Absturz soll die Seite komplett neu laden. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                display: "inline-block",
                textDecoration: "none",
                border: "1px solid currentColor",
                borderRadius: 12,
                padding: "10px 18px",
                fontSize: 15,
                fontWeight: 600,
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              Zur Startseite
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
