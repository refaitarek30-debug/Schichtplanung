import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Kennung des gerade ausgelieferten Builds – für den Hinweis „Neue Version“. */
export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "lokal" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
