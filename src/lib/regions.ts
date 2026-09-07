import "server-only";
import { prisma } from "@/lib/db";
import { REGIONS, REGION_BY_SLUG, type RegionKey } from "@/lib/labels";
import type { Region } from "@/generated/prisma/client";

/**
 * The region layer of the directory.
 *
 * Students think in regions before cities — "somewhere in Qassim" comes before
 * "Buraydah or Unaizah" — so the region pages are a browsing path in their own
 * right rather than a filter on the city list.
 *
 * Every count here is read from the denormalised columns City already
 * maintains (see lib/aggregates.ts). Counting facilities and reviews per
 * region from their own tables would be three joins to arrive at numbers that
 * are already sitting on the city row, and would disagree with what the city
 * cards say the moment the two queries used different filters.
 */

export type RegionSummary = {
  key: RegionKey;
  slug: string;
  cityCount: number;
  facilityCount: number;
  reviewCount: number;
};

export type RegionStats = {
  cityCount: number;
  facilityCount: number;
  reviewCount: number;
};

/**
 * The assignment is the point: it fails to compile if `labels.ts` and the
 * schema's `Region` enum ever drift apart, which is the one way this whole
 * file could silently start returning zeros for a region that has cities.
 */
function toPrismaRegion(key: RegionKey): Region {
  const region: Region = key;
  return region;
}

/**
 * Every region, in display order, with what is behind it.
 *
 * One grouped query rather than thirteen: the list is fixed and small, so the
 * database groups what exists and the missing regions are filled in here at
 * zero. A region with nothing in it yet still has to appear — the complaint
 * that started all of this was a student who could not find Qassim, and an
 * empty row that says so is a better answer than no row at all.
 */
export async function listRegions(): Promise<RegionSummary[]> {
  const grouped = await prisma.city.groupBy({
    by: ["region"],
    _count: { _all: true },
    _sum: { facilityCount: true, reviewCount: true },
  });

  const byRegion = new Map<string, (typeof grouped)[number]>(
    grouped.map((row) => [row.region, row]),
  );

  return REGIONS.map(({ key, slug }) => {
    const row = byRegion.get(key);
    return {
      key,
      slug,
      cityCount: row?._count._all ?? 0,
      facilityCount: row?._sum.facilityCount ?? 0,
      reviewCount: row?._sum.reviewCount ?? 0,
    };
  });
}

/** Resolve a URL segment to a region, or null so the route can 404. */
export function getRegionBySlug(slug: string): RegionKey | null {
  const key = REGION_BY_SLUG[slug];
  return key ? (key as RegionKey) : null;
}

/**
 * The cities of one region, busiest first.
 *
 * Cities with no facilities yet are listed rather than hidden, unlike the
 * country-wide city index: inside a quiet region, knowing which cities exist
 * and that none of them has anything listed is the answer the reader came for.
 * Ordering leads with the facility count — it matches the
 * `[region, facilityCount desc]` index, and within a single region the number
 * of places to train separates the cities far better than review counts do
 * while reviews are still sparse.
 */
export async function listCitiesInRegion(key: RegionKey) {
  return prisma.city.findMany({
    where: { region: toPrismaRegion(key) },
    orderBy: [
      { facilityCount: "desc" },
      { reviewCount: "desc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      slug: true,
      name: true,
      facilityCount: true,
      reviewCount: true,
    },
  });
}

/** The totals under a region's heading. */
export async function getRegionStats(key: RegionKey): Promise<RegionStats> {
  const totals = await prisma.city.aggregate({
    where: { region: toPrismaRegion(key) },
    _count: { _all: true },
    _sum: { facilityCount: true, reviewCount: true },
  });

  return {
    cityCount: totals._count._all,
    facilityCount: totals._sum.facilityCount ?? 0,
    reviewCount: totals._sum.reviewCount ?? 0,
  };
}
