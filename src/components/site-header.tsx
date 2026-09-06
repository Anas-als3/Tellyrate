"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useViewer } from "@/components/use-viewer";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

/**
 * Structurally satisfied by `SessionUser`, but declared locally: `@/lib/session`
 * is server-only and must not be reachable from a client module graph.
 */
export type HeaderUser = { username: string };

/**
 * The strings arrive as props for the same reason: `@/lib/i18n/server` reads
 * cookies and cannot be imported here. Typing them off `Dictionary` keeps them
 * in step with the dictionary without importing a value from it.
 */
type NavStrings = Dictionary["nav"];
type LanguageStrings = Dictionary["common"]["language"];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({
  locale,
  nav,
  language,
}: {
  locale: Locale;
  nav: NavStrings;
  language: LanguageStrings;
}) {
  // Fetched client-side rather than passed down, so that reading the session
  // cookie does not make every public page render per-request. See use-viewer.
  const { viewer: user } = useViewer();

  const pathname = usePathname();

  const navLinks = [
    { href: "/facilities", label: nav.facilities },
    { href: "/cities", label: nav.cities },
    { href: "/guidelines", label: nav.guidelines },
  ];

  return (
    <header
      style={{
        position: "sticky",
        insetBlockStart: 0,
        zIndex: 50,
        background: "var(--surface)",
        borderBlockEnd: "1px solid var(--line)",
      }}
    >
      <div
        className="page"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-s)",
          minBlockSize: 56,
        }}
      >
        <Link
          href="/"
          aria-label={nav.brandHome}
          style={{
            // globals.css clears `min-inline-size` on every flex child so text
            // can shrink; a nowrap wordmark that shrinks just spills over its
            // neighbour instead, so this one opts out of shrinking.
            flexShrink: 0,
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontStretch: "92%",
            fontSize: "var(--step-1)",
            letterSpacing: "-0.02em",
            textDecoration: "none",
            whiteSpace: "nowrap",
            color: "var(--ink)",
          }}
        >
          {/* The wordmark is the brand and stays Latin in both languages, so
              it is tagged `en` — otherwise an Arabic page would try to shape
              it with the Arabic face and read it out letter by letter. */}
          <span lang="en">Tellyrate</span>
        </Link>

        <nav
          aria-label={nav.sections}
          className="hidden md:flex"
          style={{ alignItems: "center", gap: "var(--space-3xs)" }}
        >
          {navLinks.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              active={isActive(pathname, link.href)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* A plain GET form: search has to work with scripting turned off, and
            each result set has to have a URL somebody can send to a friend. */}
        <form
          action="/search"
          method="get"
          role="search"
          style={{
            display: "flex",
            flex: "1 1 auto",
            minInlineSize: 0,
            maxInlineSize: 300,
          }}
        >
          <label htmlFor="site-search" className="sr-only">
            {nav.searchLabel}
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            className="input"
            placeholder={nav.searchPlaceholder}
            autoComplete="off"
            style={{
              minInlineSize: 0,
              padding: "6px var(--space-s)",
              fontSize: "var(--step--1)",
            }}
          />
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2xs)",
            marginInlineStart: "auto",
            // Fixed-size controls: the search box beside them is the elastic
            // one. Without this they share the squeeze and spill their buttons
            // out of the header on a narrow Arabic page, where the switcher
            // reads "English" and is wider than it is on the English page.
            flexShrink: 0,
          }}
        >
          <LanguageSwitcher
            locale={locale}
            label={language.switchTo}
            targetName={language.targetName}
          />

          <ThemeToggle />

          <div
            className="hidden md:flex"
            style={{ alignItems: "center", gap: "var(--space-2xs)" }}
          >
            {user ? (
              <>
                <Link
                  href="/account"
                  className="chip"
                  aria-current={isActive(pathname, "/account") ? "page" : undefined}
                  style={{ maxInlineSize: 160, overflow: "hidden" }}
                >
                  <bdi
                    dir="auto"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.username}
                  </bdi>
                </Link>
                {/* Deliberately a plain anchor: a next/link would let a hover
                    prefetch sign the reader out. */}
                <a href="/logout" className="btn btn--quiet btn--small">
                  {nav.logOut}
                </a>
              </>
            ) : (
              <Link href="/login" className="btn btn--quiet btn--small">
                {nav.logIn}
              </Link>
            )}
            {/* A review always belongs to one facility, so the call to action
                leads to the directory the reader picks it from. */}
            <Link href="/facilities" className="btn btn--primary btn--small">
              {nav.writeReview}
            </Link>
          </div>

          {/* No drawer, no script: a native disclosure. Keyed on the path so it
              closes itself once a link inside it has been followed. */}
          <details
            key={pathname}
            className="md:hidden"
            style={{ position: "relative" }}
          >
            <summary
              className="btn btn--quiet btn--small"
              style={{
                display: "inline-flex",
                listStyle: "none",
                inlineSize: 34,
                minInlineSize: 34,
                blockSize: 34,
                minBlockSize: 34,
                padding: 0,
                color: "var(--ink-2)",
              }}
            >
              <span className="sr-only">{nav.menu}</span>
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>

            <div
              className="card"
              style={{
                position: "absolute",
                insetInlineEnd: 0,
                insetBlockStart: "calc(100% + 10px)",
                zIndex: 60,
                minInlineSize: 220,
                padding: "var(--space-xs)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3xs)",
                boxShadow: "var(--shadow-2)",
              }}
            >
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  active={isActive(pathname, link.href)}
                  block
                >
                  {link.label}
                </NavLink>
              ))}

              <hr
                style={{
                  inlineSize: "100%",
                  border: 0,
                  borderBlockStart: "1px solid var(--line)",
                  margin: "var(--space-2xs) 0",
                }}
              />

              {user ? (
                <>
                  <NavLink
                    href="/account"
                    active={isActive(pathname, "/account")}
                    block
                  >
                    <bdi dir="auto">{user.username}</bdi>
                  </NavLink>
                  <a
                    href="/logout"
                    style={{
                      padding: "8px var(--space-s)",
                      borderRadius: "var(--r-1)",
                      fontSize: "var(--step-0)",
                      fontWeight: 600,
                      textDecoration: "none",
                      color: "var(--ink-2)",
                    }}
                  >
                    {nav.logOut}
                  </a>
                </>
              ) : (
                <NavLink href="/login" active={isActive(pathname, "/login")} block>
                  {nav.logIn}
                </NavLink>
              )}

              <Link
                href="/facilities"
                className="btn btn--primary btn--small"
                style={{ marginBlockStart: "var(--space-2xs)" }}
              >
                {nav.writeReview}
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  block = false,
  children,
}: {
  href: string;
  active: boolean;
  block?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        display: block ? "block" : undefined,
        padding: block ? "8px var(--space-s)" : "6px var(--space-s)",
        borderRadius: block ? "var(--r-1)" : "var(--r-pill)",
        fontSize: "var(--step-0)",
        fontWeight: 600,
        textDecoration: "none",
        whiteSpace: "nowrap",
        color: active ? "var(--brand-ink)" : "var(--ink-2)",
        background: active ? "var(--brand-soft)" : "transparent",
      }}
    >
      {children}
    </Link>
  );
}
