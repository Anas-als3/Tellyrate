import { revalidatePath } from "next/cache";

import { destroySession, getCurrentUser } from "@/lib/session";

/**
 * Signing out.
 *
 * A route handler rather than a server action so the header's sign-out works
 * with scripting turned off, as a plain form post.
 *
 * Deliberately not rate limited: refusing to sign someone out would leave a
 * live session behind on a shared ward computer, which is the failure that
 * actually matters here.
 */

/** Relative `Location`, so a spoofed Host header cannot rewrite the target. */
function seeOther(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}

/**
 * Same-origin check, on fetch metadata rather than `Origin`.
 *
 * `Origin` is the obvious header to use and the wrong one here: this site
 * sends `Referrer-Policy: no-referrer`, and a browser that is not allowed to
 * disclose the referrer of a navigation serialises its origin as `null` too —
 * so a perfectly ordinary sign-out button arrives looking cross-origin.
 * `Sec-Fetch-Site` is unaffected by that, cannot be set from script, and says
 * exactly what we need to know. `none` covers a URL typed or bookmarked by
 * hand. The `Origin` comparison stays as the fallback for a browser too old to
 * send fetch metadata; a missing or opaque origin is allowed there rather than
 * leaving those people unable to sign out at all.
 */
function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return true;

  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }

  if (host === request.headers.get("host")) return true;

  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return host === new URL(configured).host;
    } catch {
      return false;
    }
  }

  return false;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return new Response("Cross-origin sign-out refused.", { status: 403 });
  }

  await destroySession();
  // The header renders differently for a signed-in reader, and it is cached
  // per layout — so the layout is what has to be dropped.
  revalidatePath("/", "layout");

  return seeOther("/");
}

/**
 * A GET must not change state: prefetchers, link scanners and an `<img>` tag
 * on someone else's site would all sign people out at random. It goes to the
 * account page instead, which asks first.
 */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  return seeOther(user ? "/account?signout=1" : "/");
}
