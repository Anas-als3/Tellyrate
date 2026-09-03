"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { voteOnCommentAction, voteOnReviewAction } from "@/lib/actions/votes";
import { submitReportAction } from "@/lib/actions/reports";
import { REPORT_REASON_LABELS } from "@/lib/labels";

/**
 * The two interactive controls in a review's action row.
 *
 * They live in one file because they are the only client islands inside an
 * otherwise server-rendered review card: keeping them together keeps the card
 * itself — the part search engines and readers care about — out of the bundle.
 */

type VoteState = {
  /** The viewer's own vote: 1, -1, or 0 for none. */
  value: 1 | -1 | 0;
  likeCount: number;
  dislikeCount: number;
};

/**
 * Fold a click into the displayed counts. Clicking the button you already
 * pressed removes the vote, so the same control both casts and retracts.
 */
function applyVote(state: VoteState, next: 1 | -1): VoteState {
  const retracting = state.value === next;
  const likeDelta =
    (next === 1 && !retracting ? 1 : 0) - (state.value === 1 ? 1 : 0);
  const dislikeDelta =
    (next === -1 && !retracting ? 1 : 0) - (state.value === -1 ? 1 : 0);

  return {
    value: retracting ? 0 : next,
    likeCount: Math.max(0, state.likeCount + likeDelta),
    dislikeCount: Math.max(0, state.dislikeCount + dislikeDelta),
  };
}

export function VoteButtons({
  target,
  id,
  likeCount,
  dislikeCount,
  viewerVote = 0,
  signedIn,
  isOwn = false,
  nextPath,
}: {
  target: "review" | "comment";
  id: string;
  likeCount: number;
  dislikeCount: number;
  viewerVote?: number;
  signedIn: boolean;
  /** The viewer wrote this, so voting on it is refused. */
  isOwn?: boolean;
  /** Where to return a signed-out visitor after logging in. */
  nextPath: string;
}) {
  const noun = target === "review" ? "review" : "comment";

  // Signed out, the buttons stay visible and lead somewhere useful. Hiding
  // them would misrepresent the review as unvotable; a dead button would be
  // worse still.
  if (!signedIn) {
    const href = `/login?next=${encodeURIComponent(nextPath)}`;
    return (
      <span style={{ display: "inline-flex", gap: "var(--space-2xs)" }}>
        <Link className="btn btn--quiet btn--small" href={href}>
          <ThumbIcon />
          <span className="tnum">{likeCount}</span>
          <span className="sr-only">Log in to mark this {noun} helpful</span>
        </Link>
        <Link className="btn btn--quiet btn--small" href={href}>
          <ThumbIcon down />
          <span className="tnum">{dislikeCount}</span>
          <span className="sr-only">Log in to mark this {noun} unhelpful</span>
        </Link>
      </span>
    );
  }

  return (
    <LiveVoteButtons
      target={target}
      id={id}
      likeCount={likeCount}
      dislikeCount={dislikeCount}
      viewerVote={viewerVote}
      isOwn={isOwn}
      noun={noun}
    />
  );
}

