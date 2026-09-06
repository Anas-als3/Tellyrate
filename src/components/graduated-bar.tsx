import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The graduated bar — the site's signature element.
 *
 * A track with hairline graduations every 20%, like the volume scale printed
 * down the side of an IV bag. Used for rating distributions, sub-rating
 * breakdowns and field breakdowns, so the same shape means "a proportion"
 * everywhere on the site.
 *
 * The fill is anchored with `inset-inline-start`, so in Arabic the bar grows
 * from the right without a single rule changing. Nothing here may be given a
 * physical edge.
 */

/** Colour a score by band, so a 2-star average never renders in the same green as a 5. */
export function tierFor(rating: number): string {
  if (rating >= 4.5) return "var(--tier-5)";
  if (rating >= 3.5) return "var(--tier-4)";
  if (rating >= 2.5) return "var(--tier-3)";
  if (rating >= 1.5) return "var(--tier-2)";
  return "var(--tier-1)";
}

export function GraduatedBar({
  percent,
  tier,
  label,
}: {
  percent: number;
  /** A colour, or a 1-5 rating to derive one from. */
  tier?: string | number;
  /** Only needed when the bar is not already described by adjacent text. */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const colour =
    typeof tier === "number" ? tierFor(tier) : (tier ?? "var(--tier-5)");

  return (
    <span
      className="gbar"
      style={
        {
          "--pct": `${clamped}%`,
          "--tier": colour,
        } as React.CSSProperties
      }
      role={label ? "img" : "presentation"}
      aria-label={label}
    >
      <span className="gbar__fill" />
    </span>
  );
}

/**
 * The 5★→1★ distribution table.
 *
 * A real `<table>` rather than styled divs: sighted readers get the bars,
 * screen-reader users get the exact counts, and neither is a second-class
 * rendering of the other.
 */
export function RatingDistribution({
  counts,
  total,
  t,
}: {
  /** Index 0 is one star, index 4 is five stars. */
  counts: number[];
  total: number;
  t: Dictionary;
}) {
  return (
    <table
      style={{
        inlineSize: "100%",
        borderCollapse: "collapse",
        fontSize: "var(--step--1)",
      }}
    >
      <caption className="sr-only">{t.facility.distributionHeading}</caption>
      <tbody>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = counts[star - 1] ?? 0;
          const percent = total > 0 ? (count / total) * 100 : 0;
          return (
            <tr key={star}>
              <th
                scope="row"
                style={{
                  textAlign: "start",
                  fontWeight: 500,
                  color: "var(--ink-3)",
                  padding: "3px 0",
                  // A hint, not a cap: Arabic spells the row out as a word
                  // ("نجمة واحدة") rather than a numeral plus "stars", and
                  // auto table layout widens the column to fit it.
                  inlineSize: "4.5rem",
                  whiteSpace: "nowrap",
                }}
              >
                {t.facility.starsRow(star)}
              </th>
              <td style={{ padding: "3px var(--space-xs)", inlineSize: "100%" }}>
                <GraduatedBar percent={percent} tier={star} />
              </td>
              <td
                className="tnum"
                style={{
                  textAlign: "end",
                  color: "var(--ink-2)",
                  inlineSize: "3rem",
                }}
              >
                {count}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * A labelled sub-rating row. Each axis carries its own `n`, because the
 * sub-ratings are optional per review and a reader needs to know whether an
 * axis rests on 40 opinions or 3.
 */
export function SubRating({
  label,
  value,
  count,
  t,
}: {
  label: string;
  value: number | null;
  count: number;
  t: Dictionary;
}) {
  if (value === null || count === 0) {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "var(--space-s)",
          }}
        >
          <span style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}>
            {label}
          </span>
          <span style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
            {t.facility.notRatedYet}
          </span>
        </div>
        <GraduatedBar percent={0} tier="var(--surface-3)" />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "var(--space-s)",
        }}
      >
        <span style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}>
          {label}
        </span>
        <span
          className="tnum"
          style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}
        >
          {/* One sentence for a screen reader rather than three fragments
              stitched around a numeral, which is unorderable in Arabic. */}
          <span className="sr-only">
            {t.common.outOfFiveFrom(value.toFixed(1), count)}
          </span>
          <span aria-hidden="true">
            <strong style={{ color: "var(--ink)" }}>{value.toFixed(1)}</strong>{" "}
            {t.common.ratingCount(count)}
          </span>
        </span>
      </div>
      <GraduatedBar percent={(value / 5) * 100} tier={value} />
    </div>
  );
}
