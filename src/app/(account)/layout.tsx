import Link from "next/link";

/**
 * Content and footer note share one measure, so the note is not stranded
 * against the edge of a much wider page.
 */
const measure: React.CSSProperties = {
  inlineSize: "100%",
  maxInlineSize: "44rem",
  marginInline: "auto",
};

/** The content column itself: the same measure, stacked and spaced. */
const column: React.CSSProperties = {
  ...measure,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-l)",
};

/**
 * Account pages sit outside the public shell for the same reason the sign-in
 * pages do: this is the one part of the site that is about you rather than
 * about a hospital, and mixing the directory's navigation into it invites the
 * mistake of thinking the two are connected.
 */
export default function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minBlockSize: "100dvh",
      }}
    >
      <header
        style={{
          borderBlockEnd: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <div
          className="page"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-m)",
            minBlockSize: 56,
          }}
        >
          <Link
            href="/"
            style={{
              fontWeight: 700,
              fontStretch: "92%",
              letterSpacing: "-0.02em",
              fontSize: "var(--step-1)",
              textDecoration: "none",
            }}
          >
            Tellyrate
          </Link>
          <Link href="/facilities" className="btn btn--quiet btn--small">
            Browse facilities
          </Link>
        </div>
      </header>

      {/* The root layout's skip link points at this id. */}
      <main
        id="main"
        style={{
          flex: "1 0 auto",
          display: "flex",
          justifyContent: "center",
          paddingBlock: "var(--space-xl)",
          paddingInline: "var(--space-m)",
        }}
      >
        <div style={column}>{children}</div>
      </main>

      <footer
        style={{
          borderBlockStart: "1px solid var(--line)",
          paddingBlock: "var(--space-m)",
        }}
      >
        <div className="page">
          {/* The page itself already states what is held; the footer just
              points at the longer answers. */}
          <p className="hint" style={measure}>
            <Link href="/privacy">What we store</Link> ·{" "}
            <Link href="/guidelines">Posting guidelines</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
