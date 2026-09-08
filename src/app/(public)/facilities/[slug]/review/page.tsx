import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ReviewForm } from "@/components/review-form";
import { prisma } from "@/lib/db";
import { getDictionary, lookup } from "@/lib/i18n/dictionaries";
import { cityNameFor, facilityNamesFor } from "@/lib/i18n/names";
import { getLocale } from "@/lib/i18n/server";
import { getFacilityBySlug } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

/**
 * Write a review.
 *
 * Deliberately reachable while signed out: the sign-in wall sits at submit,
 * not at the door, so nobody types six hundred words into a form they are
 * about to be bounced out of.
 */

// generateMetadata and the page body both need the facility; `cache` collapses
// that into one query per request.
const loadFacility = cache(getFacilityBySlug);

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [facility, locale] = await Promise.all([loadFacility(slug), getLocale()]);
  const t = getDictionary(locale);
  const facilityName = facility
    ? facilityNamesFor(locale, facility).primary
    : null;

  return {
    title: facilityName
      ? t.reviewForm.metaTitleFor(facilityName)
      : t.reviewForm.metaTitle,
    description: facilityName
      ? t.reviewForm.metaDescriptionFor(facilityName)
      : undefined,
    // A form has nothing to index, and keeping it out of search results means
    // one fewer way for a review to be found by its author's own words.
    robots: { index: false, follow: true },
  };
}

export default async function WriteReviewPage({ params }: PageProps) {
  const { slug } = await params;

  const [facility, user, locale] = await Promise.all([
    loadFacility(slug),
    getCurrentUser(),
    getLocale(),
  ]);

  if (!facility) notFound();

  const t = getDictionary(locale);
  const names = facilityNamesFor(locale, facility);
  const cityName = cityNameFor(locale, facility.city.name);

  const existing = user
    ? await prisma.review.findFirst({
        where: { facilityId: facility.id, authorId: user.id },
        select: {
          id: true,
          overall: true,
          body: true,
          title: true,
          field: true,
          role: true,
          specialty: true,
          department: true,
          trainingYear: true,
          supervision: true,
          handsOn: true,
          staffRespect: true,
          workload: true,
          resources: true,
          safety: true,
        },
      })
    : null;

  const next = encodeURIComponent(`/facilities/${facility.slug}/review`);
  // "Back" points against the reading direction, so the glyph has to turn too.
  const backArrow = locale === "ar" ? "→" : "←";

  return (
    // The `(public)` layout owns the `<main>` landmark; this is just the page.
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <div style={{ maxInlineSize: "56rem", marginInline: "auto" }}>
        <nav
          aria-label={t.facility.breadcrumb}
          style={{ marginBlockEnd: "var(--space-m)", fontSize: "var(--step--1)" }}
        >
          <Link href={`/facilities/${facility.slug}`}>
            <span aria-hidden="true">{backArrow}</span> {t.common.back}
            {t.common.separator}
            <bdi dir="auto">{names.primary}</bdi>
          </Link>
        </nav>

        <header style={{ display: "grid", gap: "var(--space-2xs)" }}>
          <p className="label">
            {existing ? t.facility.editYourReview : t.facility.writeReview}
          </p>
          <h1 style={{ fontSize: "var(--step-3)" }}>
            <bdi dir="auto">{names.primary}</bdi>
          </h1>
          <p className="hint">
            {lookup(
              t.labels.facilityKind,
              facility.kind,
              t.labels.facilityFallback,
            )}
            {t.common.separator}
            <Link href={`/cities/${facility.city.slug}`}>
              {cityName}
            </Link>
            {names.secondary ? (
              <>
                {t.common.separator}
                <bdi dir="auto">{names.secondary}</bdi>
              </>
            ) : null}
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gap: "var(--space-m)",
            marginBlock: "var(--space-l)",
          }}
        >
          {facility.status === "PENDING" ? (
            <p className="notice">{t.facilities.addPage.createHint}</p>
          ) : null}

          {existing ? (
            <p className="notice notice--warn">
              {t.static.guidelines.oneReviewP1}
            </p>
          ) : null}

          {!user ? (
            <p className="notice">
              {t.reviewForm.signedOutNote}{" "}
              <Link href={`/login?next=${next}`}>{t.reviewForm.signIn}</Link>
              {t.facilities.addPage.or}
              <Link href={`/signup?next=${next}`}>
                {t.facilities.addPage.createOne}
              </Link>
              {t.facilities.addPage.signedOutSuffix}
            </p>
          ) : null}

          <p className="prose" style={{ color: "var(--ink-2)" }}>
            {t.home.noReviewsHint}
          </p>
        </div>

        <ReviewForm
          facility={{ slug: facility.slug, name: names.primary }}
          locale={locale}
          username={user?.username ?? null}
          mode={existing ? "edit" : "create"}
          reviewId={existing?.id}
          initial={
            existing
              ? {
                  overall: existing.overall,
                  body: existing.body,
                  title: existing.title,
                  field: existing.field,
                  role: existing.role,
                  specialty: existing.specialty,
                  department: existing.department,
                  trainingYear: existing.trainingYear,
                  supervision: existing.supervision,
                  handsOn: existing.handsOn,
                  staffRespect: existing.staffRespect,
                  workload: existing.workload,
                  resources: existing.resources,
                  safety: existing.safety,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
