import "server-only";
import { prisma } from "@/lib/db";
import { facilitySearchConditions } from "@/lib/facility-search-query";
import { citySearchName } from "@/lib/i18n/names";
import { fold } from "@/lib/slug";
import {
  DEFAULT_MEAN_RATING,
  type ReviewSortKey,
  type SortKey,
} from "@/lib/ranking";
import { reviewPageForPrecedingCount } from "@/lib/review-query";
import type {
  FacilityKind,
  Prisma,
  Region,
  RotationSpecialty,
  StudentField,
} from "@/generated/prisma/client";

export const PAGE_SIZE = 24;
export const REVIEWS_PAGE_SIZE = 10;

export type FacilityFilters = {
  sort: SortKey;
  citySlug?: string;
  countryCode?: string;
  /**
   * A `Region` enum value, not the URL slug — `toFacilityFilters` in
   * lib/facility-query.ts does that conversion, the way it upper-cases the
   * country code.
   */
  regionKey?: string;
  kind?: string;
  field?: string;
  specialty?: string;
  query?: string;
  minRating?: number;
  page: number;
};

/**
 * "Highest rated" orders by the stored Bayesian score rather than the raw
 * average — see lib/ranking.ts for why. It is written on each review so the
 * sort stays a plain indexed column scan.
 */
function orderFor(sort: SortKey): Prisma.FacilityOrderByWithRelationInput[] {
  switch (sort) {
    case "highest_rated":
      return [
        { bayesScore: "desc" },
        { ratingCount: "desc" },
        { name: "asc" },
      ];
    case "newest":
      return [{ createdAt: "desc" }, { name: "asc" }];
    case "name":
      return [{ name: "asc" }];
    case "most_reviewed":
    default:
      return [
        { reviewCount: "desc" },
        { bayesScore: "desc" },
        { name: "asc" },
      ];
  }
}

function facilityWhere(filters: FacilityFilters): Prisma.FacilityWhereInput {
  const where: Prisma.FacilityWhereInput = { status: "PUBLISHED" };

  // Region lives on City, so it narrows through the same relation filter the
  // city and country do — one join, whichever of the three is in force.
  const city: Prisma.CityWhereInput = {};
  if (filters.citySlug) city.slug = filters.citySlug;
  if (filters.countryCode) city.countryCode = filters.countryCode;
  if (filters.regionKey) city.region = filters.regionKey as Region;
  if (Object.keys(city).length > 0) where.city = city;

  if (filters.kind) where.kind = filters.kind as FacilityKind;
  if (filters.minRating !== undefined) {
    // A minimum rating only makes sense among facilities that have been rated.
    where.ratingCount = { gt: 0 };
    where.ratingAvg = { gte: filters.minRating };
  }

  const matchingReview = matchingReviewWhere(filters);
  if (filters.field || filters.specialty) {
    // Both values belong to the same experience. Two separate relation
    // filters would incorrectly match a medical review and an unrelated
    // pharmacy review from the same facility.
    where.reviews = { some: matchingReview };
  }

  if (filters.query) {
    const q = filters.query.trim();
    if (q) {
      // Match across the display name and both localised names, so an Arabic
      // or English spelling finds the same place.
      where.OR = facilitySearchConditions(q, { includeCity: true });
    }
  }

  return where;
}

function matchingReviewWhere(
  filters: FacilityFilters,
): Prisma.ReviewWhereInput {
  const where: Prisma.ReviewWhereInput = { status: "PUBLISHED" };
  if (filters.field) where.field = filters.field as StudentField;
  if (filters.specialty) {
    where.specialty = filters.specialty as RotationSpecialty;
  }
  return where;
}

