import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { clientAddress, normaliseAddress } from "@/lib/net";

/**
 * Rate limiting without surveillance.
 *
 * Throttling normally means keeping a log of who did what from where, which is
 * exactly what this site promises not to do. The compromise: an address is
 * never stored, only an HMAC of it keyed by a secret plus the current date.
 * That is stable enough to count requests within a day, and useless afterwards
 * — yesterday's bucket cannot be linked to today's, so the table cannot be
 * turned into a history of anyone's activity.
 */

export type RateLimitRule = {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export const RATE_LIMITS = {
  signup: { limit: 5, windowSeconds: 60 * 60 },
  login: { limit: 10, windowSeconds: 15 * 60 },
  review: { limit: 10, windowSeconds: 60 * 60 * 24 },
  comment: { limit: 30, windowSeconds: 60 * 60 },
  vote: { limit: 200, windowSeconds: 60 * 60 },
  facility: { limit: 10, windowSeconds: 60 * 60 * 24 },
  report: { limit: 20, windowSeconds: 60 * 60 * 24 },
  search: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/**
 * Pseudonymise the caller's address. The salt changes at midnight UTC, so the
 * resulting identifier has a lifetime of at most one day by construction and
 * cannot be joined across days into a history of anyone's activity.
 */
async function clientFingerprint(): Promise<string> {
  const secret = process.env.IP_HASH_SECRET ?? "hospirate-development-only";
  const store = await headers();

  const address = normaliseAddress(
    clientAddress(store.get("x-forwarded-for"), store.get("x-real-ip")),
  );

  const day = new Date().toISOString().slice(0, 10);

  return createHmac("sha256", `${secret}:${day}`)
    .update(address)
    .digest("base64url")
    .slice(0, 24);
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Consume one unit from a fixed window. Keyed by user id when signed in, and
 * by the day-scoped address hash otherwise.
 */
export async function checkRateLimit(
  action: RateLimitAction,
  userId?: string | null,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[action];
  const subject = userId ? `u:${userId}` : `a:${await clientFingerprint()}`;
  const bucket = `${action}:${subject}`;
  const now = new Date();

  try {
    // Upsert-then-check keeps this to a single round trip in the common case.
    const existing = await prisma.rateLimit.findUnique({ where: { bucket } });

    if (!existing || existing.resetAt <= now) {
      await prisma.rateLimit.upsert({
        where: { bucket },
        create: {
          bucket,
          count: 1,
          resetAt: new Date(now.getTime() + rule.windowSeconds * 1000),
        },
        update: {
          count: 1,
          resetAt: new Date(now.getTime() + rule.windowSeconds * 1000),
        },
      });
      return { ok: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
    }

    if (existing.count >= rule.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000),
        ),
      };
    }

    const updated = await prisma.rateLimit.update({
      where: { bucket },
      data: { count: { increment: 1 } },
    });

    return {
      ok: updated.count <= rule.limit,
      remaining: Math.max(0, rule.limit - updated.count),
      retryAfterSeconds: 0,
    };
  } catch {
    // A throttling outage must not take the site down with it. Failing open is
    // the right call for a site with no payments and no destructive actions.
    return { ok: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
}

/** Housekeeping: drop expired windows. Safe to call from a cron job. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { resetAt: { lt: new Date() } },
  });
  return count;
}
