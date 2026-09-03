import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Hospirate stores and what it does not: no email, no IP logs, no analytics, no third-party requests — and an honest account of where anonymity stops.",
  alternates: { canonical: "/privacy" },
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

export default function PrivacyPage() {
  return (
    <div
      className="page"
      style={{ paddingBlock: "var(--space-2xl) var(--space-3xl)" }}
    >
      <article style={{ maxInlineSize: "var(--measure)" }}>
        <p className="label">Privacy</p>
        <h1
          style={{
            fontSize: "var(--step-4)",
            marginBlockStart: "var(--space-xs)",
          }}
        >
          What we store, and what we don&rsquo;t
        </h1>
        <p
          className="prose"
          style={{ marginBlockStart: "var(--space-m)", color: "var(--ink-2)" }}
        >
          This is a description of what the software does, not a statement of
          intent. Every claim below names a specific mechanism, so it can be
          checked rather than believed.
        </p>

        <Section id="account" title="An account is a username and a password">
          <p>
            Signing up asks for a username and a password. That is the entire
            form. The row kept for you holds the username as you typed it, a
            case-folded copy of it so that two people cannot register names that
            differ only in capitalisation, a password hash, an optional hash of
            a single-use recovery code, a role, a flag saying whether the
            account is banned, and the date it was created.
          </p>
          <p>
            There is no email column in the database. Not blank — absent. The
            same goes for a real name, a phone number, a date of birth, a
            school, a graduation year and a profile photo. Nothing asks for
            them, so nothing can leak them, and no future change of ownership
            can quietly start using them.
          </p>
        </Section>

        <Section id="passwords" title="Passwords">
          <p>
            Passwords are hashed with scrypt from Node&rsquo;s standard library
            — N = 32768, r = 8, p = 3, a 64-byte key and a fresh 16-byte random
            salt for every password. The cost parameters are written alongside
            each hash, so they can be raised later without locking anyone out.
            The password itself is never stored and cannot be recovered from the
            hash.
          </p>
          <p>
            The cost of that is real and worth stating plainly: if you lose both
            your password and your recovery code, the account is unreachable. We
            hold nothing that could establish you as its owner, so there is no
            support route that could hand it back. That is the trade this design
            makes deliberately.
          </p>
        </Section>

        <Section id="sessions" title="Sessions and cookies">
          <p>
            Signing in sets exactly one cookie,{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              hospirate_session
            </code>
            . It is <code style={{ fontFamily: "var(--font-mono)" }}>
              httpOnly
            </code>{" "}
            so page scripts cannot read it, <code
              style={{ fontFamily: "var(--font-mono)" }}
            >
              SameSite=Lax
            </code>{" "}
            so another site cannot ride on it, marked{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>Secure</code> in
            production, and it expires after thirty days — slid forward once a
            session is more than half spent, so you are not logged out
            mid-visit.
          </p>
          <p>
            The value in the cookie is 256 random bits. What the database stores
            is its SHA-256 digest, so a dump of the sessions table is a list of
            hashes that cannot be replayed as a login. Signing out deletes the
            row and the cookie; signing out everywhere deletes every session for
            the account, which is the remedy if you think your password has
            leaked.
          </p>
          <p>
            There are no other cookies. No preference cookie, no analytics
            cookie, no third-party cookie, and no consent banner, because there
            is nothing to consent to.
          </p>
        </Section>

        <Section id="local-storage" title="Your browser’s local storage">
          <p>
            One key,{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              hospirate-theme
            </code>
            , holding <code style={{ fontFamily: "var(--font-mono)" }}>
              light
            </code>{" "}
            or <code style={{ fontFamily: "var(--font-mono)" }}>dark</code> when
            you have chosen one. A small inline script reads it before the first
            paint so a dark-mode visitor never gets a white flash. It stays in
            your browser and is never sent to the server.
          </p>
        </Section>

        <Section id="addresses" title="IP addresses are never stored">
          <p>
            Any site that lets strangers write needs a way to stop a flood, and
            the usual way is to keep a log of who did what from where — exactly
            what this site promises not to do.
          </p>
          <p>
            So an address is never written down. To count requests it is passed
            through HMAC-SHA256, keyed with a server secret plus today&rsquo;s
            date in UTC, and only the first 24 characters of the digest are
            kept, as part of a key like{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              review:a:&lt;digest&gt;
            </code>
            . The row holds that key, a count, and the time the window resets.
            Nothing else: no timestamps of individual actions, no user agent, no
            path, no record of what was posted.
          </p>
          <p>
            Because the key includes the date, the same address produces a
            different digest tomorrow. Yesterday&rsquo;s counters cannot be
            joined to today&rsquo;s, so the table cannot be reassembled into a
            history of anyone&rsquo;s activity — by us or by anyone who takes a
            copy of it. Expired rows are deleted outright.
          </p>
          <p>
            Two details, for completeness. IPv6 addresses are truncated to their
            /64 prefix before hashing, because phones rotate the rest of the
            address routinely and would otherwise get an unlimited supply of
            fresh counters. And when you are signed in, throttling counts
            against your account id instead — the address is not hashed at all.
          </p>
        </Section>

        <Section id="third-parties" title="No third parties, enforced by the browser">
          <p>
            There is no analytics, no tag manager, no advertising network, no
            A/B testing service, no session recorder, no error-reporting
            service, no embedded video, no social buttons and no map tiles.
            Fonts are served from this domain rather than a font CDN, which
            would otherwise hand your address to a third party on every page
            load.
          </p>
          <p>
            That is not only a policy — the browser enforces it. Every response
            carries a Content Security Policy of{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              default-src &apos;self&apos;
            </code>{" "}
            with{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              connect-src &apos;self&apos;
            </code>{" "}
            and{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              frame-ancestors &apos;none&apos;
            </code>
            : if a tracker were ever added to this site, your browser would
            refuse to contact it. Responses also send{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              Referrer-Policy: no-referrer
            </code>
            , so following a link out of here does not tell the destination
            which facility page you were reading, and a Permissions-Policy that
            switches off camera, microphone, geolocation and interest-cohort
            advertising.
          </p>
        </Section>

        <Section id="public" title="What is public">
          <p>
            Everything you post is public and indexable — that is the point of
            the site. Specifically: your username, your reviews with their
            ratings and text, your comments, the field you trained in, what you
            were there as, the department if you named one, the year (widened to
            a five-year band on facilities with fewer than five reviews), and
            the totals of likes and dislikes.
          </p>
          <p>
            Who voted is not public. A facility page loads your own vote and no
            one else&rsquo;s — the voter list is never sent to a browser.
          </p>
        </Section>

        <Section id="limits" title="Where honesty about anonymity stops">
          <p>
            A username with no email behind it protects you from being
            identified <em>by this site</em>. It does not protect you from being
            identified by what you write, and no software can.
          </p>
          <p>
            If you were the only pharmacy student in that department that term,
            or you describe an incident everyone there remembers, or you write
            the way you talk, a colleague reading it may well know who you are.
            Only you can judge how much detail is worth that risk.{" "}
            <Link href="/guidelines">The guidelines</Link> give concrete advice
            on writing something useful without pinning it to one person.
          </p>
          <p>
            Publishing is also less reversible than people expect. Deleting a
            review removes it from this site; it does not remove it from a
            search engine&rsquo;s cache, someone&rsquo;s screenshot, or a
            scraper&rsquo;s copy taken an hour after you posted it.
          </p>
        </Section>

        <Section id="hosting" title="The layer we don’t control">
          <p>
            The site runs on rented servers and reaches you across a network
            that belongs to other people. TLS terminates at the host, so the
            host can see connection metadata — an address, a timestamp, a
            requested path — exactly as it can for every site it serves, under
            its own policies rather than this one.
          </p>
          <p>
            What can be said is that the application never asks for those
            records, never stores them, and has nothing to join them to.
            Database backups contain the same rows described on this page and
            nothing more.
          </p>
        </Section>

        <Section id="requests" title="If someone demands the data">
          <p>
            If we were ever compelled to hand over what is held about an
            account, this is the complete list of what exists:
          </p>
          <ul style={{ margin: "0.75em 0 0", paddingInlineStart: "1.25em" }}>
            <Li>the username</Li>
            <Li>a password hash that cannot be reversed</Li>
            <Li>possibly a hash of a recovery code</Li>
            <Li>a role, a banned flag and a creation date</Li>
            <Li>
              the reviews, comments and votes already published for anyone to
              read
            </Li>
          </ul>
          <p>
            There is no email address, no phone number, no address log and no
            browsing history, because none of it is ever collected. A demand
            cannot produce what was never written down.
          </p>
        </Section>

        <Section id="changes" title="Changes to this page">
          <p>
            This page describes the code, so it changes when the code does. If a
            future version of the site ever collected something new, this page
            would have to say so — and if it says nothing about a kind of data,
            that data is not collected.
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
            About Hospirate
          </Link>
          <Link className="btn btn--small" href="/guidelines">
            Review guidelines
          </Link>
        </nav>
      </article>
    </div>
  );
}
