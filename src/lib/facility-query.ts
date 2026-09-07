/**
 * URL state for the facility directory.
 *
 * Every filter, sort and page lives in the query string rather than in
 * component state, so a result set can be linked, bookmarked and crawled. That
 * only holds if the mapping is a function in both directions, which is what
 * this module is: one parser that never throws, and one serialiser that emits
 * exactly one URL per result set.
 *
 * Two rules do most of the work:
 *
 *   · Bad input is clamped or dropped, never rejected. `?page=-4&min=9` is a
 *     bored crawler or a mangled link, not an error worth a 404 — it renders
 *     page one, unfiltered, and the canonical tag points at the clean URL.
 *   · A parameter sitting at its default is omitted. Without that,
 *     `/facilities`, `/facilities?page=1` and `/facilities?sort=most_reviewed`
 *     are three URLs for one page, and the crawl budget goes to duplicates.
 *
 * Deliberately free of server-only imports: these are pure functions over
 * plain data, callable from a test file or a component.
 */

import { z } from "zod";
import { DEFAULT_SORT, SORT_OPTIONS, type SortKey } from "@/lib/ranking";
import { FACILITY_KINDS, REGION_BY_SLUG } from "@/lib/labels";

/** Longer than this is a paste accident, not a facility name. */
export const MAX_QUERY_LENGTH = 80;

/**
 * Deep paging is a crawler trap and a database cost with no reader behind it;
 * at 24 per page this is still ~4,800 facilities deep.
 */
export const MAX_PAGE = 200;

/** Past this depth the pages are noindexed — see `shouldNoIndex`. */
export const MAX_INDEXED_PAGE = 5;

/**
 * Rating thresholds offered as a filter. Whole and half stars only: a "3.7+"
 * option would imply a precision the underlying averages do not have.
 */
export const MIN_RATING_OPTIONS = [3, 3.5, 4, 4.5] as const;

export type MinRating = (typeof MIN_RATING_OPTIONS)[number];

/**
 * Plural forms for headings ("Hospitals in Riyadh").
 *
 * `FACILITY_KIND_LABELS` holds the singular, and no suffix rule gets all nine
 * right — "Laboratory" needs -ies, "Mental health" needs a noun added, and
 * "Rehabilitation" is not a countable thing at all.
 */
export const KIND_PLURAL_LABELS: Record<string, string> = {
  HOSPITAL: "Hospitals",
  CLINIC: "Clinics",
  HEALTH_CENTER: "Health centres",
  DENTAL_CLINIC: "Dental clinics",
  PHARMACY: "Pharmacies",
  LABORATORY: "Laboratories",
  REHAB_CENTER: "Rehabilitation centres",
  MENTAL_HEALTH: "Mental health facilities",
  OTHER: "Other facilities",
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export type FacilityQuery = {
  /** Free-text search. Empty string, never undefined, so it is safe to render. */
  q: string;
  sort: SortKey;
  /** ISO-3166-1 alpha-2, lower-cased for the URL. */
  country?: string;
  /** Region slug, e.g. "qassim". Resolved to the enum on the way to the query. */
  region?: string;
  /** City slug. */
  city?: string;
  /** FacilityKind enum value, upper-cased. Serialised lower-case. */
  kind?: string;
  min?: MinRating;
  page: number;
};

export type FacilityQueryOverrides = Partial<FacilityQuery>;

/**
 * The families that show as a removable chip above the results, in chip order.
 */
export const FILTER_FAMILIES = ["city", "country", "kind", "min"] as const;

export type FilterFamily = (typeof FILTER_FAMILIES)[number];

/**
 * The rail offers one family more than the chips do.
 *
 * Region leads it — a student weighing a training year thinks "somewhere in
 * Qassim" before they think "Buraydah" — but it has no chip of its own, so its
 * row in the rail is both how it is set and how it is cleared.
 */
export type RailFamily = FilterFamily | "region";

const SORT_KEYS = Object.keys(SORT_OPTIONS) as [SortKey, ...SortKey[]];

/** Slug shape: lower-case words joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `hasOwn`, not `in`: `REGION_BY_SLUG` carries Object's prototype, so `in`
 * would accept `?region=constructor` and hand its value on to the database.
 */
function isRegionSlug(value: string): boolean {
  return Object.hasOwn(REGION_BY_SLUG, value);
}

function clampPage(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_PAGE, Math.max(1, Math.floor(value)));
}

function isMinRating(value: number): value is MinRating {
  return (MIN_RATING_OPTIONS as readonly number[]).includes(value);
}

/**
 * Every field carries a `.catch`, so this schema is total: any input object,
 * including `{}`, parses to a usable query.
 */
export const facilityQuerySchema = z.object({
  q: z
    .string()
    .transform((value) =>
      value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH),
    )
    .catch(""),
  sort: z.enum(SORT_KEYS).catch(DEFAULT_SORT),
  country: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional()
    .catch(undefined),
  region: z
    .string()
    .refine(isRegionSlug)
    .optional()
    .catch(undefined),
  city: z
    .string()
    .max(80)
    .regex(SLUG_PATTERN)
    .optional()
    .catch(undefined),
  kind: z
    .string()
    .refine((value) => FACILITY_KINDS.includes(value))
    .optional()
    .catch(undefined),
  min: z.coerce
    .number()
    .refine(isMinRating)
    .optional()
    .catch(undefined),
  page: z.coerce.number().catch(1).transform(clampPage),
});

/** A repeated param (`?kind=a&kind=b`) resolves to its first value. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Case-fold before validation so `?country=SA` and `?kind=Hospital` are
 * understood, while the canonical URL still emits one spelling of each.
 */
