import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REGIONS } from "@/lib/labels";
import {
  getRegionBySlug,
  getRegionStats,
  listCitiesInRegion,
} from "@/lib/regions";
import {
  getDictionary,
  lookup,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { cityNameFor } from "@/lib/i18n/names";
import { getLocale, getT } from "@/lib/i18n/server";
import { EmptyState } from "@/components/empty-state";

type Params = Promise<{ slug: string }>;

type CityRow = Awaited<ReturnType<typeof listCitiesInRegion>>[number];

/**
 * The thirteen regions are a constant, not a query: unlike the city pages
 * these params need no database, so a build without one still knows every
 * address this route can have.
 */
export function generateStaticParams() {
  return REGIONS.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const t = await getT();
  const { slug } = await params;
  const key = getRegionBySlug(slug);

  if (!key) {
    return {
      title: t.regions.notFoundTitle,
      robots: { index: false, follow: false },
    };
  }

  const name = lookup(t.labels.region, key, key);

  return {
    title: name,
    // "Facilities in Qassim reviewed by the students who trained there" —
    // assembled by the dictionary, because Arabic attaches the place
    // differently from English.
    description: t.cities.metaDescriptionFor(
      t.facilities.describe({
        noun: t.labels.facilityKindPluralFallback,
        place: name,
      }),
    ),
    alternates: { canonical: `/regions/${slug}` },
  };
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
      <span
        className="tnum"
        style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
      >
        {t.cities.cityLine(city.facilityCount, city.reviewCount)}
      </span>
    </Link>
  );
}

export default async function RegionPage({ params }: { params: Params }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { slug } = await params;

  const key = getRegionBySlug(slug);
  if (!key) notFound();

  const [stats, cities] = await Promise.all([
    getRegionStats(key),
    listCitiesInRegion(key),
  ]);
  const name = lookup(t.labels.region, key, key);

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <header style={{ display: "grid", gap: "var(--space-2xs)" }}>
        {/* Source order is crumb-then-place; the direction of the page decides
            which end of the line that lands on. */}
        <p className="label" style={{ margin: 0 }}>
          <Link href="/regions" style={{ color: "inherit" }}>
            {t.regions.breadcrumb}
          </Link>
        </p>
        <h1 style={{ fontSize: "var(--step-3)" }}>
          <bdi dir="auto">{name}</bdi>
        </h1>
        <p className="hint tnum">
          {t.common.cityCount(stats.cityCount)}
          {t.common.separator}
          {t.common.facilityCount(stats.facilityCount)}
          {t.common.separator}
          {t.common.reviewCount(stats.reviewCount)}
        </p>
        <p style={{ marginBlockStart: "var(--space-2xs)" }}>
          {/* The whole region in one filtered list, for a reader who is willing
              to travel anywhere inside it — which is exactly the reader who
              came in through a region page. With nothing listed yet, that link
              would lead to an empty result set, so it becomes the invitation to
              add the first place instead. */}
          {stats.facilityCount > 0 ? (
            <Link className="btn" href={`/facilities?region=${slug}`}>
              {t.regions.allFacilitiesIn(stats.facilityCount)}
            </Link>
          ) : (
            <Link className="btn btn--primary" href="/facilities/new">
              {t.cities.addFacility}
            </Link>
          )}
        </p>
      </header>

      <section
        aria-labelledby="region-cities"
        style={{ marginBlockStart: "var(--space-xl)" }}
      >
        <div
          style={{
            borderBlockEnd: "1px solid var(--line)",
            paddingBlockEnd: "var(--space-2xs)",
            marginBlockEnd: "var(--space-m)",
          }}
        >
          <h2 id="region-cities" style={{ fontSize: "var(--step-1)" }}>
            {t.regions.citiesHeading}
          </h2>
        </div>

        {cities.length === 0 ? (
          <EmptyState
            title={t.regions.noFacilitiesYet}
            primary={{ href: "/facilities/new", label: t.cities.addFacility }}
            secondary={{ href: "/cities", label: t.cities.browseOtherCities }}
          >
            <p>{t.regions.noFacilitiesBody}</p>
          </EmptyState>
        ) : (
          <ul
            className="grid-cards"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {cities.map((city) => (
              <li key={city.slug}>
                <CityLink city={city} t={t} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