export async function listFacilities(filters: FacilityFilters) {
  const where = facilityWhere(filters);
  const matchingReview = matchingReviewWhere(filters);
  const skip = (filters.page - 1) * PAGE_SIZE;

  const [facilities, total] = await Promise.all([
    prisma.facility.findMany({
      where,
      orderBy: orderFor(filters.sort),
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        name: true,
        nameEn: true,
        nameLocal: true,
        kind: true,
        reviewCount: true,
        ratingCount: true,
        ratingAvg: true,
        bayesScore: true,
        city: { select: { name: true, slug: true, countryCode: true } },
        _count: {
          select: {
            reviews: { where: matchingReview },
          },
        },
      },
    }),
    prisma.facility.count({ where }),
  ]);

  return {
    facilities: facilities.map(({ _count, ...facility }) => ({
      ...facility,
      matchingReviewCount:
        filters.field || filters.specialty ? _count.reviews : undefined,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getFacilityBySlug(slug: string) {
  return prisma.facility.findFirst({
    where: { slug, status: { in: ["PUBLISHED", "PENDING"] } },
    include: {
      city: true,
      submittedBy: { select: { username: true } },
    },
  });
}

function reviewOrder(sort: ReviewSortKey): Prisma.ReviewOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "highest":
      return [
        { overall: { sort: "desc", nulls: "last" } },
        { helpfulScore: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ];
    case "lowest":
      return [
        { overall: { sort: "asc", nulls: "last" } },
        { helpfulScore: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ];
    case "helpful":
    default:
      return [
        { helpfulScore: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ];
  }
}

export async function listReviews(
  facilityId: string,
  filters: {
    sort: ReviewSortKey;
    page: number;
    field?: StudentField;
    specialty?: RotationSpecialty;
  },
  viewerId?: string | null,
  linkedReviewId?: string,
) {
  const where: Prisma.ReviewWhereInput = {
    facilityId,
    status: "PUBLISHED",
    field: filters.field,
    specialty: filters.specialty,
  };

  let page = filters.page;
  if (
    linkedReviewId &&
    filters.sort === "newest" &&
    filters.field === undefined &&
    filters.specialty === undefined
  ) {
    const linkedReview = await prisma.review.findFirst({
      where: { id: linkedReviewId, facilityId, status: "PUBLISHED" },
      select: { id: true, createdAt: true },
    });

    if (linkedReview) {
      const precedingReviews = await prisma.review.count({
        where: {
          facilityId,
          status: "PUBLISHED",
          OR: [
            { createdAt: { gt: linkedReview.createdAt } },
            {
              createdAt: linkedReview.createdAt,
              id: { gt: linkedReview.id },
            },
          ],
        },
      });
      page = reviewPageForPrecedingCount(
        precedingReviews,
        REVIEWS_PAGE_SIZE,
      );
    }
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: reviewOrder(filters.sort),
      skip: (page - 1) * REVIEWS_PAGE_SIZE,
      take: REVIEWS_PAGE_SIZE,
      include: {
        author: { select: { id: true, username: true } },
        // Only the viewer's own vote is fetched, never the full voter list —
        // who liked what is nobody else's business.
        votes: viewerId
          ? { where: { userId: viewerId }, select: { value: true } }
          : false,
      },
    }),
    prisma.review.count({ where }),
  ]);

  return {
    reviews,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE)),
  };
}

export async function listCities(options: { query?: string; countryCode?: string } = {}) {
  const where: Prisma.CityWhereInput = { facilityCount: { gt: 0 } };
  if (options.countryCode) where.countryCode = options.countryCode;
  if (options.query?.trim()) {
    const query = options.query.trim();
    const englishCity = citySearchName(query);
    where.OR = [
      { nameFold: { contains: fold(query) } },
      ...(englishCity
        ? [{ name: { equals: englishCity, mode: "insensitive" as const } }]
        : []),
    ];
  }

  return prisma.city.findMany({
    where,
    orderBy: [{ reviewCount: "desc" }, { facilityCount: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      country: true,
      countryCode: true,
      // Carried so callers can group the flat list by region without a second
      // query — /cities is a list of regions before it is a list of cities.
      region: true,
      facilityCount: true,
      reviewCount: true,
    },
  });
}

export async function getCityBySlug(slug: string) {
  return prisma.city.findUnique({ where: { slug } });
}

/** The site-wide mean rating that the Bayesian prior needs. */
export async function getMeanRating(): Promise<number> {
  const stat = await prisma.siteStat.findUnique({ where: { id: "global" } });
  return stat?.meanRating ?? DEFAULT_MEAN_RATING;
}

export async function getSiteCounts() {
  const [facilities, reviews, cities] = await Promise.all([
    prisma.facility.count({ where: { status: "PUBLISHED" } }),
    prisma.review.count({ where: { status: "PUBLISHED" } }),
    prisma.city.count({ where: { facilityCount: { gt: 0 } } }),
  ]);
  return { facilities, reviews, cities };
}
