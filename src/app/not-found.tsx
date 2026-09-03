import Link from "next/link";

/**
 * No `<main>` element here on purpose: this file also serves `notFound()`
 * calls from pages inside the public shell, which already provides the main
 * landmark. A second one would break the document outline.
 */
export default function NotFound() {
  return (
    <div
      className="page"
      style={{ paddingBlock: "var(--space-3xl)" }}
    >
      <section
        aria-labelledby="not-found-title"
        style={{ maxInlineSize: "var(--measure)" }}
      >
        <p className="label">Error 404</p>
        <h1
          id="not-found-title"
          style={{
            fontSize: "var(--step-4)",
            marginBlockStart: "var(--space-xs)",
          }}
        >
          There is nothing at this address
        </h1>
        <p
          className="prose"
          style={{ marginBlockStart: "var(--space-m)", color: "var(--ink-2)" }}
        >
          The page may have been a facility that was merged into another record,
          or the link may simply be wrong. Searching for the place by name is
          usually faster than fixing the URL — hospital names arrive here from
          OpenStreetMap and are spelled in more ways than anyone would guess.
        </p>

        <nav
          aria-label="Where to go instead"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
            marginBlockStart: "var(--space-l)",
          }}
        >
          <Link className="btn btn--primary" href="/facilities">
            Search facilities
          </Link>
          <Link className="btn" href="/cities">
            Browse by city
          </Link>
          <Link className="btn btn--quiet" href="/">
            Home
          </Link>
        </nav>
      </section>
    </div>
  );
}
