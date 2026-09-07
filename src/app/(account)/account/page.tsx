import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Stars } from "@/components/stars";
import { prisma } from "@/lib/db";
import {
  formatNumber,
  getDictionary,
  lookup,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { facilityNamesFor } from "@/lib/i18n/names";
import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    title: t.account.metaTitle,
    robots: { index: false, follow: false },
  };
}

/**
 * Month and year only — the same coarseness reviews are stamped with.
 *
 * Arabic gets Arabic month names but a Gregorian calendar and Western digits,
 * both of which have to be asked for: `ar-SA` defaults to the Umm al-Qura
 * calendar and to Arabic-Indic digits, and a joining date silently rendered as
 * a Hijri month would be read as a mistake rather than as a conversion.
 */
const MONTH_YEAR: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
  ar: new Intl.DateTimeFormat("ar-SA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    calendar: "gregory",
    numberingSystem: "latn",
  }),
};

const RECENT_LIMIT = 8;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/account")}`);

  const [params, locale] = await Promise.all([searchParams, getLocale()]);
  const t = getDictionary(locale);
  const monthYear = MONTH_YEAR[locale];

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
        facility: {
          select: {
            name: true,
            nameEn: true,
            nameLocal: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  return (
    <>
      <nav className="tabs" aria-label={t.account.tabsLabel}>
        <Link className="tab" href="/account" aria-current="page">
          {t.account.tabAccount}
        </Link>
        <Link className="tab" href="/account/security">
          {t.account.tabSecurity}
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
            {t.account.signOutHeading}
          </h2>
          <p style={{ color: "var(--ink-2)" }}>
            {t.account.signOutBodyPrefix}
            <Link href="/account/security">{t.account.signOutBodyLink}</Link>
            {t.account.signOutBodySuffix}
          </p>
          <form method="post" action="/logout">
            <button type="submit" className="btn btn--primary">
              {t.account.signOut}
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
        <p className="label">{t.account.signedInAs}</p>
        <h1 style={{ fontSize: "var(--step-3)" }}>
          <bdi dir="auto">{user.username}</bdi>
        </h1>
        <p className="hint">
          {t.account.usernameNote(
            user.username,
            monthYear.format(user.createdAt),
          )}
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
        aria-label={t.account.contributions}
      >
        <div>
          <p className="label">{t.account.reviews}</p>
          <p className="tnum" style={{ fontSize: "var(--step-3)" }}>
            {formatNumber(reviewCount)}
          </p>
        </div>
        <div>
          <p className="label">{t.account.comments}</p>
          <p className="tnum" style={{ fontSize: "var(--step-3)" }}>
            {formatNumber(commentCount)}
          </p>
        </div>
      </section>

      <section
        className="notice"
        aria-label={t.account.holdsLabel}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-2xs)" }}
      >
        <p>
          <strong>{t.account.holdsHeading}</strong>
        </p>
        <p>{t.account.holdsBody}</p>
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
            {t.account.yourReviews}
          </h2>
          {reviewCount > RECENT_LIMIT ? (
            <span className="hint tnum">
              {t.account.mostRecentOf(RECENT_LIMIT, reviewCount)}
            </span>
          ) : null}
        </div>

        {reviews.length === 0 ? (
          <p
            className="card"
            style={{ padding: "var(--space-m)", color: "var(--ink-2)" }}
          >
            {t.account.noReviewsPrefix}
            <Link href="/facilities">{t.account.noReviewsLink}</Link>
            {t.account.noReviewsSuffix}
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
            {reviews.map((review) => {
              const facilityNames = facilityNamesFor(locale, review.facility);

              return (
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
                    <Stars value={review.overall} size={14} t={t} />
                    <span className="stamp" style={{ border: 0, padding: 0 }}>
                      {monthYear.format(review.createdAt)}
                    </span>
                    {review.status !== "PUBLISHED" ? (
                      <span className="chip chip--warn">
                        {lookup(
                          t.labels.reviewStatus,
                          review.status,
                          t.labels.notVisible,
                        )}
                      </span>
                    ) : null}
                  </div>

                  <Link
                    href={`/facilities/${review.facility.slug}#review-${review.id}`}
                    style={{ fontWeight: 600 }}
                  >
                    <bdi dir="auto">{facilityNames.primary}</bdi>
                  </Link>

                  {review.title ? (
                    <p className="prose" style={{ fontSize: "var(--step-0)" }}>
                      <bdi dir="auto">{review.title}</bdi>
                    </p>
                  ) : null}
                </li>
              );
            })}
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
        aria-label={t.account.actionsLabel}
      >
        <Link className="btn" href="/account/security">
          {t.account.passwordAndAccount}
        </Link>
        {/* A plain form post: signing out has to work with scripting off. */}
        <form method="post" action="/logout">
          <button type="submit" className="btn btn--quiet">
            {t.account.signOut}
          </button>
        </form>
      </section>
    </>
  );
}
