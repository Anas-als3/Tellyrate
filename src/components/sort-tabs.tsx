import Link from "next/link";
import { SORT_OPTIONS, type SortKey } from "@/lib/ranking";
import { buildHref, type FacilityQuery } from "@/lib/facility-query";

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
 */
export function SortTabs({
  base,
  query,
  label = "Sort facilities",
}: {
  base: string;
  query: FacilityQuery;
  label?: string;
}) {
  const options = Object.entries(SORT_OPTIONS) as [SortKey, string][];

  return (
    <nav aria-label={label}>
      <ul className="tabs" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {options.map(([key, text]) => {
          const active = key === query.sort;
          return (
            <li key={key}>
              <Link
                className="tab"
                href={buildHref(base, query, { sort: key })}
                aria-current={active ? "page" : undefined}
              >
                {text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
