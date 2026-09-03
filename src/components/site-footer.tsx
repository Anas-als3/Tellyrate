import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/guidelines", label: "Guidelines" },
] as const;

export function SiteFooter() {
  return (
    <footer
      style={{
        marginBlockStart: "var(--space-3xl)",
        borderBlockStart: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div
        className="page"
        style={{
          paddingBlock: "var(--space-xl)",
          display: "grid",
          gap: "var(--space-l)",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          alignItems: "start",
        }}
      >
        <nav aria-label="About this site" style={column}>
          <span className="label">Hospirate</span>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2xs)",
            }}
          >
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  style={{
                    fontSize: "var(--step--1)",
                    color: "var(--ink-2)",
                    textDecoration: "none",
                  }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div style={column}>
          <span className="label">Anonymous by design</span>
          <p style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}>
            No email. No real name. Just a username.
          </p>
          <p style={{ fontSize: "var(--step--2)", color: "var(--ink-3)" }}>
            An account exists only so that one person cannot review the same
            placement twice.
          </p>
        </div>

        <div style={column}>
          <span className="label">Data</span>
          {/* A licence obligation, not a courtesy: it has to appear on every
              page that shows imported facility data. */}
          <p style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}>
            <a
              href="https://www.openstreetmap.org/copyright"
              rel="license noopener noreferrer"
              target="_blank"
            >
              Facility data © OpenStreetMap contributors, ODbL
            </a>
          </p>
          <p style={{ fontSize: "var(--step--2)", color: "var(--ink-3)" }}>
            Reviews are the opinions of the students who wrote them, not of the
            facilities described.
          </p>
        </div>
      </div>
    </footer>
  );
}

const column: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-xs)",
};
