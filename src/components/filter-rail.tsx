import Link from "next/link";
import {
  activeFamilies,
  buildHref,
  clearedQuery,
  familyOverride,
  familyValue,
  type FacilityQuery,
  type RailFamily,
} from "@/lib/facility-query";
import { REGIONS } from "@/lib/labels";
import { formatNumber, lookup, type Dictionary } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";
import { DEFAULT_SORT } from "@/lib/ranking";
import { MobileFilterForm } from "@/components/mobile-filter-form";

/**
 * The facet rail.
 *
 * Every option is an anchor that rewrites the query string, not a checkbox
 * waiting for a submit handler: filtering works with scripting off, each
 * combination has its own URL, and the browser's back button behaves. The
 * cost is that only one value per family can be selected, which for a
 * directory this size is the right trade — multi-select facets would multiply
 * the crawlable surface without helping anyone find a hospital.
 *
 * `t` is threaded down as a prop rather than awaited in each part: the rail is
 * rendered twice per page (see the note on the two copies below), and the
 * dictionary should be looked up once for both.
 */

export type FilterOption = {
  /** The value the URL carries: a slug, a country code, an enum, a number. */
  value: string;
  label: string;
  /** Facilities matching this option under the *other* active filters. */
  count?: number;
};

export type FilterFacets = {
  cities: FilterOption[];
  countries: FilterOption[];
  kinds: FilterOption[];
  fields: FilterOption[];
  specialties: FilterOption[];
  ratings: FilterOption[];
  /**
   * Optional, and the only family that is: a region is a place to start
   * browsing as much as it is a filter, so the rail offers all thirteen
   * whether or not the page counted them first.
   */
  regions?: FilterOption[];
};

/**
 * The thirteen regions as filter options, counted where the page counted them.
 *
 * Uncounted is not the same as empty — an option with no count is always shown
 * (see `FilterGroup`), which is what keeps Qassim on the rail even before a
 * facility in it is listed. That absence is the complaint this whole layer
 * exists to answer.
 */
function regionOptions(t: Dictionary, facets: FilterFacets): FilterOption[] {
  return (
    facets.regions ??
    REGIONS.map(({ key, slug }) => ({
      value: slug,
      label: lookup(t.labels.region, key, key),
    }))
  );
}

/** The "no filter" row at the top of each family. */
function anyLabel(t: Dictionary, family: RailFamily): string {
  switch (family) {
    case "region":
      return t.facilities.anyRegion;
    case "city":
      return t.facilities.anyCity;
    case "country":
      return t.facilities.anyCountry;
    case "kind":
      return t.facilities.anyKind;
    case "field":
      return t.facilities.anyField;
    case "specialty":
      return t.facilities.anySpecialty;
    case "min":
      return t.facilities.anyRating;
  }
}

/** Written as switches so a new filter family is a compile error, not a blank. */
function groupTitle(t: Dictionary, family: RailFamily): string {
  switch (family) {
    case "region":
      return t.facilities.regionFamily;
    case "city":
      return t.facilities.cityFamily;
    case "country":
      return t.facilities.countryFamily;
    case "kind":
      return t.facilities.kindFamily;
    case "field":
      return t.facilities.fieldFamily;
    case "specialty":
      return t.facilities.specialtyFamily;
    case "min":
      return t.facilities.ratingFamily;
  }
}

function Marker({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: "0 0 auto",
        inlineSize: 11,
        blockSize: 11,
        borderRadius: 2,
        border: `1px solid ${active ? "var(--brand)" : "var(--line-strong)"}`,
        background: active ? "var(--brand)" : "transparent",
      }}
    />
  );
}

function FilterOptionLink({
  t,
  href,
  label,
  count,
  active,
  /** True for the "Any city" row, which is a state rather than a filter. */
  isAny = false,
}: {
  t: Dictionary;
  href: string;
  label: string;
  count?: number;
  active: boolean;
  isAny?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-xs)",
        padding: "5px var(--space-2xs)",
        borderRadius: "var(--r-1)",
        fontSize: "var(--step--1)",
        fontWeight: active ? 600 : 400,
        color: active ? "var(--brand-ink)" : "var(--ink-2)",
        background: active ? "var(--brand-soft)" : "transparent",
        textDecoration: "none",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2xs)",
          minInlineSize: 0,
        }}
      >
        <Marker active={active} />
        {/* An Arabic city or facility name must not reorder the count beside it. */}
        <bdi dir="auto">{label}</bdi>
      </span>

      {count !== undefined ? (
        <>
          <span
            className="tnum"
            aria-hidden="true"
            style={{ color: "var(--ink-3)", fontSize: "var(--step--2)" }}
          >
            {formatNumber(count)}
          </span>
          <span className="sr-only">{t.common.facilityCount(count)}</span>
        </>
      ) : null}

      {/* Only the selected *filter* offers removal. Saying it on "Any city",
          which is what a cleared family already looks like, would promise a
          screen-reader user an action that does nothing. */}
      {active && !isAny ? (
        <span className="sr-only">{t.facilities.removeFilter}</span>
      ) : null}
    </Link>
  );
}

