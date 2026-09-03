"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { recalcCommentCount } from "@/lib/aggregates";

/**
 * Comments on reviews.
 *
 * Shaped for `useActionState`, so every failure comes back as text next to the
 * form rather than as a thrown error that replaces the page — a rate-limited
 * reply should never cost someone the paragraph they just typed.
 */
export type CommentFormState = {
  ok?: true;
  error?: string;
  /** Echoed back so a rejected comment is not lost from the textarea. */
  body?: string;
};

const commentInput = z.object({
  reviewId: z.string().min(1).max(64),
  parentId: z.string().min(1).max(64).nullable(),
  body: z
    .string()
    .trim()
    .min(2, "Write at least a couple of words.")
    .max(2000, "Comments are limited to 2000 characters."),
});

export async function addCommentAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const rawBody = String(formData.get("body") ?? "");

  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to comment.", body: rawBody };

  const parsed = commentInput.safeParse({
    reviewId: formData.get("reviewId"),
    parentId: formData.get("parentId") || null,
    body: rawBody,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That comment is not valid.",
      body: rawBody,
    };
  }

  const limit = await checkRateLimit("comment", user.id);
  if (!limit.ok) {
    return {
      error: `You are commenting too quickly. Try again in ${retryPhrase(limit.retryAfterSeconds)}.`,
      body: rawBody,
    };
  }

  const review = await prisma.review.findUnique({
    where: { id: parsed.data.reviewId },
    select: {
      id: true,
      status: true,
      facility: { select: { slug: true } },
    },
  });

  if (!review || review.status !== "PUBLISHED") {
    return { error: "That review is no longer available.", body: rawBody };
  }

  // One level of nesting, enforced here rather than in the UI: a reply to a
  // reply attaches to the grandparent, so a thread stays readable at any depth
  // of enthusiasm.
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parsed.data.parentId },
      select: { id: true, parentId: true, reviewId: true, status: true },
    });

    if (!parent || parent.reviewId !== review.id || parent.status !== "PUBLISHED") {
      return { error: "That comment is no longer available.", body: rawBody };
    }

    parentId = parent.parentId ?? parent.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.create({
      data: {
        reviewId: review.id,
        authorId: user.id,
        parentId,
        body: parsed.data.body,
      },
    });
    await recalcCommentCount(tx, review.id);
  });

  revalidatePath(`/facilities/${review.facility.slug}`);

  return { ok: true };
}

const deleteInput = z.object({ commentId: z.string().min(1).max(64) });

export async function deleteCommentAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const parsed = deleteInput.safeParse({ commentId: formData.get("commentId") });
  if (!parsed.success) return { error: "That comment is not valid." };

  const [comment, account] = await Promise.all([
    prisma.comment.findUnique({
      where: { id: parsed.data.commentId },
      select: {
        id: true,
        authorId: true,
        reviewId: true,
        status: true,
        review: { select: { facility: { select: { slug: true } } } },
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    }),
  ]);

  if (!comment) return { error: "That comment is no longer available." };

  const isModerator =
    account?.role === "MODERATOR" || account?.role === "ADMIN";
  if (comment.authorId !== user.id && !isModerator) {
    return { error: "You can only delete your own comments." };
  }

  if (comment.status === "PUBLISHED") {
    // Soft delete: replies hang off this row, and a hard delete would take an
    // unrelated conversation down with it.
    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id: comment.id },
        data: { status: "REMOVED" },
      });
      await recalcCommentCount(tx, comment.reviewId);
    });
  }

  revalidatePath(`/facilities/${comment.review.facility.slug}`);

  return { ok: true };
}

function retryPhrase(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