function normaliseRaw(sp: SearchParamsInput) {
  return {
    q: first(sp.q),
    sort: first(sp.sort)?.trim().toLowerCase(),
    country: first(sp.country)?.trim().toLowerCase(),
    region: first(sp.region)?.trim().toLowerCase(),
    city: first(sp.city)?.trim().toLowerCase(),
    kind: first(sp.kind)?.trim().toUpperCase(),
    min: first(sp.min)?.trim(),
    page: first(sp.page)?.trim(),
  };
}

export function parseFacilityQuery(
  sp: SearchParamsInput = {},
): FacilityQuery {
  const parsed = facilityQuerySchema.parse(normaliseRaw(sp));
  return {
    q: parsed.q,
    sort: parsed.sort,
    country: parsed.country,
    region: parsed.region,
    city: parsed.city,
    kind: parsed.kind,
    min: parsed.min as MinRating | undefined,
    page: parsed.page,
  };
}

/**
 * Serialise a query back to a URL, dropping every parameter that is already at
 * its default value so each result set has exactly one address.
 *
 * `overrides` is applied on top of `params`; passing `undefined` for a key
 * clears it, which is how the filter links toggle a value off.
 */
export function buildHref(
  base: string,
  params: FacilityQuery,
  overrides: FacilityQueryOverrides = {},
): string {
  const next: FacilityQuery = { ...params, ...overrides };

  // Page 7 of an old result set is meaningless once the set changes, and often
  // empty. Any override except an explicit page returns to the first page.
  const changesResultSet = Object.keys(overrides).some((key) => key !== "page");
  if (changesResultSet && !("page" in overrides)) next.page = 1;

  // Fixed key order: two links that mean the same thing must be byte-identical.
  const search = new URLSearchParams();
  if (next.q) search.set("q", next.q);
  if (next.country) search.set("country", next.country);
  if (next.region) search.set("region", next.region);
  if (next.city) search.set("city", next.city);
  if (next.kind) search.set("kind", next.kind.toLowerCase());
  if (next.min !== undefined) search.set("min", String(next.min));
  if (next.sort !== DEFAULT_SORT) search.set("sort", next.sort);
  if (next.page > 1) search.set("page", String(next.page));

  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

/** The query with every filter cleared, keeping the reader's chosen sort. */
export function clearedQuery(query: FacilityQuery): FacilityQuery {
  return { q: "", sort: query.sort, page: 1 };
}

export function activeFamilies(query: FacilityQuery): FilterFamily[] {
  return FILTER_FAMILIES.filter((family) => query[family] !== undefined);
}

export function hasActiveFilters(query: FacilityQuery): boolean {
  return (
    query.q !== "" ||
    query.region !== undefined ||
    activeFamilies(query).length > 0
  );
}

/** The selected value of one family, as the string its option links carry. */
export function familyValue(
  query: FacilityQuery,
  family: RailFamily,
): string | undefined {
  const value = query[family];
  return value === undefined ? undefined : String(value);
}

/**
 * An override that sets — or, with `undefined`, clears — one family.
 *
 * Written as a switch rather than a computed key so the numeric `min` keeps
 * its type and a typo in a family name is a compile error.
 */
export function familyOverride(
  family: RailFamily,
  value: string | undefined,
): FacilityQueryOverrides {
  switch (family) {
    case "region":
      return { region: value };
    case "city":
      return { city: value };
    case "country":
      return { country: value };
    case "kind":
      return { kind: value };
    case "min": {
      if (value === undefined) return { min: undefined };
      const parsed = Number(value);
      return { min: isMinRating(parsed) ? parsed : undefined };
    }
  }
}

/**
 * Whether this result set should be kept out of the index.
 *
 * Four filter families multiply into tens of thousands of URLs that all
 * paraphrase the same few hundred facilities. Two families deep stays
 * indexable — "hospitals in Riyadh" is a real page someone searches for —
 * beyond that, and for free-text and deep pages, we follow but do not index.
 */
export function shouldNoIndex(query: FacilityQuery): boolean {
  if (query.q) return true;
  if (query.page > MAX_INDEXED_PAGE) return true;
  const narrowed = activeFamilies(query).length + (query.region ? 1 : 0);
  return narrowed > 2;
}

/**
 * The heading, and the `<title>`, for a result set. Pure so the wording is
 * testable without a database.
 */
export function describeFacilityQuery(input: {
  kind?: string;
  cityName?: string;
  regionName?: string;
  countryName?: string;
  q?: string;
}): string {
  const noun = input.kind
    ? (KIND_PLURAL_LABELS[input.kind] ?? "Facilities")
    : "Facilities";
  // Narrowest place first: "Hospitals in Buraydah" beats "in Qassim".
  const place = input.cityName ?? input.regionName ?? input.countryName;

  const parts = [noun];
  if (place) parts.push(`in ${place}`);
  if (input.q) parts.push(`matching “${input.q}”`);

  // Nothing narrowed at all: say so plainly rather than "Facilities".
  if (parts.length === 1 && !input.kind) return "All facilities";
  return parts.join(" ");
}

/**
 * Translate URL state into the filter shape `listFacilities` expects. The
 * country code is stored upper-case in the database and lower-case in the URL,
 * and that conversion belongs here rather than in every caller.
 */
export function toFacilityFilters(query: FacilityQuery) {
  return {
    sort: query.sort,
    page: query.page,
    query: query.q || undefined,
    citySlug: query.city,
    countryCode: query.country?.toUpperCase(),
    // The URL carries the slug; the column holds the enum value.
    regionKey: query.region ? REGION_BY_SLUG[query.region] : undefined,
    kind: query.kind,
    minRating: query.min,
  };
}
