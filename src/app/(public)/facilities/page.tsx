import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { listCities, listFacilities } from "@/lib/queries";
import {
  MAX_QUERY_LENGTH,
  MIN_RATING_OPTIONS,
  activeFamilies,
  buildHref,
  clearedQuery,
  familyOverride,
  hasActiveFilters,
  parseFacilityQuery,
  shouldNoIndex,
  toFacilityFilters,
  type FacilityQuery,
  type FilterFamily,
} from "@/lib/facility-query";
import { DEFAULT_SORT } from "@/lib/ranking";
import { facilitySearchConditions } from "@/lib/facility-search-query";
import {
  getDictionary,
  lookup,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { cityNameFor } from "@/lib/i18n/names";
import { getLocale } from "@/lib/i18n/server";
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
 * The heading and the `<title>` for a result set.
 *
 * `describeFacilityQuery` in lib/facility-query.ts builds the English form by
 * joining fragments; Arabic cannot reuse that, because the pieces attach in a
 * different order and "in" carries no article. So the assembly lives in the
 * dictionary and this only decides which noun goes in.
 */
function headingFor(
  t: Dictionary,
  input: {
    kind?: string;
    cityName?: string;
    countryName?: string;
    q?: string;
  },
): string {
  const place = input.cityName ?? input.countryName;

  // Nothing narrowed at all: say so plainly rather than "Facilities".
  if (!input.kind && !place && !input.q) return t.facilities.allFacilities;

  const noun = input.kind
    ? lookup(
        t.labels.facilityKindPlural,
        input.kind,
        t.labels.facilityKindPluralFallback,
      )
    : t.labels.facilityKindPluralFallback;

  return t.facilities.describe({ noun, place, q: input.q });
}

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
    where.OR = facilitySearchConditions(query.q, { includeCity: true });
  }

  return where;
}

type CityRow = Awaited<ReturnType<typeof listCities>>[number];

