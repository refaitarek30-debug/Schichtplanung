import { getAppSession } from "@/lib/auth/session";
import { PrivacySettingsForm } from "@/components/privacy/privacy-settings-form";
import { ProfilRahmen } from "../rahmen";
import { MeineDatenKnopf } from "@/components/privacy/meine-daten-knopf";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PrivacySettingsPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("privacy_settings")
    .select(
      "absence_visibility, sickness_visibility, privacy_notice_version, accepted_at, updated_at",
    )
    .eq("user_id", session.profile.id)
    .maybeSingle();

  if (error || !data) {
    return (
      <ProfilRahmen aktiv="datenschutz">
        <p className="text-sm text-crit-fg">Die Datenschutzeinstellungen konnten nicht geladen werden.</p>
      </ProfilRahmen>
    );
  }

  return (
    <ProfilRahmen aktiv="datenschutz">
      <PrivacySettingsForm
        absenceVisibility={data.absence_visibility}
        sicknessVisibility={data.sickness_visibility}
        acknowledged={Boolean(data.accepted_at)}
      />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <MeineDatenKnopf />
      </div>
    </ProfilRahmen>
  );
}
