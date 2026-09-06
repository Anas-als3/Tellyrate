import Link from "next/link";

import { getT } from "@/lib/i18n/server";

/**
 * A missing facility is usually a stale link or a place that was merged into
 * another record, so this page spends its space on the two routes back in
 * rather than on an apology.
 *
 * Async because it answers in the reader's language, and the locale lives in
 * a cookie. The root layout already reads that cookie on every request, so
 * this costs nothing that was not already being paid.
 */
export default async function FacilityNotFound() {
  const t = await getT();

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
      <p className="label">{t.errors.facilityNotFoundEyebrow}</p>

      <h1 style={{ fontSize: "var(--step-3)" }}>
        {t.errors.facilityNotFoundTitle}
      </h1>

      <p style={{ color: "var(--ink-2)" }}>{t.errors.facilityNotFoundBody}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
        <Link className="btn btn--primary" href="/facilities">
          {t.errors.searchFacilities}
        </Link>
        <Link className="btn" href="/cities">
          {t.errors.browseByCity}
        </Link>
      </div>
    </div>
  );
}
