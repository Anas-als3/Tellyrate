/**
 * Nightly maintenance.
 *
 *   npm run job:nightly
 *
 * Run it from cron (or a scheduled GitHub Action) once a day. Everything here
 * is idempotent and safe to run more often; none of it belongs in a request,
 * because each step touches every row of something.
 *
 * Three jobs:
 *   1. Expired sessions and spent rate-limit windows are deleted. Nothing else
 *      removes them, so without this the tables grow forever — and a table of
 *      dead sessions is a liability on a site that promises to hold nothing.
 *   2. The site-wide mean rating is recomputed, then every facility is
 *      rescored against it. The Bayesian prior moves as the site grows, and a
 *      score computed against last month's mean is quietly wrong.
 *   3. City counters are reconciled, in case a write path ever missed one.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { bayesianScore, DEFAULT_MEAN_RATING } from "../src/lib/ranking";

async function main() {
  const started = Date.now();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const now = new Date();

  // ---- 1. Housekeeping ---------------------------------------------------
  const sessions = await prisma.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const buckets = await prisma.rateLimit.deleteMany({
    where: { resetAt: { lt: now } },
  });

  console.log(
    `Pruned ${sessions.count} expired sessions, ${buckets.count} rate-limit windows.`,
  );

  // ---- 2. Ranking --------------------------------------------------------
  // The prior is the mean of facility means, not of all reviews: averaging
  // reviews directly lets one heavily-reviewed teaching hospital define the
  // prior that every small clinic is shrunk toward.
  const rated = await prisma.facility.findMany({
    where: { reviewCount: { gt: 0 } },
    select: { id: true, ratingSum: true, reviewCount: true },
  });

  const meanRating =
    rated.length > 0
      ? rated.reduce((sum, f) => sum + f.ratingSum / f.reviewCount, 0) /
        rated.length
      : DEFAULT_MEAN_RATING;

  const reviewCount = await prisma.review.count({
    where: { status: "PUBLISHED" },
  });

  await prisma.siteStat.upsert({
    where: { id: "global" },
    create: { id: "global", meanRating, reviewCount },
    update: { meanRating, reviewCount },
  });

  let rescored = 0;
  for (const f of rated) {
    const score = bayesianScore(f.ratingSum, f.reviewCount, meanRating);
    await prisma.facility.update({
      where: { id: f.id },
      data: { bayesScore: score },
    });
    rescored++;
  }

  console.log(
    `Site mean ${meanRating.toFixed(3)} over ${reviewCount} reviews; rescored ${rescored} facilities.`,
  );

  // ---- 3. Reconcile city counters ---------------------------------------
  // These are maintained on write, so a non-zero drift here is a bug report
  // rather than a repair — worth noticing rather than silently fixing.
  const cities = await prisma.city.findMany({
    select: { id: true, name: true, facilityCount: true, reviewCount: true },
  });

  let drifted = 0;
  for (const city of cities) {
    const [facilityCount, agg] = await Promise.all([
      prisma.facility.count({
        where: { cityId: city.id, status: "PUBLISHED" },
      }),
      prisma.facility.aggregate({
        where: { cityId: city.id, status: "PUBLISHED" },
        _sum: { reviewCount: true },
      }),
    ]);
    const cityReviews = agg._sum.reviewCount ?? 0;

    if (city.facilityCount !== facilityCount || city.reviewCount !== cityReviews) {
      console.warn(
        `  drift in ${city.name}: facilities ${city.facilityCount} -> ${facilityCount}, reviews ${city.reviewCount} -> ${cityReviews}`,
      );
      await prisma.city.update({
        where: { id: city.id },
        data: { facilityCount, reviewCount: cityReviews },
      });
      drifted++;
    }
  }

  if (drifted > 0) {
    console.warn(
      `${drifted} cities had drifted counters. They are fixed, but a write path is losing updates — worth investigating.`,
    );
  } else {
    console.log("City counters all consistent.");
  }

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
