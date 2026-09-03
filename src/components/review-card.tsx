import { Stars } from "@/components/stars";
import { VoteButtons, ReportControl } from "@/components/vote-buttons";
import { CommentThread, type ThreadComment, type ThreadViewer } from "@/components/comment-thread";
import {
  RATING_AXES,
  STUDENT_FIELD_LABELS,
  TRAINEE_ROLE_SHORT,
  rotationStamp,
} from "@/lib/labels";

/**
 * One review, drawn as a chart entry.
 *
 * The header is a rotation stamp — field, role, department, year, author — set in
 * the mono face above a hairline, the way a form header sits above the section
 * it labels. The testimony itself is in the serif: this is the one part of the
 * site that is somebody's words rather than the interface talking.
 */

export type ReviewCardReview = {
  id: string;
  overall: number;
  supervision: number | null;
  handsOn: number | null;
  staffRespect: number | null;
  workload: number | null;
  resources: number | null;
  safety: number | null;
  title: string | null;
  body: string;
  field: string;
  role: string;
  department: string | null;
  trainingYear: number | null;
  likeCount: number;
  dislikeCount: number;
  editedAt: Date | null;
  author: { id: string; username: string } | null;
};

/** Bodies past this length are folded; roughly a screenful on a phone. */
const FOLD_AT = 900;

export function ReviewCard({
  review,
  facilityReviewCount,
  age,
  viewerVote = 0,
  viewer,
  comments,
  nextPath,
}: {
  review: ReviewCardReview;
  /** Drives how coarsely the rotation year is stamped. */
  facilityReviewCount: number;
  /** Coarse posting age, computed on the server. */
  age: string;
  viewerVote?: number;
  viewer: ThreadViewer;
  comments: ThreadComment[];
  nextPath: string;
}) {
  const isOwn = viewer !== null && review.author?.id === viewer.id;

  const stamp = [
    STUDENT_FIELD_LABELS[review.field] ?? "Healthcare",
    TRAINEE_ROLE_SHORT[review.role] ?? "Trainee",
    review.department,
    rotationStamp(review.trainingYear, facilityReviewCount),
    // A review whose author deleted their account keeps its testimony and
    // loses its name, rather than vanishing and quietly rewriting the average.
    `@${review.author?.username ?? "deleted"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const { head, tail } = splitBody(review.body);

  // Sub-scores are optional per review, so only the axes this reviewer
  // actually answered are shown — a missing axis is not a zero.
  const subRatings: { label: string; value: number }[] = [];
  for (const axis of RATING_AXES) {
    const value = review[axis.key];
    if (value !== null) subRatings.push({ label: axis.label, value });
  }

  return (
    <article
      className="card"
      id={`review-${review.id}`}
      style={{
        padding: "var(--space-m) var(--space-l) var(--space-m)",
        display: "grid",
        gap: "var(--space-s)",
      }}
    >
      <header className="stamp" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", justifyContent: "space-between" }}>
        <bdi dir="auto">{stamp}</bdi>
        <span style={{ color: "var(--ink-3)" }}>
          {age}
          {review.editedAt ? " · edited" : ""}
        </span>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", flexWrap: "wrap" }}>
        <Stars value={review.overall} size={17} />
        {/* Stars already announces the value; this is the sighted reading. */}
        <span className="tnum" aria-hidden="true" style={{ fontWeight: 700 }}>
          {review.overall.toFixed(1)}
        </span>
        {review.title ? (
          <h3 style={{ fontSize: "var(--step-1)", flexBasis: "100%" }}>
            <bdi dir="auto">{review.title}</bdi>
          </h3>
        ) : null}
      </div>

      <div className="prose">
        <Paragraphs text={head} />
        {tail ? (
          <details style={{ marginBlockStart: "0.75em" }}>
            <summary
              className="btn btn--quiet btn--small"
              style={{ listStyle: "none", fontFamily: "var(--font-ui)" }}
            >
              Read the rest
            </summary>
            <div style={{ marginBlockStart: "0.75em" }}>
              <Paragraphs text={tail} />
            </div>
          </details>
        ) : null}
      </div>

      {subRatings.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2xs)",
          }}
        >
          {subRatings.map((row) => (
            <li key={row.label}>
              <span className="chip">
                {row.label}
                <strong className="tnum">{row.value}</strong>
                <span className="sr-only">out of 5</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <footer style={{ display: "grid", gap: "var(--space-2xs)", borderBlockStart: "1px solid var(--line)", paddingBlockStart: "var(--space-xs)" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "var(--space-2xs)",
          }}
        >
          <VoteButtons
            target="review"
            id={review.id}
            likeCount={review.likeCount}
            dislikeCount={review.dislikeCount}
            viewerVote={viewerVote}
            signedIn={viewer !== null}
            isOwn={isOwn}
            nextPath={nextPath}
          />
          <span style={{ marginInlineStart: "auto" }}>
            <ReportControl
              targetType="review"
              targetId={review.id}
              signedIn={viewer !== null}
              nextPath={nextPath}
            />
          </span>
        </div>

        <CommentThread
          reviewId={review.id}
          comments={comments}
          viewer={viewer}
          nextPath={nextPath}
        />
      </footer>
    </article>
  );
}

function Paragraphs({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} style={{ whiteSpace: "pre-wrap" }}>
          <bdi dir="auto">{paragraph.trim()}</bdi>
        </p>
      ))}
    </>
  );
}

/**
 * Split a long review at a natural break rather than truncating it.
 *
 * The tail goes inside a `<details>`, never a duplicate of the head: the whole
 * text stays in the document exactly once, so search engines and screen
 * readers get all of it and sighted readers get a short card.
 */
function splitBody(body: string): { head: string; tail: string | null } {
  const text = body.trim();
  if (text.length <= FOLD_AT) return { head: text, tail: null };

  const window = text.slice(0, FOLD_AT);
  let cut = window.lastIndexOf("\n\n");
  if (cut < FOLD_AT * 0.4) {
    const sentence = window.lastIndexOf(". ");
    cut = sentence > FOLD_AT * 0.4 ? sentence + 1 : FOLD_AT;
  }

  return { head: text.slice(0, cut).trim(), tail: text.slice(cut).trim() };
}

/**
 * Coarsen a timestamp for display.
 *
 * An exact posting date, next to a field and a small department, is enough to
 * identify one student. Bands are the most precision this site can honestly
 * offer without handing that away.
 */
export function coarseAge(date: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 7) return "this week";
  if (days <= 31) return "this month";
  if (days <= 182) return "in the past 6 months";
  if (days <= 365) return "in the past year";
  const years = Math.max(1, Math.round(days / 365));
  return `over ${years} year${years === 1 ? "" : "s"} ago`;
}
