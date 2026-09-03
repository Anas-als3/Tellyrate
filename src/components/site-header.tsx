"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Structurally satisfied by `SessionUser`, but declared locally: `@/lib/session`
 * is server-only and must not be reachable from a client module graph.
 */
export type HeaderUser = { username: string };

const NAV_LINKS = [
  { href: "/facilities", label: "Facilities" },
  { href: "/cities", label: "Cities" },
  { href: "/guidelines", label: "Guidelines" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();

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
          aria-label="Hospirate — home"
          style={{
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
          Hospirate
        </Link>

        <nav
          aria-label="Sections"
          className="hidden md:flex"
          style={{ alignItems: "center", gap: "var(--space-3xs)" }}
        >
          {NAV_LINKS.map((link) => (
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
            Search facilities and cities
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            className="input"
            placeholder="Search"
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
          }}
        >
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
                  Log out
                </a>
              </>
            ) : (
              <Link href="/login" className="btn btn--quiet btn--small">
                Log in
              </Link>
            )}
            <Link href="/review/new" className="btn btn--primary btn--small">
              Write a review
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
              <span className="sr-only">Menu</span>
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
              {NAV_LINKS.map((link) => (
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
                    Log out
                  </a>
                </>
              ) : (
                <NavLink href="/login" active={isActive(pathname, "/login")} block>
                  Log in
                </NavLink>
              )}

              <Link
                href="/review/new"
                className="btn btn--primary btn--small"
                style={{ marginBlockStart: "var(--space-2xs)" }}
              >
                Write a review
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
