import type { Metadata } from "next";
import Link from "next/link";
import { listCities } from "@/lib/queries";
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

type CountryGroup = {
  code: string;
  name: string;
  cities: CityRow[];
  facilityCount: number;
  reviewCount: number;
};

/**
 * Group by country, then order countries the way the city list itself is
 * ordered: by how much testimony is behind them, not alphabetically. A reader
 * arriving here is looking for somewhere with reviews to read.
 */
function groupByCountry(cities: CityRow[], t: Dictionary): CountryGroup[] {
  const groups = new Map<string, CountryGroup>();

  for (const city of cities) {
    const code = city.countryCode;
    let group = groups.get(code);
    if (!group) {
      group = {
        code,
        // The country column holds an English name; the dictionary has the
        // Arabic one, so the translation wins wherever it exists.
        name: lookup(t.labels.country, code, city.country ?? code),
        cities: [],
        facilityCount: 0,
        reviewCount: 0,
      };
      groups.set(code, group);
    }
    group.cities.push(city);
    group.facilityCount += city.facilityCount;
    group.reviewCount += city.reviewCount;
  }

  return [...groups.values()].sort(
    (a, b) =>
      b.reviewCount - a.reviewCount ||
      b.facilityCount - a.facilityCount ||
      a.name.localeCompare(b.name),
  );
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
  const groups = groupByCountry(cities, t);
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
            key={group.code}
            aria-labelledby={`country-${group.code}`}
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
              <h2 id={`country-${group.code}`} style={{ fontSize: "var(--step-1)" }}>
                <bdi dir="auto">{group.name}</bdi>
              </h2>
              <Link
                className="hint"
                href={`/facilities?country=${group.code.toLowerCase()}`}
              >
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
