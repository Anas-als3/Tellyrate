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
  ratingAvg: number;
  city: { name: string; slug: string; countryCode: string };
};

export function FacilityCard({
  facility,
  locale,
}: {
  facility: FacilityCardData;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const names = facilityNamesFor(locale, facility);
  const cityName = cityNameFor(locale, facility.city.name);
  const rated = facility.reviewCount > 0;

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
          href={`/facilities/${facility.slug}`}
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
              {t.common.reviewCount(facility.reviewCount)}
            </span>
          </>
        ) : (
          <span style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
            {t.facility.noReviewsYet} {t.facility.writeTheFirstOne}
          </span>
        )}
      </div>
    </article>
  );
}
