import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "Tellyrate collects anonymous reviews of the hospitals and clinics where healthcare students do their clinical training, written by the students who trained there.",
  alternates: { canonical: "/about" },
};

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

export default function AboutPage() {
  return (
    <div
      className="page"
      style={{ paddingBlock: "var(--space-2xl) var(--space-3xl)" }}
    >
      <article style={{ maxInlineSize: "var(--measure)" }}>
        <p className="label">About</p>
        <h1
          style={{
            fontSize: "var(--step-4)",
            marginBlockStart: "var(--space-xs)",
          }}
        >
          Reviews of the places we train in
        </h1>
        <p
          className="prose"
          style={{ marginBlockStart: "var(--space-m)", color: "var(--ink-2)" }}
        >
          Tellyrate collects anonymous reviews of the hospitals, clinics and
          health centres where healthcare students do their clinical training —
          written by the students who did the rotation.
        </p>

        <Section id="why" title="Why it exists">
          <p>
            Where you spend a rotation shapes what you take out of a healthcare
            degree more than almost anything else in it, and most students
            choose one on rumour. A senior tells you a department is worth
            asking for. A friend of a friend says another one is six weeks of
            standing in a corner. None of it is written down anywhere, so every
            cohort rediscovers the same things from scratch — and the
            departments that teach well get no credit for doing it.
          </p>
          <p>
            This site is an attempt to write it down. One review is an opinion.
            Forty reviews of the same hospital, from students in different
            fields across several years, is evidence.
          </p>
        </Section>

        <Section id="review" title="What a review contains">
          <p>
            Every review carries one overall rating and a few sentences of
            testimony. Six optional sub-ratings cover the things students
            actually compare placements on:
          </p>
          <ul style={{ margin: "0.75em 0 0", paddingInlineStart: "1.25em" }}>
            <Li>Supervision and teaching — were you taught, or left to watch?</Li>
            <Li>Hands-on experience — did you get to do things yourself?</Li>
            <Li>
              How students are treated — as a colleague, or as an inconvenience?
            </Li>
            <Li>Workload and hours — reasonable, and predictable?</Li>
            <Li>
              Facilities and equipment — somewhere to sit, eat and change, and
              equipment that works.
            </Li>
            <Li>
              Safety and wellbeing — protective equipment, incident reporting,
              and what happened when someone raised a concern.
            </Li>
          </ul>
          <p>
            A review also records the field you were training in and what you
            were there as — student, summer trainee, intern, resident, fellow or
            observer — which read together as &ldquo;Pharmacy &middot;
            Intern&rdquo;. Naming the department is optional and free text,
            because departments are called different things everywhere.
          </p>
          <p>
            Timing is recorded as a year and nothing finer, and on a facility
            with fewer than five reviews even the year is widened to a five-year
            band. An exact month in a small department can point at exactly one
            person.
          </p>
        </Section>

        <Section id="accounts" title="Reading is public. Writing needs an account.">
          <p>
            Nothing here is behind a login. Browsing facilities, reading
            reviews, following a sort link, sharing a page — none of it asks who
            you are, and none of it ever will.
          </p>
          <p>
            Posting a review, commenting or voting needs an account, because
            otherwise the ratings are worth nothing. An account is a username
            and a password. There is no email field, no phone number, no real
            name and no school anywhere in the database, so there is nothing to
            connect a review back to a rotation list.{" "}
            <Link href="/privacy">The privacy page</Link> describes exactly what
            is stored, mechanism by mechanism.
          </p>
        </Section>

        <Section id="ranking" title="How the ordering works">
          <p>
            <strong>Highest rated</strong> does not sort by plain average,
            because a plain average lets one enthusiastic five-star review
            outrank a hospital with forty reviews averaging 4.6. Each rating is
            pulled toward the site-wide mean in proportion to how little
            evidence stands behind it — a Bayesian average with a confidence
            constant of eight reviews. A facility earns its position by
            accumulating agreement, not by being new.
          </p>
          <p>
            <strong>Most helpful</strong> sorts reviews by the lower bound of a
            95% confidence interval on their like rate, rather than by likes
            minus dislikes. Subtracting would let a 600/400 review beat a 20/0
            one; a raw ratio would put a single like at the top of the page.
          </p>
          <p>
            Neither number can be bought. Facilities cannot pay to rank higher,
            to add a review, or to have one taken down.
          </p>
        </Section>

        <Section id="data" title="Where the places come from">
          <p>
            The directory itself is imported from OpenStreetMap: the facility
            names, kinds, coordinates and whatever address, phone number and
            website the map happens to hold. Records are keyed on their
            OpenStreetMap identity, so a re-import updates a place rather than
            duplicating it.
          </p>
          <p>
            The data is uneven, and it shows. Some facilities are named only in
            Arabic, some only in transliteration, and an address is the
            exception rather than the rule. A name that reads oddly here almost
            certainly reads oddly in the map it came from.
          </p>
          <p>
            If the place you trained at is missing, you can add it, and it joins
            the directory after a light duplicate check. If a facility&rsquo;s
            details are wrong here they are probably wrong in OpenStreetMap too
            — correcting them there fixes them for everything else built on that
            map, not just for us.
          </p>
          <p style={{ fontSize: "var(--step--1)", color: "var(--ink-3)" }}>
            Facility data &copy; OpenStreetMap contributors, available under the{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              rel="noreferrer nofollow"
            >
              Open Database Licence
            </a>
            .
          </p>
        </Section>

        <Section id="not" title="What this is not">
          <ul style={{ margin: 0, paddingInlineStart: "1.25em" }}>
            <Li>
              <strong>Not a patient review site.</strong> Nothing here is about
              whether a hospital is a good place to be treated. The reviewers
              are describing a workplace they were taught in, which is a
              different question with different answers.
            </Li>
            <Li>
              <strong>Not a complaints channel.</strong> Nobody at a facility is
              notified when it is reviewed. If something unsafe happened, it
              needs an incident report inside your institution as well — a
              review is not a substitute for one, and it will not reach anyone
              who can act.
            </Li>
            <Li>
              <strong>Not unmoderated.</strong> Anonymous does not mean
              consequence-free. Naming staff or patients gets a review removed,
              and doing it repeatedly costs the account.{" "}
              <Link href="/guidelines">The guidelines</Link> spell out where the
              line is.
            </Li>
          </ul>
        </Section>

        <Section id="who" title="Who runs it">
          <p>
            Tellyrate is an independent project, not affiliated with any
            hospital, university, ministry or professional body. There is no
            advertising, nothing is sponsored, no listing is paid for, and no
            data is sold or shared with anyone — there is barely any to sell.
          </p>
          <p>
            The way to raise something is the report control on the review,
            comment or facility in question. It goes to a moderation queue that
            a person reads.
          </p>
        </Section>

        <nav
          aria-label="Related pages"
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
            Review guidelines
          </Link>
          <Link className="btn btn--small" href="/privacy">
            Privacy
          </Link>
          <Link className="btn btn--small btn--primary" href="/facilities">
            Browse facilities
          </Link>
        </nav>
      </article>
    </div>
  );
}