function FilterGroup({
  t,
  base,
  query,
  family,
  options,
  footer,
}: {
  t: Dictionary;
  base: string;
  query: FacilityQuery;
  family: RailFamily;
  options: FilterOption[];
  footer?: React.ReactNode;
}) {
  const current = familyValue(query, family);

  // An option nothing can match is noise — unless it is the one in force, which
  // must stay visible so it can be switched off.
  const visible = options.filter(
    (option) =>
      option.value === current || option.count === undefined || option.count > 0,
  );

  if (visible.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: "var(--space-2xs)" }}>
      <h2 className="label" style={{ margin: 0 }}>
        {groupTitle(t, family)}
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <li>
          <FilterOptionLink
            t={t}
            href={buildHref(base, query, familyOverride(family, undefined))}
            label={anyLabel(t, family)}
            active={current === undefined}
            isAny
          />
        </li>
        {visible.map((option) => {
          const active = option.value === current;
          return (
            <li key={option.value}>
              <FilterOptionLink
                t={t}
                href={buildHref(
                  base,
                  query,
                  familyOverride(family, active ? undefined : option.value),
                )}
                label={option.label}
                count={option.count}
                active={active}
              />
            </li>
          );
        })}
      </ul>
      {footer}
    </div>
  );
}

function FilterGroups({
  t,
  base,
  query,
  facets,
}: {
  t: Dictionary;
  base: string;
  query: FacilityQuery;
  facets: FilterFacets;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--space-l)" }}>
      {/* Above the cities, because that is the order the question arrives in:
          a student picks a part of the country before a city inside it. */}
      <FilterGroup
        t={t}
        base={base}
        query={query}
        family="region"
        options={regionOptions(t, facets)}
      />
      <FilterGroup
        t={t}
        base={base}
        query={query}
        family="city"
        options={facets.cities}
        footer={
          <Link
            href="/cities"
            className="hint"
            style={{ paddingInlineStart: "var(--space-2xs)" }}
          >
            {t.search.browseByCity}
          </Link>
        }
      />
      {/* No country group: the site covers Saudi Arabia only, so a filter with
          one option is noise. The `country` URL param still parses, so links
          keep working if the scope ever widens. */}
      <FilterGroup
        t={t}
        base={base}
        query={query}
        family="field"
        options={facets.fields}
      />
      <FilterGroup
        t={t}
        base={base}
        query={query}
        family="specialty"
        options={facets.specialties}
      />
      <FilterGroup
        t={t}
        base={base}
        query={query}
        family="kind"
        options={facets.kinds}
      />
      <FilterGroup
        t={t}
        base={base}
        query={query}
        family="min"
        options={facets.ratings}
      />
    </div>
  );
}

export async function FilterRail({
  base,
  query,
  facets,
}: {
  base: string;
  query: FacilityQuery;
  facets: FilterFacets;
}) {
  const t = await getT();
  const groups = (
    <FilterGroups t={t} base={base} query={query} facets={facets} />
  );
  const activeCount = activeFamilies(query).length;
  const regions = regionOptions(t, facets);

  return (
    <>
      {/* Rendered twice, one copy `display:none` at any given width. The
          alternative — one copy inside a <details> forced open by CSS above
          1024px — cannot work, because a closed <details> stays closed no
          matter what the stylesheet says. `display:none` also removes the
          hidden copy from the accessibility tree, so nothing is announced
          twice. */}
      <aside
        aria-label={t.facilities.filtersHeading}
        className="hidden lg:block"
        style={{
          alignSelf: "start",
          paddingInlineEnd: "var(--space-2xs)",
        }}
      >
        {groups}
      </aside>

      <details
        className="card lg:hidden"
        style={{ padding: "var(--space-s) var(--space-m)" }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          {t.facilities.showFilters}
          {activeCount > 0 ? (
            <span className="tnum" style={{ color: "var(--ink-3)" }}>
              {" "}
              ({formatNumber(activeCount)})
            </span>
          ) : null}
        </summary>
        <div style={{ marginBlockStart: "var(--space-m)" }}>
          <MobileFilterForm
            base={base}
            values={{
              q: query.q,
              sort: query.sort === DEFAULT_SORT ? undefined : query.sort,
              country: query.country,
              region: query.region,
              city: query.city,
              field: query.field,
              specialty: query.specialty,
              kind: query.kind,
              min: query.min === undefined ? undefined : String(query.min),
            }}
            facets={facets}
            regions={regions}
            clearHref={buildHref(base, clearedQuery(query))}
            strings={{
              region: t.facilities.regionFamily,
              city: t.facilities.cityFamily,
              field: t.facilities.fieldFamily,
              specialty: t.facilities.specialtyFamily,
              kind: t.facilities.kindFamily,
              rating: t.facilities.ratingFamily,
              anyRegion: t.facilities.anyRegion,
              anyCity: t.facilities.anyCity,
              anyField: t.facilities.anyField,
              anySpecialty: t.facilities.anySpecialty,
              anyKind: t.facilities.anyKind,
              anyRating: t.facilities.anyRating,
              apply: t.facilities.applyFilters,
              clear: t.facilities.clearAll,
            }}
          />
        </div>
      </details>
    </>
  );
}
