"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { recalcCommentVotes, recalcReviewVotes } from "@/lib/aggregates";

/**
 * Voting on reviews and comments.
 *
 * The counters live on the row rather than being counted at read time, so
 * every write has to keep them true: the vote row and the recount happen in
 * one transaction, and the recount reads the vote table rather than nudging a
 * number, so a double-submitted click cannot drift the total away from the
 * facts.
 */

/** What the client needs to reconcile its optimistic state with the truth. */
export type VoteResult =
  | {
      ok: true;
      /** The viewer's vote after this call: 1, -1, or 0 when toggled off. */
      value: 1 | -1 | 0;
      likeCount: number;
      dislikeCount: number;
    }
  | { ok: false; error: string };

const voteInput = z.object({
  id: z.string().min(1).max(64),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export async function voteOnReviewAction(
  reviewId: string,
  value: number,
): Promise<VoteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to vote." };

  const parsed = voteInput.safeParse({ id: reviewId, value });
  if (!parsed.success) return { ok: false, error: "That vote is not valid." };

  const limit = await checkRateLimit("vote", user.id);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many votes. Try again in ${retryPhrase(limit.retryAfterSeconds)}.`,
    };
  }

  const review = await prisma.review.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      authorId: true,
      status: true,
      facility: { select: { slug: true } },
    },
  });

  if (!review || review.status !== "PUBLISHED") {
    return { ok: false, error: "That review is no longer available." };
  }

  // Self-voting would let an author pump their own review to the top of the
  // "most helpful" sort, which is the one ordering readers trust most.
  if (review.authorId === user.id) {
    return { ok: false, error: "You cannot vote on your own review." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.reviewVote.findUnique({
      where: { reviewId_userId: { reviewId: review.id, userId: user.id } },
      select: { id: true, value: true },
    });

    let next: 1 | -1 | 0;
    if (existing && existing.value === parsed.data.value) {
      // Clicking the same button again means "undo", not "vote twice".
      await tx.reviewVote.delete({ where: { id: existing.id } });
      next = 0;
    } else if (existing) {
      await tx.reviewVote.update({
        where: { id: existing.id },
        data: { value: parsed.data.value },
      });
      next = parsed.data.value;
    } else {
      await tx.reviewVote.create({
        data: { reviewId: review.id, userId: user.id, value: parsed.data.value },
      });
      next = parsed.data.value;
    }

    await recalcReviewVotes(tx, review.id);

    const fresh = await tx.review.findUniqueOrThrow({
      where: { id: review.id },
      select: { likeCount: true, dislikeCount: true },
    });

    return { next, ...fresh };
  });

  revalidatePath(`/facilities/${review.facility.slug}`);

  return {
    ok: true,
    value: result.next,
    likeCount: result.likeCount,
    dislikeCount: result.dislikeCount,
  };
}

export async function voteOnCommentAction(
  commentId: string,
  value: number,
): Promise<VoteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to vote." };

  const parsed = voteInput.safeParse({ id: commentId, value });
  if (!parsed.success) return { ok: false, error: "That vote is not valid." };

  const limit = await checkRateLimit("vote", user.id);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many votes. Try again in ${retryPhrase(limit.retryAfterSeconds)}.`,
    };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      authorId: true,
      status: true,
      review: { select: { facility: { select: { slug: true } } } },
    },
  });

  if (!comment || comment.status !== "PUBLISHED") {
    return { ok: false, error: "That comment is no longer available." };
  }

  if (comment.authorId === user.id) {
    return { ok: false, error: "You cannot vote on your own comment." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.commentVote.findUnique({
      where: { commentId_userId: { commentId: comment.id, userId: user.id } },
      select: { id: true, value: true },
    });

    let next: 1 | -1 | 0;
    if (existing && existing.value === parsed.data.value) {
      await tx.commentVote.delete({ where: { id: existing.id } });
      next = 0;
    } else if (existing) {
      await tx.commentVote.update({
        where: { id: existing.id },
        data: { value: parsed.data.value },
      });
      next = parsed.data.value;
    } else {
      await tx.commentVote.create({
        data: {
          commentId: comment.id,
          userId: user.id,
          value: parsed.data.value,
        },
      });
      next = parsed.data.value;
    }

    await recalcCommentVotes(tx, comment.id);

    const fresh = await tx.comment.findUniqueOrThrow({
      where: { id: comment.id },
      select: { likeCount: true, dislikeCount: true },
    });

    return { next, ...fresh };
  });

  revalidatePath(`/facilities/${comment.review.facility.slug}`);

  return {
    ok: true,
    value: result.next,
    likeCount: result.likeCount,
    dislikeCount: result.dislikeCount,
  };
}

function retryPhrase(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
