import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_SIZE, listCities, listFacilities } from "@/lib/queries";
import { COUNTRY_NAMES } from "@/lib/labels";
import { MAX_QUERY_LENGTH, parseFacilityQuery } from "@/lib/facility-query";
import { FacilityCard } from "@/components/facility-card";
import { EmptyState } from "@/components/empty-state";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Search results are never indexed — they are a reader's private path into the
 * directory, and every distinct query would otherwise become a thin page.
 * `follow` stays on so the facilities they lead to are still discovered.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q } = parseFacilityQuery(await searchParams);
  return {
    title: q ? `Search: ${q}` : "Search",
    robots: { index: false, follow: true },
  };
}

function SearchForm({ value }: { value: string }) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="Search facilities and cities"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-xs)",
        marginBlockStart: "var(--space-s)",
      }}
    >
      <label style={{ flex: "1 1 20rem", minInlineSize: 0 }}>
        <span className="sr-only">Search facilities and cities</span>
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={value}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="A hospital, a clinic, or a city"
        />
      </label>
      <button className="btn btn--primary" type="submit">
        Search
      </button>
    </form>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Reading costs nothing and is never gated, so no rate limit here — a
  // throttle on search would only ever punish someone browsing.
  const { q } = parseFacilityQuery(await searchParams);

  if (!q) {
    return (
      <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>Search</h1>
        <p className="hint" style={{ maxInlineSize: "var(--measure)" }}>
          Look for a hospital, clinic or health centre by name, or for a city to
          see everywhere students trained there.
        </p>
        <SearchForm value="" />
        <p style={{ marginBlockStart: "var(--space-l)" }}>
          <Link className="btn" href="/facilities">
            Browse all facilities
          </Link>{" "}
          <Link className="btn btn--quiet" href="/cities">
            Browse by city
          </Link>
        </p>
      </div>
    );
  }

  const [facilityResult, cities] = await Promise.all([
    listFacilities({ sort: "most_reviewed", page: 1, query: q }),
    listCities({ query: q }),
  ]);

  const nothingFound = facilityResult.total === 0 && cities.length === 0;

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header>
        <h1 style={{ fontSize: "var(--step-3)" }}>
          Results for <bdi dir="auto">“{q}”</bdi>
        </h1>
        <SearchForm value={q} />
      </header>

      <p role="status" className="sr-only">
        {nothingFound
          ? `Nothing found for ${q}.`
          : `${facilityResult.total} ${facilityResult.total === 1 ? "facility" : "facilities"} and ${cities.length} ${cities.length === 1 ? "city" : "cities"} match ${q}.`}
      </p>

      {nothingFound ? (
        <div style={{ marginBlockStart: "var(--space-xl)" }}>
          <EmptyState
            title={`Nothing found for “${q}”`}
            primary={{
              href: `/facilities/new?name=${encodeURIComponent(q)}`,
              label: "Add this facility",
            }}
            secondary={{ href: "/facilities", label: "Browse all facilities" }}
          >
            <p>
              Try a shorter name, or the city instead. If the place you trained
              in is genuinely missing, adding it takes about a minute.
            </p>
          </EmptyState>
        </div>
      ) : null}

      {cities.length > 0 ? (
        <section
          aria-labelledby="search-cities"
          style={{ marginBlockStart: "var(--space-xl)" }}
        >
          <h2
            id="search-cities"
            style={{
              fontSize: "var(--step-1)",
              borderBlockEnd: "1px solid var(--line)",
              paddingBlockEnd: "var(--space-2xs)",
              marginBlockEnd: "var(--space-m)",
            }}
          >
            Cities
          </h2>
          <ul
            className="grid-cards"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {cities.map((city) => (
              <li key={city.slug}>
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
                  <span style={{ fontWeight: 600 }}>
                    <bdi dir="auto">{city.name}</bdi>
                  </span>
                  <span
                    className="tnum"
                    style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
                  >
                    {COUNTRY_NAMES[city.countryCode] ?? city.country} ·{" "}
                    {city.facilityCount}{" "}
                    {city.facilityCount === 1 ? "facility" : "facilities"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {facilityResult.total > 0 ? (
        <section
          aria-labelledby="search-facilities"
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
            <h2 id="search-facilities" style={{ fontSize: "var(--step-1)" }}>
              Facilities{" "}
              <span className="tnum hint">({facilityResult.total})</span>
            </h2>
            {facilityResult.total > PAGE_SIZE ? (
              <Link
                className="hint"
                href={`/facilities?q=${encodeURIComponent(q)}`}
              >
                All results, with filters
              </Link>
            ) : null}
          </div>

          <ul
            className="grid-cards"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {facilityResult.facilities.map((facility) => (
              <li key={facility.slug}>
                <FacilityCard facility={facility} />
              </li>
            ))}
          </ul>

          <p style={{ marginBlockStart: "var(--space-l)" }}>
            <Link className="btn" href={`/facilities?q=${encodeURIComponent(q)}`}>
              Refine these results
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
