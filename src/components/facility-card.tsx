import Link from "next/link";
import { Stars } from "@/components/stars";
import { FACILITY_KIND_LABELS } from "@/lib/labels";

export type FacilityCardData = {
  slug: string;
  name: string;
  nameLocal: string | null;
  kind: string;
  reviewCount: number;
  ratingAvg: number;
  city: { name: string; slug: string; countryCode: string };
};

export function FacilityCard({ facility }: { facility: FacilityCardData }) {
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
        {FACILITY_KIND_LABELS[facility.kind] ?? "Facility"}
      </span>

      <h3 style={{ fontSize: "var(--step-1)" }}>
        <Link
          href={`/facilities/${facility.slug}`}
          style={{ textDecoration: "none" }}
        >
          {/* bdi keeps an Arabic name from reordering the Latin text around it */}
          <bdi>{facility.name}</bdi>
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
        {facility.city.name}
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
              · {facility.reviewCount}{" "}
              {facility.reviewCount === 1 ? "review" : "reviews"}
            </span>
          </>
        ) : (
          <span style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
            No reviews yet — be the first
          </span>
        )}
      </div>
    </article>
  );
}
