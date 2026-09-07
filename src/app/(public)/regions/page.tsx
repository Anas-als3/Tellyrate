import type { Metadata } from "next";
import Link from "next/link";
import { listRegions, type RegionSummary } from "@/lib/regions";
import {
  getDictionary,
  lookup,
  type Dictionary,
} from "@/lib/i18n/dictionaries";
import { getLocale, getT } from "@/lib/i18n/server";

/**
 * Rendered per request, like the city index and for the same reason: the
 * counts come from the database, so prerendering would need one during
 * `next build` — which `docker build` has no route to — and would freeze a
 * snapshot of a directory that grows every night.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t.regions.metaTitle,
    description: t.cities.metaDescription,
    alternates: { canonical: "/regions" },
  };
}

function RegionLink({ region, t }: { region: RegionSummary; t: Dictionary }) {
  const name = lookup(t.labels.region, region.key, region.key);

  return (
    <Link
      className="card"
      href={`/regions/${region.slug}`}
      style={{
        display: "grid",
        gap: "var(--space-3xs)",
        padding: "var(--space-s) var(--space-m)",
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <span style={{ fontSize: "var(--step-0)", fontWeight: 600 }}>
        <bdi dir="auto">{name}</bdi>
      </span>
      <span
        className="tnum"
        style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
      >
        {/* A region with nothing in it says so rather than reading "0
            facilities": it is waiting for its first record, not empty of
            hospitals, and the difference matters to whoever lives there. */}
        {region.facilityCount === 0 ? (
          t.regions.noFacilitiesYet
        ) : (
          <>
            {t.common.cityCount(region.cityCount)}
            {t.common.separator}
            {t.common.facilityCount(region.facilityCount)}
          </>
        )}
      </span>
    </Link>
  );
}

export default async function RegionsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const regions = await listRegions();

  const totalCities = regions.reduce((sum, r) => sum + r.cityCount, 0);
  const totalFacilities = regions.reduce((sum, r) => sum + r.facilityCount, 0);

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header style={{ display: "grid", gap: "var(--space-s)" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>
          {t.regions.heading}
        </h1>
        <p className="hint tnum" style={{ maxInlineSize: "var(--measure)" }}>
          {t.regions.lede(regions.length, totalCities, totalFacilities)}
        </p>
      </header>

      <ul
        className="grid-cards"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          marginBlockStart: "var(--space-xl)",
        }}
      >
        {regions.map((region) => (
          <li key={region.key}>
            <RegionLink region={region} t={t} />
          </li>
        ))}
      </ul>

      {/* The flat city list is still the faster route for anyone who already
          knows the city they want. */}
      <p style={{ marginBlockStart: "var(--space-l)" }}>
        <Link className="hint" href="/cities">
          {t.home.browseByCity}
        </Link>
      </p>
    </div>
  );
}
