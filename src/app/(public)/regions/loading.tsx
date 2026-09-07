import { getT } from "@/lib/i18n/server";

/**
 * Covers both the region index and a single region — the two pages share a
 * shape, a heading over a line of counts over a grid of cards, so one skeleton
 * stands in the right places for either. It is decorative: a screen reader is
 * told the page is loading once rather than being read a wall of empty boxes.
 *
 * Nothing here needs mirroring: every size is logical, so the grid turns round
 * with the document on its own. Only the spoken line has to be translated.
 */
export default async function RegionsLoading() {
  const t = await getT();

  return (
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <p role="status" className="sr-only">
        {t.regions.loadingStatus}
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
            inlineSize: "min(30rem, 100%)",
            marginBlockStart: "var(--space-s)",
          }}
        />

        <div
          className="grid-cards"
          style={{ marginBlockStart: "var(--space-xl)" }}
        >
          {/* Thirteen boxes because the index has exactly thirteen regions —
              a constant, so this length is known rather than guessed. */}
          {Array.from({ length: 13 }).map((_, index) => (
            <div
              key={index}
              className="skeleton"
              style={{ blockSize: "4.75rem" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
