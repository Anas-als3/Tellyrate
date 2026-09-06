import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_SIZE, listCities, listFacilities } from "@/lib/queries";
import { MAX_QUERY_LENGTH, parseFacilityQuery } from "@/lib/facility-query";
import { formatNumber, lookup, type Dictionary } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";
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
  const t = await getT();
  const { q } = parseFacilityQuery(await searchParams);
  return {
    title: q ? t.search.metaTitleFor(q) : t.search.metaTitle,
    robots: { index: false, follow: true },
  };
}

function SearchForm({ value, t }: { value: string; t: Dictionary }) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label={t.search.formLabel}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-xs)",
        marginBlockStart: "var(--space-s)",
      }}
    >
      <label style={{ flex: "1 1 20rem", minInlineSize: 0 }}>
        <span className="sr-only">{t.search.formLabel}</span>
        {/* Half the directory is named in Arabic and half in transliteration,
            so the field has to follow what is typed rather than the page. */}
        <input
          className="input"
          type="search"
          name="q"
          dir="auto"
          defaultValue={value}
          maxLength={MAX_QUERY_LENGTH}
          placeholder={t.search.placeholder}
        />
      </label>
      <button className="btn btn--primary" type="submit">
        {t.search.submit}
      </button>
    </form>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getT();
  // Reading costs nothing and is never gated, so no rate limit here — a
  // throttle on search would only ever punish someone browsing.
  const { q } = parseFacilityQuery(await searchParams);

  if (!q) {
    return (
      <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>{t.search.heading}</h1>
        <p className="hint" style={{ maxInlineSize: "var(--measure)" }}>
          {t.search.lede}
        </p>
        <SearchForm value="" t={t} />
        <p style={{ marginBlockStart: "var(--space-l)" }}>
          <Link className="btn" href="/facilities">
            {t.search.browseAll}
          </Link>{" "}
          <Link className="btn btn--quiet" href="/cities">
            {t.search.browseByCity}
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
          {/* The heading is mostly the reader's own words, so it takes its
              direction from them — an Arabic query on an English page reads
              right-to-left inside a left-to-right line. */}
          <bdi dir="auto">{t.search.resultsFor(q)}</bdi>
        </h1>
        <SearchForm value={q} t={t} />
      </header>

      <p role="status" className="sr-only">
        {nothingFound
          ? t.search.statusNothing(q)
          : t.search.status(facilityResult.total, cities.length, q)}
      </p>

      {nothingFound ? (
        <div style={{ marginBlockStart: "var(--space-xl)" }}>
          <EmptyState
            title={t.search.emptyTitle(q)}
            primary={{
              href: `/facilities/new?name=${encodeURIComponent(q)}`,
              label: t.search.addThisFacility,
            }}
            secondary={{ href: "/facilities", label: t.search.browseAll }}
          >
            <p>{t.search.emptyBody}</p>
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
            {t.search.citiesHeading}
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
                    <bdi dir="auto">
                      {lookup(t.labels.country, city.countryCode, city.country)}
                    </bdi>
                    {t.common.separator}
                    {t.common.facilityCount(city.facilityCount)}
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
              {t.search.facilitiesHeading}{" "}
              <span className="tnum hint">
                ({formatNumber(facilityResult.total)})
              </span>
            </h2>
            {facilityResult.total > PAGE_SIZE ? (
              <Link
                className="hint"
                href={`/facilities?q=${encodeURIComponent(q)}`}
              >
                {t.search.allResultsWithFilters}
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
              {t.search.refineResults}
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
