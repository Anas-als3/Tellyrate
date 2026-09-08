import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { getFacilityBySlug, listReviews } from "@/lib/queries";
import { REVIEW_SORT_OPTIONS, type ReviewSortKey } from "@/lib/ranking";
import {
  RATING_AXES,
  REGION_SLUGS,
  ROTATION_SPECIALTIES,
  STUDENT_FIELDS,
} from "@/lib/labels";
import {
  buildReviewHref,
  hasReviewFilters,
  parseReviewQuery,
} from "@/lib/review-query";
import {
  formatNumber,
  getDictionary,
  lookup,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { cityNameFor, facilityNamesFor } from "@/lib/i18n/names";
import { getLocale } from "@/lib/i18n/server";
import { Stars } from "@/components/stars";
import { RatingDistribution, SubRating } from "@/components/graduated-bar";
import { FacilityCard } from "@/components/facility-card";
import {
  ReviewCard,
  coarseAge,
  reportStrings,
} from "@/components/review-card";
import { ReportControl } from "@/components/vote-buttons";
import type { ThreadComment, ThreadViewer } from "@/components/comment-thread";
import type {
  RotationSpecialty,
  StudentField,
} from "@/generated/prisma/client";

/**
 * The facility page — the one page the whole site exists to produce.
 *
 * Everything a reader needs to judge a placement is here and nothing else is:
 * the score and how it is distributed, the six axes with their own sample
 * sizes, the reviews themselves, and where the place is. No map tiles, no
 * embeds, no third-party anything — a tile request would hand every reader's
 * IP address to someone else, which would quietly undo the promise the site
 * is built on.
 */

/**
 * Arabic has its own comma, and the Latin one reads as a typo in Arabic text.
 * Used where the page joins values the dictionary cannot join for it — an
 * address, a place, a coordinate pair.
 */
const LIST_COMMA: Record<Locale, string> = { en: ", ", ar: "، " };

/**
 * `←` and `→` are bidi-neutral: the algorithm decides where they sit but never
 * turns them round, so "the previous page" has to be picked rather than
 * mirrored. Same for the arrow that marks a link as leaving the site.
 */
function arrowsFor(rtl: boolean) {
  return {
    back: rtl ? "→" : "←",
    forward: rtl ? "←" : "→",
    external: rtl ? "↖" : "↗",
  };
}

/** Deduplicate the lookup between `generateMetadata` and the render. */
const loadFacility = cache(async (slug: string) => getFacilityBySlug(slug));

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const facility = await loadFacility(slug);

  if (!facility) {
    return {
      title: t.facility.notFoundTitle,
      robots: { index: false, follow: true },
    };
  }

  // Lower-casing is a no-op in Arabic, which has no case at all, so the same
  // call serves both languages.
  const kind = lookup(
    t.labels.facilityKind,
    facility.kind,
    t.labels.facilityFallback,
  ).toLowerCase();
  const country = lookup(
    t.labels.country,
    facility.city.countryCode,
    facility.city.country,
  );
  const names = facilityNamesFor(locale, facility);
  const cityName = cityNameFor(locale, facility.city.name);
  const place = `${cityName}${LIST_COMMA[locale]}${country}`;
  const title = t.facility.titleWithCity(names.primary, cityName);

  const description =
    facility.ratingCount > 0
      ? t.facility.metaRated(
          names.primary,
          kind,
          place,
          facility.ratingAvg.toFixed(1),
          facility.ratingCount,
        )
      : t.facility.metaUnrated(names.primary, kind, place);

  return {
    title,
    description,
    alternates: { canonical: `/facilities/${facility.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/facilities/${facility.slug}`,
    },
  };
}

