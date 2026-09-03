import Link from "next/link";

/**
 * Windowed page numbers: always the first and last page, always the pages
 * either side of the current one, and an ellipsis where the run breaks. Keeps
 * the control a fixed width at any depth, and keeps the first and last page
 * one click away, which is where readers actually jump.
 */
export function pageWindow(
  page: number,
  pageCount: number,
  span = 1,
): (number | "gap")[] {
  const wanted = new Set<number>([1, pageCount]);
  for (let p = page - span; p <= page + span; p++) {
    if (p >= 1 && p <= pageCount) wanted.add(p);
  }

  const pages = [...wanted].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous = 0;

  for (const p of pages) {
    // A single skipped page is not worth an ellipsis — show the page instead.
    if (previous && p - previous === 2) out.push(previous + 1);
    else if (previous && p - previous > 2) out.push("gap");
    out.push(p);
    previous = p;
  }

  return out;
}

export function Pagination({
  page,
  pageCount,
  href,
  label = "Pagination",
}: {
  page: number;
  pageCount: number;
  /** Builds the URL for a page number, preserving every other parameter. */
  href: (page: number) => string;
  label?: string;
}) {
  if (pageCount <= 1) return null;

  const items = pageWindow(page, pageCount);

  return (
    <nav
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-xs)",
        flexWrap: "wrap",
        marginBlockStart: "var(--space-xl)",
      }}
    >
      {/* Absent rather than disabled at the ends: a control that cannot act
          should not be in the tab order at all. */}
      {page > 1 ? (
        <Link className="btn btn--small" rel="prev" href={href(page - 1)}>
          <span aria-hidden="true">←</span> Previous
        </Link>
      ) : null}

      <ol
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3xs)",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {items.map((item, index) =>
          item === "gap" ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              style={{
                padding: "0 var(--space-2xs)",
                color: "var(--ink-3)",
              }}
            >
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                className={
                  item === page
                    ? "btn btn--small btn--primary tnum"
                    : "btn btn--small btn--quiet tnum"
                }
                href={href(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Page ${item}`}
                style={{ minInlineSize: 36 }}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>

      {page < pageCount ? (
        <Link className="btn btn--small" rel="next" href={href(page + 1)}>
          Next <span aria-hidden="true">→</span>
        </Link>
      ) : null}

      <p className="sr-only">
        Page {page} of {pageCount}
      </p>
    </nav>
  );
}
