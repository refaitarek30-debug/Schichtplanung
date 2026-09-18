import { getAppSession } from "@/lib/auth/session";
import { PrivacySettingsForm } from "@/components/privacy/privacy-settings-form";
import { PageHeader } from "@/components/ui/page-header";
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
      <div className="space-y-5">
        <PageHeader
          eyebrow="Mein Konto"
          title="Datenschutz"
          description="Deine persönlichen Sichtbarkeitseinstellungen."
        />
        <p className="text-sm text-crit-fg">
          Die Datenschutzeinstellungen konnten nicht geladen werden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Konto"
        title="Datenschutz"
        description="Du kannst diese Einstellungen jederzeit ändern. Änderungen wirken sofort im Schichtplan."
      />
      <PrivacySettingsForm
        absenceVisibility={data.absence_visibility}
        sicknessVisibility={data.sickness_visibility}
        acknowledged={Boolean(data.accepted_at)}
      />
    </div>
  );
}
