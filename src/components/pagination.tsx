import Link from "next/link";
import {
  LOCALE_DIR,
  formatNumber,
  getDictionary,
} from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

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

/**
 * An arrow means "backwards" or "forwards", not "left" or "right", and those
 * are opposite glyphs in the two directions. Keyed on the writing direction
 * rather than on the language, so a third locale gets this right for free.
 * The flex row needs no mirroring: the browser reverses it under `dir="rtl"`,
 * which is why Previous stays first in the DOM.
 */
const BACKWARD_GLYPH = { ltr: "←", rtl: "→" } as const;
const FORWARD_GLYPH = { ltr: "→", rtl: "←" } as const;

export async function Pagination({
  page,
  pageCount,
  href,
  label,
}: {
  page: number;
  pageCount: number;
  /** Builds the URL for a page number, preserving every other parameter. */
  href: (page: number) => string;
  label?: string;
}) {
  if (pageCount <= 1) return null;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const dir = LOCALE_DIR[locale];
  const items = pageWindow(page, pageCount);

  return (
    <nav
      aria-label={label ?? t.common.pagination}
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
          should not be in the tab order at all. `rel` describes the document
          order, so it stays prev/next whichever way the arrows point. */}
      {page > 1 ? (
        <Link className="btn btn--small" rel="prev" href={href(page - 1)}>
          <span aria-hidden="true">{BACKWARD_GLYPH[dir]}</span>{" "}
          {t.common.previous}
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
                aria-label={t.common.pageNumber(item)}
                style={{ minInlineSize: 36 }}
              >
                {formatNumber(item)}
              </Link>
            </li>
          ),
        )}
      </ol>

      {page < pageCount ? (
        <Link className="btn btn--small" rel="next" href={href(page + 1)}>
          {t.common.next} <span aria-hidden="true">{FORWARD_GLYPH[dir]}</span>
        </Link>
      ) : null}

      <p className="sr-only">{t.common.pageOf(page, pageCount)}</p>
    </nav>
  );
}
