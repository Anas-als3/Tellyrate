"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recalcCommentVotes, recalcReviewVotes } from "@/lib/aggregates";
import {
  generateRecoveryCode,
  hashPassword,
  needsRehash,
  normalizeRecoveryCode,
  verifyPassword,
} from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { safeRedirectPath } from "@/lib/net";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  getCurrentUser,
} from "@/lib/session";
import { fold } from "@/lib/slug";

/**
 * Account actions.
 *
 * An account here is a username and a password and nothing else — no email, no
 * name, no school. That single decision shapes everything below: there is no
 * "reset link" to fall back on, so a recovery code is issued once at signup;
 * and there is no second factor to lean on, so the login path is written to
 * leak as little as possible about which usernames exist.
 */

/** The shape every form in this module speaks, via `useActionState`. */
export type AuthState = {
  /** Whole-form failure: bad credentials, throttling, an expired session. */
  error?: string;
  /** Keyed by input `name`, rendered against the field it belongs to. */
  fieldErrors?: Record<string, string>;
  /** Confirmation for the actions that stay on the page instead of redirecting. */
  ok?: string;
  /** Shown exactly once — only its hash is stored, so it cannot be re-shown. */
  recoveryCode?: string;
  /** Echoed back so a rejected form does not throw away what was typed. */
  username?: string;
  /**
   * The delete confirmation tick, echoed back for the same reason: React
   * resets a form once its action settles, so a wrong password would silently
   * clear the box and the next attempt would fail on the box instead.
   */
  confirmed?: boolean;
};

/**
 * One message for a missing account and for a wrong password alike. Telling
 * them apart would turn the login form into a directory of who has an account,
 * which on a site about anonymous testimony is the whole ballgame.
 */
const CREDENTIALS_MISMATCH = "That username and password don't match.";

const SESSION_EXPIRED = "Your session has expired. Sign in again.";

const USERNAME_MIN = 3;
const USERNAME_MAX = 24;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Passwords are capped as well as floored: scrypt happily burns CPU on a
 * megabyte of input, which is a free denial-of-service otherwise.
 */
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 200;

/**
 * Names that would let an account pose as the site or its moderators.
 * Compared after folding with the separators stripped, so `Admin`, `admin`,
 * `a-d-m-i-n` and `a_d_m_i_n` are all the same name to this check.
 */
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "tellyrate",
  "official",
  "support",
  "staff",
  "system",
  "root",
  "help",
  "team",
]);

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

const usernameField = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const reject = (message: string) =>
      ctx.addIssue({ code: "custom", message });

    if (value.length === 0) {
      reject("Choose a username.");
      return;
    }
    // Checked before the character rule so the message can say why, rather
    // than leaving someone to guess that "@" is what upset it.
    if (value.includes("@") || /\.(com|net|org|edu|sa)$/i.test(value)) {
      reject(
        "Invent a nickname, not an email address — we do not want your email.",
      );
      return;
    }
    if (value.length < USERNAME_MIN) {
      reject(`At least ${USERNAME_MIN} characters.`);
      return;
    }
    if (value.length > USERNAME_MAX) {
      reject(`At most ${USERNAME_MAX} characters.`);
      return;
    }
    if (!USERNAME_PATTERN.test(value)) {
      reject("Letters, numbers, hyphens and underscores only.");
    }
  });

const passwordField = z.string().superRefine((value, ctx) => {
  const reject = (message: string) => ctx.addIssue({ code: "custom", message });

  // Deliberately no character-class rule. Forcing a symbol and a digit pushes
  // people towards Passw0rd! — shorter, more guessable, and more likely to be
  // written on a lanyard card. Length is the requirement that actually helps.
  if (value.length < PASSWORD_MIN) {
    reject(`At least ${PASSWORD_MIN} characters.`);
    return;
  }
  if (value.length > PASSWORD_MAX) {
    reject(`At most ${PASSWORD_MAX} characters.`);
  }
});

const signUpSchema = z.object({
  username: usernameField,
  password: passwordField,
});

/**
 * Signing in validates loosely on purpose: the rules may change over time, and
 * an old account must never be locked out by a rule invented after it.
 */
const signInSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your username.")
    .max(64, "That is not a username here."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(PASSWORD_MAX, "That is not a password here."),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two new passwords do not match.",
      });
    }
    if (value.newPassword === value.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "That is already your password.",
      });
    }
  });

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm."),
  confirm: z
    .string()
    .refine((value) => value === "on", "Tick the box to confirm you understand."),
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** First issue per field wins — the schemas order their checks accordingly. */
function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

