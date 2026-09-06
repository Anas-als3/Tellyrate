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
    title: t.static.guidelines.metaTitle,
    description: t.static.guidelines.metaDescription,
    alternates: { canonical: "/guidelines" },
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

export default async function GuidelinesPage() {
  const t = await getT();
  const g = t.static.guidelines;

  return (
    <div
      className="page"
      style={{ paddingBlock: "var(--space-2xl) var(--space-3xl)" }}
    >
      <article style={{ maxInlineSize: "var(--measure)" }}>
        <p className="label">{g.eyebrow}</p>
        <h1
          style={{
            fontSize: "var(--step-4)",
            marginBlockStart: "var(--space-xs)",
          }}
        >
          {g.heading}
        </h1>
        <p
          className="prose"
          style={{ marginBlockStart: "var(--space-m)", color: "var(--ink-2)" }}
        >
          {g.lede}
        </p>

        <p
          className="notice notice--warn"
          style={{ marginBlockStart: "var(--space-l)" }}
        >
          {g.hardRule}
        </p>

        <Section id="places-not-people" title={g.peopleTitle}>
          <p>{g.peopleP1}</p>
          <p>{g.peopleP2}</p>
          <p>{g.peopleP3}</p>
        </Section>

        <Section id="patients" title={g.patientsTitle}>
          <p>{g.patientsP1}</p>
          <p>{g.patientsP2}</p>
        </Section>

        <Section id="useful" title={g.usefulTitle}>
          <ul style={{ margin: 0, paddingInlineStart: "1.25em" }}>
            {g.usefulItems.map((item) => (
              <Li key={item.strong}>
                <strong>{item.strong}</strong>
                {item.text}
              </Li>
            ))}
          </ul>
        </Section>

        <Section id="ratings" title={g.ratingsTitle}>
          <p>{g.ratingsP1}</p>
          <p>{g.ratingsP2}</p>
        </Section>

        <Section id="protect-yourself" title={g.protectTitle}>
          <ul style={{ margin: 0, paddingInlineStart: "1.25em" }}>
            {g.protectItems.map((item) => (
              <Li key={item}>{item}</Li>
            ))}
          </ul>
          <p>
            <Link href="/privacy">{g.protectPrivacyLink}</Link>
            {g.protectPrivacySuffix}
          </p>
        </Section>

        <Section id="one-review" title={g.oneReviewTitle}>
          <p>{g.oneReviewP1}</p>
        </Section>

        <Section id="comments-votes" title={g.commentsTitle}>
          <p>{g.commentsP1}</p>
          <p>{g.commentsP2}</p>
        </Section>

        <Section id="removed" title={g.removedTitle}>
          <ul style={{ margin: 0, paddingInlineStart: "1.25em" }}>
            {g.removedItems.map((item) => (
              <Li key={item}>{item}</Li>
            ))}
          </ul>
          <p>{g.removedP1}</p>
        </Section>

        <Section id="facilities" title={g.facilitiesTitle}>
          <p>{g.facilitiesP1}</p>
          <p>{g.facilitiesP2}</p>
        </Section>

        <nav
          aria-label={g.relatedLabel}
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
            {g.relatedAbout}
          </Link>
          <Link className="btn btn--small" href="/privacy">
            {g.relatedPrivacy}
          </Link>
          <Link className="btn btn--small btn--primary" href="/facilities">
            {g.relatedFind}
          </Link>
        </nav>
      </article>
    </div>
  );
}
