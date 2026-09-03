import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { REPORT_REASON_LABELS } from "@/lib/labels";
import { recalcFacility } from "@/lib/aggregates";

export const metadata: Metadata = {
  title: "Moderation queue",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The moderation queue.
 *
 * Reports are worth nothing if no one ever reads them, so this closes the
 * loop: every open report, the content it points at, and the two actions a
 * moderator actually needs. Deliberately plain — it is a work surface, not a
 * page anyone browses.
 *
 * Access is by the `role` column. Promote an account with:
 *   UPDATE "User" SET role = 'MODERATOR' WHERE username = '...';
 */
async function requireModerator() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/moderate");

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (record?.role !== "MODERATOR" && record?.role !== "ADMIN") {
    // Deliberately a 404, not a 403: a 403 confirms the page exists.
    redirect("/");
  }

  return user;
}

type ReportTarget = {
  kind: "review" | "comment" | "facility";
  excerpt: string;
  href: string | null;
  status: string;
};

/** Resolve what a report points at, whatever type it is. */
async function loadTarget(
  targetType: string,
  targetId: string,
): Promise<ReportTarget | null> {
  if (targetType === "review") {
    const review = await prisma.review.findUnique({
      where: { id: targetId },
      select: {
        body: true,
        status: true,
        facility: { select: { slug: true } },
      },
    });
    if (!review) return null;
    return {
      kind: "review",
      excerpt: review.body.slice(0, 400),
      href: `/facilities/${review.facility.slug}`,
      status: review.status,
    };
  }

  if (targetType === "comment") {
    const comment = await prisma.comment.findUnique({
      where: { id: targetId },
      select: {
        body: true,
        status: true,
        review: { select: { facility: { select: { slug: true } } } },
      },
    });
    if (!comment) return null;
    return {
      kind: "comment",
      excerpt: comment.body.slice(0, 400),
      href: `/facilities/${comment.review.facility.slug}`,
      status: comment.status,
    };
  }

  const facility = await prisma.facility.findUnique({
    where: { id: targetId },
    select: { name: true, status: true, slug: true },
  });
  if (!facility) return null;
  return {
    kind: "facility",
    excerpt: facility.name,
    href: `/facilities/${facility.slug}`,
    status: facility.status,
  };
}

async function hideContent(formData: FormData) {
  "use server";
  await requireModerator();

  const reportId = String(formData.get("reportId"));
  const targetType = String(formData.get("targetType"));
  const targetId = String(formData.get("targetId"));

  await prisma.$transaction(async (tx) => {
    if (targetType === "review") {
      const review = await tx.review.update({
        where: { id: targetId },
        data: { status: "REMOVED" },
        select: { facilityId: true },
      });
      // A removed review must stop counting toward the facility's rating.
      await recalcFacility(tx, review.facilityId);
    } else if (targetType === "comment") {
      const comment = await tx.comment.update({
        where: { id: targetId },
        data: { status: "REMOVED" },
        select: { reviewId: true },
      });
      const commentCount = await tx.comment.count({
        where: { reviewId: comment.reviewId, status: "PUBLISHED" },
      });
      await tx.review.update({
        where: { id: comment.reviewId },
        data: { commentCount },
      });
    } else {
      await tx.facility.update({
        where: { id: targetId },
        data: { status: "REJECTED" },
      });
    }

    await tx.report.update({
      where: { id: reportId },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  });

  revalidatePath("/moderate");
  revalidatePath("/");
}

async function dismissReport(formData: FormData) {
  "use server";
  await requireModerator();

  await prisma.report.update({
    where: { id: String(formData.get("reportId")) },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });

  revalidatePath("/moderate");
}

export default async function ModeratePage() {
  await requireModerator();

  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const withTargets = await Promise.all(
    reports.map(async (report) => ({
      report,
      target: await loadTarget(report.targetType, report.targetId),
    })),
  );

  return (
    <main id="main" className="page" style={{ paddingBlock: "var(--space-2xl)" }}>
      <p className="label">Moderation</p>
      <h1 style={{ fontSize: "var(--step-3)", marginBlockEnd: "var(--space-l)" }}>
        Open reports
      </h1>

      {withTargets.length === 0 ? (
        <p className="notice">Nothing reported. Nothing to do.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "var(--space-m)",
          }}
        >
          {withTargets.map(({ report, target }) => (
            <li
              key={report.id}
              className="card"
              style={{ padding: "var(--space-m)", display: "grid", gap: "var(--space-s)" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-xs)",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span className="chip chip--warn">
                  {REPORT_REASON_LABELS[report.reason] ?? report.reason}
                </span>
                <span className="chip">{report.targetType}</span>
                <span className="label">
                  {report.createdAt.toISOString().slice(0, 10)}
                </span>
                {target ? (
                  <span className="label">status: {target.status}</span>
                ) : (
                  <span className="label">target deleted</span>
                )}
              </div>

              {report.note ? (
                <p style={{ fontSize: "var(--step--1)", color: "var(--ink-2)" }}>
                  “{report.note}”
                </p>
              ) : null}

              {target ? (
                <blockquote
                  className="prose"
                  style={{
                    margin: 0,
                    padding: "var(--space-s)",
                    background: "var(--surface-2)",
                    borderRadius: "var(--r-1)",
                    fontSize: "var(--step-0)",
                  }}
                >
                  <bdi dir="auto">{target.excerpt}</bdi>
                </blockquote>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: "var(--space-xs)",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {target?.href ? (
                  <Link className="btn btn--small btn--quiet" href={target.href}>
                    View in context
                  </Link>
                ) : null}

                <form action={hideContent}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="targetType" value={report.targetType} />
                  <input type="hidden" name="targetId" value={report.targetId} />
                  <button className="btn btn--small" type="submit">
                    Remove content
                  </button>
                </form>

                <form action={dismissReport}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <button className="btn btn--small btn--quiet" type="submit">
                    Dismiss report
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
