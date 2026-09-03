"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/ratelimit";
import { getCurrentUser } from "@/lib/session";
import { fold, shortId, slugWithSuffix } from "@/lib/slug";
import { FacilityKind } from "@/generated/prisma/client";

/**
 * Adding a facility.
 *
 * Duplicates are the failure mode that kills a directory: three records for
 * one hospital means three sets of reviews, none of which is the truth. So the
 * flow is search-first, and the "I searched and none of these matched" claim is
 * carried by a signed token rather than by a disabled button. A disabled button
 * is a client-side suggestion; a POST with no valid token is refused here, on
 * the server, which is the only place a rule like this can actually hold.
 */

export type FacilityFieldErrors = Record<string, string>;

export type DuplicateFacility = {
  slug: string;
  name: string;
  nameLocal: string | null;
  cityName: string;
  reviewCount: number;
};

export type FacilityActionState =
  | { status: "idle" }
  | { status: "auth"; message: string }
  | { status: "error"; message: string; fieldErrors: FacilityFieldErrors }
  /** Found at submit time, after the client-side search was skipped or missed. */
  | { status: "duplicate"; message: string; facility: DuplicateFacility }
  | { status: "created"; message: string; slug: string; href: string };

// ---------------------------------------------------------------------------
// Search tokens
// ---------------------------------------------------------------------------

/**
 * Ten minutes is long enough to fill in the form and short enough that a token
 * cannot be minted once and reused for a week of submissions.
 */
const TOKEN_TTL_MS = 10 * 60 * 1000;
const MIN_QUERY_LENGTH = 2;

function tokenSecret(): string {
  // Same fallback as the rate limiter: absent in development, required in
  // production by lib/env.ts, so this can never silently sign with a constant
  // in a deployment that matters.
  return process.env.IP_HASH_SECRET ?? "hospirate-development-only";
}

