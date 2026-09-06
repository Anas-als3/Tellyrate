import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Review guidelines",
  description:
    "How to write a review that helps the next student: be concrete, be first-hand, and write about the place, never about the people.",
  alternates: { canonical: "/guidelines" },
};

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

export default function GuidelinesPage() {
  return (
    <div
      className="page"
      style={{ paddingBlock: "var(--space-2xl) var(--space-3xl)" }}
    >
      <article style={{ maxInlineSize: "var(--measure)" }}>
        <p className="label">Guidelines</p>
        <h1
          style={{
            fontSize: "var(--step-4)",
            marginBlockStart: "var(--space-xs)",
          }}
        >
          How to write a review worth reading
        </h1>
        <p
          className="prose"
          style={{ marginBlockStart: "var(--space-m)", color: "var(--ink-2)" }}
        >
          Two things keep this site useful: reviews specific enough to act on,
          and a hard line against turning them into attacks on individuals.
          Everything below follows from those two.
        </p>

        <p
          className="notice notice--warn"
          style={{ marginBlockStart: "var(--space-l)" }}
        >
          The rule that is never negotiable: write about the place, not the
          people. No staff names, no patient details.
        </p>

        <Section id="places-not-people" title="Write about the place, not the people">
          <p>
            Never name a member of staff, and never describe one closely enough
            to be named. No names, no nicknames, no &ldquo;the tall surgeon on
            the Tuesday list&rdquo;, no &ldquo;the new registrar in
            paediatrics&rdquo;. A department can be criticised as sharply as you
            like. A department cannot lose its job, be harassed at work, or be
            threatened over something written here. A person can.
          </p>
          <p>
            There is nearly always an institutional way to say the same thing,
            and it is the more useful sentence anyway. Instead of
            &ldquo;the consultant ignored us all afternoon&rdquo;, write
            &ldquo;students were regularly left on the ward with no supervising
            doctor after four&rdquo;. The second version describes something the
            next student will also run into, and something the hospital could
            actually fix.
          </p>
          <p>
            This is the one rule applied without discussion: a review that
            identifies a person is removed, and doing it repeatedly costs the
            account.
          </p>
        </Section>

        <Section id="patients" title="Patients are not material">
          <p>
            No patient details of any kind — not names, not initials, not bed or
            room numbers, and not the extraordinary case you will remember for
            the rest of your career. A rare presentation, plus a month, plus a
            department, identifies a real person to everyone who was there, and
            they never agreed to appear in your review.
          </p>
          <p>
            If a story only works with the clinical detail left in, it does not
            belong on this site. Tell it to your tutor instead.
          </p>
        </Section>

        <Section id="useful" title="What makes a review useful">
          <ul style={{ margin: 0, paddingInlineStart: "1.25em" }}>
            <Li>
              <strong>Be concrete.</strong> &ldquo;Four students to one
              registrar, and we were taking histories on our own from the second
              day&rdquo; tells a reader something. &ldquo;Good hospital, nice
              staff&rdquo; does not.
            </Li>
            <Li>
              <strong>Write only what happened to you.</strong> First-hand, from
              a placement you actually did. Not what someone told you about the
              night shift in another department.
            </Li>
            <Li>
              <strong>Cover the boring practicalities.</strong> They matter more
              than people admit: whether the ID badge exists on day one, whether
              the rota is published in advance, whether there is somewhere to
              change, eat, sit and pray, whether the on-call room is real.
            </Li>
            <Li>
              <strong>Say what would have made it better.</strong> &ldquo;Fine,
              but no teaching&rdquo; is a lower bar than &ldquo;the ward round
              starts at seven and nobody tells students that — ask to join it
              and you will be taught&rdquo;.
            </Li>
            <Li>
              <strong>Be fair about the bad days.</strong> One terrible week does
              not describe six months, and readers can tell the difference
              between a considered complaint and a bad mood.
            </Li>
            <Li>
              <strong>Length is not quality.</strong> Four honest sentences beat
              three paragraphs of adjectives.
            </Li>
          </ul>
        </Section>

        <Section id="ratings" title="Rating the six axes">
          <p>
            The overall rating is required. The six sub-ratings are optional, and
            you should leave blank any you cannot judge — a blank is more useful
            than a guess, because each average is computed only over the reviews
            that answered that axis.
          </p>
          <p>
            Rate them independently. Plenty of placements are genuinely
            excellent at teaching and genuinely brutal on hours, and flattening
            that into a single number is precisely the problem this site exists
            to fix.
          </p>
        </Section>

        <Section id="protect-yourself" title="Protecting yourself">
          <ul style={{ margin: 0, paddingInlineStart: "1.25em" }}>
            <Li>
              Choose a username with nothing of you in it: not your initials,
              not your graduation year, not the handle you use elsewhere.
            </Li>
            <Li>
              Leave out the details that pin a review to one person — exact
              dates, the size of your group, your specific project, the unusual
              thing only you did.
            </Li>
            <Li>
              If you were one of only one or two students in that department,
              write about patterns rather than incidents — and consider leaving
              the department box blank. It is optional, and a small named
              department plus a year narrows a review down fast.
            </Li>
            <Li>
              The site already widens your training year to a five-year band on
              facilities with fewer than five reviews. Do not undo that by
              putting the month in the text.
            </Li>
          </ul>
          <p>
            <Link href="/privacy">The privacy page</Link> explains exactly what
            the site stores, and is equally direct about the part it cannot
            protect: what you choose to write.
          </p>
        </Section>

        <Section id="one-review" title="One review per placement">
          <p>
            The database allows one review per account per facility. If you go
            back, or your view of a place changes, edit the review you already
            have rather than posting a second one — stacking reviews would tilt
            the average in favour of whoever writes most. Edited reviews are
            marked as edited, so a later reader can see the text changed.
          </p>
        </Section>

        <Section id="comments-votes" title="Comments and votes">
          <p>
            Comments are for adding context: a follow-up question, or &ldquo;this
            changed in 2024, the rota is different now&rdquo;. Replies go one
            level deep on purpose — a review thread is not a forum, and the
            people who come here are choosing a placement, not having an
            argument.
          </p>
          <p>
            A vote answers one question: was this review useful to someone
            choosing a placement? It does not mean you agree with it.
            Downvoting an accurate negative review because you are fond of the
            hospital is the fastest way to make the whole site worthless.
          </p>
        </Section>

        <Section id="removed" title="What gets removed">
          <ul style={{ margin: 0, paddingInlineStart: "1.25em" }}>
            <Li>Anything identifying a member of staff or a patient.</Li>
            <Li>Harassment, abuse or threats.</Li>
            <Li>Spam, advertising and recruitment posts.</Li>
            <Li>Reviews of a placement the author did not do.</Li>
            <Li>Claims presented as fact that are simply untrue.</Li>
            <Li>Content that is not about clinical training.</Li>
          </ul>
          <p>
            Use the report control on any review, comment or facility. A report
            records what was reported, the reason, an optional note, and which
            account sent it — so that repeated bad-faith reporting can be dealt
            with too. Reports go to a queue a person reads.
          </p>
        </Section>

        <Section id="facilities" title="If you work at a facility reviewed here">
          <p>
            If a review breaks the rules on this page — it names one of your
            colleagues, it describes a patient, it is about somewhere the author
            never trained — report it and a moderator will look at it.
          </p>
          <p>
            If it is simply unflattering and true, it stays. Nothing here can be
            bought, edited or withdrawn by the subject of it, which is the only
            reason any of it is worth reading.
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
          <Link className="btn btn--small" href="/about">
            About Tellyrate
          </Link>
          <Link className="btn btn--small" href="/privacy">
            Privacy
          </Link>
          <Link className="btn btn--small btn--primary" href="/facilities">
            Find your placement
          </Link>
        </nav>
      </article>
    </div>
  );
}
