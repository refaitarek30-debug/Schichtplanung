import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Neues Passwort – ShiftNexo" };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ mit?: string }> }) {
  const { mit } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Neues Passwort setzen</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {mit === "code" ? "Der Code stimmt. " : ""}
        Mindestens 8 Zeichen, zweimal eingeben. Danach bist du direkt angemeldet.
      </p>
      <NewPasswordForm />
      {mit === "code" ? (
        <p className="mt-5 text-[12.5px] leading-relaxed text-ink-faint">
          Privatkonto? Dein Wiederherstellungs-Code ist jetzt verbraucht. Erzeuge dir danach unter „Mehr“ einen neuen.
        </p>
      ) : null}
    </div>
  );
}
