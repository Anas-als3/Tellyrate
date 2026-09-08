"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recalcCity, recalcFacility } from "@/lib/aggregates";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/ratelimit";
import { getCurrentUser } from "@/lib/session";
import {
  RotationSpecialty,
  StudentField,
  TraineeRole,
} from "@/generated/prisma/client";

/**
 * Writing, editing and withdrawing a review.
 *
 * The one structural decision here: a signed-out submission is answered with
 * an `auth` result rather than a `redirect()`. A redirect from a server action
 * unmounts the form, and with it the six hundred words somebody just typed —
 * the client needs to stay alive long enough to flush its draft to storage and
 * put a sign-in link on screen. Losing a review to a login wall is the single
 * most expensive thing this form could do.
 */

export type ReviewFieldErrors = Record<string, string>;

export type ReviewActionState =
  /** Nothing submitted yet. */
  | { status: "idle" }
  /** Not signed in — the form shows sign-in links and keeps the draft. */
  | { status: "auth"; message: string }
  | { status: "error"; message: string; fieldErrors: ReviewFieldErrors }
  /** One review per person per facility; point them at the one they have. */
  | { status: "duplicate"; message: string; href: string }
  | { status: "posted"; message: string; href: string }
  | { status: "updated"; message: string; href: string }
  | { status: "deleted"; message: string; href: string };

/** Sub-ratings are optional, so an untouched radio group must read as absent. */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalRating = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .int("Ratings are whole stars")
    .min(1, "Ratings run from 1 to 5")
    .max(5, "Ratings run from 1 to 5")
    .optional(),
);

const MIN_BODY = 120;
const MAX_BODY = 8000;

/** Kept a little wider than the picker offers, so an edge case is not a wall. */
function yearWindow() {
  const now = new Date().getUTCFullYear();
  return { min: now - 11, max: now };
}

const reviewSchema = z.object({
  overall: z.coerce
    .number()
    .int("Pick a whole number of stars")
    .min(1, "Give the placement an overall rating")
    .max(5, "Give the placement an overall rating"),
  body: z
    .string()
    .trim()
    .min(MIN_BODY, `Write at least ${MIN_BODY} characters so it is useful`)
    .max(MAX_BODY, "That is longer than the form accepts — trim it a little"),
  field: z.enum(StudentField, "Tell us what you were training in"),
  title: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(3, "A headline needs a few words, or leave it blank")
      .max(120, "Keep the headline under 120 characters")
      .optional(),
  ),
  // Paired with `field`, this is what lets a reader weigh the review — a
  // first-week student and a second-year resident describe different places.
  role: z.enum(TraineeRole, "Say what you were there as"),
  specialty: z.preprocess(
    emptyToUndefined,
    z.enum(RotationSpecialty, "Choose a rotation specialty from the list").optional(),
  ),
  department: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(60, "A department name, not a description")
      .optional(),
  ),
  trainingYear: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int()
      .refine((year) => {
        const { min, max } = yearWindow();
        return year >= min && year <= max;
      }, "Pick a year from the list")
      .optional(),
  ),
  supervision: optionalRating,
  handsOn: optionalRating,
  staffRespect: optionalRating,
  workload: optionalRating,
  resources: optionalRating,
  safety: optionalRating,
});

type ReviewInput = z.infer<typeof reviewSchema>;

function readReviewFields(formData: FormData) {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    overall: get("overall"),
    body: get("body"),
    field: get("field"),
    title: get("title"),
    role: get("role"),
    specialty: get("specialty"),
    department: get("department"),
    trainingYear: get("trainingYear"),
    supervision: get("supervision"),
    handsOn: get("handsOn"),
    staffRespect: get("staffRespect"),
    workload: get("workload"),
    resources: get("resources"),
    safety: get("safety"),
  };
}

