"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { REPORT_REASON_LABELS } from "@/lib/labels";
import type { ReportReason } from "@/generated/prisma/client";

/**
 * Flagging a review, comment or facility for moderator attention.
 *
 * Reports are the only place where one user's action names another's content,
 * so nothing here is public: a report is invisible to everyone but moderators,
 * and the reporter is never shown to the person reported.
 */
export type ReportFormState = {
  ok?: true;
  error?: string;
};

const TARGET_TYPES = ["review", "comment", "facility"] as const;
export type ReportTargetType = (typeof TARGET_TYPES)[number];

const reportInput = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1).max(64),
  reason: z.enum(
    Object.keys(REPORT_REASON_LABELS) as [ReportReason, ...ReportReason[]],
  ),
  note: z.string().trim().max(500).optional(),
});

export async function reportContentAction(
  targetType: string,
  targetId: string,
  reason: string,
  note?: string,
): Promise<ReportFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to report content." };

  const parsed = reportInput.safeParse({ targetType, targetId, reason, note });
  if (!parsed.success) {
    return { error: "Choose a reason for the report." };
  }

  const limit = await checkRateLimit("report", user.id);
  if (!limit.ok) {
    return {
      error: `You have sent a lot of reports today. Try again in ${retryPhrase(limit.retryAfterSeconds)}.`,
    };
  }

  const slug = await facilitySlugFor(parsed.data.targetType, parsed.data.targetId);
  if (!slug) return { error: "That content is no longer available." };

  try {
    await prisma.report.create({
      data: {
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        reporterId: user.id,
        reason: parsed.data.reason,
        note: parsed.data.note || null,
      },
    });
  } catch (error) {
    // A repeat report trips the unique index. From the reporter's side nothing
    // has gone wrong — they flagged it, and it is flagged — so say so rather
    // than inviting them to try again and fail again.
    if (!isUniqueViolation(error)) throw error;
  }

  revalidatePath(`/facilities/${slug}`);

  return { ok: true };
}

/** Form wrapper, for `useActionState` on the inline report disclosure. */
export async function submitReportAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  return reportContentAction(
    String(formData.get("targetType") ?? ""),
    String(formData.get("targetId") ?? ""),
    String(formData.get("reason") ?? ""),
    String(formData.get("note") ?? "") || undefined,
  );
}

/**
 * Confirm the target exists and find the page to revalidate. Reports on a
 * ghost id are refused here rather than filling the moderation queue with
 * rows nobody can act on.
 */
async function facilitySlugFor(
  targetType: ReportTargetType,
  targetId: string,
): Promise<string | null> {
  if (targetType === "facility") {
    const facility = await prisma.facility.findUnique({
      where: { id: targetId },
      select: { slug: true },
    });
    return facility?.slug ?? null;
  }

  if (targetType === "review") {
    const review = await prisma.review.findUnique({
      where: { id: targetId },
      select: { facility: { select: { slug: true } } },
    });
    return review?.facility.slug ?? null;
  }

  const comment = await prisma.comment.findUnique({
    where: { id: targetId },
    select: { review: { select: { facility: { select: { slug: true } } } } },
  });
  return comment?.review.facility.slug ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function retryPhrase(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