function sign(payload: string): string {
  return createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Mint proof that a search actually ran, for the query it ran on.
 *
 * The folded query is inside the payload rather than sent alongside it, so
 * verification never has to trust a value the client hands back.
 *
 * Every export of a `"use server"` module is reachable as an action, so this
 * one is callable from a browser. That costs nothing: the search route hands
 * the same token to anyone who asks. The token is a speed bump against
 * accidental duplicates, not an authorisation check — the duplicate search at
 * submit is what actually protects the directory.
 */
export async function issueSearchToken(query: string): Promise<string | null> {
  const folded = fold(query);
  if (folded.length < MIN_QUERY_LENGTH) return null;

  const payload = `${Date.now()}.${Buffer.from(folded, "utf8").toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export async function verifySearchToken(
  token: string | null | undefined,
): Promise<{ ok: boolean; query: string }> {
  if (!token) return { ok: false, query: "" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, query: "" };

  const [issuedAt, encodedQuery, signature] = parts;
  const payload = `${issuedAt}.${encodedQuery}`;
  if (!constantTimeEquals(signature, sign(payload))) {
    return { ok: false, query: "" };
  }

  const issued = Number(issuedAt);
  if (!Number.isFinite(issued)) return { ok: false, query: "" };

  const age = Date.now() - issued;
  // A future timestamp means a forged or replayed payload, not a slow clock.
  if (age < -60_000 || age > TOKEN_TTL_MS) return { ok: false, query: "" };

  const query = Buffer.from(encodedQuery, "base64url").toString("utf8");
  if (fold(query).length < MIN_QUERY_LENGTH) return { ok: false, query: "" };

  return { ok: true, query };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Words that describe every second facility in the country and therefore carry
 * no matching signal. Dropping them keeps "Al Noor Medical Center" from
 * matching "Riyadh Medical Center" on the strength of two shared words.
 */
const GENERIC_TOKENS = new Set([
  "hospital",
  "hospitals",
  "clinic",
  "clinics",
  "polyclinic",
  "medical",
  "medicine",
  "center",
  "centre",
  "complex",
  "health",
  "healthcare",
  "care",
  "dental",
  "dentistry",
  "pharmacy",
  "laboratory",
  "lab",
  "labs",
  "general",
  "specialist",
  "specialized",
  "the",
  "and",
  "for",
  "of",
  "al",
  "el",
  "مستشفى",
  "مستشفي",
  "مركز",
  "عيادة",
  "عيادات",
  "مجمع",
  "صحي",
  "صحية",
  "طبي",
  "طبية",
  "الطبي",
  "الطبية",
  "صيدلية",
  "مختبر",
]);

function distinctiveTokens(folded: string): string[] {
  return folded
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token))
    .sort((a, b) => b.length - a.length);
}

/**
 * Are these two folded names plausibly the same place? Deliberately generous:
 * a false positive costs one extra click on "no, mine is different", while a
 * false negative costs the directory a permanent duplicate.
 */
function isLikelyDuplicate(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;

  // "King Fahad Hospital" inside "King Fahad Hospital Riyadh".
  if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) {
    return true;
  }

  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  if (shared < 2) return false;

  const union = new Set([...setA, ...setB]).size;
  return union > 0 && shared / union >= 0.6;
}

/**
 * Look for an existing record of the same place in the same city.
 *
 * Narrowed in SQL by the most distinctive words in the name, then compared on
 * folded forms in memory — Postgres cannot fold the way `lib/slug` does, and a
 * city can hold several hundred facilities, which is too many to scan per
 * submission.
 */
async function findExistingFacility(
  cityId: string,
  name: string,
  nameLocal?: string,
): Promise<DuplicateFacility | null> {
  const foldedName = fold(name);
  const foldedLocal = nameLocal ? fold(nameLocal) : "";

  const probes = [
    ...distinctiveTokens(foldedName).slice(0, 3),
    ...distinctiveTokens(foldedLocal).slice(0, 2),
  ];
  // A name made entirely of generic words still deserves a check.
  if (probes.length === 0) probes.push(foldedName.slice(0, 24));

  const candidates = await prisma.facility.findMany({
    where: {
      cityId,
      status: { in: ["PUBLISHED", "PENDING"] },
      OR: probes.flatMap((probe) => [
        { name: { contains: probe, mode: "insensitive" as const } },
        { nameEn: { contains: probe, mode: "insensitive" as const } },
        { nameLocal: { contains: probe } },
      ]),
    },
    take: 60,
    orderBy: { reviewCount: "desc" },
    select: {
      slug: true,
      name: true,
      nameEn: true,
      nameLocal: true,
      reviewCount: true,
      city: { select: { name: true } },
    },
  });

  for (const candidate of candidates) {
    const existing = [candidate.name, candidate.nameEn, candidate.nameLocal]
      .filter((value): value is string => Boolean(value))
      .map(fold);

    const mine = [foldedName, foldedLocal].filter(Boolean);

    const matched = existing.some((left) =>
      mine.some((right) => isLikelyDuplicate(left, right)),
    );

    if (matched) {
      return {
        slug: candidate.slug,
        name: candidate.name,
        nameLocal: candidate.nameLocal,
        cityName: candidate.city.name,
        reviewCount: candidate.reviewCount,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * A missing field and a blank one mean the same thing here. `formData.get`
 * returns `null` for a field the form never sent, and without this an older
 * cached page that omits an optional input fails validation on a field the
 * person never saw.
 */
const emptyToUndefined = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  return typeof value === "string" && value.trim() === "" ? undefined : value;
};

/** People type "riyadhclinic.com"; a bare hostname is not a parse error worth showing. */
const withScheme = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const facilitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the place its full name")
    .max(120, "That name is too long for the directory"),
  citySlug: z.string().trim().min(1, "Choose the city it is in"),
  kind: z.enum(FacilityKind, "Choose what kind of place this is"),
  nameLocal: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(120, "Keep the local name under 120 characters").optional(),
  ),
  address: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(200, "Keep the address short — street and district is plenty").optional(),
  ),
  website: z.preprocess(
    withScheme,
    z
      .url("That does not look like a web address")
      .max(300, "That web address is too long")
      .refine(
        (value) => /^https?:\/\//i.test(value),
        "Only http and https addresses are accepted",
      )
      .optional(),
  ),
});

function collectFieldErrors(error: z.ZodError): FacilityFieldErrors {
  const fieldErrors: FacilityFieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function createFacilityAction(
  _prevState: FacilityActionState,
  formData: FormData,
): Promise<FacilityActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "auth",
      message:
        "Adding a place needs an account — a username and a password, nothing else.",
    };
  }

  const token = await verifySearchToken(
    typeof formData.get("searchToken") === "string"
      ? String(formData.get("searchToken"))
      : null,
  );
  if (!token.ok) {
    return {
      status: "error",
      message:
        "Search for the place first — most of the time it is already here. Type its name above and we will check.",
      fieldErrors: {},
    };
  }

  const field = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  const parsed = facilitySchema.safeParse({
    name: field("name"),
    citySlug: field("citySlug"),
    kind: field("kind"),
    nameLocal: field("nameLocal"),
    address: field("address"),
    website: field("website"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "A couple of things need fixing before this can be added.",
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isBanned: true },
  });
  if (!account || account.isBanned) {
    return {
      status: "error",
      message: "This account cannot add places.",
      fieldErrors: {},
    };
  }

  const limit = await checkRateLimit("facility", user.id);
  if (!limit.ok) {
    return {
      status: "error",
      message:
        "You have added several places today. Try again tomorrow — new records are reviewed by hand.",
      fieldErrors: {},
    };
  }

  const city = await prisma.city.findUnique({
    where: { slug: parsed.data.citySlug },
    select: { id: true },
  });
  if (!city) {
    return {
      status: "error",
      message: "That city is not one we cover yet.",
      fieldErrors: { citySlug: "Choose a city from the list" },
    };
  }

  const existing = await findExistingFacility(
    city.id,
    parsed.data.name,
    parsed.data.nameLocal,
  );
  if (existing) {
    return {
      status: "duplicate",
      message: "We already have a record that looks like this one.",
      facility: existing,
    };
  }

  const data = {
    name: parsed.data.name,
    nameLocal: parsed.data.nameLocal ?? null,
    kind: parsed.data.kind,
    cityId: city.id,
    address: parsed.data.address ?? null,
    website: parsed.data.website ?? null,
    // Held out of the directory listings until a review vouches for it, but
    // immediately linkable and reviewable so the person who added it — and
    // anyone they send the link to — can use it right away.
    status: "PENDING" as const,
    source: "USER_SUBMITTED" as const,
    submittedById: user.id,
  };

  let slug = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidateSlug = slugWithSuffix(parsed.data.name, shortId());
    try {
      const created = await prisma.facility.create({
        data: { ...data, slug: candidateSlug },
        select: { slug: true },
      });
      slug = created.slug;
      break;
    } catch (error) {
      // The random suffix collides roughly never; one retry covers it, and a
      // second failure is a real error rather than bad luck.
      if (isUniqueViolation(error) && attempt === 0) continue;
      return {
        status: "error",
        message: "Something went wrong adding that. Try again in a moment.",
        fieldErrors: {},
      };
    }
  }

  if (!slug) {
    return {
      status: "error",
      message: "Something went wrong adding that. Try again in a moment.",
      fieldErrors: {},
    };
  }

  // The record is PENDING, so no list page changes — but its own URL may hold
  // a cached 404 from someone who guessed at it.
  revalidatePath(`/facilities/${slug}`);
  revalidatePath("/facilities");

  return {
    status: "created",
    message: "Added. It stays off the directory listings until it has a review.",
    slug,
    href: `/facilities/${slug}/review`,
  };
}
