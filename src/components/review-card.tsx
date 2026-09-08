import { Fragment } from "react";

import { Stars } from "@/components/stars";
import {
  VoteButtons,
  ReportControl,
  type ReportStrings,
  type VoteStrings,
} from "@/components/vote-buttons";
import {
  CommentThread,
  type ThreadComment,
  type ThreadStrings,
  type ThreadViewer,
} from "@/components/comment-thread";
import { RATING_AXES, rotationStamp } from "@/lib/labels";
import { lookup, type Dictionary } from "@/lib/i18n/dictionaries";
import { getT } from "@/lib/i18n/server";

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
  overall: number | null;
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
  specialty: string | null;
  department: string | null;
  trainingYear: number | null;
  likeCount: number;
  dislikeCount: number;
  editedAt: Date | null;
  source: string;
  author: { id: string; username: string } | null;
};

/** Bodies past this length are folded; roughly a screenful on a phone. */
const FOLD_AT = 900;

/** Must match `USERNAME_TOKEN` in comment-thread.tsx, which substitutes it. */
const USERNAME_TOKEN = "{username}";

/**
 * Vote labels, finished on the server.
 *
 * The dictionary builds each one as a whole sentence around the noun, because
 * "Mark this review helpful" and "ضع علامة أن المراجعة مفيدة" do not put the
 * noun in the same place. Functions cannot be handed to a client component,
 * so the sentences are built here and only their text crosses over.
 *
 * Exported because the facility page's own report control needs the same
 * treatment, and this is the server module both sides already share.
 */
export function voteStrings(
  t: Dictionary,
  target: "review" | "comment",
): VoteStrings {
  const noun = target === "review" ? t.review.nounReview : t.review.nounComment;
  return {
    markHelpful: t.review.markHelpful(noun),
    markUnhelpful: t.review.markUnhelpful(noun),
    removeHelpful: t.review.removeHelpful,
    removeUnhelpful: t.review.removeUnhelpful,
    logInHelpful: t.review.logInToMarkHelpful(noun),
    logInUnhelpful: t.review.logInToMarkUnhelpful(noun),
    cannotVoteOwn: t.review.cannotVoteOwn(noun),
  };
}

export function reportStrings(t: Dictionary): ReportStrings {
  return {
    report: t.review.report,
    thanks: t.review.reportThanks,
    reasonLabel: t.review.reportReasonLabel,
    chooseReason: t.review.reportChooseReason,
    reasons: t.labels.reportReason,
    noteLabel: t.review.reportNoteLabel,
    noteHint: t.review.reportNoteHint,
    submit: t.review.reportSubmit,
    submitting: t.review.reportSubmitting,
  };
}

function threadStrings(t: Dictionary, commentCount: number): ThreadStrings {
  return {
    summary:
      commentCount === 0 ? t.review.comments : t.review.commentsCount(commentCount),
    empty: t.review.commentsCount(0),
    logIn: t.nav.logIn,
    logInSuffix: t.review.commentSignInSuffix,
    addComment: t.review.addComment,
    addPlaceholder: t.review.addCommentPlaceholder,
    reply: t.review.reply,
    // Built with the token standing in for the name, so the client can drop a
    // username into the slot the language actually puts it in.
    replyTo: t.review.replyTo(USERNAME_TOKEN),
    replyPlaceholder: t.review.replyPlaceholder,
    post: t.review.postComment,
    posting: t.review.postingComment,
    remove: t.review.deleteComment,
    removing: t.review.deletingComment,
    authorDeleted: t.review.authorDeleted,
    separator: t.common.separator,
    vote: voteStrings(t, "comment"),
  };
}