async function loadFacets(
  query: FacilityQuery,
  cities: CityRow[],
  t: Dictionary,
  locale: Locale,
) {
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
      label: cityNameFor(locale, city.name),
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
      label: lookup(t.labels.country, code, code),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const kindCounts = new Map(
    kindGroups.map((row) => [String(row.kind), row._count._all]),
  );
  const kindOptions: FilterOption[] = [...kindCounts.entries()]
    .map(([kind, count]) => ({
      value: kind,
      label: lookup(t.labels.facilityKind, kind, kind),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // No counts on the rating family: they would cost a scan of every rated
  // facility per threshold, and the thresholds are self-explanatory anyway.
  const ratingOptions: FilterOption[] = [...MIN_RATING_OPTIONS]
    .reverse()
    .map((value) => ({
      value: String(value),
      label: t.facilities.ratingOption(value),
    }));

  return {
    cities: cityOptions,
    countries: countryOptions,
    kinds: kindOptions,
    ratings: ratingOptions,
  };
}

function placeNames(
  query: FacilityQuery,
  cities: CityRow[],
  t: Dictionary,
  locale: Locale,
) {
  const rawCityName = query.city
    ? cities.find((city) => city.slug === query.city)?.name
    : undefined;
  const cityName = rawCityName
    ? cityNameFor(locale, rawCityName)
    : undefined;
  const countryName = query.country
    ? lookup(t.labels.country, query.country.toUpperCase(), query.country.toUpperCase())
    : undefined;
  return { cityName, countryName };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const query = parseFacilityQuery(await searchParams);
  const { cityName, countryName } = placeNames(
    query,
    await cachedCities(),
    t,
    locale,
  );

  const heading = headingFor(t, {
    kind: query.kind,
    cityName,
    countryName,
    q: query.q || undefined,
  });

  return {
    title:
      query.page > 1
        ? t.facilities.titleWithPage(heading, query.page)
        : heading,
    description: t.facilities.metaDescription,
    alternates: { canonical: buildHref(BASE, query) },
    // Follow, but do not index, the long tail: four filter families multiply
    // into far more URLs than there are distinct pages worth reading.
    robots: shouldNoIndex(query)
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

function chipLabel(
  t: Dictionary,
  family: FilterFamily,
  query: FacilityQuery,
  names: { cityName?: string; countryName?: string },
): string {
  switch (family) {
    case "city":
      return t.facilities.chipCity(names.cityName ?? query.city ?? "");
    case "country":
      return t.facilities.chipCountry(names.countryName ?? query.country ?? "");
    case "kind":
      return t.facilities.chipKind(
        lookup(t.labels.facilityKind, query.kind ?? "", query.kind ?? ""),
      );
    case "min":
      return t.facilities.chipMinRating(query.min ?? 0);
  }
}

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const query = parseFacilityQuery(await searchParams);
  const cities = await cachedCities();

  const [result, facets] = await Promise.all([
    listFacilities(toFacilityFilters(query)),
    loadFacets(query, cities, t, locale),
  ]);

  const names = placeNames(query, cities, t, locale);
  const heading = headingFor(t, {
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
            label: t.facilities.chipSearch(query.q),
            href: buildHref(BASE, query, { q: "" }),
          },
        ]
      : []),
    ...activeFamilies(query).map((family) => ({
      key: family,
      label: chipLabel(t, family, query, names),
      href: buildHref(BASE, query, familyOverride(family, undefined)),
    })),
  ];

  const addHref = query.q
    ? `/facilities/new?name=${encodeURIComponent(query.q)}`
    : "/facilities/new";

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header style={{ display: "grid", gap: "var(--space-s)" }}>
        <h1 style={{ fontSize: "var(--step-3)" }}>
          {/* The heading can carry a city name or a search term in the other
              script, so it takes its direction from what it ended up saying. */}
          <bdi dir="auto">{heading}</bdi>
        </h1>
        <p className="hint" style={{ maxInlineSize: "var(--measure)" }}>
          {t.facilities.lede}
        </p>

        {/* A GET form, so a search is a URL like any other. The hidden inputs
            carry the filters already in force; `page` is deliberately absent,
            because a new search starts at the first page. */}
        <form
          action={BASE}
          method="get"
          role="search"
          aria-label={t.facilities.searchLabel}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
            marginBlockStart: "var(--space-2xs)",
          }}
        >
          <label style={{ flex: "1 1 18rem", minInlineSize: 0 }}>
            <span className="sr-only">{t.facilities.searchFieldLabel}</span>
            {/* The reader may type either script into this box whichever
                language the page is in, so the field follows its own value. */}
            <input
              className="input"
              type="search"
              name="q"
              dir="auto"
              defaultValue={query.q}
              maxLength={MAX_QUERY_LENGTH}
              placeholder={t.facilities.searchPlaceholder}
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
            {t.facilities.searchButton}
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
            {t.facilities.resultsHeading}
          </h2>

          <p role="status" className="sr-only">
            {result.total === 0
              ? t.facilities.resultsStatusEmpty
              : t.facilities.resultsStatus(
                  result.total,
                  result.page,
                  result.pageCount,
                )}
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
              {t.common.facilityCount(result.total)}
            </p>

            {chips.map((chip) => (
              <Link key={chip.key} className="chip chip--brand" href={chip.href}>
                <bdi dir="auto">{chip.label}</bdi>
                <span aria-hidden="true">✕</span>
                <span className="sr-only">{t.facilities.removeFilter}</span>
              </Link>
            ))}

            {chips.length > 1 ? (
              <Link
                className="btn btn--quiet btn--small"
                href={buildHref(BASE, clearedQuery(query))}
              >
                {t.facilities.clearAll}
              </Link>
            ) : null}
          </div>

          {result.facilities.length === 0 ? (
            <EmptyState
              title={
                query.q
                  ? t.facilities.emptyTitleQuery(query.q)
                  : t.facilities.emptyTitle
              }
              primary={{ href: addHref, label: t.facilities.addFacility }}
              secondary={
                hasActiveFilters(query)
                  ? {
                      href: buildHref(BASE, clearedQuery(query)),
                      label: t.facilities.clearFilters,
                    }
                  : undefined
              }
            >
              <p>
                {query.q ? (
                  <>
                    {t.facilities.emptyBodyPrefix}{" "}
                    <strong>
                      <bdi dir="auto">{query.q}</bdi>
                    </strong>
                    {names.cityName ? (
                      <bdi dir="auto">
                        {t.facilities.emptyBodyInCity(names.cityName)}
                      </bdi>
                    ) : null}
                    {t.facilities.emptyBodySuffix}
                  </>
                ) : (
                  t.facilities.emptyBodyNoQuery
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
                    <FacilityCard facility={facility} locale={locale} />
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
