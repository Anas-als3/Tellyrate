import Link from "next/link";

/**
 * A missing facility is usually a stale link or a place that was merged into
 * another record, so this page spends its space on the two routes back in
 * rather than on an apology.
 */
export default function FacilityNotFound() {
  return (
    <div
      className="page"
      style={{
        paddingBlock: "var(--space-3xl)",
        display: "grid",
        gap: "var(--space-m)",
        maxInlineSize: "var(--measure)",
      }}
    >
      <p className="label">404 — not found</p>

      <h1 style={{ fontSize: "var(--step-3)" }}>
        There is no facility at this address
      </h1>

      <p style={{ color: "var(--ink-2)" }}>
        The link may be out of date, or two records for the same place may have
        been merged into one. Searching by name is the quickest way to find it
        again — hospital names are often listed in both English and Arabic.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
        <Link className="btn btn--primary" href="/facilities">
          Search facilities
        </Link>
        <Link className="btn" href="/cities">
          Browse by city
        </Link>
      </div>
    </div>
  );
}
