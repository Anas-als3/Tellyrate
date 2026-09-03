import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

// Touches Prisma and cookies.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who is signed in, for the header alone.
 *
 * This endpoint exists so that reading a cookie does not force every public
 * page to render per-request. `cookies()` in a layout opts its whole subtree
 * into dynamic rendering, which would mean /about and /privacy — pure static
 * text — could never be cached, and no CDN could serve a facility page from
 * a point of presence near the reader.
 *
 * The trade is a brief flash of the signed-out header for signed-in visitors.
 * On a site that is overwhelmingly anonymous readers, that is the right way
 * round.
 */
export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json(
    { username: user?.username ?? null },
    {
      headers: {
        // Never let a shared cache hold one visitor's identity.
        "Cache-Control": "private, no-store",
      },
    },
  );
}
