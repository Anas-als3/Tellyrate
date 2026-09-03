/**
 * The skeleton mirrors the real layout's boxes exactly — heading, tab strip,
 * rail, card grid — so nothing jumps when the data lands. Marked
 * `aria-hidden` and paired with a polite status message: a screen reader
 * should hear "loading", not twelve empty cards.
 */
export default function FacilitiesLoading() {
  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <p role="status" className="sr-only">
        Loading facilities…
      </p>

      <div aria-hidden="true">
        <div
          className="skeleton"
          style={{ blockSize: "2.4rem", inlineSize: "min(22rem, 70%)" }}
        />
        <div
          className="skeleton"
          style={{
            blockSize: "0.9rem",
            inlineSize: "min(34rem, 100%)",
            marginBlockStart: "var(--space-s)",
          }}
        />
        <div
          className="skeleton"
          style={{
            blockSize: "2.6rem",
            inlineSize: "100%",
            marginBlockStart: "var(--space-m)",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: "var(--space-3xs)",
            marginBlockStart: "var(--space-l)",
            borderBlockEnd: "1px solid var(--line)",
            paddingBlockEnd: "var(--space-2xs)",
          }}
        >
          {[7, 6, 8, 5].map((width, index) => (
            <div
              key={index}
              className="skeleton"
              style={{ blockSize: "1.4rem", inlineSize: `${width}rem` }}
            />
          ))}
        </div>

        <div
          className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10"
          style={{ marginBlockStart: "var(--space-m)" }}
        >
          <div className="hidden lg:grid" style={{ gap: "var(--space-l)" }}>
            {[6, 4, 8].map((rows, group) => (
              <div key={group} style={{ display: "grid", gap: 6 }}>
                <div
                  className="skeleton"
                  style={{ blockSize: "0.7rem", inlineSize: "5rem" }}
                />
                {Array.from({ length: rows }).map((_, row) => (
                  <div
                    key={row}
                    className="skeleton"
                    style={{ blockSize: "1.1rem" }}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="grid-cards mt-6 lg:mt-0">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="skeleton"
                style={{ blockSize: "10.5rem" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
