import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  const footerLinks = [
    { href: "/about", label: t.nav.about },
    { href: "/privacy", label: t.nav.privacy },
    { href: "/guidelines", label: t.nav.guidelines },
  ];

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
        <nav aria-label={t.common.footer.aboutNav} style={column}>
          <span className="label" lang="en">
            {t.common.siteName}
          </span>
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
            {footerLinks.map((link) => (
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
          <span className="label">{t.common.footer.anonymousHeading}</span>
          <p style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}>
            {t.common.footer.anonymousLine}
          </p>
          <p style={{ fontSize: "var(--step--2)", color: "var(--ink-3)" }}>
            {t.common.footer.anonymousNote}
          </p>
        </div>

        <div style={column}>
          <span className="label">{t.common.footer.dataHeading}</span>
          {/* A licence obligation, not a courtesy: it has to appear on every
              page that shows imported facility data, in whatever language the
              page is being read in. */}
          <p style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}>
            <a
              href="https://www.openstreetmap.org/copyright"
              rel="license noopener noreferrer"
              target="_blank"
            >
              {t.common.footer.osmAttribution}
            </a>
          </p>
          <p style={{ fontSize: "var(--step--2)", color: "var(--ink-3)" }}>
            {t.common.footer.disclaimer}
          </p>
        </div>

        {/* Repeated from the header on purpose: someone who reaches the bottom
            of a page in the wrong language should not have to scroll back up
            to change it. */}
        <div style={column}>
          <span className="label">{t.common.language.groupLabel}</span>
          <div>
            <LanguageSwitcher
              locale={locale}
              label={t.common.language.switchTo}
              targetName={t.common.language.targetName}
              className="btn btn--small"
            />
          </div>
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
