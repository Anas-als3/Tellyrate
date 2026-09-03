import type { Metadata } from "next";
import Link from "next/link";
import { listCities } from "@/lib/queries";
import { COUNTRY_NAMES } from "@/lib/labels";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Cities",
  description:
    "Every city with a hospital, clinic or health centre on Hospirate, grouped by country.",
  alternates: { canonical: "/cities" },
};

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
function groupByCountry(cities: CityRow[]): CountryGroup[] {
  const groups = new Map<string, CountryGroup>();

  for (const city of cities) {
    const code = city.countryCode;
    let group = groups.get(code);
    if (!group) {
      group = {
        code,
        name: COUNTRY_NAMES[code] ?? city.country ?? code,
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

function CityLink({ city }: { city: CityRow }) {
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
        <bdi dir="auto">{city.name}</bdi>
      </span>
      <span className="tnum" style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
        {city.facilityCount}{" "}
        {city.facilityCount === 1 ? "facility" : "facilities"}
        {city.reviewCount > 0
          ? ` · ${city.reviewCount} ${city.reviewCount === 1 ? "review" : "reviews"}`
          : ""}
      </span>
    </Link>
  );
}

export default async function CitiesPage() {
  const cities = await listCities();
  const groups = groupByCountry(cities);
  const totalFacilities = groups.reduce((sum, g) => sum + g.facilityCount, 0);

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header style={{ display: "grid", gap: "var(--space-s)" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>Cities</h1>
        <p className="hint" style={{ maxInlineSize: "var(--measure)" }}>
          <span className="tnum">{cities.length}</span>{" "}
          {cities.length === 1 ? "city" : "cities"} with{" "}
          <span className="tnum">{totalFacilities}</span> places to train,
          grouped by country.
        </p>
      </header>

      {groups.length === 0 ? (
        <div style={{ marginBlockStart: "var(--space-xl)" }}>
          <EmptyState
            title="No cities yet"
            primary={{ href: "/facilities/new", label: "Add a facility" }}
          >
            <p>
              A city appears here as soon as it has its first facility. Add the
              place you trained in to start one off.
            </p>
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
                {group.name}
              </h2>
              <Link
                className="hint"
                href={`/facilities?country=${group.code.toLowerCase()}`}
              >
                All {group.facilityCount} facilities
              </Link>
            </div>

            <ul
              className="grid-cards"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {group.cities.map((city) => (
                <li key={city.slug}>
                  <CityLink city={city} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
