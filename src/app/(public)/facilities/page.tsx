import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { listCities, listFacilities } from "@/lib/queries";
import { COUNTRY_NAMES, FACILITY_KIND_LABELS } from "@/lib/labels";
import {
  MAX_QUERY_LENGTH,
  MIN_RATING_OPTIONS,
  activeFamilies,
  buildHref,
  clearedQuery,
  describeFacilityQuery,
  familyOverride,
  hasActiveFilters,
  parseFacilityQuery,
  shouldNoIndex,
  toFacilityFilters,
  type FacilityQuery,
  type FilterFamily,
} from "@/lib/facility-query";
import { DEFAULT_SORT } from "@/lib/ranking";
import { FacilityCard } from "@/components/facility-card";
import { FilterRail, type FilterOption } from "@/components/filter-rail";
import { SortTabs } from "@/components/sort-tabs";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import type { FacilityKind, Prisma } from "@/generated/prisma/client";

const BASE = "/facilities";

/** Long enough to be useful in the rail, short enough not to bury it. */
const CITY_FACET_LIMIT = 12;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * `cache` dedupes across `generateMetadata` and the render, which run in the
 * same request. Without it the city list is fetched twice for every page view.
 */
const cachedCities = cache(async () => listCities());

/**
 * Mirrors the private `facilityWhere` in lib/queries.ts, minus one family at a
 * time, so each facet can be counted under *the other* filters — the standard
 * faceting rule, and the only one that never shows a reader a zero next to an
 * option that would in fact return results.
 *
 * The duplication is deliberate but unwanted; see the note in the handover
 * about exporting the builder from lib/queries.ts instead.
 */
