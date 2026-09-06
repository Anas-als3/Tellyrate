import Link from "next/link";
import { Stars } from "@/components/stars";
import { lookup } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";

export type FacilityCardData = {
  slug: string;
  name: string;
  nameLocal: string | null;
  kind: string;
  reviewCount: number;
  ratingAvg: number;
  city: { name: string; slug: string; countryCode: string };
};

export async function FacilityCard({
  facility,
}: {
  facility: FacilityCardData;
}) {
  const t = await getT();
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
          <bdi dir="auto">{facility.name}</bdi>
        </Link>
      </h3>

      {facility.nameLocal ? (
        <bdi
          dir="auto"
          style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
        >
          {facility.nameLocal}
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
        <bdi dir="auto">{facility.city.name}</bdi>
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
            <Stars value={facility.ratingAvg} size={14} />
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