export default async function FacilityPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const arrows = arrowsFor(locale === "ar");
  const comma = LIST_COMMA[locale];

  const facility = await loadFacility(slug);
  if (!facility) notFound();
  const names = facilityNamesFor(locale, facility);
  const cityName = cityNameFor(locale, facility.city.name);

  // A separate `r*` namespace means review filtering and paging can never be
  // confused with the facility-directory URL that linked here.
  const reviewQuery = parseReviewQuery(sp);
  const { sort, page } = reviewQuery;

  const viewer = await getCurrentUser();

  const [
    reviewPage,
    distribution,
    axisTotals,
    alsoInCity,
    account,
    ownReview,
    reviewFieldGroups,
    reviewSpecialtyGroups,
  ] =
    await Promise.all([
      listReviews(
        facility.id,
        {
          sort,
          page,
          field: reviewQuery.field as StudentField | undefined,
          specialty: reviewQuery.specialty as RotationSpecialty | undefined,
        },
        viewer?.id,
      ),

      prisma.review.groupBy({
        by: ["overall"],
        where: { facilityId: facility.id, status: "PUBLISHED" },
        _count: true,
      }),

      // Field-level `_count` counts non-null values, which is exactly the per
      // axis sample size: sub-scores are optional, so each axis rests on a
      // different number of opinions and has to say so.
      prisma.review.aggregate({
        where: { facilityId: facility.id, status: "PUBLISHED" },
        _count: {
          supervision: true,
          handsOn: true,
          staffRespect: true,
          workload: true,
          resources: true,
          safety: true,
        },
      }),

      prisma.facility.findMany({
        where: {
          cityId: facility.cityId,
          status: "PUBLISHED",
          id: { not: facility.id },
        },
        orderBy: [
          { reviewCount: "desc" },
          { bayesScore: "desc" },
          { name: "asc" },
        ],
        take: 4,
        select: {
          slug: true,
          name: true,
          nameEn: true,
          nameLocal: true,
          kind: true,
          reviewCount: true,
          ratingCount: true,
          ratingAvg: true,
          city: { select: { name: true, slug: true, countryCode: true } },
        },
      }),

      viewer
        ? prisma.user.findUnique({
            where: { id: viewer.id },
            select: { role: true },
          })
        : null,

      viewer
        ? prisma.review.findFirst({
            where: { facilityId: facility.id, authorId: viewer.id },
            select: { id: true },
          })
        : null,

      prisma.review.groupBy({
        by: ["field"],
        where: {
          facilityId: facility.id,
          status: "PUBLISHED",
          specialty: reviewQuery.specialty
            ? (reviewQuery.specialty as RotationSpecialty)
            : undefined,
        },
        _count: { _all: true },
      }),

      prisma.review.groupBy({
        by: ["specialty"],
        where: {
          facilityId: facility.id,
          status: "PUBLISHED",
          field: reviewQuery.field
            ? (reviewQuery.field as StudentField)
            : undefined,
          specialty: { not: null },
        },
        _count: { _all: true },
      }),
    ]);

  const reviews = reviewPage.reviews;

  // One query for every thread on the page rather than one per review; the
  // threads are collapsed, but the text still has to be in the document for
  // readers without JavaScript and for search engines.
  const commentRows =
    reviews.length > 0
      ? await prisma.comment.findMany({
          where: {
            reviewId: { in: reviews.map((review) => review.id) },
            status: "PUBLISHED",
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            reviewId: true,
            parentId: true,
            body: true,
            createdAt: true,
            likeCount: true,
            dislikeCount: true,
            author: { select: { id: true, username: true } },
            // Only the viewer's own vote, never the voter list.
            votes: {
              where: { userId: viewer?.id ?? "" },
              select: { value: true },
            },
          },
        })
      : [];

  const now = new Date();
  const commentsByReview = new Map<string, ThreadComment[]>();
  for (const row of commentRows) {
    const node: ThreadComment = {
      id: row.id,
      parentId: row.parentId,
      body: row.body,
      age: coarseAge(row.createdAt, t.review, now),
      likeCount: row.likeCount,
      dislikeCount: row.dislikeCount,
      viewerVote: row.votes[0]?.value ?? 0,
      author: row.author,
    };
    const bucket = commentsByReview.get(row.reviewId);
    if (bucket) bucket.push(node);
    else commentsByReview.set(row.reviewId, [node]);
  }

  const threadViewer: ThreadViewer = viewer
    ? {
        id: viewer.id,
        canModerate: account?.role === "MODERATOR" || account?.role === "ADMIN",
      }
    : null;

  const distributionCounts = [0, 0, 0, 0, 0];
  for (const row of distribution) {
    if (row.overall === null) continue;
    const index = Math.min(5, Math.max(1, Math.round(row.overall))) - 1;
    distributionCounts[index] += row._count;
  }

  const fieldCounts = new Map(
    reviewFieldGroups.map((row) => [String(row.field), row._count._all]),
  );
  const specialtyCounts = new Map(
    reviewSpecialtyGroups
      .filter((row) => row.specialty !== null)
      .map((row) => [String(row.specialty), row._count._all]),
  );

  const axisCount: Record<string, number> = {
    supervision: axisTotals._count.supervision,
    handsOn: axisTotals._count.handsOn,
    staffRespect: axisTotals._count.staffRespect,
    workload: axisTotals._count.workload,
    resources: axisTotals._count.resources,
    safety: axisTotals._count.safety,
  };

  const kindLabel = lookup(
    t.labels.facilityKind,
    facility.kind,
    t.labels.facilityFallback,
  );
  const regionName = lookup(
    t.labels.region,
    facility.city.region,
    facility.city.region,
  );
  const regionSlug = REGION_SLUGS[facility.city.region];
  const rated = facility.ratingCount > 0;
  const reviewFiltersActive = hasReviewFilters(reviewQuery);
  const canonicalPath = buildReviewHref(
    facility.slug,
    reviewQuery,
    {},
    false,
  );
  const writeHref = `/facilities/${facility.slug}/review`;
  const osmHref = openStreetMapHref(facility);
  const websiteHref = safeExternalHref(facility.website);
  const writeLabel = ownReview ? t.facility.editYourReview : t.facility.writeReview;

  return (
    <div className="page" style={{ paddingBlock: "var(--space-l) var(--space-3xl)" }}>
      <script
        type="application/ld+json"
        // Structured data is how a directory gets found at all; the escape
        // stops a review body from closing this script element.
        dangerouslySetInnerHTML={{ __html: structuredData(facility, reviews, t) }}
      />

      <nav
        aria-label={t.facility.breadcrumb}
        style={{ marginBlockEnd: "var(--space-m)" }}
      >
        <ol
          className="label"
          style={{
            listStyle: "none",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2xs)",
            margin: 0,
            padding: 0,
          }}
        >
          {/* The country was here until every facility on the site was in the
              same one. The region is the level that actually tells a reader
              where this is — and where to look for alternatives to it.

              Five regions share a name with their capital, so Riyadh would
              otherwise read "Riyadh / Riyadh / …" and look like a bug. The
              city link is the more useful of the two, so the region step is
              the one that goes. */}
          {regionName === cityName ? null : (
            <>
              <li>
                <Link href={`/regions/${regionSlug}`}>
                  <bdi dir="auto">{regionName}</bdi>
                </Link>
              </li>
              <li aria-hidden="true">/</li>
            </>
          )}
          <li>
            <Link href={`/cities/${facility.city.slug}`}>
              <bdi dir="auto">{cityName}</bdi>
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: "var(--ink-2)" }}>
            <bdi dir="auto">{names.primary}</bdi>
          </li>
        </ol>
      </nav>

      <header style={{ display: "grid", gap: "var(--space-s)" }}>
        <h1 style={{ fontSize: "var(--step-4)" }}>
          <bdi dir="auto">{names.primary}</bdi>
        </h1>

        {names.secondary ? (
          <bdi
            dir="auto"
            style={{ fontSize: "var(--step-1)", color: "var(--ink-3)" }}
          >
            {names.secondary}
          </bdi>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "var(--space-xs)",
          }}
        >
          <span className="chip">{kindLabel}</span>
          <Link className="chip" href={`/cities/${facility.city.slug}`}>
            <bdi dir="auto">{cityName}</bdi>
          </Link>
          {facility.status === "PENDING" ? (
            <span className="chip chip--warn">{t.facility.pendingBadge}</span>
          ) : null}
          {facility.reviewCount > 0 ? (
            <Link className="btn btn--small" href="#reviews">
              {t.facility.readReviews(facility.reviewCount)}
            </Link>
          ) : null}
          <Link
            className="btn btn--primary hidden lg:inline-flex"
            href={writeHref}
            style={{ marginInlineStart: "auto" }}
          >
            {writeLabel}
          </Link>
        </div>
      </header>

      <div
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
        style={{ marginBlockStart: "var(--space-l)", alignItems: "start" }}
      >
        {/* Block layout, not grid: a `position: sticky` child of a grid
            container is trapped in its own row and never sticks. */}
        <div style={{ minInlineSize: 0 }}>
          <section
            className="card"
            aria-labelledby="score-heading"
            style={{ padding: "var(--space-l)", display: "grid", gap: "var(--space-m)" }}
          >
            <h2 id="score-heading" className="sr-only">
              {t.facility.scoreHeading}
            </h2>

            {rated ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-l)",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ display: "grid", gap: "var(--space-2xs)" }}>
                  {/* The headline numeral is the sighted reading of the score;
                      the stars beside it carry the accessible name. */}
                  <span
                    className="tnum"
                    aria-hidden="true"
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: "var(--step-4)",
                      fontWeight: 700,
                      fontStretch: "92%",
                      lineHeight: "var(--lh-tight)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {facility.ratingAvg.toFixed(1)}
                  </span>
                  <Stars value={facility.ratingAvg} size={18} t={t} />
                  <span
                    className="tnum"
                    style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
                  >
                    {t.facility.ratedReviewCount(facility.ratingCount)}
                    {facility.reviewCount > facility.ratingCount
                      ? `${t.common.separator}${t.facility.totalExperienceCount(facility.reviewCount)}`
                      : ""}
                  </span>
                </div>

                <div style={{ flex: "1 1 16rem", minInlineSize: 0 }}>
                  <RatingDistribution
                    counts={distributionCounts}
                    total={facility.ratingCount}
                    t={t}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                <p className="label">{t.facility.notRatedYet}</p>
                <p style={{ maxInlineSize: "var(--measure)", color: "var(--ink-2)" }}>
                  {facility.reviewCount > 0
                    ? t.facility.unratedWithExperiences(facility.reviewCount)
                    : t.facility.notRatedBody(kindLabel.toLowerCase())}
                </p>
                <div>
                  <Link className="btn btn--primary" href={writeHref}>
                    {facility.reviewCount > 0
                      ? t.facility.writeFirstRating
                      : t.facility.writeFirstReview}
                  </Link>
                </div>
              </div>
            )}

            <div
              className="hidden lg:grid"
              style={{
                gap: "var(--space-s)",
                gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
                borderBlockStart: "1px solid var(--line)",
                paddingBlockStart: "var(--space-m)",
              }}
            >
              {/* The axis keys and their order come from the schema-facing
                  list; only the wording comes from the dictionary. */}
              {RATING_AXES.map((axis) => (
                <SubRating
                  key={axis.key}
                  label={t.labels.ratingAxis[axis.key].label}
                  value={facility[axis.avgKey]}
                  count={axisCount[axis.key] ?? 0}
                  t={t}
                />
              ))}
            </div>

            <details className="lg:hidden">
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {t.facility.ratingBreakdown}
              </summary>
              <div
                style={{
                  display: "grid",
                  gap: "var(--space-s)",
                  borderBlockStart: "1px solid var(--line)",
                  paddingBlockStart: "var(--space-m)",
                  marginBlockStart: "var(--space-s)",
                }}
              >
                {RATING_AXES.map((axis) => (
                  <SubRating
                    key={axis.key}
                    label={t.labels.ratingAxis[axis.key].label}
                    value={facility[axis.avgKey]}
                    count={axisCount[axis.key] ?? 0}
                    t={t}
                  />
                ))}
              </div>
            </details>
          </section>

          <section
            id="reviews"
            aria-labelledby="reviews-heading"
            style={{
              display: "grid",
              gap: "var(--space-m)",
              marginBlockStart: "var(--space-l)",
              scrollMarginBlockStart: "var(--space-l)",
            }}
          >
            <h2 id="reviews-heading" style={{ fontSize: "var(--step-2)" }}>
              {facility.reviewCount > 0
                ? t.facility.reviewsHeadingCount(facility.reviewCount)
                : t.facility.reviewsHeading}
            </h2>

            {facility.reviewCount > 1 || reviewFiltersActive ? (
              <form
                action={`/facilities/${facility.slug}#reviews`}
                method="get"
                className="card"
                aria-label={t.facility.filterReviews}
                style={{
                  padding: "var(--space-m)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "end",
                  gap: "var(--space-s)",
                }}
              >
                {sort !== "helpful" ? (
                  <input type="hidden" name="rsort" value={sort} />
                ) : null}

                <label className="field" style={{ flex: "1 1 14rem" }}>
                  <span className="label">{t.facility.reviewerField}</span>
                  <select
                    className="select"
                    name="rfield"
                    defaultValue={reviewQuery.field?.toLowerCase() ?? ""}
                  >
                    <option value="">{t.facility.allReviewerFields}</option>
                    {STUDENT_FIELDS.filter(
                      (field) =>
                        (fieldCounts.get(field) ?? 0) > 0 ||
                        field === reviewQuery.field,
                    ).map((field) => (
                      <option key={field} value={field.toLowerCase()}>
                        {lookup(t.labels.studentField, field, field)} (
                        {formatNumber(fieldCounts.get(field) ?? 0)})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" style={{ flex: "1 1 14rem" }}>
                  <span className="label">{t.facility.rotationSpecialty}</span>
                  <select
                    className="select"
                    name="rspecialty"
                    defaultValue={reviewQuery.specialty?.toLowerCase() ?? ""}
                  >
                    <option value="">{t.facility.allRotationSpecialties}</option>
                    {ROTATION_SPECIALTIES.filter(
                      (specialty) =>
                        (specialtyCounts.get(specialty) ?? 0) > 0 ||
                        specialty === reviewQuery.specialty,
                    ).map((specialty) => (
                      <option key={specialty} value={specialty.toLowerCase()}>
                        {lookup(
                          t.labels.rotationSpecialty,
                          specialty,
                          specialty,
                        )}{" "}
                        ({formatNumber(specialtyCounts.get(specialty) ?? 0)})
                      </option>
                    ))}
                  </select>
                </label>

                <button className="btn btn--primary btn--small" type="submit">
                  {t.facility.applyReviewFilters}
                </button>
                {reviewFiltersActive ? (
                  <Link
                    className="btn btn--quiet btn--small"
                    scroll={false}
                    href={buildReviewHref(
                      facility.slug,
                      reviewQuery,
                      { field: undefined, specialty: undefined },
                    )}
                  >
                    {t.facility.clearReviewFilters}
                  </Link>
                ) : null}
              </form>
            ) : null}

            {reviewFiltersActive ? (
              <p className="hint" role="status">
                {t.facility.matchingReviews(reviewPage.total)}
              </p>
            ) : null}

            {reviewPage.total > 1 ? (
              <>
                <nav
                  className="tabs hidden sm:flex"
                  aria-label={t.facility.sortReviews}
                >
                  {(Object.keys(REVIEW_SORT_OPTIONS) as ReviewSortKey[]).map(
                    (key) => (
                      <Link
                        key={key}
                        className="tab"
                        scroll={false}
                        href={buildReviewHref(facility.slug, reviewQuery, {
                          sort: key,
                          page: 1,
                        })}
                        aria-current={key === sort ? "page" : undefined}
                      >
                        {t.labels.reviewSort[key]}
                      </Link>
                    ),
                  )}
                </nav>

                <form
                  className="sm:hidden"
                  action={`/facilities/${facility.slug}#reviews`}
                  method="get"
                  style={{ display: "flex", alignItems: "end", gap: "var(--space-xs)" }}
                >
                  {reviewQuery.field ? (
                    <input
                      type="hidden"
                      name="rfield"
                      value={reviewQuery.field.toLowerCase()}
                    />
                  ) : null}
                  {reviewQuery.specialty ? (
                    <input
                      type="hidden"
                      name="rspecialty"
                      value={reviewQuery.specialty.toLowerCase()}
                    />
                  ) : null}
                  <label className="field" style={{ flex: "1 1 auto" }}>
                    <span className="label">{t.facility.sortReviews}</span>
                    <select className="select" name="rsort" defaultValue={sort}>
                      {(Object.keys(REVIEW_SORT_OPTIONS) as ReviewSortKey[]).map(
                        (key) => (
                          <option key={key} value={key}>
                            {t.labels.reviewSort[key]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <button className="btn btn--small" type="submit">
                    {t.facility.applyReviewSort}
                  </button>
                </form>
              </>
            ) : null}

            {reviews.length === 0 ? (
              <p className="notice">
                {reviewPage.total === 0
                  ? reviewFiltersActive
                    ? t.facility.noMatchingReviews
                    : t.facility.noReviewsYet
                  : t.facility.noReviewsOnPage}{" "}
                {reviewPage.total === 0 ? (
                  reviewFiltersActive ? (
                    <Link
                      scroll={false}
                      href={buildReviewHref(
                        facility.slug,
                        reviewQuery,
                        { field: undefined, specialty: undefined },
                      )}
                    >
                      {t.facility.clearReviewFilters}
                    </Link>
                  ) : (
                    <Link href={writeHref}>{t.facility.writeTheFirstOne}</Link>
                  )
                ) : (
                  <Link
                    scroll={false}
                    href={buildReviewHref(facility.slug, reviewQuery, { page: 1 })}
                  >
                    {t.facility.backToFirstPage}
                  </Link>
                )}
              </p>
            ) : (
              <ol
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "var(--space-m)",
                }}
              >
                {reviews.map((review) => (
                  <li key={review.id}>
                    <ReviewCard
                      review={review}
                      facilityReviewCount={facility.reviewCount}
                      age={coarseAge(review.createdAt, t.review, now)}
                      viewerVote={viewerVoteOf(review)}
                      viewer={threadViewer}
                      comments={commentsByReview.get(review.id) ?? []}
                      nextPath={canonicalPath}
                    />
                  </li>
                ))}
              </ol>
            )}

            {reviewPage.pageCount > 1 ? (
              <nav
                aria-label={t.facility.reviewPages}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-s)",
                }}
              >
                {page > 1 ? (
                  <Link
                    className="btn btn--small"
                    scroll={false}
                    href={buildReviewHref(facility.slug, reviewQuery, {
                      page: page - 1,
                    })}
                    rel="prev"
                  >
                    <span aria-hidden="true">{arrows.back}</span>{" "}
                    {t.facility.newerPage}
                  </Link>
                ) : (
                  <span />
                )}

                <span className="tnum" style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
                  {t.common.pageOf(page, reviewPage.pageCount)}
                </span>

                {page < reviewPage.pageCount ? (
                  <Link
                    className="btn btn--small"
                    scroll={false}
                    href={buildReviewHref(facility.slug, reviewQuery, {
                      page: page + 1,
                    })}
                    rel="next"
                  >
                    {t.facility.olderPage}{" "}
                    <span aria-hidden="true">{arrows.forward}</span>
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </section>

          {/* Last in the column on purpose: `position: sticky` with `bottom`
              pins an element only while its natural position is still below
              the viewport, so a bar placed higher up would scroll away on the
              first flick. Here it rides the bottom of the screen the whole way
              down the reviews and settles inline at the end of them. */}
          <div
            className="lg:hidden"
            style={{
              position: "sticky",
              insetBlockEnd: 0,
              zIndex: 5,
              background: "var(--paper)",
              borderBlockStart: "1px solid var(--line)",
              padding: "var(--space-xs) 0 max(var(--space-xs), env(safe-area-inset-bottom))",
              marginBlockStart: "var(--space-l)",
            }}
          >
            <Link
              className="btn btn--primary"
              href={writeHref}
              style={{ inlineSize: "100%" }}
            >
              {writeLabel}
            </Link>
          </div>
        </div>

        <aside style={{ display: "grid", gap: "var(--space-l)", minInlineSize: 0 }}>
          <section
            className="card"
            aria-labelledby="where-heading"
            style={{ padding: "var(--space-m)", display: "grid", gap: "var(--space-xs)" }}
          >
            <h2 id="where-heading" className="label" style={{ fontSize: "var(--step--2)" }}>
              {t.facility.whereHeading}
            </h2>

            <dl style={{ display: "grid", gap: "var(--space-xs)", margin: 0 }}>
              <div>
                <dt className="hint">{t.facility.address}</dt>
                <dd style={{ margin: 0 }}>
                  <bdi dir="auto">
                    {[facility.address, facility.postcode, cityName]
                      .filter(Boolean)
                      .join(comma) || cityName}
                  </bdi>
                </dd>
              </div>

              {facility.lat !== null && facility.lon !== null ? (
                <div>
                  <dt className="hint">{t.facility.coordinates}</dt>
                  {/* Pinned left-to-right: a comma with a space after it is a
                      neutral run, and in Arabic the bidi algorithm would swap
                      the latitude and the longitude round. */}
                  <dd className="tnum" style={{ margin: 0 }}>
                    <bdi dir="ltr">
                      {facility.lat.toFixed(5)}, {facility.lon.toFixed(5)}
                    </bdi>
                  </dd>
                </div>
              ) : null}

              {facility.phone ? (
                <div>
                  <dt className="hint">{t.facility.phone}</dt>
                  <dd style={{ margin: 0 }}>
                    <a href={`tel:${facility.phone.replace(/\s+/g, "")}`}>
                      <bdi dir="ltr">{facility.phone}</bdi>
                    </a>
                  </dd>
                </div>
              ) : null}

              {websiteHref ? (
                <div>
                  <dt className="hint">{t.facility.website}</dt>
                  <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
                    <a
                      href={websiteHref}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                    >
                      <bdi dir="ltr">{displayHost(websiteHref)}</bdi>{" "}
                      <span aria-hidden="true">{arrows.external}</span>
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            {osmHref ? (
              <p style={{ marginBlockStart: "var(--space-2xs)" }}>
                <a href={osmHref} rel="noopener noreferrer" target="_blank">
                  {t.facility.openInOsm}{" "}
                  <span aria-hidden="true">{arrows.external}</span>
                </a>
              </p>
            ) : null}

            <p className="hint">{t.facility.noMapNote}</p>
          </section>

          <section
            className="card"
            aria-labelledby="flag-heading"
            style={{ padding: "var(--space-m)", display: "grid", gap: "var(--space-xs)" }}
          >
            <h2 id="flag-heading" className="label" style={{ fontSize: "var(--step--2)" }}>
              {t.facility.flagHeading}
            </h2>
            <p className="hint">{t.facility.flagBody}</p>
            <div>
              <ReportControl
                targetType="facility"
                targetId={facility.id}
                signedIn={viewer !== null}
                nextPath={canonicalPath}
                strings={reportStrings(t)}
              />
            </div>
          </section>
        </aside>
      </div>

      {alsoInCity.length > 0 ? (
        <section
          aria-labelledby="nearby-heading"
          style={{ marginBlockStart: "var(--space-2xl)", display: "grid", gap: "var(--space-m)" }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--space-s)",
            }}
          >
            {/* The whole sentence is isolated rather than the city name alone:
                the dictionary decides where the name goes, and `dir="auto"`
                then lets a Latin city sit inside an Arabic heading — or the
                reverse — without either reordering the other. */}
            <h2 id="nearby-heading" style={{ fontSize: "var(--step-2)" }}>
              <bdi dir="auto">{t.facility.moreIn(cityName)}</bdi>
            </h2>
            <Link href={`/cities/${facility.city.slug}`}>
              <bdi dir="auto">
                {t.facility.allFacilitiesIn(cityName)}
              </bdi>{" "}
              <span aria-hidden="true">{arrows.forward}</span>
            </Link>
          </div>

          <div className="grid-cards">
            {alsoInCity.map((other) => (
              <FacilityCard
                key={other.slug}
                facility={other}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The viewer's own vote, when `listReviews` was given a viewer to look for. */
function viewerVoteOf(review: { votes?: { value: number }[] }): number {
  return review.votes?.[0]?.value ?? 0;
}

/**
 * Website addresses come from OpenStreetMap contributors, so the scheme is not
 * ours to trust: anything but http(s) — `javascript:` above all — is dropped
 * rather than rendered into an `href`.
 */
function safeExternalHref(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function displayHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function openStreetMapHref(facility: {
  osmType: string | null;
  osmId: bigint | null;
  lat: number | null;
  lon: number | null;
}): string | null {
  if (facility.osmType && facility.osmId !== null) {
    return `https://www.openstreetmap.org/${facility.osmType}/${facility.osmId}`;
  }
  if (facility.lat !== null && facility.lon !== null) {
    return `https://www.openstreetmap.org/?mlat=${facility.lat}&mlon=${facility.lon}#map=17/${facility.lat}/${facility.lon}`;
  }
  return null;
}

/** schema.org types, so a dental clinic is not announced as a hospital. */
const SCHEMA_TYPES: Record<string, string> = {
  HOSPITAL: "Hospital",
  CLINIC: "MedicalClinic",
  HEALTH_CENTER: "MedicalClinic",
  DENTAL_CLINIC: "Dentist",
  PHARMACY: "Pharmacy",
  LABORATORY: "MedicalClinic",
  REHAB_CENTER: "MedicalClinic",
  MENTAL_HEALTH: "MedicalClinic",
  OTHER: "MedicalOrganization",
};

type StructuredFacility = {
  slug: string;
  name: string;
  nameLocal: string | null;
  kind: string;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lon: number | null;
  website: string | null;
  phone: string | null;
  ratingAvg: number;
  reviewCount: number;
  ratingCount: number;
  city: { name: string; countryCode: string };
};

type StructuredReview = {
  overall: number | null;
  title: string | null;
  body: string;
  source: string;
  author: { username: string } | null;
};

function structuredData(
  facility: StructuredFacility,
  reviews: StructuredReview[],
  t: Dictionary,
): string {
  // schema.org wants an absolute URL; `env` supplies one in every environment.
  const url = `${env.NEXT_PUBLIC_SITE_URL}/facilities/${facility.slug}`;
  const website = safeExternalHref(facility.website);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPES[facility.kind] ?? "MedicalOrganization",
    name: facility.name,
    alternateName: facility.nameLocal ?? undefined,
    url,
    telephone: facility.phone ?? undefined,
    sameAs: website ? [website] : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: facility.address ?? undefined,
      addressLocality: facility.city.name,
      postalCode: facility.postcode ?? undefined,
      addressCountry: facility.city.countryCode,
    },
    geo:
      facility.lat !== null && facility.lon !== null
        ? {
            "@type": "GeoCoordinates",
            latitude: facility.lat,
            longitude: facility.lon,
          }
        : undefined,
  };

  if (facility.ratingCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: facility.ratingAvg,
      reviewCount: facility.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (facility.reviewCount > 0) {
    // No `datePublished`: an exact date beside a field and a small department
    // is identifying, and the schema does not require one.
    data.review = reviews.slice(0, 10).map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name:
          review.source === "BATCH17_SURVEY"
            ? t.review.importedSurvey
            : (review.author?.username ?? t.review.authorDeleted),
      },
      reviewRating:
        review.overall === null
          ? undefined
          : {
              "@type": "Rating",
              ratingValue: review.overall,
              bestRating: 5,
              worstRating: 1,
            },
      name: review.title ?? undefined,
      reviewBody:
        review.body.length > 600
          ? `${review.body.slice(0, 600).trimEnd()}…`
          : review.body,
    }));
  }

  return JSON.stringify(data).replace(/</g, "\\u003c");
}