function facetWhere(
  query: FacilityQuery,
  omit: FilterFamily[] = [],
): Prisma.FacilityWhereInput {
  const drop = new Set(omit);
  const where: Prisma.FacilityWhereInput = { status: "PUBLISHED" };

  const city: Prisma.CityWhereInput = {};
  if (query.city && !drop.has("city")) city.slug = query.city;
  if (query.country && !drop.has("country")) {
    city.countryCode = query.country.toUpperCase();
  }
  if (Object.keys(city).length > 0) where.city = city;

  if (query.kind && !drop.has("kind")) where.kind = query.kind as FacilityKind;

  if (query.min !== undefined && !drop.has("min")) {
    where.reviewCount = { gt: 0 };
    where.ratingAvg = { gte: query.min };
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { nameEn: { contains: query.q, mode: "insensitive" } },
      { nameLocal: { contains: query.q } },
      { city: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  return where;
}

type CityRow = Awaited<ReturnType<typeof listCities>>[number];

async function loadFacets(query: FacilityQuery, cities: CityRow[]) {
  const [kindGroups, cityGroups, countryGroups] = await Promise.all([
    prisma.facility.groupBy({
      by: ["kind"],
      where: facetWhere(query, ["kind"]),
      _count: { _all: true },
    }),
    prisma.facility.groupBy({
      by: ["cityId"],
      where: facetWhere(query, ["city"]),
      _count: { _all: true },
    }),
    // A city implies its country, so the country facet has to ignore both or
    // every country except the selected city's would read zero.
    prisma.facility.groupBy({
      by: ["cityId"],
      where: facetWhere(query, ["city", "country"]),
      _count: { _all: true },
    }),
  ]);

  const cityById = new Map(cities.map((city) => [city.id, city]));

  const cityCounts = new Map(
    cityGroups.map((row) => [row.cityId, row._count._all]),
  );
  const cityOptions: FilterOption[] = cities
    .map((city) => ({
      value: city.slug,
      label: city.name,
      count: cityCounts.get(city.id) ?? 0,
    }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label))
    .filter((option, index) => index < CITY_FACET_LIMIT || option.value === query.city);

  const countryCounts = new Map<string, number>();
  for (const row of countryGroups) {
    const code = cityById.get(row.cityId)?.countryCode;
    if (!code) continue;
    countryCounts.set(code, (countryCounts.get(code) ?? 0) + row._count._all);
  }
  const countryOptions: FilterOption[] = [...countryCounts.entries()]
    .map(([code, count]) => ({
      value: code.toLowerCase(),
      label: COUNTRY_NAMES[code] ?? code,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const kindCounts = new Map(
    kindGroups.map((row) => [String(row.kind), row._count._all]),
  );
  const kindOptions: FilterOption[] = [...kindCounts.entries()]
    .map(([kind, count]) => ({
      value: kind,
      label: FACILITY_KIND_LABELS[kind] ?? kind,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // No counts on the rating family: they would cost a scan of every rated
  // facility per threshold, and the thresholds are self-explanatory anyway.
  const ratingOptions: FilterOption[] = [...MIN_RATING_OPTIONS]
    .reverse()
    .map((value) => ({
      value: String(value),
      label: `${value} stars and up`,
    }));

  return {
    cities: cityOptions,
    countries: countryOptions,
    kinds: kindOptions,
    ratings: ratingOptions,
  };
}

function placeNames(query: FacilityQuery, cities: CityRow[]) {
  const cityName = query.city
    ? cities.find((city) => city.slug === query.city)?.name
    : undefined;
  const countryName = query.country
    ? (COUNTRY_NAMES[query.country.toUpperCase()] ?? query.country.toUpperCase())
    : undefined;
  return { cityName, countryName };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const query = parseFacilityQuery(await searchParams);
  const { cityName, countryName } = placeNames(query, await cachedCities());

  const heading = describeFacilityQuery({
    kind: query.kind,
    cityName,
    countryName,
    q: query.q || undefined,
  });
  const title = query.page > 1 ? `${heading} — page ${query.page}` : heading;

  return {
    title,
    description:
      "Hospitals, clinics and health centres reviewed by the healthcare students who trained in them.",
    alternates: { canonical: buildHref(BASE, query) },
    // Follow, but do not index, the long tail: four filter families multiply
    // into far more URLs than there are distinct pages worth reading.
    robots: shouldNoIndex(query)
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

function chipLabel(
  family: FilterFamily,
  query: FacilityQuery,
  names: { cityName?: string; countryName?: string },
): string {
  switch (family) {
    case "city":
      return `City: ${names.cityName ?? query.city}`;
    case "country":
      return `Country: ${names.countryName ?? query.country}`;
    case "kind":
      return `Kind: ${FACILITY_KIND_LABELS[query.kind ?? ""] ?? query.kind}`;
    case "min":
      return `Rated ${query.min} and up`;
  }
}

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = parseFacilityQuery(await searchParams);
  const cities = await cachedCities();

  const [result, facets] = await Promise.all([
    listFacilities(toFacilityFilters(query)),
    loadFacets(query, cities),
  ]);

  const names = placeNames(query, cities);
  const heading = describeFacilityQuery({
    kind: query.kind,
    cityName: names.cityName,
    countryName: names.countryName,
    q: query.q || undefined,
  });

  const chips = [
    ...(query.q
      ? [
          {
            key: "q",
            label: `Search: “${query.q}”`,
            href: buildHref(BASE, query, { q: "" }),
          },
        ]
      : []),
    ...activeFamilies(query).map((family) => ({
      key: family,
      label: chipLabel(family, query, names),
      href: buildHref(BASE, query, familyOverride(family, undefined)),
    })),
  ];

  const addHref = query.q
    ? `/facilities/new?name=${encodeURIComponent(query.q)}`
    : "/facilities/new";

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header style={{ display: "grid", gap: "var(--space-s)" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>{heading}</h1>
        <p className="hint" style={{ maxInlineSize: "var(--measure)" }}>
          Every entry is a real place someone trained in. Ratings come only from
          students who were there.
        </p>

        {/* A GET form, so a search is a URL like any other. The hidden inputs
            carry the filters already in force; `page` is deliberately absent,
            because a new search starts at the first page. */}
        <form
          action={BASE}
          method="get"
          role="search"
          aria-label="Search within facilities"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
            marginBlockStart: "var(--space-2xs)",
          }}
        >
          <label style={{ flex: "1 1 18rem", minInlineSize: 0 }}>
            <span className="sr-only">Search facilities by name</span>
            <input
              className="input"
              type="search"
              name="q"
              defaultValue={query.q}
              maxLength={MAX_QUERY_LENGTH}
              placeholder="Search by name — e.g. King Fahad"
            />
          </label>
          {query.sort !== DEFAULT_SORT ? (
            <input type="hidden" name="sort" value={query.sort} />
          ) : null}
          {query.country ? (
            <input type="hidden" name="country" value={query.country} />
          ) : null}
          {query.city ? (
            <input type="hidden" name="city" value={query.city} />
          ) : null}
          {query.kind ? (
            <input type="hidden" name="kind" value={query.kind.toLowerCase()} />
          ) : null}
          {query.min !== undefined ? (
            <input type="hidden" name="min" value={String(query.min)} />
          ) : null}
          <button className="btn btn--primary" type="submit">
            Search
          </button>
        </form>
      </header>

      <div style={{ marginBlockStart: "var(--space-l)" }}>
        <SortTabs base={BASE} query={query} />
      </div>

      <div
        className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10"
        style={{ marginBlockStart: "var(--space-m)" }}
      >
        <FilterRail base={BASE} query={query} facets={facets} />

        <section aria-labelledby="results-heading" className="mt-6 lg:mt-0">
          <h2 id="results-heading" className="sr-only">
            Results
          </h2>

          <p role="status" className="sr-only">
            {result.total === 0
              ? "No facilities match these filters."
              : `${result.total} facilities match. Showing page ${result.page} of ${result.pageCount}.`}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "var(--space-xs)",
              marginBlockEnd: "var(--space-m)",
            }}
          >
            <p className="hint tnum" style={{ marginInlineEnd: "auto" }}>
              {result.total} {result.total === 1 ? "facility" : "facilities"}
            </p>

            {chips.map((chip) => (
              <Link key={chip.key} className="chip chip--brand" href={chip.href}>
                <bdi dir="auto">{chip.label}</bdi>
                <span aria-hidden="true">✕</span>
                <span className="sr-only">— remove this filter</span>
              </Link>
            ))}

            {chips.length > 1 ? (
              <Link
                className="btn btn--quiet btn--small"
                href={buildHref(BASE, clearedQuery(query))}
              >
                Clear all
              </Link>
            ) : null}
          </div>

          {result.facilities.length === 0 ? (
            <EmptyState
              title={
                query.q
                  ? `Nothing here matches “${query.q}”`
                  : "Nothing matches these filters"
              }
              primary={{ href: addHref, label: "Add this facility" }}
              secondary={
                hasActiveFilters(query)
                  ? {
                      href: buildHref(BASE, clearedQuery(query)),
                      label: "Clear filters",
                    }
                  : undefined
              }
            >
              <p>
                {query.q ? (
                  <>
                    No facility on Hospirate is called{" "}
                    <strong>
                      <bdi dir="auto">{query.q}</bdi>
                    </strong>
                    {names.cityName ? ` in ${names.cityName}` : ""}. If you
                    trained somewhere we do not list yet, adding it takes about a
                    minute.
                  </>
                ) : (
                  "Try widening one of the filters, or add the place you trained in."
                )}
              </p>
            </EmptyState>
          ) : (
            <>
              <ul
                className="grid-cards"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {result.facilities.map((facility) => (
                  <li key={facility.slug}>
                    <FacilityCard facility={facility} />
                  </li>
                ))}
              </ul>

              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                href={(page) => buildHref(BASE, query, { page })}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
