import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSiteCounts, listCities } from "@/lib/queries";
import { rotationStamp, STUDENT_FIELD_LABELS } from "@/lib/labels";
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

export const metadata: Metadata = {
  title: {
    absolute: "Hospirate — what a clinical rotation is really like",
  },
  description:
    "Anonymous reviews of the hospitals and clinics where healthcare students train. Search by name or city, read what supervision and hands-on time were actually like, and add your own placement.",
  alternates: { canonical: "/" },
};

/** Everything `<FacilityCard>` needs, and nothing else. */
const facilityCardSelect = {
  slug: true,
  name: true,
  nameLocal: true,
  kind: true,
  reviewCount: true,
  ratingAvg: true,
  city: { select: { name: true, slug: true, countryCode: true } },
} as const;

const HOME_CARD_COUNT = 8;
const LATEST_REVIEW_COUNT = 6;

/** Below this a five-star average is one person's opinion, not a rating. */
const RATED_THRESHOLD = 3;

const numbers = new Intl.NumberFormat("en");

export default async function HomePage() {
  const [counts, cities, mostReviewed, highestRated, latestReviews] =
    await Promise.all([
      getSiteCounts(),
      listCities(),
      prisma.facility.findMany({
        where: { status: "PUBLISHED", reviewCount: { gt: 0 } },
        orderBy: [{ reviewCount: "desc" }, { bayesScore: "desc" }, { name: "asc" }],
        take: HOME_CARD_COUNT,
        select: facilityCardSelect,
      }),
      prisma.facility.findMany({
        where: { status: "PUBLISHED", reviewCount: { gte: RATED_THRESHOLD } },
        orderBy: [{ bayesScore: "desc" }, { reviewCount: "desc" }, { name: "asc" }],
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
          title: true,
          body: true,
          field: true,
          trainingYear: true,
          facility: {
            select: { slug: true, name: true, reviewCount: true },
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

  const topCities = [...cities]
    .sort((a, b) => b.facilityCount - a.facilityCount)
    .slice(0, 6);

  return (
    <div className="page" style={{ paddingBlockEnd: "var(--space-2xl)" }}>
      <section
        aria-labelledby="hero-heading"
        style={{ paddingBlock: "var(--space-2xl) var(--space-xl)" }}
      >
        <span className="label">Anonymous reviews by healthcare students</span>

        <h1
          id="hero-heading"
          style={{
            marginBlockStart: "var(--space-s)",
            maxInlineSize: "17ch",
          }}
        >
          Know where to train before you apply.
        </h1>

        <p
          className="prose"
          style={{
            marginBlockStart: "var(--space-m)",
            maxInlineSize: "54ch",
            color: "var(--ink-2)",
          }}
        >
          Students who already did their training year describe the
          supervision, the hands-on time and the way they were treated — so you
          can pick the hospitals worth applying to.
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
            Search facilities
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
              placeholder="Hospital, clinic, or city"
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
              Search
            </button>
          </div>
        </form>

        {topCities.length > 0 ? (
          <div style={{ marginBlockStart: "var(--space-l)" }}>
            <span className="label">Browse by city</span>
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
              {topCities.map((city) => (
                <li key={city.slug}>
                  <Link href={`/cities/${city.slug}`} className="chip">
                    <bdi dir="auto">{city.name}</bdi>
                    <span className="tnum" style={{ color: "var(--ink-3)" }}>
                      {numbers.format(city.facilityCount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p
          className="hint tnum"
          style={{ marginBlockStart: "var(--space-m)" }}
        >
          {numbers.format(counts.facilities)}{" "}
          {counts.facilities === 1 ? "facility" : "facilities"} ·{" "}
          {numbers.format(counts.cities)}{" "}
          {counts.cities === 1 ? "city" : "cities"} ·{" "}
          {counts.reviews === 0
            ? "no reviews yet"
            : `${numbers.format(counts.reviews)} ${counts.reviews === 1 ? "review" : "reviews"}`}
        </p>
      </section>

      {mostReviewed.length > 0 ? (
        <Section
          id="most-reviewed"
          title="Most reviewed"
          href="/facilities"
          linkLabel="All facilities"
        >
          <div className="grid-cards">
            {mostReviewed.map((facility) => (
              <FacilityCard key={facility.slug} facility={facility} />
            ))}
          </div>
        </Section>
      ) : recentlyAdded.length > 0 ? (
        <Section
          id="recently-added"
          title="Recently added"
          note="waiting for a first review"
          href="/facilities?sort=newest"
          linkLabel="All facilities"
        >
          <div className="grid-cards">
            {recentlyAdded.map((facility) => (
              <FacilityCard key={facility.slug} facility={facility} />
            ))}
          </div>
        </Section>
      ) : null}

      {highestRated.length > 0 ? (
        <Section
          id="highest-rated"
          title="Highest rated"
          // Said out loud rather than hidden in a tooltip: a 5.0 from a single
          // review is noise, and a reader deserves to know it was excluded.
          note={`${RATED_THRESHOLD}+ reviews`}
          href="/facilities?sort=highest_rated"
          linkLabel="All facilities by rating"
        >
          <div className="grid-cards">
            {highestRated.map((facility) => (
              <FacilityCard key={facility.slug} facility={facility} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        id="latest-reviews"
        title="Latest reviews"
        href={latestReviews.length > 0 ? "/facilities" : undefined}
        linkLabel="Browse facilities"
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
              <ReviewPreview key={review.id} review={review} />
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
            <p className="prose">
              Nobody has written one yet. Every facility here is waiting for the
              first student who trained there to say what it was actually like.
            </p>
            <p className="hint">
              Find the place you trained, then leave a rating and a few
              sentences. Readers only ever see a username.
            </p>
            <Link href="/facilities" className="btn btn--primary">
              Write the first review
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
          Why this can be honest
        </h2>
        <div
          style={{
            marginBlockStart: "var(--space-s)",
            display: "grid",
            gap: "var(--space-m)",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          <p style={promiseLine}>
            Signing up asks for a username and a password. There is no email
            field, because there is no email.
          </p>
          <p style={promiseLine}>
            Reviews carry no real name, no school and no exact dates — timing is
            blurred until a place has enough reviews to hide in.
          </p>
          <p style={promiseLine}>
            No analytics, no third-party fonts, no trackers. Nothing on this
            page is loaded from anyone else&rsquo;s server.
          </p>
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
            How this works
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
  overall: number;
  title: string | null;
  body: string;
  field: string;
  trainingYear: number | null;
  facility: { slug: string; name: string; reviewCount: number };
};

function ReviewPreview({ review }: { review: ReviewPreviewData }) {
  const stamp = rotationStamp(review.trainingYear, review.facility.reviewCount);
  const field = STUDENT_FIELD_LABELS[review.field] ?? "Student";

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
        {stamp ? ` · ${stamp}` : ""}
      </span>

      <Stars value={review.overall} size={14} showValue />

      {review.title ? (
        <h3 style={{ fontSize: "var(--step-1)" }}>{review.title}</h3>
      ) : null}

      <p className="prose" style={{ fontSize: "var(--step-0)", maxInlineSize: "none" }}>
        {excerpt(review.body)}
      </p>

      <div className="stamp" style={{ marginBlockStart: "auto" }}>
        <Link
          href={`/facilities/${review.facility.slug}`}
          style={{ color: "var(--ink-2)", textDecoration: "none" }}
        >
          <bdi dir="auto">{review.facility.name}</bdi>
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
