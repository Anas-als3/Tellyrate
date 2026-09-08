import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSiteCounts } from "@/lib/queries";
import { listRegions } from "@/lib/regions";
import { rotationStamp } from "@/lib/labels";
import {
  formatNumber,
  getDictionary,
  lookup,
  type Dictionary,
} from "@/lib/i18n/dictionaries";
import { facilityNamesFor } from "@/lib/i18n/names";
import { getLocale } from "@/lib/i18n/server";
import { FacilityCard } from "@/components/facility-card";
import { Stars } from "@/components/stars";

/**
 * Rendered per request, not prerendered.
 *
 * This page reads live data, so prerendering it would need a database during
 * `next build` — which `docker build` has no route to, and which would bake a
 * snapshot of the directory into the image. The prose pages (/about,
 * /privacy, /guidelines) carry no data and stay static.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());

  return {
    title: { absolute: t.home.metaTitle },
    description: t.home.metaDescription,
    alternates: { canonical: "/" },
  };
}

/** Everything `<FacilityCard>` needs, and nothing else. */
const facilityCardSelect = {
  slug: true,
  name: true,
  nameEn: true,
  nameLocal: true,
  kind: true,
  reviewCount: true,
  ratingCount: true,
  ratingAvg: true,
  city: { select: { name: true, slug: true, countryCode: true } },
} as const;

const HOME_CARD_COUNT = 8;
const LATEST_REVIEW_COUNT = 6;

/** Below this a five-star average is one person's opinion, not a rating. */
const RATED_THRESHOLD = 3;