function retryPhrase(seconds: number): string {
  if (seconds <= 90) return `${Math.max(1, Math.round(seconds))} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Matched structurally rather than with `instanceof`, so this module never has
 * to pull the generated client's error classes into the action bundle.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * A throwaway hash to verify against when no such user exists, so a miss costs
 * the same ~110ms of scrypt as a hit and the response time stops being an
 * account-existence oracle. Memoised, and kicked off before the lookup branch
 * so that even the first miss in a fresh process is not the slow one.
 */
let decoyHash: Promise<string> | null = null;
function decoyPasswordHash(): Promise<string> {
  decoyHash ??= hashPassword(generateRecoveryCode());
  return decoyHash;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

export async function signUpAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // Guarded here rather than on the page. Next re-renders the page as part of
  // the action's response, so a page-level redirect for signed-in visitors
  // would fire the instant the account exists and carry the recovery code —
  // which is shown once and stored only as a hash — away with it.
  if (await getCurrentUser()) {
    return {
      error:
        "You are already signed in. Sign out first to create another account.",
    };
  }

  const username = text(formData, "username");
  const password = text(formData, "password");

  const parsed = signUpSchema.safeParse({ username, password });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), username };
  }

  // Throttle before any lookup, so the uniqueness check cannot be driven as a
  // free "does this username exist" oracle.
  const limit = await checkRateLimit("signup");
  if (!limit.ok) {
    return {
      error:
        "Too many accounts created from this connection. Try again in " +
        `${retryPhrase(limit.retryAfterSeconds)}.`,
      username,
    };
  }

  // Uniqueness is on the folded form, so `Nurse01` and `nurse01` cannot both
  // exist and be mistaken for each other in a comment thread.
  const usernameFold = fold(parsed.data.username);
  if (!usernameFold) {
    return {
      fieldErrors: { username: "Use at least one letter or number." },
      username,
    };
  }
  if (RESERVED_USERNAMES.has(usernameFold.replaceAll(" ", ""))) {
    return { fieldErrors: { username: "That username is reserved." }, username };
  }

  const taken = await prisma.user.findUnique({
    where: { usernameFold },
    select: { id: true },
  });
  if (taken) {
    return { fieldErrors: { username: "That username is taken." }, username };
  }

  const recoveryCode = generateRecoveryCode();
  const [passwordHash, recoveryCodeHash] = await Promise.all([
    hashPassword(parsed.data.password),
    // Hashed like a password, so a database leak cannot be replayed into
    // anyone's account — and so we cannot read it back out either.
    hashPassword(normalizeRecoveryCode(recoveryCode)),
  ]);

  try {
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        usernameFold,
        passwordHash,
        recoveryCodeHash,
      },
      select: { id: true },
    });

    await createSession(user.id);

    // No redirect, unlike signing in: the recovery code exists for exactly one
    // render and a redirect would carry it away unread. Nothing is revalidated
    // either — the page onward from here is reached by a full navigation, so
    // it renders against the new session anyway.
    return { recoveryCode, username: parsed.data.username };
  } catch (error) {
    // Two people can pass the check above in the same instant; the unique
    // index is the real arbiter, and losing that race is a form error, not a 500.
    if (isUniqueViolation(error)) {
      return {
        fieldErrors: {
          username: "That username was taken a moment ago. Try another.",
        },
        username,
      };
    }
    throw error;
  }
}

export async function logInAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = text(formData, "username");
  const password = text(formData, "password");
  const nextPath = safeRedirectPath(text(formData, "next"), "/");

  // Started now rather than inside the miss branch: computing it lazily would
  // make the first miss in a process measurably slower than any hit.
  const decoy = decoyPasswordHash();

  const parsed = signInSchema.safeParse({ username, password });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), username };
  }

  const limit = await checkRateLimit("login");
  if (!limit.ok) {
    return {
      error:
        "Too many sign-in attempts. Try again in " +
        `${retryPhrase(limit.retryAfterSeconds)}.`,
      username,
    };
  }

  const user = await prisma.user.findUnique({
    where: { usernameFold: fold(parsed.data.username) },
    select: { id: true, passwordHash: true, isBanned: true },
  });

  if (!user) {
    await verifyPassword(parsed.data.password, await decoy);
    return { error: CREDENTIALS_MISMATCH, username };
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: CREDENTIALS_MISMATCH, username };
  }

  // Checked only after the password, so a suspension notice cannot be used to
  // enumerate accounts.
  if (user.isBanned) {
    return {
      error: "This account has been suspended for breaking the posting rules.",
      username,
    };
  }

  // The one moment the plaintext is in hand, so the one moment an old hash can
  // be upgraded. Failure here is not worth blocking a sign-in over.
  if (needsRehash(user.passwordHash)) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(parsed.data.password) },
      })
      .catch(() => {});
  }

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect(nextPath);
}

/**
 * Declared without parameters so it fits both `<form action={logOutAction}>`
 * and `useActionState`. Deliberately not rate limited: refusing to sign
 * someone out would leave a live session behind, which is the opposite of
 * safe, and the action can only ever destroy the caller's own session.
 */
export async function logOutAction(): Promise<never> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function changePasswordAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const current = await getCurrentUser();
  if (!current) return { error: SESSION_EXPIRED };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    newPassword: text(formData, "newPassword"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  // Keyed to the account rather than the address: this is the same guessing
  // surface as the login form, reached from inside a session.
  const limit = await checkRateLimit("login", current.id);
  if (!limit.ok) {
    return {
      error: `Too many attempts. Try again in ${retryPhrase(
        limit.retryAfterSeconds,
      )}.`,
    };
  }

  const record = await prisma.user.findUnique({
    where: { id: current.id },
    select: { passwordHash: true },
  });
  if (!record) return { error: SESSION_EXPIRED };

  if (!(await verifyPassword(parsed.data.currentPassword, record.passwordHash))) {
    return { fieldErrors: { currentPassword: "That is not your current password." } };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: current.id },
    data: { passwordHash },
  });

  // Changing a password is what you do when you suspect someone else has it,
  // so every session goes — then this browser is signed straight back in, so
  // the person doing the responsible thing is not punished for it.
  await destroyAllSessions(current.id);
  await createSession(current.id);

  // No `revalidatePath`: nothing this page renders has changed, and a refresh
  // here would remount the form and discard the confirmation below.
  return {
    ok: "Password changed. Every other signed-in device has been signed out.",
  };
}

/** Takes no arguments for the same reason `logOutAction` does not. */
export async function signOutEverywhereAction(): Promise<AuthState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const limit = await checkRateLimit("login", current.id);
  if (!limit.ok) {
    return {
      error: `Too many attempts. Try again in ${retryPhrase(
        limit.retryAfterSeconds,
      )}.`,
    };
  }

  await destroyAllSessions(current.id);
  // The row for this browser is already gone; this only clears the cookie so
  // the next request does not carry a token that resolves to nothing.
  await destroySession();

  revalidatePath("/", "layout");
  redirect("/login");
}

export async function deleteAccountAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const current = await getCurrentUser();
  const confirmed = text(formData, "confirm") === "on";
  if (!current) return { error: SESSION_EXPIRED, confirmed };

  const parsed = deleteAccountSchema.safeParse({
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), confirmed };
  }

  const limit = await checkRateLimit("login", current.id);
  if (!limit.ok) {
    return {
      error: `Too many attempts. Try again in ${retryPhrase(
        limit.retryAfterSeconds,
      )}.`,
      confirmed,
    };
  }

  const record = await prisma.user.findUnique({
    where: { id: current.id },
    select: { passwordHash: true },
  });
  if (!record) return { error: SESSION_EXPIRED, confirmed };

  if (!(await verifyPassword(parsed.data.password, record.passwordHash))) {
    return {
      fieldErrors: { password: "That password is not right." },
      confirmed,
    };
  }

  await prisma.$transaction(
    async (tx) => {
      // Votes cascade away with the account, so the counters they fed have to
      // be rebuilt in the same transaction or reviews keep phantom likes.
      // Reviews and comments do not cascade — they are set to no author and
      // stay up as testimony, which is what the page promises.
      const [reviewVotes, commentVotes] = await Promise.all([
        tx.reviewVote.findMany({
          where: { userId: current.id },
          select: { reviewId: true },
        }),
        tx.commentVote.findMany({
          where: { userId: current.id },
          select: { commentId: true },
        }),
      ]);

      await tx.user.delete({ where: { id: current.id } });

      for (const reviewId of new Set(reviewVotes.map((v) => v.reviewId))) {
        await recalcReviewVotes(tx, reviewId);
      }
      for (const commentId of new Set(commentVotes.map((v) => v.commentId))) {
        await recalcCommentVotes(tx, commentId);
      }
    },
    // A heavy voter can own hundreds of rows; the default 5s window is too
    // tight to risk leaving the counters half-rebuilt.
    { timeout: 20_000 },
  );

  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
