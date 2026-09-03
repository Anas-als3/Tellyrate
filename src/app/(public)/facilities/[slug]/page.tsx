import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { getFacilityBySlug, listReviews } from "@/lib/queries";
import {
  REVIEW_SORT_OPTIONS,
  isReviewSortKey,
  type ReviewSortKey,
} from "@/lib/ranking";
import {
  COUNTRY_NAMES,
  FACILITY_KIND_LABELS,
  RATING_AXES,
} from "@/lib/labels";
import { Stars } from "@/components/stars";
import { RatingDistribution, SubRating } from "@/components/graduated-bar";
import { FacilityCard } from "@/components/facility-card";
import { ReviewCard, coarseAge } from "@/components/review-card";
import { ReportControl } from "@/components/vote-buttons";
import type { ThreadComment, ThreadViewer } from "@/components/comment-thread";

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

const DEFAULT_REVIEW_SORT: ReviewSortKey = "helpful";

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
  const facility = await loadFacility(slug);

  if (!facility) {
    return { title: "Facility not found", robots: { index: false, follow: true } };
  }

  const kind = (FACILITY_KIND_LABELS[facility.kind] ?? "Facility").toLowerCase();
  const country =
    COUNTRY_NAMES[facility.city.countryCode] ?? facility.city.country;
  const place = `${facility.city.name}, ${country}`;

  const description =
    facility.reviewCount > 0
      ? `${facility.name} is a ${kind} in ${place}, rated ${facility.ratingAvg.toFixed(1)} out of 5 across ${facility.reviewCount} anonymous ${facility.reviewCount === 1 ? "review" : "reviews"} by healthcare students who trained there — supervision, hands-on experience, workload and how students are treated.`
      : `${facility.name} is a ${kind} in ${place}. No student reviews yet. If you did a rotation, an internship or summer training here, write the first one — anonymously.`;

  return {
    title: `${facility.name} — ${facility.city.name}`,
    description,
    alternates: { canonical: `/facilities/${facility.slug}` },
    openGraph: {
      type: "website",
      title: `${facility.name} — ${facility.city.name}`,
      description,
      url: `/facilities/${facility.slug}`,
    },
  };
}

