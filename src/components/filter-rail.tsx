import Link from "next/link";
import {
  activeFamilies,
  buildHref,
  familyOverride,
  familyValue,
  type FacilityQuery,
  type FilterFamily,
} from "@/lib/facility-query";

/**
 * The facet rail.
 *
 * Every option is an anchor that rewrites the query string, not a checkbox
 * waiting for a submit handler: filtering works with scripting off, each
 * combination has its own URL, and the browser's back button behaves. The
 * cost is that only one value per family can be selected, which for a
 * directory this size is the right trade — multi-select facets would multiply
 * the crawlable surface without helping anyone find a hospital.
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
  ratings: FilterOption[];
};

/** Labels for the "no filter" row at the top of each family. */
const ANY_LABELS: Record<FilterFamily, string> = {
  city: "Any city",
  country: "Any country",
  kind: "Any kind",
  min: "Any rating",
};

const GROUP_TITLES: Record<FilterFamily, string> = {
  city: "City",
  country: "Country",
  kind: "Kind",
  min: "Minimum rating",
};

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
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
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
            {count}
          </span>
          <span className="sr-only">{count} facilities</span>
        </>
      ) : null}

      {active ? <span className="sr-only">— selected, activate to remove</span> : null}
    </Link>
  );
}

function FilterGroup({
  base,
  query,
  family,
  options,
  footer,
}: {
  base: string;
  query: FacilityQuery;
  family: FilterFamily;
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
        {GROUP_TITLES[family]}
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <li>
          <FilterOptionLink
            href={buildHref(base, query, familyOverride(family, undefined))}
            label={ANY_LABELS[family]}
            active={current === undefined}
          />
        </li>
        {visible.map((option) => {
          const active = option.value === current;
          return (
            <li key={option.value}>
              <FilterOptionLink
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
  base,
  query,
  facets,
}: {
  base: string;
  query: FacilityQuery;
  facets: FilterFacets;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--space-l)" }}>
      <FilterGroup
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
            Browse all cities
          </Link>
        }
      />
      {/* No country group: the site covers Saudi Arabia only, so a filter with
          one option is noise. The `country` URL param still parses, so links
          keep working if the scope ever widens. */}
      <FilterGroup base={base} query={query} family="kind" options={facets.kinds} />
      <FilterGroup base={base} query={query} family="min" options={facets.ratings} />
    </div>
  );
}

export function FilterRail({
  base,
  query,
  facets,
}: {
  base: string;
  query: FacilityQuery;
  facets: FilterFacets;
}) {
  const groups = <FilterGroups base={base} query={query} facets={facets} />;
  const activeCount = activeFamilies(query).length;

  return (
    <>
      {/* Rendered twice, one copy `display:none` at any given width. The
          alternative — one copy inside a <details> forced open by CSS above
          1024px — cannot work, because a closed <details> stays closed no
          matter what the stylesheet says. `display:none` also removes the
          hidden copy from the accessibility tree, so nothing is announced
          twice. */}
      <aside
        aria-label="Filters"
        className="hidden lg:block"
        style={{
          position: "sticky",
          insetBlockStart: "var(--space-m)",
          alignSelf: "start",
          maxBlockSize: "calc(100dvh - 2 * var(--space-m))",
          overflowY: "auto",
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
          Filters
          {activeCount > 0 ? (
            <span className="tnum" style={{ color: "var(--ink-3)" }}>
              {" "}
              ({activeCount} applied)
            </span>
          ) : null}
        </summary>
        <div style={{ marginBlockStart: "var(--space-m)" }}>{groups}</div>
      </details>
    </>
  );
}
