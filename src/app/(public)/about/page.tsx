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
    title: t.static.about.metaTitle,
    description: t.static.about.metaDescription,
    alternates: { canonical: "/about" },
  };
}

/**
 * Section headings sit above a hairline rather than inside a box: the page is
 * meant to read like a handover note, not a marketing site.
 */
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

export default async function AboutPage() {
  const t = await getT();
  const about = t.static.about;

  return (
    <div
      className="page"
      style={{ paddingBlock: "var(--space-2xl) var(--space-3xl)" }}
    >
      <article style={{ maxInlineSize: "var(--measure)" }}>
        <p className="label">{about.eyebrow}</p>
        <h1
          style={{
            fontSize: "var(--step-4)",
            marginBlockStart: "var(--space-xs)",
          }}
        >
          {about.heading}
        </h1>
        <p
          className="prose"
          style={{ marginBlockStart: "var(--space-m)", color: "var(--ink-2)" }}
        >
          {about.lede}
        </p>

        <Section id="why" title={about.whyTitle}>
          <p>{about.whyP1}</p>
          <p>{about.whyP2}</p>
        </Section>

        <Section id="review" title={about.reviewTitle}>
          <p>{about.reviewP1}</p>
          <ul style={{ margin: "0.75em 0 0", paddingInlineStart: "1.25em" }}>
            {about.reviewAxes.map((axis) => (
              <Li key={axis}>{axis}</Li>
            ))}
          </ul>
          <p>{about.reviewP2}</p>
          <p>{about.reviewP3}</p>
        </Section>

        <Section id="accounts" title={about.accountsTitle}>
          <p>{about.accountsP1}</p>
          <p>
            {about.accountsP2Prefix}
            <Link href="/privacy">{about.accountsP2Link}</Link>
            {about.accountsP2Suffix}
          </p>
        </Section>

        <Section id="ranking" title={about.rankingTitle}>
          <p>
            <strong>{about.rankingHighestRated}</strong>
            {about.rankingP1}
          </p>
          <p>
            <strong>{about.rankingMostHelpful}</strong>
            {about.rankingP2}
          </p>
          <p>{about.rankingP3}</p>
        </Section>

        <Section id="data" title={about.dataTitle}>
          <p>{about.dataP1}</p>
          <p>{about.dataP2}</p>
          <p>{about.dataP3}</p>
          <p style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
            {about.dataLicencePrefix}
            <a
              href="https://www.openstreetmap.org/copyright"
              rel="noreferrer nofollow"
            >
              {about.dataLicenceLink}
            </a>
            .
          </p>
        </Section>

        <Section id="not" title={about.notTitle}>
          <ul style={{ margin: 0, paddingInlineStart: "1.25em" }}>
            {about.notItems.map((item, index) => (
              <Li key={item.strong}>
                <strong>{item.strong}</strong>
                {item.text}
                {/* The moderation item — the last one — is the only one that
                    hands off to the guidelines. Its closing sentence is a
                    separate key so a translator can put the link text where
                    their grammar wants it rather than at a fixed offset. */}
                {index === about.notItems.length - 1 ? (
                  <>
                    {" "}
                    <Link href="/guidelines">{about.notGuidelinesLink}</Link>
                    {about.notGuidelinesSuffix}
                  </>
                ) : null}
              </Li>
            ))}
          </ul>
        </Section>

        <Section id="who" title={about.whoTitle}>
          <p>{about.whoP1}</p>
          <p>{about.whoP2}</p>
        </Section>

        <nav
          aria-label={about.relatedLabel}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
            marginBlockStart: "var(--space-xl)",
            paddingBlockStart: "var(--space-l)",
            borderBlockStart: "1px solid var(--line)",
          }}
        >
          <Link className="btn btn--small" href="/guidelines">
            {about.relatedGuidelines}
          </Link>
          <Link className="btn btn--small" href="/privacy">
            {about.relatedPrivacy}
          </Link>
          <Link className="btn btn--small btn--primary" href="/facilities">
            {about.relatedBrowse}
          </Link>
        </nav>
      </article>
    </div>
  );
}
