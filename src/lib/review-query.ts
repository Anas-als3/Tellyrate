import { z } from "zod";
import { ROTATION_SPECIALTIES, STUDENT_FIELDS } from "@/lib/labels";
import {
  REVIEW_SORT_OPTIONS,
  type ReviewSortKey,
} from "@/lib/ranking";
import type { SearchParamsInput } from "@/lib/facility-query";

export const DEFAULT_REVIEW_SORT: ReviewSortKey = "helpful";

export type ReviewQuery = {
  sort: ReviewSortKey;
  page: number;
  field?: string;
  specialty?: string;
};

export type ReviewQueryOverrides = Partial<ReviewQuery>;

const REVIEW_SORT_KEYS = Object.keys(REVIEW_SORT_OPTIONS) as [
  ReviewSortKey,
  ...ReviewSortKey[],
];

const schema = z.object({
  sort: z.enum(REVIEW_SORT_KEYS).catch(DEFAULT_REVIEW_SORT),
  page: z.coerce
    .number()
    .catch(1)
    .transform((value) =>
      Number.isFinite(value)
        ? Math.min(1000, Math.max(1, Math.floor(value)))
        : 1,
    ),
  field: z
    .string()
    .refine((value) => STUDENT_FIELDS.includes(value))
    .optional()
    .catch(undefined),
  specialty: z
    .string()
    .refine((value) => ROTATION_SPECIALTIES.includes(value))
    .optional()
    .catch(undefined),
});

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseReviewQuery(sp: SearchParamsInput = {}): ReviewQuery {
  const parsed = schema.parse({
    sort: first(sp.rsort)?.trim().toLowerCase(),
    page: first(sp.rpage)?.trim(),
    field: first(sp.rfield)?.trim().toUpperCase(),
    specialty: first(sp.rspecialty)?.trim().toUpperCase(),
  });
  return parsed;
}

export function buildReviewHref(
  slug: string,
  query: ReviewQuery,
  overrides: ReviewQueryOverrides = {},
  withHash = true,
): string {
  const next = { ...query, ...overrides };
  const changesResults = Object.keys(overrides).some((key) => key !== "page");
  if (changesResults && !("page" in overrides)) next.page = 1;

  const search = new URLSearchParams();
  if (next.sort !== DEFAULT_REVIEW_SORT) search.set("rsort", next.sort);
  if (next.field) search.set("rfield", next.field.toLowerCase());
  if (next.specialty) {
    search.set("rspecialty", next.specialty.toLowerCase());
  }
  if (next.page > 1) search.set("rpage", String(next.page));

  const qs = search.toString();
  return `/facilities/${slug}${qs ? `?${qs}` : ""}${withHash ? "#reviews" : ""}`;
}

export function hasReviewFilters(query: ReviewQuery): boolean {
  return query.field !== undefined || query.specialty !== undefined;
}
