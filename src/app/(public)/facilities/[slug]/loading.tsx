/**
 * The loading state mirrors the real page's blocks at their real sizes, so
 * nothing jumps when the content arrives. It is decorative: screen readers are
 * told the page is busy once, rather than reading a wall of empty boxes.
 */
export default function FacilityLoading() {
  return (
    <div
      className="page"
      style={{ paddingBlock: "var(--space-l) var(--space-3xl)" }}
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        Loading facility
      </span>

      <div aria-hidden="true" style={{ display: "grid", gap: "var(--space-l)" }}>
        <div style={{ display: "grid", gap: "var(--space-s)" }}>
          <div className="skeleton" style={{ blockSize: 12, inlineSize: "18rem" }} />
          <div className="skeleton" style={{ blockSize: 44, inlineSize: "min(100%, 32rem)" }} />
          <div style={{ display: "flex", gap: "var(--space-xs)" }}>
            <div className="skeleton" style={{ blockSize: 26, inlineSize: "6rem", borderRadius: "var(--r-pill)" }} />
            <div className="skeleton" style={{ blockSize: 26, inlineSize: "8rem", borderRadius: "var(--r-pill)" }} />
          </div>
        </div>

        <div
          className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
          style={{ alignItems: "start" }}
        >
          <div style={{ display: "grid", gap: "var(--space-l)", minInlineSize: 0 }}>
            <div className="card" style={{ padding: "var(--space-l)", display: "grid", gap: "var(--space-m)" }}>
              <div style={{ display: "flex", gap: "var(--space-l)", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: "var(--space-2xs)" }}>
                  <div className="skeleton" style={{ blockSize: 46, inlineSize: "5rem" }} />
                  <div className="skeleton" style={{ blockSize: 16, inlineSize: "7rem" }} />
                </div>
                <div style={{ flex: "1 1 16rem", display: "grid", gap: 6 }}>
                  {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="skeleton" style={{ blockSize: 12 }} />
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "var(--space-s)",
                  gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
                  borderBlockStart: "1px solid var(--line)",
                  paddingBlockStart: "var(--space-m)",
                }}
              >
                {[0, 1, 2, 3, 4, 5].map((axis) => (
                  <div key={axis} style={{ display: "grid", gap: 4 }}>
                    <div className="skeleton" style={{ blockSize: 12, inlineSize: "60%" }} />
                    <div className="skeleton" style={{ blockSize: 10 }} />
                  </div>
                ))}
              </div>
            </div>

            {[0, 1, 2].map((card) => (
              <div
                key={card}
                className="card"
                style={{ padding: "var(--space-m) var(--space-l)", display: "grid", gap: "var(--space-s)" }}
              >
                <div className="skeleton" style={{ blockSize: 11, inlineSize: "22rem", maxInlineSize: "100%" }} />
                <div className="skeleton" style={{ blockSize: 18, inlineSize: "8rem" }} />
                <div className="skeleton" style={{ blockSize: 14 }} />
                <div className="skeleton" style={{ blockSize: 14 }} />
                <div className="skeleton" style={{ blockSize: 14, inlineSize: "70%" }} />
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: "var(--space-m)", display: "grid", gap: "var(--space-s)" }}>
            <div className="skeleton" style={{ blockSize: 11, inlineSize: "6rem" }} />
            <div className="skeleton" style={{ blockSize: 14 }} />
            <div className="skeleton" style={{ blockSize: 14, inlineSize: "80%" }} />
            <div className="skeleton" style={{ blockSize: 14, inlineSize: "55%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
