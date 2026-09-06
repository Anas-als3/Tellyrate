import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { generateSessionToken, hashToken } from "@/lib/crypto";

export const SESSION_COOKIE = "tellyrate_session";

/** Sessions last 30 days and are slid forward once they are half spent. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_RENEW_AFTER_MS = SESSION_TTL_MS / 2;

/**
 * The cookie deliberately outlives the session it carries.
 *
 * The database row is the authority: `getCurrentUser` checks `expiresAt` on
 * every request and deletes the row once it passes, so a stale cookie grants
 * nothing. Giving the cookie the same 30 days would quietly break the sliding
 * renewal below — the row would be extended to day 60 while the browser threw
 * the cookie away on day 30, logging out exactly the people who kept using the
 * site. The renewal cannot re-issue the cookie itself, because `cookies().set`
 * is only allowed in a server action or route handler, and this runs during a
 * page render.
 *
 * 400 days is the ceiling Chrome enforces on cookie lifetime; anything longer
 * is silently clamped.
 */
const SESSION_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export type SessionUser = {
  id: string;
  username: string;
  createdAt: Date;
};

/**
 * Issue a session and set its cookie. Only the SHA-256 digest of the token is
 * written to the database, so a dump of the sessions table cannot be replayed.
 */
export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken();

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Resolve the signed-in user, or null. Wrapped in React's `cache` so that a
 * page rendering a header, a sidebar and a review list still costs one query
 * per request rather than one per component.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, username: true, createdAt: true } },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Slide the expiry so active users are not logged out mid-visit. Writing on
  // every request would be wasteful, so only do it past the halfway mark.
  if (session.expiresAt.getTime() - Date.now() < SESSION_RENEW_AFTER_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => {});
  }

  return session.user;
});

/** Sign out of this device. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }

  store.delete(SESSION_COOKIE);
}

/** Sign out everywhere — the only remedy available if a password leaks. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
