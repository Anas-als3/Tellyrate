import type { Metadata } from "next";
import Link from "next/link";

import { getT } from "@/lib/i18n/server";

/**
 * A function rather than a constant, because the title and description are
 * different sentences in each language and the locale is only known per
 * request.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    title: t.static.privacy.metaTitle,
    description: t.static.privacy.metaDescription,
    alternates: { canonical: "/privacy" },
  };
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        marginBlockStart: "var(--space-xl)",
        paddingBlockStart: "var(--space-l)",
        borderBlockStart: "1px solid var(--line)",
      }}
    >
      <h2 style={{ fontSize: "var(--step-2)" }}>{title}</h2>
      <div
        className="prose"
        style={{ marginBlockStart: "var(--space-s)", color: "var(--ink-2)" }}
      >
        {children}
      </div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ marginBlockStart: "0.4em" }}>{children}</li>;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A dictionary paragraph, with the identifiers inside it set as code.
 *
 * This page names cookies, keys and header values, and each of them has to
 * look like a literal rather than an oddly spelled word. The dictionary keeps
 * every paragraph as one string — a translator needs the whole sentence to
 * order it — so the identifiers arrive embedded in prose and are pulled back
 * out here. That way the sentence around them can be rewritten freely in any
 * language and `tellyrate_session` still renders as `tellyrate_session`.
 *
 * Caller passes only the identifiers that appear in that one paragraph, so a
 * short token like `en` can never be matched against a sentence that was not
 * written with it in mind.
 */
function Prose({ text, code }: { text: string; code: readonly string[] }) {
  const pattern = new RegExp(
    // Longest first, so an identifier that starts with another one still wins.
    // The boundaries are what stop `dark` from matching inside `dark-mode`;
    // they exclude letters of any script, because the prose around a token is
    // Arabic half the time.
    `(?<![\\p{L}\\p{N}_-])(${[...code]
      .sort((a, b) => b.length - a.length)
      .map(escapeForRegExp)
      .join("|")})(?![\\p{L}\\p{N}_-])`,
    "gu",
  );

  return (
    <>
      {text.split(pattern).map((part, index) =>
        // Splitting on a pattern with one capture group interleaves the two:
        // prose at the even indices, the identifiers that separated it at the
        // odd ones.
        index % 2 === 1 ? (
          <code
            key={index}
            // An identifier is Latin whatever the page around it is written
            // in, so it keeps its own direction instead of inheriting RTL.
            dir="ltr"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default async function PrivacyPage() {
  const t = await getT();
  const privacy = t.static.privacy;

  return (
    <div
      className="page"
      style={{ paddingBlock: "var(--space-2xl) var(--space-3xl)" }}
    >
      <article style={{ maxInlineSize: "var(--measure)" }}>
        <p className="label">{privacy.eyebrow}</p>
        <h1
          style={{
            fontSize: "var(--step-4)",
            marginBlockStart: "var(--space-xs)",
          }}
        >
          {privacy.heading}
        </h1>
        <p
          className="prose"
          style={{ marginBlockStart: "var(--space-m)", color: "var(--ink-2)" }}
        >
          {privacy.lede}
        </p>

        <Section id="account" title={privacy.accountTitle}>
          <p>{privacy.accountP1}</p>
          <p>{privacy.accountP2}</p>
        </Section>

        <Section id="passwords" title={privacy.passwordsTitle}>
          <p>{privacy.passwordsP1}</p>
          <p>{privacy.passwordsP2}</p>
        </Section>

        <Section id="sessions" title={privacy.sessionsTitle}>
          <p>
            <Prose
              text={privacy.sessionsP1}
              code={["tellyrate_session", "httpOnly", "SameSite=Lax", "Secure"]}
            />
          </p>
          <p>{privacy.sessionsP2}</p>
          {/* The site sets a second cookie to remember the reader's language,
              and this paragraph is where the page admits to it. The English
              copy this replaced still claimed the session cookie was the only
              one — a page whose whole argument is that it can be checked
              against the code cannot afford to be out of date with it. */}
          <p>
            <Prose
              text={privacy.sessionsP3}
              code={["tellyrate-locale", "en", "ar"]}
            />
          </p>
        </Section>

        <Section id="local-storage" title={privacy.storageTitle}>
          <p>
            <Prose
              text={privacy.storageP1}
              code={["tellyrate-theme", "light", "dark"]}
            />
          </p>
        </Section>

        <Section id="addresses" title={privacy.addressesTitle}>
          <p>{privacy.addressesP1}</p>
          <p>
            <Prose text={privacy.addressesP2} code={["review:a:<digest>"]} />
          </p>
          <p>{privacy.addressesP3}</p>
          <p>{privacy.addressesP4}</p>
        </Section>

        <Section id="third-parties" title={privacy.thirdPartiesTitle}>
          <p>{privacy.thirdPartiesP1}</p>
          <p>
            <Prose
              text={privacy.thirdPartiesP2}
              code={[
                "default-src 'self'",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "Referrer-Policy: no-referrer",
              ]}
            />
          </p>
        </Section>

        <Section id="public" title={privacy.publicTitle}>
          <p>{privacy.publicP1}</p>
          <p>{privacy.publicP2}</p>
        </Section>

        <Section id="limits" title={privacy.limitsTitle}>
          <p>{privacy.limitsP1}</p>
          <p>
            {privacy.limitsP2Prefix}
            <Link href="/guidelines">{privacy.limitsP2Link}</Link>
            {privacy.limitsP2Suffix}
          </p>
          <p>{privacy.limitsP3}</p>
        </Section>

        <Section id="hosting" title={privacy.hostingTitle}>
          <p>{privacy.hostingP1}</p>
          <p>{privacy.hostingP2}</p>
        </Section>

        <Section id="requests" title={privacy.requestsTitle}>
          <p>{privacy.requestsP1}</p>
          <ul style={{ margin: "0.75em 0 0", paddingInlineStart: "1.25em" }}>
            {privacy.requestsItems.map((item) => (
              <Li key={item}>{item}</Li>
            ))}
          </ul>
          <p>{privacy.requestsP2}</p>
        </Section>

        <Section id="changes" title={privacy.changesTitle}>
          <p>{privacy.changesP1}</p>
        </Section>

        <nav
          aria-label={privacy.relatedLabel}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
            marginBlockStart: "var(--space-xl)",
            paddingBlockStart: "var(--space-l)",
            borderBlockStart: "1px solid var(--line)",
          }}
        >
          <Link className="btn btn--small" href="/about">
            {privacy.relatedAbout}
          </Link>
          <Link className="btn btn--small" href="/guidelines">
            {privacy.relatedGuidelines}
          </Link>
        </nav>
      </article>
    </div>
  );
}
