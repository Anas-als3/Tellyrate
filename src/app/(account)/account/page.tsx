import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Stars } from "@/components/stars";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

/** Month and year only — the same coarseness reviews are stamped with. */
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** How a review that is not currently visible is described to its author. */
const STATUS_NOTE: Record<string, string> = {
  PENDING: "Awaiting moderation",
  HIDDEN: "Hidden by a moderator",
  REMOVED: "Removed by a moderator",
};

const RECENT_LIMIT = 8;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/account")}`);

  const params = await searchParams;
  // Set by GET /logout, which will not sign anyone out on its own — a link
  // that mutates state gets followed by prefetchers and scanners.
  const confirmingSignOut = params.signout === "1";

  const [reviewCount, commentCount, reviews] = await Promise.all([
    prisma.review.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
    prisma.review.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: {
        id: true,
        title: true,
        overall: true,
        status: true,
        createdAt: true,
        facility: { select: { name: true, nameLocal: true, slug: true } },
      },
    }),
  ]);

  return (
    <>
      <nav className="tabs" aria-label="Account">
        <Link className="tab" href="/account" aria-current="page">
          Account
        </Link>
        <Link className="tab" href="/account/security">
          Security
        </Link>
      </nav>

      {confirmingSignOut ? (
        <section
          className="card"
          style={{
            padding: "var(--space-m)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-s)",
          }}
          aria-labelledby="signout-heading"
        >
          <h2 id="signout-heading" style={{ fontSize: "var(--step-1)" }}>
            Sign out of this device?
          </h2>
          <p style={{ color: "var(--ink-2)" }}>
            Your other devices stay signed in. There is a{" "}
            <Link href="/account/security">sign out everywhere</Link> button if
            you need it.
          </p>
          <form method="post" action="/logout">
            <button type="submit" className="btn btn--primary">
              Sign out
            </button>
          </form>
        </section>
      ) : null}

      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2xs)",
        }}
      >
        <p className="label">Signed in as</p>
        <h1 style={{ fontSize: "var(--step-3)" }}>
          <bdi dir="auto">{user.username}</bdi>
        </h1>
        <p className="hint">
          This is the name that appears on everything you post, as{" "}
          <span style={{ fontFamily: "var(--font-mono)" }}>
            @{user.username}
          </span>
          . Joined {MONTH_YEAR.format(user.createdAt)}.
        </p>
      </header>

      <section
        className="card"
        style={{
          padding: "var(--space-m)",
          display: "flex",
          gap: "var(--space-xl)",
          flexWrap: "wrap",
        }}
        aria-label="Your contributions"
      >
        <div>
          <p className="label">Reviews</p>
          <p className="tnum" style={{ fontSize: "var(--step-3)" }}>
            {reviewCount}
          </p>
        </div>
        <div>
          <p className="label">Comments</p>
          <p className="tnum" style={{ fontSize: "var(--step-3)" }}>
            {commentCount}
          </p>
        </div>
      </section>

      <section
        className="notice"
        aria-label="What this account holds"
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-2xs)" }}
      >
        <p>
          <strong>We hold no email, no name, and no school for this account.</strong>
        </p>
        <p>
          A username, a password hash, the date you joined, and what you have
          posted — that is the whole record. Nothing here can be used to send
          you anything, because there is nowhere to send it.
        </p>
      </section>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-s)",
        }}
        aria-labelledby="reviews-heading"
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--space-m)",
          }}
        >
          <h2 id="reviews-heading" style={{ fontSize: "var(--step-2)" }}>
            Your reviews
          </h2>
          {reviewCount > RECENT_LIMIT ? (
            <span className="hint tnum">
              {RECENT_LIMIT} most recent of {reviewCount}
            </span>
          ) : null}
        </div>

        {reviews.length === 0 ? (
          <p
            className="card"
            style={{ padding: "var(--space-m)", color: "var(--ink-2)" }}
          >
            You have not written one yet.{" "}
            <Link href="/facilities">Find the place you trained</Link> and say
            what it was actually like.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-xs)",
            }}
          >
            {reviews.map((review) => (
              <li
                key={review.id}
                className="card"
                style={{
                  padding: "var(--space-s) var(--space-m)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2xs)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-xs)",
                    flexWrap: "wrap",
                  }}
                >
                  <Stars value={review.overall} size={14} />
                  <span className="stamp" style={{ border: 0, padding: 0 }}>
                    {MONTH_YEAR.format(review.createdAt)}
                  </span>
                  {review.status !== "PUBLISHED" ? (
                    <span className="chip chip--warn">
                      {STATUS_NOTE[review.status] ?? "Not visible"}
                    </span>
                  ) : null}
                </div>

                <Link
                  href={`/facilities/${review.facility.slug}#review-${review.id}`}
                  style={{ fontWeight: 600 }}
                >
                  <bdi dir="auto">{review.facility.name}</bdi>
                </Link>

                {review.title ? (
                  <p className="prose" style={{ fontSize: "var(--step-0)" }}>
                    <bdi dir="auto">{review.title}</bdi>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        style={{
          display: "flex",
          gap: "var(--space-s)",
          flexWrap: "wrap",
          borderBlockStart: "1px solid var(--line)",
          paddingBlockStart: "var(--space-m)",
        }}
        aria-label="Account actions"
      >
        <Link className="btn" href="/account/security">
          Password and account
        </Link>
        {/* A plain form post: signing out has to work with scripting off. */}
        <form method="post" action="/logout">
          <button type="submit" className="btn btn--quiet">
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}
