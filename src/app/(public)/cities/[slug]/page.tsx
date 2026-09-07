import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCityBySlug, listFacilities } from "@/lib/queries";
import {
  buildHref,
  parseFacilityQuery,
  shouldNoIndex,
  toFacilityFilters,
  type FacilityQuery,
} from "@/lib/facility-query";
import {
  getDictionary,
  lookup,
  type Dictionary,
} from "@/lib/i18n/dictionaries";
import { cityNameFor } from "@/lib/i18n/names";
import { getLocale } from "@/lib/i18n/server";
import { FacilityCard } from "@/components/facility-card";
import { SortTabs } from "@/components/sort-tabs";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const cachedCity = cache(async (slug: string) => getCityBySlug(slug));

/**
 * The busiest cities are prerendered; the rest render on demand and are cached
 * from then on. Fifty covers the whole seeded directory today and stays a
 * sane build cost as it grows.
 */
export async function generateStaticParams() {
  try {
    const cities = await prisma.city.findMany({
      where: { facilityCount: { gt: 0 } },
      orderBy: [{ facilityCount: "desc" }, { reviewCount: "desc" }],
      take: 50,
      select: { slug: true },
    });
    return cities.map((city) => ({ slug: city.slug }));
  } catch {
    // A build without a reachable database still produces a working site —
    // these pages simply render on first request instead of ahead of time.
    return [];
  }
}

/**
 * The route already fixes the city, so `city` and `country` are stripped from
 * the URL state: leaving them in would let `/cities/riyadh?city=jeddah` exist
 * as a second address for the same result set.
 */
function cityUrlQuery(sp: { [key: string]: string | string[] | undefined }): FacilityQuery {
  return { ...parseFacilityQuery(sp), city: undefined, country: undefined };
}

/**
 * "Hospitals in Riyadh" — the same assembly the directory index uses, kept in
 * the dictionary because Arabic attaches the place differently and the English
 * builder in lib/facility-query.ts joins fragments in English word order.
 */
function headingFor(
  t: Dictionary,
  input: { kind?: string; cityName: string },
): string {
  const noun = input.kind
    ? lookup(
        t.labels.facilityKindPlural,
        input.kind,
        t.labels.facilityKindPluralFallback,
      )
    : t.labels.facilityKindPluralFallback;

  return t.facilities.describe({ noun, place: input.cityName });
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { slug } = await params;
  const city = await cachedCity(slug);

  if (!city) {
    return {
      title: t.cities.notFoundTitle,
      robots: { index: false, follow: false },
    };
  }

  const query = cityUrlQuery(await searchParams);
  const base = `/cities/${city.slug}`;
  const cityName = cityNameFor(locale, city.name);
  const heading = headingFor(t, { kind: query.kind, cityName });

  return {
    title:
      query.page > 1
        ? t.cities.titleWithPage(cityName, query.page)
        : cityName,
    description: t.cities.metaDescriptionFor(heading),
    alternates: { canonical: buildHref(base, query) },
    robots: shouldNoIndex(query)
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { slug } = await params;
  const city = await cachedCity(slug);
  if (!city) notFound();
  const cityName = cityNameFor(locale, city.name);

  const query = cityUrlQuery(await searchParams);
  const base = `/cities/${city.slug}`;

  const result = await listFacilities(
    toFacilityFilters({ ...query, city: city.slug }),
  );

  const countryName = lookup(t.labels.country, city.countryCode, city.country);

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header style={{ display: "grid", gap: "var(--space-2xs)" }}>
        {/* Source order is crumb-then-place; the direction of the page decides
            which end of the line that lands on. */}
        <p className="label" style={{ margin: 0 }}>
          <Link href="/cities" style={{ color: "inherit" }}>
            {t.cities.breadcrumb}
          </Link>{" "}
          / <bdi dir="auto">{countryName}</bdi>
        </p>
        <h1 style={{ fontSize: "var(--step-3)" }}>
          <bdi dir="auto">{cityName}</bdi>
        </h1>
        <p className="hint tnum">
          {t.common.facilityCount(city.facilityCount)}
          {t.common.separator}
          {t.common.reviewCount(city.reviewCount)}
        </p>
        <p style={{ marginBlockStart: "var(--space-2xs)" }}>
          <Link className="btn btn--small" href={`/facilities?city=${city.slug}`}>
            {t.cities.filterByKindAndRating}
          </Link>
        </p>
      </header>

      <div style={{ marginBlockStart: "var(--space-l)" }}>
        <SortTabs
          base={base}
          query={query}
          label={t.cities.sortLabelFor(cityName)}
        />
      </div>

      <section
        aria-labelledby="city-results"
        style={{ marginBlockStart: "var(--space-m)" }}
      >
        <h2 id="city-results" className="sr-only">
          {t.cities.resultsHeadingFor(cityName)}
        </h2>

        <p role="status" className="sr-only">
          {result.total === 0
            ? t.cities.resultsStatusEmpty(cityName)
            : t.cities.resultsStatus(
                cityName,
                result.total,
                result.page,
                result.pageCount,
              )}
        </p>

        {result.facilities.length === 0 ? (
          <EmptyState
            title={t.cities.nothingListed(cityName)}
            primary={{ href: "/facilities/new", label: t.cities.addFacility }}
            secondary={{ href: "/cities", label: t.cities.browseOtherCities }}
          >
            <p>{t.cities.nothingListedBody}</p>
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
              href={(page) => buildHref(base, query, { page })}
            />
          </>
        )}
      </section>
    </div>
  );
}
