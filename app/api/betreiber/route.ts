import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * Ist die angemeldete Person Betreiber? Nur dafür, den Link zur Betreiber-Seite
 * zu zeigen. Alle anderen bekommen 404 – wie die Seite selbst, damit niemand
 * herausfindet, dass es sie gibt.
 */
export async function GET() {
  const weg = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isSupabaseConfigured) return weg();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return weg();
    const { data } = await createAdminClient().rpc("is_platform_admin", { p_user_id: user.id });
    if (data !== true) return weg();
  } catch {
    return weg();
  }
  return NextResponse.json({ betreiber: true }, { headers: { "Cache-Control": "no-store" } });
}
