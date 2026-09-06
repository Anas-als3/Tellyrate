import Link from "next/link";
import { SORT_OPTIONS, type SortKey } from "@/lib/ranking";
import { buildHref, type FacilityQuery } from "@/lib/facility-query";
import { getT } from "@/lib/i18n/server";

/**
 * Sort controls as links, not a `<select>`.
 *
 * A select needs JavaScript to do anything, gives every ordering the same URL,
 * and hides the options behind a click. Four anchors cost nothing, work with
 * scripting off, and make each ordering shareable and crawlable — which is the
 * whole reason sort state lives in the query string.
 *
 * A list inside a nav, rather than bare anchors, so a screen reader announces
 * how many orderings there are before the reader commits to one.
 *
 * `SORT_OPTIONS` supplies the keys and the ordering; the wording comes from
 * the dictionary. Keeping the English out of `lib/ranking.ts` means the URL
 * vocabulary (`?sort=highest_rated`) stays language-independent, which it has
 * to be — a shared link must open the same result set in either language.
 */
export async function SortTabs({
  base,
  query,
  label,
}: {
  base: string;
  query: FacilityQuery;
  label?: string;
}) {
  const t = await getT();
  const keys = Object.keys(SORT_OPTIONS) as SortKey[];

  return (
    <nav aria-label={label ?? t.facilities.sortLabel}>
      <ul className="tabs" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {keys.map((key) => {
          const active = key === query.sort;
          return (
            <li key={key}>
              <Link
                className="tab"
                href={buildHref(base, query, { sort: key })}
                aria-current={active ? "page" : undefined}
              >
                {t.labels.sort[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
