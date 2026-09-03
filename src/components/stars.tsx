import { Fragment } from "react";

const STAR_PATH =
  "M12 2.6l2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.48l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 2.6z";

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
}: {
  value: number;
  size?: number;
  showValue?: boolean;
  count?: number;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const label =
    count === undefined
      ? `${clamped.toFixed(1)} out of 5`
      : `${clamped.toFixed(1)} out of 5, from ${count} ${count === 1 ? "review" : "reviews"}`;

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
          const id = `star-${i}-${Math.round(fill * 100)}`;
          return (
            <svg
              key={i}
              width={size}
              height={size}
              viewBox="0 0 24 24"
              style={{ display: "block" }}
            >
              <defs>
                <linearGradient id={id}>
                  <stop offset={`${fill * 100}%`} stopColor="var(--amber)" />
                  <stop offset={`${fill * 100}%`} stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d={STAR_PATH}
                fill={`url(#${id})`}
                stroke="var(--amber-ink)"
                strokeWidth={1.25}
                strokeLinejoin="round"
                opacity={fill > 0 ? 1 : 0.45}
              />
            </svg>
          );
        })}
      </span>
      {showValue ? (
        <span
          className="tnum"
          style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}
        >
          {clamped.toFixed(1)}
        </span>
      ) : null}
    </span>
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
const RATING_WORDS = [
  "",
  "Avoid",
  "Poor",
  "Mixed",
  "Good",
  "Excellent",
] as const;

export function StarInput({
  name = "overall",
  defaultValue,
  required = true,
}: {
  name?: string;
  defaultValue?: number;
  required?: boolean;
}) {
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
              {n} {n === 1 ? "star" : "stars"} — {RATING_WORDS[n]}
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
