import type { Metadata } from "next";
import Link from "next/link";
import { listCities } from "@/lib/queries";
import { REGIONS } from "@/lib/labels";
import {
  getDictionary,
  lookup,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { cityNameFor } from "@/lib/i18n/names";
import { getLocale, getT } from "@/lib/i18n/server";
import { EmptyState } from "@/components/empty-state";

/**
 * Rendered per request, not prerendered.
 *
 * This page reads live data, so prerendering it would need a database during
 * `next build` — which `docker build` has no route to, and which would bake a
 * snapshot of the directory into the image. The prose pages (/about,
 * /privacy, /guidelines) carry no data and stay static.
 */
export const dynamic = "force-dynamic";

/**
 * A function rather than a constant, because the title and description are
 * different sentences in each language and the locale is only known per
 * request.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t.cities.metaTitle,
    description: t.cities.metaDescription,
    alternates: { canonical: "/cities" },
  };
}

type CityRow = Awaited<ReturnType<typeof listCities>>[number];

type RegionGroup = {
  key: string;
  slug: string;
  name: string;
  cities: CityRow[];
  facilityCount: number;
};

/**
 * Group by region, in the fixed order `REGIONS` carries.
 *
 * Not by how much testimony sits behind each one, the way the cities inside a
 * group are ordered: this list is how a reader finds a place they already have
 * in mind, and a heading that moves down the page whenever someone posts a
 * review is a heading nobody can learn the position of. A region with no
 * listed city yet is skipped here — /regions is the page that accounts for
 * all thirteen.
 */
function groupByRegion(cities: CityRow[], t: Dictionary): RegionGroup[] {
  const byRegion = new Map<string, CityRow[]>();

  for (const city of cities) {
    const group = byRegion.get(city.region);
    if (group) group.push(city);
    else byRegion.set(city.region, [city]);
  }

  return REGIONS.flatMap(({ key, slug }) => {
    const cityRows = byRegion.get(key);
    if (!cityRows) return [];

    return [
      {
        key,
        slug,
        name: lookup(t.labels.region, key, key),
        cities: cityRows,
        facilityCount: cityRows.reduce(
          (sum, city) => sum + city.facilityCount,
          0,
        ),
      },
    ];
  });
}

function CityLink({
  city,
  t,
  locale,
}: {
  city: CityRow;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <Link
      className="card"
      href={`/cities/${city.slug}`}
      style={{
        display: "grid",
        gap: "var(--space-3xs)",
        padding: "var(--space-s) var(--space-m)",
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <span style={{ fontSize: "var(--step-0)", fontWeight: 600 }}>
        <bdi dir="auto">{cityNameFor(locale, city.name)}</bdi>
      </span>
      <span className="tnum" style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
        {t.cities.cityLine(city.facilityCount, city.reviewCount)}
      </span>
    </Link>
  );
}

export default async function CitiesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const cities = await listCities();
  const groups = groupByRegion(cities, t);
  const totalFacilities = groups.reduce((sum, g) => sum + g.facilityCount, 0);

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header style={{ display: "grid", gap: "var(--space-s)" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>{t.cities.heading}</h1>
        <p className="hint tnum" style={{ maxInlineSize: "var(--measure)" }}>
          {t.cities.lede(cities.length, totalFacilities)}
        </p>
      </header>

      {groups.length === 0 ? (
        <div style={{ marginBlockStart: "var(--space-xl)" }}>
          <EmptyState
            title={t.cities.emptyTitle}
            primary={{
              href: "/facilities/new",
              label: t.cities.addFacility,
            }}
          >
            <p>{t.cities.emptyBody}</p>
          </EmptyState>
        </div>
      ) : (
        groups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`region-${group.slug}`}
            style={{ marginBlockStart: "var(--space-xl)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "var(--space-s)",
                borderBlockEnd: "1px solid var(--line)",
                paddingBlockEnd: "var(--space-2xs)",
                marginBlockEnd: "var(--space-m)",
              }}
            >
              <h2 id={`region-${group.slug}`} style={{ fontSize: "var(--step-1)" }}>
                {/* The heading is the way into the region itself: its own page
                    carries the cities that have nothing listed yet, which this
                    index leaves out. */}
                <Link href={`/regions/${group.slug}`} style={{ color: "inherit" }}>
                  <bdi dir="auto">{group.name}</bdi>
                </Link>
              </h2>
              <Link className="hint" href={`/facilities?region=${group.slug}`}>
                {t.cities.allFacilitiesIn(group.facilityCount)}
              </Link>
            </div>

            <ul
              className="grid-cards"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {group.cities.map((city) => (
                <li key={city.slug}>
                  <CityLink city={city} t={t} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
