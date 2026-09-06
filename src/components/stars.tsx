import { Fragment } from "react";

import type { Dictionary } from "@/lib/i18n/dictionaries";

const STAR_PATH =
  "M12 2.6l2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.48l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 2.6z";

/**
 * Strings arrive as a prop rather than from `getT()`.
 *
 * `StarInput` below is used by the review form, which is a client component,
 * so this module ends up in the client graph and cannot import
 * `@/lib/i18n/server` — that module is server-only by design. The prop is
 * optional because several call sites belong to other areas of the site; a
 * missing dictionary falls back to English, which is a more honest failure
 * mode for an unwired call site than a blank accessible name.
 */
const EN = {
  outOfFive: (value: string) => `${value} out of 5`,
  outOfFiveFrom: (value: string, count: number) =>
    `${value} out of 5, from ${count} ${count === 1 ? "review" : "reviews"}`,
  starCount: (n: number) => `${n} ${n === 1 ? "star" : "stars"}`,
  ratingWords: ["Avoid", "Poor", "Mixed", "Good", "Excellent"],
};

/**
 * A read-only rating display. Rendered as one accessible label plus decorative
 * glyphs, rather than five separate images, so a screen reader hears
 * "4.4 out of 5" instead of counting stars aloud.
 */
export function Stars({
  value,
  size = 16,
  showValue = false,
  count,
  t,
}: {
  value: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  t?: Dictionary;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  // Western digits in both languages — the site's tabular alignment is built
  // on them, and Saudi interfaces use them anyway.
  const shown = clamped.toFixed(1);

  // A whole sentence from the dictionary, never a number glued to a translated
  // suffix: Arabic puts the sample size somewhere else in the sentence than
  // English does, and a sentence assembled from fragments cannot be reordered.
  const label =
    count === undefined
      ? (t?.common.outOfFive ?? EN.outOfFive)(shown)
      : (t?.common.outOfFiveFrom ?? EN.outOfFiveFrom)(shown, count);

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      title={label}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        style={{ display: "inline-flex", gap: 1, lineHeight: 0 }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          // Fill this star by however much of it the rating covers, so 4.4
          // reads as four filled and one 40% filled rather than rounding.
          const fill = Math.max(0, Math.min(1, clamped - i));
          return (
            <span
              key={i}
              style={{
                position: "relative",
                display: "block",
                inlineSize: size,
                blockSize: size,
              }}
            >
              <StarGlyph size={size} filled={false} dim={fill === 0} />
              {fill > 0 ? (
                // The partial fill is a clip on a logical edge rather than an
                // SVG gradient, so the scale grows from the reading edge in
                // both directions — the same way the graduated bars do — and
                // so a page full of reviews does not repeat one gradient id.
                <span
                  style={{
                    position: "absolute",
                    insetBlock: 0,
                    insetInlineStart: 0,
                    inlineSize: `${fill * 100}%`,
                    overflow: "hidden",
                  }}
                >
                  <StarGlyph size={size} filled pinned />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span
          className="tnum"
          style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}
        >
          {shown}
        </span>
      ) : null}
    </span>
  );
}

function StarGlyph({
  size,
  filled,
  dim = false,
  pinned = false,
}: {
  size: number;
  filled: boolean;
  /** An untouched star sits back rather than reading as an empty slot. */
  dim?: boolean;
  /** Held against the clip's leading edge so the glyph does not slide with it. */
  pinned?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={
        pinned
          ? { position: "absolute", insetBlockStart: 0, insetInlineStart: 0 }
          : { display: "block" }
      }
    >
      <path
        d={STAR_PATH}
        fill={filled ? "var(--amber)" : "none"}
        stroke="var(--amber-ink)"
        strokeWidth={1.25}
        strokeLinejoin="round"
        opacity={dim ? 0.45 : 1}
      />
    </svg>
  );
}

/**
 * The interactive star input.
 *
 * Native radios, not a slider and not clickable divs: arrow-key navigation,
 * "2 of 5" position announcements, and correct form submission all come free
 * and correct. The `row-reverse` trick in globals lets CSS fill every star up
 * to the hovered one while the DOM order stays 1 to 5.
 */
export function StarInput({
  name = "overall",
  defaultValue,
  required = true,
  t,
}: {
  name?: string;
  defaultValue?: number;
  required?: boolean;
  t?: Dictionary;
}) {
  const starCount = t?.common.starCount ?? EN.starCount;
  const words = t?.labels.ratingWords ?? EN.ratingWords;

  return (
    <div className="star-input">
      {[1, 2, 3, 4, 5].map((n) => (
        // A Fragment, not a wrapper element: the CSS fill trick relies on the
        // inputs and labels being real DOM siblings.
        <Fragment key={n}>
          <input
            type="radio"
            id={`${name}-${n}`}
            name={name}
            value={n}
            required={required && n === 1}
            defaultChecked={defaultValue === n}
            className="sr-only"
          />
          <label htmlFor={`${name}-${n}`}>
            <span className="sr-only">
              {starCount(n)} — {words[n - 1]}
            </span>
            <svg width={30} height={30} viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={STAR_PATH}
                fill="var(--star-fill)"
                stroke="var(--star-line)"
                strokeWidth={1.25}
                strokeLinejoin="round"
              />
            </svg>
          </label>
        </Fragment>
      ))}
    </div>
  );
}