export default async function HomePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const [counts, regions, mostReviewed, highestRated, latestReviews] =
    await Promise.all([
      getSiteCounts(),
      listRegions(),
      prisma.facility.findMany({
        where: { status: "PUBLISHED", reviewCount: { gt: 0 } },
        orderBy: [{ reviewCount: "desc" }, { bayesScore: "desc" }, { name: "asc" }],
        take: HOME_CARD_COUNT,
        select: facilityCardSelect,
      }),
      prisma.facility.findMany({
        where: { status: "PUBLISHED", ratingCount: { gte: RATED_THRESHOLD } },
        orderBy: [{ bayesScore: "desc" }, { ratingCount: "desc" }, { name: "asc" }],
        take: HOME_CARD_COUNT,
        select: facilityCardSelect,
      }),
      prisma.review.findMany({
        where: { status: "PUBLISHED", facility: { status: "PUBLISHED" } },
        orderBy: { createdAt: "desc" },
        take: LATEST_REVIEW_COUNT,
        select: {
          id: true,
          overall: true,
          source: true,
          title: true,
          body: true,
          field: true,
          specialty: true,
          trainingYear: true,
          facility: {
            select: {
              slug: true,
              name: true,
              nameEn: true,
              nameLocal: true,
              reviewCount: true,
            },
          },
        },
      }),
    ]);

  // Before the first review lands there is no "most reviewed", so show what is
  // actually true instead — the places most recently added to the directory.
  const recentlyAdded =
    mostReviewed.length === 0
      ? await prisma.facility.findMany({
          where: { status: "PUBLISHED" },
          orderBy: [{ createdAt: "desc" }, { name: "asc" }],
          take: HOME_CARD_COUNT,
          select: facilityCardSelect,
        })
      : [];

  return (
    <div className="page" style={{ paddingBlockEnd: "var(--space-2xl)" }}>
      <section
        aria-labelledby="hero-heading"
        style={{ paddingBlock: "var(--space-2xl) var(--space-xl)" }}
      >
        <span className="label">{t.home.eyebrow}</span>

        <h1
          id="hero-heading"
          style={{
            marginBlockStart: "var(--space-s)",
            maxInlineSize: "17ch",
          }}
        >
          {t.home.heading}
        </h1>

        <p
          className="prose"
          style={{
            marginBlockStart: "var(--space-m)",
            maxInlineSize: "54ch",
            color: "var(--ink-2)",
          }}
        >
          {t.home.lede}
        </p>

        {/* The hero is the search box. A plain GET form, so it works before any
            JavaScript loads and every result set gets a shareable URL. */}
        <form
          action="/search"
          method="get"
          role="search"
          style={{
            marginBlockStart: "var(--space-l)",
            maxInlineSize: 560,
          }}
        >
          <label htmlFor="home-search" className="label">
            {t.home.searchLabel}
          </label>
          <div
            style={{
              display: "flex",
              gap: "var(--space-xs)",
              marginBlockStart: "var(--space-2xs)",
            }}
          >
            <input
              id="home-search"
              name="q"
              type="search"
              className="input"
              placeholder={t.home.searchPlaceholder}
              autoComplete="off"
              style={{
                flex: "1 1 auto",
                minInlineSize: 0,
                padding: "12px var(--space-m)",
                fontSize: "var(--step-1)",
              }}
            />
            <button
              type="submit"
              className="btn btn--primary"
              style={{ paddingInline: "var(--space-l)" }}
            >
              {t.home.searchButton}
            </button>
          </div>
        </form>

        {/* Six cities used to sit here. A student weighing a training year
            starts a level up — "somewhere in Qassim" comes before Buraydah —
            and thirteen regions cover the whole country, where six cities
            silently left most of it out. */}
        <div style={{ marginBlockStart: "var(--space-l)" }}>
          <Link
            className="label"
            href="/regions"
            style={{ color: "var(--brand-ink)", textDecoration: "none" }}
          >
            {t.home.browseByRegion}
          </Link>
          <ul
            style={{
              listStyle: "none",
              margin: "var(--space-xs) 0 0",
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-2xs)",
            }}
          >
            {regions.map((region) => (
              <li key={region.slug}>
                <Link href={`/regions/${region.slug}`} className="chip">
                  <bdi dir="auto">
                    {lookup(t.labels.region, region.key, region.key)}
                  </bdi>
                  <span className="tnum" style={{ color: "var(--ink-3)" }}>
                    {formatNumber(region.facilityCount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p
          className="hint tnum"
          style={{ marginBlockStart: "var(--space-m)" }}
        >
          {t.home.stats(counts.facilities, counts.cities, counts.reviews)}
        </p>
      </section>

      {mostReviewed.length > 0 ? (
        <Section
          id="most-reviewed"
          title={t.home.mostReviewed}
          href="/facilities"
          linkLabel={t.home.allFacilities}
        >
          <div className="grid-cards">
            {mostReviewed.map((facility) => (
              <FacilityCard
                key={facility.slug}
                facility={facility}
                locale={locale}
              />
            ))}
          </div>
        </Section>
      ) : recentlyAdded.length > 0 ? (
        <Section
          id="recently-added"
          title={t.home.recentlyAdded}
          note={t.home.recentlyAddedNote}
          href="/facilities?sort=newest"
          linkLabel={t.home.allFacilities}
        >
          <div className="grid-cards">
            {recentlyAdded.map((facility) => (
              <FacilityCard
                key={facility.slug}
                facility={facility}
                locale={locale}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {highestRated.length > 0 ? (
        <Section
          id="highest-rated"
          title={t.home.highestRated}
          // Said out loud rather than hidden in a tooltip: a 5.0 from a single
          // review is noise, and a reader deserves to know it was excluded.
          note={t.home.highestRatedNote(RATED_THRESHOLD)}
          href="/facilities?sort=highest_rated"
          linkLabel={t.home.allFacilitiesByRating}
        >
          <div className="grid-cards">
            {highestRated.map((facility) => (
              <FacilityCard
                key={facility.slug}
                facility={facility}
                locale={locale}
              />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        id="latest-reviews"
        title={t.home.latestReviews}
        href={latestReviews.length > 0 ? "/facilities" : undefined}
        linkLabel={t.home.browseFacilities}
      >
        {latestReviews.length > 0 ? (
          <div
            style={{
              display: "grid",
              gap: "var(--space-m)",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            }}
          >
            {latestReviews.map((review) => (
              <ReviewPreview
                key={review.id}
                review={review}
                t={t}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: "var(--space-l)",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "var(--space-s)",
            }}
          >
            <p className="prose">{t.home.noReviewsBody}</p>
            <p className="hint">{t.home.noReviewsHint}</p>
            <Link href="/facilities" className="btn btn--primary">
              {t.home.writeFirstReview}
            </Link>
          </div>
        )}
      </Section>

      <section
        aria-labelledby="privacy-heading"
        style={{
          marginBlockStart: "var(--space-2xl)",
          paddingBlockStart: "var(--space-m)",
          borderBlockStart: "1px solid var(--line)",
        }}
      >
        <h2
          id="privacy-heading"
          className="label"
          style={{ fontSize: "var(--step--2)", fontWeight: 400 }}
        >
          {t.home.privacyHeading}
        </h2>
        <div
          style={{
            marginBlockStart: "var(--space-s)",
            display: "grid",
            gap: "var(--space-m)",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          <p style={promiseLine}>{t.home.promiseAccount}</p>
          <p style={promiseLine}>{t.home.promiseReviews}</p>
          <p style={promiseLine}>{t.home.promiseTracking}</p>
        </div>
        <p style={{ marginBlockStart: "var(--space-s)" }}>
          <Link
            href="/privacy"
            style={{
              fontSize: "var(--step--1)",
              fontWeight: 600,
              color: "var(--brand-ink)",
            }}
          >
            {t.home.howThisWorks}
          </Link>
        </p>
      </section>
    </div>
  );
}

const promiseLine: React.CSSProperties = {
  fontSize: "var(--step--1)",
  color: "var(--ink-3)",
  maxInlineSize: "40ch",
};

function Section({
  id,
  title,
  note,
  href,
  linkLabel,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      style={{ marginBlockStart: "var(--space-2xl)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-s)",
          marginBlockEnd: "var(--space-m)",
        }}
      >
        <h2 id={`${id}-heading`} style={{ fontSize: "var(--step-2)" }}>
          {title}
          {note ? (
            <span
              style={{
                fontWeight: 500,
                fontStretch: "100%",
                letterSpacing: 0,
                fontSize: "var(--step-0)",
                color: "var(--ink-3)",
              }}
            >
              {" · "}
              {note}
            </span>
          ) : null}
        </h2>
        {href && linkLabel ? (
          <Link
            href={href}
            style={{
              fontSize: "var(--step--1)",
              fontWeight: 600,
              color: "var(--brand-ink)",
              whiteSpace: "nowrap",
            }}
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type ReviewPreviewData = {
  id: string;
  overall: number | null;
  source: string;
  title: string | null;
  body: string;
  field: string;
  specialty: string | null;
  trainingYear: number | null;
  facility: {
    slug: string;
    name: string;
    nameEn: string | null;
    nameLocal: string | null;
    reviewCount: number;
  };
};

function ReviewPreview({
  review,
  t,
  locale,
}: {
  review: ReviewPreviewData;
  t: Dictionary;
  locale: "en" | "ar";
}) {
  const stamp = rotationStamp(review.trainingYear, review.facility.reviewCount);
  const facilityNames = facilityNamesFor(locale, review.facility);
  const field = lookup(
    t.labels.studentField,
    review.field,
    t.home.studentFallback,
  );

  return (
    <article
      className="card"
      style={{
        padding: "var(--space-m)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
      }}
    >
      <span className="label">
        {field}
        {review.specialty
          ? `${t.common.separator}${lookup(
              t.labels.rotationSpecialty,
              review.specialty,
              review.specialty,
            )}`
          : ""}
        {stamp ? `${t.common.separator}${stamp}` : ""}
        {review.source === "BATCH17_SURVEY"
          ? `${t.common.separator}${t.review.importedSurvey}`
          : ""}
      </span>

      {review.overall === null ? (
        <span className="chip" style={{ alignSelf: "flex-start" }}>
          {t.review.unratedExperience}
        </span>
      ) : (
        <Stars value={review.overall} size={14} showValue t={t} />
      )}

      {review.title ? (
        <h3 dir="auto" style={{ fontSize: "var(--step-1)" }}>
          {review.title}
        </h3>
      ) : null}

      <p
        className="prose"
        dir="auto"
        style={{ fontSize: "var(--step-0)", maxInlineSize: "none" }}
      >
        {excerpt(review.body)}
      </p>

      <div className="stamp" style={{ marginBlockStart: "auto" }}>
        <Link
          href={`/facilities/${review.facility.slug}`}
          style={{ color: "var(--ink-2)", textDecoration: "none" }}
        >
          <bdi dir="auto">{facilityNames.primary}</bdi>
        </Link>
      </div>
    </article>
  );
}

/** Trim to roughly 200 characters, on a word boundary where there is one. */
function excerpt(body: string, max = 200): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s,.;:—-]+$/u, "")}…`;
}