export default async function FacilityPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const facility = await loadFacility(slug);
  if (!facility) notFound();

  const sortParam = firstParam(sp.rsort);
  // A separate `rsort`/`rpage` namespace, so paging the reviews here can never
  // be confused with paging the facility directory that linked in.
  const sort: ReviewSortKey = isReviewSortKey(sortParam)
    ? sortParam
    : DEFAULT_REVIEW_SORT;
  const page = parsePage(firstParam(sp.rpage));

  const viewer = await getCurrentUser();

  const [reviewPage, distribution, axisTotals, alsoInCity, account, ownReview] =
    await Promise.all([
      listReviews(facility.id, sort, page, viewer?.id),

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
          nameLocal: true,
          kind: true,
          reviewCount: true,
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
      age: coarseAge(row.createdAt, now),
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
    const index = Math.min(5, Math.max(1, Math.round(row.overall))) - 1;
    distributionCounts[index] += row._count;
  }

  const axisCount: Record<string, number> = {
    supervision: axisTotals._count.supervision,
    handsOn: axisTotals._count.handsOn,
    staffRespect: axisTotals._count.staffRespect,
    workload: axisTotals._count.workload,
    resources: axisTotals._count.resources,
    safety: axisTotals._count.safety,
  };

  const kindLabel = FACILITY_KIND_LABELS[facility.kind] ?? "Facility";
  const country =
    COUNTRY_NAMES[facility.city.countryCode] ?? facility.city.country;
  const rated = facility.reviewCount > 0;
  const canonicalPath = reviewsPath(facility.slug, sort, page);
  const writeHref = `/facilities/${facility.slug}/review`;
  const osmHref = openStreetMapHref(facility);
  const websiteHref = safeExternalHref(facility.website);

  return (
    <div className="page" style={{ paddingBlock: "var(--space-l) var(--space-3xl)" }}>
      <script
        type="application/ld+json"
        // Structured data is how a directory gets found at all; the escape
        // stops a review body from closing this script element.
        dangerouslySetInnerHTML={{ __html: structuredData(facility, reviews) }}
      />

      <nav aria-label="Breadcrumb" style={{ marginBlockEnd: "var(--space-m)" }}>
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
          <li>{country}</li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/cities/${facility.city.slug}`}>
              <bdi dir="auto">{facility.city.name}</bdi>
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: "var(--ink-2)" }}>
            <bdi dir="auto">{facility.name}</bdi>
          </li>
        </ol>
      </nav>

      <header style={{ display: "grid", gap: "var(--space-s)" }}>
        <h1 style={{ fontSize: "var(--step-4)" }}>
          <bdi dir="auto">{facility.name}</bdi>
        </h1>

        {facility.nameLocal ? (
          <bdi
            dir="auto"
            style={{ fontSize: "var(--step-1)", color: "var(--ink-3)" }}
          >
            {facility.nameLocal}
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
            <bdi dir="auto">{facility.city.name}</bdi>
          </Link>
          {facility.status === "PENDING" ? (
            <span className="chip chip--warn">
              Added by a user — not yet verified
            </span>
          ) : null}
          <Link
            className="btn btn--primary hidden lg:inline-flex"
            href={writeHref}
            style={{ marginInlineStart: "auto" }}
          >
            {ownReview ? "Edit your review" : "Write a review"}
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
              Student rating
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
                  <Stars value={facility.ratingAvg} size={18} />
                  <span
                    className="tnum"
                    style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
                  >
                    {facility.reviewCount}{" "}
                    {facility.reviewCount === 1 ? "review" : "reviews"}
                  </span>
                </div>

                <div style={{ flex: "1 1 16rem", minInlineSize: 0 }}>
                  <RatingDistribution
                    counts={distributionCounts}
                    total={facility.reviewCount}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                <p className="label">Not rated yet</p>
                <p style={{ maxInlineSize: "var(--measure)", color: "var(--ink-2)" }}>
                  Nobody has reviewed this {kindLabel.toLowerCase()} yet. If you
                  trained here, yours would be the first — and the only account
                  anyone gets of what the placement is actually like.
                </p>
                <div>
                  <Link className="btn btn--primary" href={writeHref}>
                    Write the first review
                  </Link>
                </div>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gap: "var(--space-s)",
                gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
                borderBlockStart: "1px solid var(--line)",
                paddingBlockStart: "var(--space-m)",
              }}
            >
              {RATING_AXES.map((axis) => (
                <SubRating
                  key={axis.key}
                  label={axis.label}
                  value={facility[axis.avgKey]}
                  count={axisCount[axis.key] ?? 0}
                />
              ))}
            </div>
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
              {rated
                ? `${facility.reviewCount} ${facility.reviewCount === 1 ? "review" : "reviews"}`
                : "Reviews"}
            </h2>

            {reviewPage.total > 1 ? (
              <nav className="tabs" aria-label="Sort reviews">
                {(
                  Object.entries(REVIEW_SORT_OPTIONS) as [ReviewSortKey, string][]
                ).map(([key, label]) => (
                  <Link
                    key={key}
                    className="tab"
                    href={reviewsHref(facility.slug, key, 1)}
                    aria-current={key === sort ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            ) : null}

            {reviews.length === 0 ? (
              <p className="notice">
                {reviewPage.total === 0
                  ? "No reviews yet."
                  : "No reviews on this page."}{" "}
                {reviewPage.total === 0 ? (
                  <Link href={writeHref}>Write the first one.</Link>
                ) : (
                  <Link href={reviewsHref(facility.slug, sort, 1)}>
                    Back to the first page.
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
                      age={coarseAge(review.createdAt, now)}
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
                aria-label="Review pages"
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
                    href={reviewsHref(facility.slug, sort, page - 1)}
                    rel="prev"
                  >
                    ← Newer page
                  </Link>
                ) : (
                  <span />
                )}

                <span className="tnum" style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
                  Page {page} of {reviewPage.pageCount}
                </span>

                {page < reviewPage.pageCount ? (
                  <Link
                    className="btn btn--small"
                    href={reviewsHref(facility.slug, sort, page + 1)}
                    rel="next"
                  >
                    Older page →
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
              padding: "var(--space-xs) 0",
              marginBlockStart: "var(--space-l)",
            }}
          >
            <Link
              className="btn btn--primary"
              href={writeHref}
              style={{ inlineSize: "100%" }}
            >
              {ownReview ? "Edit your review" : "Write a review"}
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
              Where it is
            </h2>

            <dl style={{ display: "grid", gap: "var(--space-xs)", margin: 0 }}>
              <div>
                <dt className="hint">Address</dt>
                <dd style={{ margin: 0 }}>
                  <bdi dir="auto">
                    {[facility.address, facility.postcode, facility.city.name]
                      .filter(Boolean)
                      .join(", ") || facility.city.name}
                  </bdi>
                </dd>
              </div>

              {facility.lat !== null && facility.lon !== null ? (
                <div>
                  <dt className="hint">Coordinates</dt>
                  <dd className="tnum" style={{ margin: 0 }}>
                    {facility.lat.toFixed(5)}, {facility.lon.toFixed(5)}
                  </dd>
                </div>
              ) : null}

              {facility.phone ? (
                <div>
                  <dt className="hint">Phone</dt>
                  <dd style={{ margin: 0 }}>
                    <a href={`tel:${facility.phone.replace(/\s+/g, "")}`}>
                      <bdi dir="auto">{facility.phone}</bdi>
                    </a>
                  </dd>
                </div>
              ) : null}

              {websiteHref ? (
                <div>
                  <dt className="hint">Website</dt>
                  <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
                    <a
                      href={websiteHref}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                    >
                      {displayHost(websiteHref)} ↗
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            {osmHref ? (
              <p style={{ marginBlockStart: "var(--space-2xs)" }}>
                <a href={osmHref} rel="noopener noreferrer" target="_blank">
                  Open in OpenStreetMap ↗
                </a>
              </p>
            ) : null}

            <p className="hint">
              No map is embedded here on purpose — loading tiles would tell
              another company which facility you were reading about.
            </p>
          </section>

          <section
            className="card"
            aria-labelledby="flag-heading"
            style={{ padding: "var(--space-m)", display: "grid", gap: "var(--space-xs)" }}
          >
            <h2 id="flag-heading" className="label" style={{ fontSize: "var(--step--2)" }}>
              Something wrong here?
            </h2>
            <p className="hint">
              Wrong name, closed down, or the same place listed twice? Tell a
              moderator.
            </p>
            <div>
              <ReportControl
                targetType="facility"
                targetId={facility.id}
                signedIn={viewer !== null}
                nextPath={canonicalPath}
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
            <h2 id="nearby-heading" style={{ fontSize: "var(--step-2)" }}>
              More in <bdi dir="auto">{facility.city.name}</bdi>
            </h2>
            <Link href={`/cities/${facility.city.slug}`}>
              All facilities in <bdi dir="auto">{facility.city.name}</bdi> →
            </Link>
          </div>

          <div className="grid-cards">
            {alsoInCity.map((other) => (
              <FacilityCard key={other.slug} facility={other} />
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

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 1000 ? parsed : 1;
}

/**
 * Link builder for the review list. Parameters sitting at their default are
 * omitted, so every ordering of every page has exactly one URL.
 */
function reviewsPath(slug: string, sort: ReviewSortKey, page: number): string {
  const params = new URLSearchParams();
  if (sort !== DEFAULT_REVIEW_SORT) params.set("rsort", sort);
  if (page > 1) params.set("rpage", String(page));
  const query = params.toString();
  return `/facilities/${slug}${query ? `?${query}` : ""}`;
}

function reviewsHref(slug: string, sort: ReviewSortKey, page: number): string {
  return `${reviewsPath(slug, sort, page)}#reviews`;
}

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
  city: { name: string; countryCode: string };
};

type StructuredReview = {
  overall: number;
  title: string | null;
  body: string;
  author: { username: string } | null;
};

function structuredData(
  facility: StructuredFacility,
  reviews: StructuredReview[],
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

  if (facility.reviewCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: facility.ratingAvg,
      reviewCount: facility.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };

    // No `datePublished`: an exact date beside a field and a small department
    // is identifying, and the schema does not require one.
    data.review = reviews.slice(0, 10).map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: review.author?.username ?? "deleted",
      },
      reviewRating: {
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