function collectFieldErrors(error: z.ZodError): ReviewFieldErrors {
  const fieldErrors: ReviewFieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    // First issue per field wins; a stack of messages under one input is noise.
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * Prisma's error classes travel badly across driver-adapter boundaries and
 * bundler copies, so identify the unique-constraint violation by its code
 * rather than by `instanceof`.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

const RATE_LIMITED =
  "You have posted a lot today. Try again in a few hours — the limit is there to keep the site readable.";

function reviewPayload(input: ReviewInput) {
  return {
    overall: input.overall,
    body: input.body,
    field: input.field,
    title: input.title ?? null,
    role: input.role,
    specialty: input.specialty ?? null,
    department: input.department ?? null,
    trainingYear: input.trainingYear ?? null,
    supervision: input.supervision ?? null,
    handsOn: input.handsOn ?? null,
    staffRespect: input.staffRespect ?? null,
    workload: input.workload ?? null,
    resources: input.resources ?? null,
    safety: input.safety ?? null,
  };
}

/** One place to invalidate, so an edit and a delete cannot drift apart. */
function revalidateFacility(facilitySlug: string, citySlug: string) {
  revalidatePath(`/facilities/${facilitySlug}`);
  revalidatePath(`/cities/${citySlug}`);
  revalidatePath("/facilities");
  revalidatePath("/");
}

export async function submitReviewAction(
  _prevState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const facilitySlug = String(formData.get("facilitySlug") ?? "");
  if (!facilitySlug) {
    return {
      status: "error",
      message: "That placement could not be identified. Reload and try again.",
      fieldErrors: {},
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "auth",
      message:
        "Your review is saved on this device. Sign in and it will be waiting.",
    };
  }

  const parsed = reviewSchema.safeParse(readReviewFields(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "A couple of things need fixing before this can post.",
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const [account, facility] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { isBanned: true },
    }),
    prisma.facility.findFirst({
      where: { slug: facilitySlug, status: { in: ["PUBLISHED", "PENDING"] } },
      select: { id: true, status: true, cityId: true, city: { select: { slug: true } } },
    }),
  ]);

  if (!account || account.isBanned) {
    return {
      status: "error",
      message: "This account cannot post reviews.",
      fieldErrors: {},
    };
  }

  if (!facility) {
    return {
      status: "error",
      message: "That placement no longer exists on Tellyrate.",
      fieldErrors: {},
    };
  }

  const limit = await checkRateLimit("review", user.id);
  if (!limit.ok) {
    return { status: "error", message: RATE_LIMITED, fieldErrors: {} };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          facilityId: facility.id,
          authorId: user.id,
          ...reviewPayload(parsed.data),
        },
      });

      // User-submitted facilities stay pending until a moderator verifies
      // that the real place is in Saudi Arabia. A review proves somebody has
      // an experience to share; it does not prove the typed facility name or
      // location is genuine.
      await recalcFacility(tx, facility.id);
      await recalcCity(tx, facility.cityId);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "duplicate",
        message:
          "You have already reviewed this placement. Trained there twice? Edit what you wrote rather than posting again.",
        href: `/facilities/${facilitySlug}/review`,
      };
    }
    return {
      status: "error",
      message: "Something went wrong saving that. Your draft is still here — try again.",
      fieldErrors: {},
    };
  }

  revalidateFacility(facilitySlug, facility.city.slug);

  return {
    status: "posted",
    message: "Posted. Thank you — this is the part that makes the site worth reading.",
    href: `/facilities/${facilitySlug}`,
  };
}

export async function updateReviewAction(
  _prevState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const reviewId = String(formData.get("reviewId") ?? "");
  const facilitySlug = String(formData.get("facilitySlug") ?? "");

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "auth",
      message: "Your changes are saved on this device. Sign in to keep going.",
    };
  }

  const parsed = reviewSchema.safeParse(readReviewFields(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "A couple of things need fixing before this can save.",
      fieldErrors: collectFieldErrors(parsed.error),
    };
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      authorId: true,
      facilityId: true,
      facility: {
        select: { slug: true, cityId: true, city: { select: { slug: true } } },
      },
    },
  });

  // Ownership and existence answer identically, so this cannot be used to
  // probe which review ids exist.
  if (!review || review.authorId !== user.id) {
    return {
      status: "error",
      message: "That review is not yours to edit.",
      fieldErrors: {},
    };
  }

  const limit = await checkRateLimit("review", user.id);
  if (!limit.ok) {
    return { status: "error", message: RATE_LIMITED, fieldErrors: {} };
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: review.id },
      data: { ...reviewPayload(parsed.data), editedAt: new Date() },
    });
    await recalcFacility(tx, review.facilityId);
    await recalcCity(tx, review.facility.cityId);
  });

  revalidateFacility(review.facility.slug, review.facility.city.slug);

  return {
    status: "updated",
    message: "Saved.",
    href: `/facilities/${facilitySlug || review.facility.slug}`,
  };
}

export async function deleteReviewAction(
  _prevState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const reviewId = String(formData.get("reviewId") ?? "");

  const user = await getCurrentUser();
  if (!user) {
    return { status: "auth", message: "Sign in to manage your reviews." };
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      authorId: true,
      facilityId: true,
      facility: {
        select: { slug: true, cityId: true, city: { select: { slug: true } } },
      },
    },
  });

  if (!review || review.authorId !== user.id) {
    return {
      status: "error",
      message: "That review is not yours to withdraw.",
      fieldErrors: {},
    };
  }

  const limit = await checkRateLimit("review", user.id);
  if (!limit.ok) {
    return { status: "error", message: RATE_LIMITED, fieldErrors: {} };
  }

  // A hard delete, not a status flag: someone withdrawing their testimony
  // should not leave a row behind that still ties them to a placement.
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } });
    await recalcFacility(tx, review.facilityId);
    await recalcCity(tx, review.facility.cityId);
  });

  revalidateFacility(review.facility.slug, review.facility.city.slug);

  return {
    status: "deleted",
    message: "Your review has been withdrawn.",
    href: `/facilities/${review.facility.slug}`,
  };
}
