import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCityBySlug, listFacilities } from "@/lib/queries";
import { COUNTRY_NAMES } from "@/lib/labels";
import {
  buildHref,
  describeFacilityQuery,
  parseFacilityQuery,
  shouldNoIndex,
  toFacilityFilters,
  type FacilityQuery,
} from "@/lib/facility-query";
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = await cachedCity(slug);

  if (!city) {
    return { title: "City not found", robots: { index: false, follow: false } };
  }

  const query = cityUrlQuery(await searchParams);
  const base = `/cities/${city.slug}`;
  const heading = describeFacilityQuery({ kind: query.kind, cityName: city.name });

  return {
    title: query.page > 1 ? `${city.name} — page ${query.page}` : city.name,
    description: `${heading} reviewed by the healthcare students who trained there.`,
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
  const { slug } = await params;
  const city = await cachedCity(slug);
  if (!city) notFound();

  const query = cityUrlQuery(await searchParams);
  const base = `/cities/${city.slug}`;

  const result = await listFacilities(
    toFacilityFilters({ ...query, city: city.slug }),
  );

  const countryName = COUNTRY_NAMES[city.countryCode] ?? city.country;

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header style={{ display: "grid", gap: "var(--space-2xs)" }}>
        <p className="label" style={{ margin: 0 }}>
          <Link href="/cities" style={{ color: "inherit" }}>
            Cities
          </Link>{" "}
          / {countryName}
        </p>
        <h1 style={{ fontSize: "var(--step-3)" }}>
          <bdi dir="auto">{city.name}</bdi>
        </h1>
        <p className="hint tnum">
          {city.facilityCount}{" "}
          {city.facilityCount === 1 ? "facility" : "facilities"} ·{" "}
          {city.reviewCount} {city.reviewCount === 1 ? "review" : "reviews"}
        </p>
        <p style={{ marginBlockStart: "var(--space-2xs)" }}>
          <Link className="btn btn--small" href={`/facilities?city=${city.slug}`}>
            Filter by kind and rating
          </Link>
        </p>
      </header>

      <div style={{ marginBlockStart: "var(--space-l)" }}>
        <SortTabs
          base={base}
          query={query}
          label={`Sort facilities in ${city.name}`}
        />
      </div>

      <section
        aria-labelledby="city-results"
        style={{ marginBlockStart: "var(--space-m)" }}
      >
        <h2 id="city-results" className="sr-only">
          Facilities in {city.name}
        </h2>

        <p role="status" className="sr-only">
          {result.total === 0
            ? `No facilities listed in ${city.name} yet.`
            : `${result.total} facilities in ${city.name}. Showing page ${result.page} of ${result.pageCount}.`}
        </p>

        {result.facilities.length === 0 ? (
          <EmptyState
            title={`Nothing listed in ${city.name} yet`}
            primary={{ href: "/facilities/new", label: "Add a facility" }}
            secondary={{ href: "/cities", label: "Browse other cities" }}
          >
            <p>
              If you trained at a hospital or clinic here, adding it takes about
              a minute and gives the next student somewhere to start.
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
              href={(page) => buildHref(base, query, { page })}
            />
          </>
        )}
      </section>
    </div>
  );
}