export async function ReviewCard({
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
  /** Coarse posting age, already in the reader's language. */
  age: string;
  viewerVote?: number;
  viewer: ThreadViewer;
  comments: ThreadComment[];
  nextPath: string;
}) {
  const t = await getT();
  const isOwn = viewer !== null && review.author?.id === viewer.id;

  const stampParts = [
    lookup(t.labels.studentField, review.field, t.labels.healthcareFallback),
    lookup(t.labels.traineeRoleShort, review.role, t.labels.traineeFallback),
    review.specialty
      ? lookup(
          t.labels.rotationSpecialty,
          review.specialty,
          review.specialty,
        )
      : null,
    review.department,
    rotationStamp(review.trainingYear, facilityReviewCount),
    // A review whose author deleted their account keeps its testimony and
    // loses its name, rather than vanishing and quietly rewriting the average.
    review.source === "BATCH17_SURVEY"
      ? null
      : review.author
        ? `@${review.author.username}`
        : t.review.authorDeleted,
  ].filter((part): part is string => Boolean(part));

  const { head, tail } = splitBody(review.body);

  // Sub-scores are optional per review, so only the axes this reviewer
  // actually answered are shown — a missing axis is not a zero.
  const subRatings: { key: string; label: string; value: number }[] = [];
  for (const axis of RATING_AXES) {
    const value = review[axis.key];
    if (value !== null) {
      subRatings.push({
        key: axis.key,
        label: t.labels.ratingAxis[axis.key].label,
        value,
      });
    }
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
        {/* Each field is isolated rather than joined into one string: the year
            and the Latin username sit next to Arabic here, and a single run
            would let the digits and the handle change places. */}
        <span>
          {stampParts.map((part, index) => (
            <Fragment key={index}>
              {index > 0 ? <span>{t.common.separator}</span> : null}
              <bdi dir="auto">{part}</bdi>
            </Fragment>
          ))}
        </span>
        <span style={{ color: "var(--ink-3)" }}>
          {review.source === "BATCH17_SURVEY" ? t.review.importedSurvey : age}
          {review.editedAt ? `${t.common.separator}${t.review.edited}` : ""}
        </span>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", flexWrap: "wrap" }}>
        {review.overall === null ? (
          <span className="chip">{t.review.unratedExperience}</span>
        ) : (
          <>
            <Stars value={review.overall} size={17} t={t} />
            {/* Stars already announces the value; this is the sighted reading. */}
            <span className="tnum" aria-hidden="true" style={{ fontWeight: 700 }}>
              {review.overall.toFixed(1)}
            </span>
          </>
        )}
        {review.title ? (
          <h3
            dir="auto"
            style={{ fontSize: "var(--step-1)", flexBasis: "100%" }}
          >
            {review.title}
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
              {t.review.readTheRest}
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
            <li key={row.key}>
              <span className="chip">
                {row.label}
                <strong className="tnum">{row.value}</strong>
                <span className="sr-only">{t.review.outOfFive}</span>
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
            strings={voteStrings(t, "review")}
          />
          <span style={{ marginInlineStart: "auto" }}>
            <ReportControl
              targetType="review"
              targetId={review.id}
              signedIn={viewer !== null}
              nextPath={nextPath}
              strings={reportStrings(t)}
            />
          </span>
        </div>

        <CommentThread
          reviewId={review.id}
          comments={comments}
          viewer={viewer}
          nextPath={nextPath}
          strings={threadStrings(t, comments.length)}
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
        <p key={index} dir="auto" style={{ whiteSpace: "pre-wrap" }}>
          {paragraph.trim()}
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
 *
 * Each band is a finished phrase from the dictionary rather than a number and
 * a unit stuck together, because Arabic inflects the unit by the count.
 */
export function coarseAge(
  date: Date,
  t: Dictionary["review"],
  now: Date = new Date(),
): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 7) return t.ageThisWeek;
  if (days <= 31) return t.ageThisMonth;
  if (days <= 182) return t.agePastSixMonths;
  if (days <= 365) return t.agePastYear;
  const years = Math.max(1, Math.round(days / 365));
  return t.ageOverYears(years);
}
