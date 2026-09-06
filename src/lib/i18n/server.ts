import "server-only";

import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  isLocale,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";

/**
 * Which language this request is being answered in.
 *
 * The locale lives in a cookie rather than in the path, so `/facilities` is
 * one URL that answers in whichever language the reader chose. That keeps the
 * whole route tree as it is — no `[locale]` segment, no rewritten links — at
 * the cost of the two languages sharing one address in search results. Moving
 * to `/ar` prefixes later is a route change, not a copy change: everything
 * below this line stays exactly as it is.
 *
 * `cookies()` is async in Next 16, and reading it opts the request into
 * per-request rendering. The root layout already does that for every page,
 * because it has to know the direction before it can emit `<html>`.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The strings for this request. Named `getT` because call sites read better as `t.`. */
export async function getT(): Promise<Dictionary> {
  return getDictionary(await getLocale());
}
