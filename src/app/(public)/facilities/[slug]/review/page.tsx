import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ReviewForm } from "@/components/review-form";
import { prisma } from "@/lib/db";
import { FACILITY_KIND_LABELS } from "@/lib/labels";
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
  const facility = await loadFacility(slug);

  return {
    title: facility ? `Review ${facility.name}` : "Write a review",
    description: facility
      ? `Write an anonymous review of training at ${facility.name}.`
      : undefined,
    // A form has nothing to index, and keeping it out of search results means
    // one fewer way for a review to be found by its author's own words.
    robots: { index: false, follow: true },
  };
}

export default async function WriteReviewPage({ params }: PageProps) {
  const { slug } = await params;

  const [facility, user] = await Promise.all([
    loadFacility(slug),
    getCurrentUser(),
  ]);

  if (!facility) notFound();

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

  return (
    // The `(public)` layout owns the `<main>` landmark; this is just the page.
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <div style={{ maxInlineSize: "56rem", marginInline: "auto" }}>
        <nav
          aria-label="Breadcrumb"
          style={{ marginBlockEnd: "var(--space-m)", fontSize: "var(--step--1)" }}
        >
          <Link href={`/facilities/${facility.slug}`}>
            ← Back to <bdi dir="auto">{facility.name}</bdi>
          </Link>
        </nav>

        <header style={{ display: "grid", gap: "var(--space-2xs)" }}>
          <p className="label">
            {existing ? "Edit your review" : "Write a review"}
          </p>
          <h1 style={{ fontSize: "var(--step-3)" }}>
            <bdi dir="auto">{facility.name}</bdi>
          </h1>
          <p className="hint">
            {FACILITY_KIND_LABELS[facility.kind] ?? "Facility"} ·{" "}
            <Link href={`/cities/${facility.city.slug}`}>
              {facility.city.name}
            </Link>
            {facility.nameLocal ? (
              <>
                {" · "}
                <bdi dir="auto">{facility.nameLocal}</bdi>
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
            <p className="notice">
              This place was added by a student and is not in the directory
              listings yet. The first review is what puts it there.
            </p>
          ) : null}

          {existing ? (
            <p className="notice notice--warn">
              You have already reviewed this placement — one review per person
              per place, so the average stays honest. Trained there twice?
              Update what you wrote below.
            </p>
          ) : null}

          {!user ? (
            <p className="notice">
              You can write this now without an account. We&rsquo;ll ask you to
              sign in when you post, and what you have typed stays on this
              device in the meantime.{" "}
              <Link href={`/login?next=${next}`}>Sign in</Link> or{" "}
              <Link href={`/signup?next=${next}`}>create an account</Link> —
              username and password, nothing else.
            </p>
          ) : null}

          <p className="prose" style={{ color: "var(--ink-2)" }}>
            Write it for the student who has this placement next term. What the
            days were actually like, what you were trusted to do, what you wish
            somebody had told you.
          </p>
        </div>

        <ReviewForm
          facility={{ slug: facility.slug, name: facility.name }}
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
