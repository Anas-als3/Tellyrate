import Link from "next/link";
import { Stars } from "@/components/stars";
import {
  getDictionary,
  lookup,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { cityNameFor, facilityNamesFor } from "@/lib/i18n/names";

export type FacilityCardData = {
  slug: string;
  name: string;
  nameEn: string | null;
  nameLocal: string | null;
  kind: string;
  reviewCount: number;
  ratingCount: number;
  matchingReviewCount?: number;
  ratingAvg: number;
  city: { name: string; slug: string; countryCode: string };
};

export function FacilityCard({
  facility,
  locale,
  reviewFilters,
}: {
  facility: FacilityCardData;
  locale: Locale;
  reviewFilters?: { field?: string; specialty?: string };
}) {
  const t = getDictionary(locale);
  const names = facilityNamesFor(locale, facility);
  const cityName = cityNameFor(locale, facility.city.name);
  const rated = facility.ratingCount > 0;
  const facilityHref = filteredFacilityHref(facility.slug, reviewFilters);
  const experienceLabel =
    facility.matchingReviewCount === undefined
      ? t.common.reviewCount(facility.reviewCount)
      : facility.matchingReviewCount === facility.reviewCount
        ? t.facility.matchingReviews(facility.matchingReviewCount)
        : `${t.facility.matchingReviews(facility.matchingReviewCount)}${t.common.separator}${t.facility.totalExperienceCount(facility.reviewCount)}`;

  return (
    <article
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        padding: "var(--space-m)",
      }}
    >
      <span className="label">
        {lookup(t.labels.facilityKind, facility.kind, t.labels.facilityFallback)}
      </span>

      <h3 style={{ fontSize: "var(--step-1)" }}>
        <Link
          href={facilityHref}
          style={{ textDecoration: "none" }}
        >
          {/* Names arrive from OpenStreetMap in either script, so the isolate
              has to take its direction from the text rather than the page. */}
          <bdi dir="auto">{names.primary}</bdi>
        </Link>
      </h3>

      {names.secondary ? (
        <bdi
          dir="auto"
          style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
        >
          {names.secondary}
        </bdi>
      ) : null}

      <Link
        href={`/cities/${facility.city.slug}`}
        style={{
          fontSize: "var(--step--1)",
          color: "var(--ink-3)",
          textDecoration: "none",
          marginBlockStart: "auto",
        }}
      >
        <bdi dir="auto">{cityName}</bdi>
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-xs)",
          paddingBlockStart: "var(--space-xs)",
          borderBlockStart: "1px solid var(--line)",
        }}
      >
        {rated ? (
          <>
            <Stars value={facility.ratingAvg} size={14} t={t} />
            <span
              className="tnum"
              style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}
            >
              {facility.ratingAvg.toFixed(1)}
            </span>
            <span
              className="tnum"
              style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
            >
              {t.common.separator}
              {experienceLabel}
            </span>
          </>
        ) : facility.reviewCount > 0 ? (
          <span style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
            {t.review.unratedExperience}
            {t.common.separator}
            {experienceLabel}
          </span>
        ) : (
          <span style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
            {t.facility.noReviewsYet} {t.facility.writeTheFirstOne}
          </span>
        )}
      </div>
    </article>
  );
}

function filteredFacilityHref(
  slug: string,
  filters?: { field?: string; specialty?: string },
): string {
  const search = new URLSearchParams();
  if (filters?.field) search.set("rfield", filters.field.toLowerCase());
  if (filters?.specialty) {
    search.set("rspecialty", filters.specialty.toLowerCase());
  }
  const query = search.toString();
  return `/facilities/${slug}${query ? `?${query}#reviews` : ""}`;
}
