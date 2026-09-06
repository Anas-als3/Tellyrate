import Link from "next/link";

/**
 * The content and the footer note share one measure, so the note reads as
 * part of the page rather than as something stranded against its edge.
 */
const measure: React.CSSProperties = {
  inlineSize: "100%",
  maxInlineSize: "27rem",
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
 * Sign-in and sign-up sit outside the public shell on purpose: no search box,
 * no navigation, nothing to click but the form and the way back. The one link
 * out is the wordmark, because nobody should feel walled in by a page that
 * exists only to take a password.
 */
export default function AuthLayout({
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
          <span className="label">Reading never needs an account</span>
        </div>
      </header>

      {/* The root layout's skip link points at this id. */}
      <main
        id="main"
        style={{
          flex: "1 0 auto",
          display: "flex",
          justifyContent: "center",
          paddingBlock: "var(--space-2xl)",
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
          <p className="hint" style={measure}>
            An account here is a username and a password. No email, no real
            name, no school — see{" "}
            <Link href="/privacy">what we store</Link>.
          </p>
        </div>
      </footer>
    </div>
  );
}