function LiveVoteButtons({
  target,
  id,
  likeCount,
  dislikeCount,
  viewerVote,
  isOwn,
  noun,
}: {
  target: "review" | "comment";
  id: string;
  likeCount: number;
  dislikeCount: number;
  viewerVote: number;
  isOwn: boolean;
  noun: string;
}) {
  const base: VoteState = {
    value: viewerVote === 1 ? 1 : viewerVote === -1 ? -1 : 0,
    likeCount,
    dislikeCount,
  };

  const [state, addOptimistic] = useOptimistic(base, applyVote);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function cast(value: 1 | -1) {
    if (isOwn) {
      setError(`You cannot vote on your own ${noun}.`);
      return;
    }

    setError(null);
    startTransition(async () => {
      addOptimistic(value);
      const result =
        target === "review"
          ? await voteOnReviewAction(id, value)
          : await voteOnCommentAction(id, value);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}>
      <button
        type="button"
        className="btn btn--quiet btn--small"
        aria-pressed={state.value === 1}
        aria-disabled={isOwn || undefined}
        aria-busy={isPending || undefined}
        onClick={() => cast(1)}
        style={state.value === 1 ? pressedStyle : undefined}
      >
        <ThumbIcon />
        <span className="tnum">{state.likeCount}</span>
        <span className="sr-only">
          {state.value === 1 ? `Remove your helpful mark` : `Mark this ${noun} helpful`}
        </span>
      </button>

      <button
        type="button"
        className="btn btn--quiet btn--small"
        aria-pressed={state.value === -1}
        aria-disabled={isOwn || undefined}
        aria-busy={isPending || undefined}
        onClick={() => cast(-1)}
        style={state.value === -1 ? pressedStyle : undefined}
      >
        <ThumbIcon down />
        <span className="tnum">{state.dislikeCount}</span>
        <span className="sr-only">
          {state.value === -1
            ? `Remove your unhelpful mark`
            : `Mark this ${noun} unhelpful`}
        </span>
      </button>

      {error ? (
        <span className="error-text" role="status">
          {error}
        </span>
      ) : null}
    </span>
  );
}

const pressedStyle: React.CSSProperties = {
  background: "var(--brand-soft)",
  borderColor: "transparent",
  color: "var(--brand-ink)",
};

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: down ? "rotate(180deg)" : undefined, flex: "none" }}
    >
      <path d="M7 21V10L12.2 2.9a1.4 1.4 0 0 1 2.5.9V9h4.4a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.7 20H7Z" />
      <path d="M7 10H4.5A1.5 1.5 0 0 0 3 11.5v8A1.5 1.5 0 0 0 4.5 21H7" />
    </svg>
  );
}

/**
 * The report disclosure.
 *
 * Kept collapsed and quiet: reporting is a rare action, and a prominent
 * "Report" button invites reflexive flagging of opinions people merely
 * disagree with.
 */
export function ReportControl({
  targetType,
  targetId,
  signedIn,
  nextPath,
}: {
  targetType: "review" | "comment" | "facility";
  targetId: string;
  signedIn: boolean;
  nextPath: string;
}) {
  const [state, formAction, isPending] = useActionState(submitReportAction, {});

  if (!signedIn) {
    return (
      <Link
        className="btn btn--quiet btn--small"
        href={`/login?next=${encodeURIComponent(nextPath)}`}
        style={{ color: "var(--ink-3)" }}
      >
        Report
      </Link>
    );
  }

  return (
    <details style={{ display: "inline-block" }}>
      <summary
        className="btn btn--quiet btn--small"
        style={{ color: "var(--ink-3)", listStyle: "none" }}
      >
        Report
      </summary>

      <div
        className="card"
        style={{
          marginBlockStart: "var(--space-xs)",
          padding: "var(--space-m)",
          maxInlineSize: "34rem",
        }}
      >
        {state.ok ? (
          <p className="notice" role="status">
            Thanks — a moderator will take a look. Nobody is told who reported
            this.
          </p>
        ) : (
          <form action={formAction} style={{ display: "grid", gap: "var(--space-s)" }}>
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />

            <div className="field">
              <label className="label" htmlFor={`report-reason-${targetId}`}>
                Why are you reporting this?
              </label>
              <select
                className="select"
                id={`report-reason-${targetId}`}
                name="reason"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Choose a reason
                </option>
                {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor={`report-note-${targetId}`}>
                Anything else? (optional)
              </label>
              <textarea
                className="input"
                id={`report-note-${targetId}`}
                name="note"
                rows={2}
                maxLength={500}
                style={{ minBlockSize: "auto", fontFamily: "var(--font-ui)" }}
              />
              <span className="hint">
                Do not include anyone&rsquo;s name — not yours, not a staff
                member&rsquo;s.
              </span>
            </div>

            {state.error ? (
              <p className="error-text" role="alert">
                {state.error}
              </p>
            ) : null}

            <div>
              <button className="btn btn--small" type="submit" disabled={isPending}>
                {isPending ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
}
