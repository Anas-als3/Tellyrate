/**
 * Address handling and redirect validation. Pure functions, deliberately free
 * of any server-only imports so they can be unit-tested directly.
 */

/**
 * Reduce an address to the unit we actually want to throttle.
 *
 * IPv6 is the trap: a phone using SLAAC privacy extensions rotates the
 * interface identifier of its address routinely, so hashing the full address
 * hands one device an unlimited supply of fresh rate-limit buckets. Truncating
 * to the /64 prefix — the smallest block allocated as a unit — closes that.
 * IPv4 is used whole.
 */
export function normaliseAddress(raw: string): string {
  const ip = raw.trim().replace(/^\[|\]$/g, "");

  if (ip.includes(":") && !ip.includes(".")) {
    const parts = ip.split("::");
    let hextets: string[];
    if (parts.length === 2) {
      const head = parts[0] ? parts[0].split(":") : [];
      const tail = parts[1] ? parts[1].split(":") : [];
      const gap = Math.max(0, 8 - head.length - tail.length);
      hextets = [...head, ...Array(gap).fill("0"), ...tail];
    } else {
      hextets = ip.split(":");
    }
    return hextets
      .slice(0, 4)
      .map((h) => (h || "0").padStart(4, "0"))
      .join(":");
  }

  return ip;
}

/**
 * Pull the client address out of `X-Forwarded-For`.
 *
 * Taking the leftmost entry — the common shortcut — is wrong and exploitable:
 * that entry is whatever the *client* sent, so anyone can spoof it and mint a
 * fresh rate-limit bucket per request. Only entries appended by infrastructure
 * we control are trustworthy, and those are on the right. `TRUSTED_PROXY_HOPS`
 * says how many proxies sit in front of the app (1 on Vercel or behind a
 * single nginx; raise it if you put a CDN in front).
 */
export function clientAddress(
  forwarded: string | null,
  realIp: string | null,
  trustedHops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1),
): string {
  if (forwarded) {
    const hops = Math.max(1, Number.isFinite(trustedHops) ? trustedHops : 1);
    const chain = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (chain.length > 0) {
      return chain[Math.max(0, chain.length - hops)];
    }
  }
  if (realIp?.trim()) return realIp.trim();
  return "unknown";
}

const BACKSLASH = 0x5c;
const DELETE = 0x7f;
const FIRST_PRINTABLE = 0x20;

/**
 * Backslashes and control characters are the URL-parser confusion vectors.
 * Checked by code point rather than a regex so the source stays free of the
 * literal control characters such a pattern would otherwise embed.
 */
function hasForbiddenChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < FIRST_PRINTABLE || code === DELETE || code === BACKSLASH) {
      return true;
    }
  }
  return false;
}

/**
 * Validate a post-login redirect target.
 *
 * The obvious rule — "must start with a slash and not two" — is bypassable:
 * a path of `/` followed by a backslash and a hostname resolves to that
 * external origin, because the URL parser treats a backslash as a path
 * separator. Rejecting backslashes and control characters, then re-parsing
 * against a throwaway origin and confirming that origin survived, closes it.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (hasForbiddenChar(value)) return fallback;

  try {
    const probe = new URL(value, "https://tellyrate.invalid");
    if (probe.origin !== "https://tellyrate.invalid") return fallback;
    return probe.pathname + probe.search + probe.hash;
  } catch {
    return fallback;
  }
}
