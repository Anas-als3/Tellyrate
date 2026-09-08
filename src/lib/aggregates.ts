import "server-only";
import { prisma } from "@/lib/db";
import {
  bayesianScore,
  DEFAULT_MEAN_RATING,
  roundRating,
  wilsonLowerBound,
} from "@/lib/ranking";
import { RATING_AXES } from "@/lib/labels";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Recompute a facility's denormalised aggregates from its reviews.
 *
 * Sorting a directory by rating cannot afford an aggregate-per-row at query
 * time, so these columns are maintained on write instead — always inside the
 * same transaction as the review change, so a crash between the two can never
 * leave a facility claiming reviews it does not have.
 */
export async function recalcFacility(tx: Tx, facilityId: string): Promise<void> {
  const stats = await tx.review.aggregate({
    where: { facilityId, status: "PUBLISHED" },
    _count: { _all: true, overall: true },
    _sum: { overall: true },
    _avg: {
      supervision: true,
      handsOn: true,
      staffRespect: true,
      workload: true,
      resources: true,
      safety: true,
    },
  });

  const reviewCount = stats._count._all;
  const ratingCount = stats._count.overall;
  const ratingSum = stats._sum.overall ?? 0;
  const ratingAvg = ratingCount > 0 ? ratingSum / ratingCount : 0;

  const siteStat = await tx.siteStat.findUnique({ where: { id: "global" } });
  const meanRating = siteStat?.meanRating ?? DEFAULT_MEAN_RATING;

  await tx.facility.update({
    where: { id: facilityId },
    data: {
      reviewCount,
      ratingCount,
      ratingSum,
      ratingAvg: roundRating(ratingAvg),
      bayesScore: bayesianScore(ratingSum, ratingCount, meanRating),
      avgSupervision: round1(stats._avg.supervision),
      avgHandsOn: round1(stats._avg.handsOn),
      avgStaffRespect: round1(stats._avg.staffRespect),
      avgWorkload: round1(stats._avg.workload),
      avgResources: round1(stats._avg.resources),
      avgSafety: round1(stats._avg.safety),
    },
  });
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

/** Keep the city's headline counts in step with its facilities. */
export async function recalcCity(tx: Tx, cityId: string): Promise<void> {
  const [facilityCount, agg] = await Promise.all([
    tx.facility.count({ where: { cityId, status: "PUBLISHED" } }),
    tx.facility.aggregate({
      where: { cityId, status: "PUBLISHED" },
      _sum: { reviewCount: true },
    }),
  ]);

  await tx.city.update({
    where: { id: cityId },
    data: { facilityCount, reviewCount: agg._sum.reviewCount ?? 0 },
  });
}

/**
 * Recompute a review's like/dislike counters and its helpfulness score.
 *
 * Helpfulness uses the Wilson lower bound rather than `likes - dislikes`,
 * which would let a 600/400 review outrank a 20/0 one, or a raw ratio, which
 * would put a single like at the top of the page.
 */
export async function recalcReviewVotes(
  tx: Tx,
  reviewId: string,
): Promise<void> {
  const [likes, dislikes] = await Promise.all([
    tx.reviewVote.count({ where: { reviewId, value: 1 } }),
    tx.reviewVote.count({ where: { reviewId, value: -1 } }),
  ]);

  await tx.review.update({
    where: { id: reviewId },
    data: {
      likeCount: likes,
      dislikeCount: dislikes,
      helpfulScore: wilsonLowerBound(likes, dislikes),
    },
  });
}

export async function recalcCommentVotes(
  tx: Tx,
  commentId: string,
): Promise<void> {
  const [likes, dislikes] = await Promise.all([
    tx.commentVote.count({ where: { commentId, value: 1 } }),
    tx.commentVote.count({ where: { commentId, value: -1 } }),
  ]);

  await tx.comment.update({
    where: { id: commentId },
    data: { likeCount: likes, dislikeCount: dislikes },
  });
}

export async function recalcCommentCount(
  tx: Tx,
  reviewId: string,
): Promise<void> {
  const commentCount = await tx.comment.count({
    where: { reviewId, status: "PUBLISHED" },
  });
  await tx.review.update({ where: { id: reviewId }, data: { commentCount } });
}

/**
 * Refresh the site-wide mean that the Bayesian prior rests on.
 *
 * Deliberately not run on every review: the mean moves slowly, and rewriting
 * every facility's score on each new review would turn one insert into a full
 * table update. Called from the seed and from a periodic job instead.
 */
export async function refreshSiteStats(): Promise<{
  meanRating: number;
  reviewCount: number;
}> {
  // The prior is the mean of facility means, not the mean of all reviews.
  // Averaging reviews directly would let one heavily-reviewed teaching
  // hospital define the prior that every small clinic is shrunk toward.
  const [rows, reviewCount] = await Promise.all([
    prisma.facility.findMany({
      where: { ratingCount: { gt: 0 } },
      select: { ratingSum: true, ratingCount: true },
    }),
    prisma.review.count({ where: { status: "PUBLISHED" } }),
  ]);

  const meanRating =
    rows.length > 0
      ? rows.reduce((sum, f) => sum + f.ratingSum / f.ratingCount, 0) /
        rows.length
      : DEFAULT_MEAN_RATING;

  await prisma.siteStat.upsert({
    where: { id: "global" },
    create: { id: "global", meanRating, reviewCount },
    update: { meanRating, reviewCount },
  });

  return { meanRating, reviewCount };
}

/**
 * Rescore every rated facility against the current site mean. Run after
 * `refreshSiteStats`, from the seed or a scheduled job — never in a request.
 */
export async function rescoreAllFacilities(meanRating: number): Promise<number> {
  const facilities = await prisma.facility.findMany({
    where: { ratingCount: { gt: 0 } },
    select: { id: true, ratingSum: true, ratingCount: true },
  });

  for (const f of facilities) {
    await prisma.facility.update({
      where: { id: f.id },
      data: { bayesScore: bayesianScore(f.ratingSum, f.ratingCount, meanRating) },
    });
  }

  return facilities.length;
}

/** The axis keys, for building review payloads without repeating the list. */
export const AXIS_KEYS = RATING_AXES.map((a) => a.key);
