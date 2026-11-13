import { signOut } from "@/lib/auth/actions";
import { GESPERRT_TEXT } from "@/lib/auth/zwei-faktor";

export const metadata = { title: "Zugang gesperrt – ShiftNexo", robots: { index: false, follow: false } };

/** Nach 5 Fehlversuchen (Migration 0219): ehrlich sagen, was los ist, statt still umzuleiten. */
export default function GesperrtPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Zugang gesperrt</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{GESPERRT_TEXT}</p>
      <form action={signOut} className="mt-6">
        <button className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white">Abmelden</button>
      </form>
    </div>
  );
}
