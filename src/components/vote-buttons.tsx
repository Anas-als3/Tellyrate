"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { voteOnCommentAction, voteOnReviewAction } from "@/lib/actions/votes";
import { submitReportAction } from "@/lib/actions/reports";

/**
 * The two interactive controls in a review's action row.
 *
 * They live in one file because they are the only client islands inside an
 * otherwise server-rendered review card: keeping them together keeps the card
 * itself — the part search engines and readers care about — out of the bundle.
 *
 * Their wording arrives already finished, as plain strings. Functions cannot
 * cross the server/client boundary, so the dictionary's sentence builders are
 * called on the server and only the result is sent — see `voteStrings` and
 * `reportStrings` in review-card.tsx. That also keeps both dictionaries out of
 * the client bundle.
 */

/**
 * Every label is pre-bound to the thing being voted on, because Arabic does
 * not put the noun where English does: "Mark this review helpful" is not
 * "Mark this" + noun + "helpful" in any language but English.
 */
export type VoteStrings = {
  markHelpful: string;
  markUnhelpful: string;
  removeHelpful: string;
  removeUnhelpful: string;
  logInHelpful: string;
  logInUnhelpful: string;
  cannotVoteOwn: string;
};

export type ReportStrings = {
  report: string;
  thanks: string;
  reasonLabel: string;
  chooseReason: string;
  /** Enum value → label, in the order the options should be offered. */
  reasons: Record<string, string>;
  noteLabel: string;
  noteHint: string;
  submit: string;
  submitting: string;
};

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
  strings,
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
  strings: VoteStrings;
}) {
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
          <span className="sr-only">{strings.logInHelpful}</span>
        </Link>
        <Link className="btn btn--quiet btn--small" href={href}>
          <ThumbIcon down />
          <span className="tnum">{dislikeCount}</span>
          <span className="sr-only">{strings.logInUnhelpful}</span>
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
      strings={strings}
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
  strings,
}: {
  target: "review" | "comment";
  id: string;
  likeCount: number;
  dislikeCount: number;
  viewerVote: number;
  isOwn: boolean;
  strings: VoteStrings;
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
      setError(strings.cannotVoteOwn);
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
          {state.value === 1 ? strings.removeHelpful : strings.markHelpful}
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
          {state.value === -1 ? strings.removeUnhelpful : strings.markUnhelpful}
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
      // Only the up/down flip is meaningful. A thumb is not a directional
      // glyph, so it is left alone in Arabic rather than mirrored.
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
  strings,
}: {
  targetType: "review" | "comment" | "facility";
  targetId: string;
  signedIn: boolean;
  nextPath: string;
  strings: ReportStrings;
}) {
  const [state, formAction, isPending] = useActionState(submitReportAction, {});

  if (!signedIn) {
    return (
      <Link
        className="btn btn--quiet btn--small"
        href={`/login?next=${encodeURIComponent(nextPath)}`}
        style={{ color: "var(--ink-3)" }}
      >
        {strings.report}
      </Link>
    );
  }

  return (
    // Positioned rather than inline: opening the panel must not shove the
    // vote buttons around, which is what an in-flow disclosure does inside a
    // flex action row.
    <details style={{ display: "inline-block", position: "relative" }}>
      <summary
        className="btn btn--quiet btn--small"
        style={{ color: "var(--ink-3)", listStyle: "none" }}
      >
        {strings.report}
      </summary>

      <div
        className="card"
        style={{
          position: "absolute",
          insetInlineEnd: 0,
          insetBlockStart: "calc(100% + var(--space-2xs))",
          zIndex: 10,
          inlineSize: "min(30rem, 80vw)",
          padding: "var(--space-m)",
          boxShadow: "var(--shadow-2)",
        }}
      >
        {state.ok ? (
          <p className="notice" role="status">
            {strings.thanks}
          </p>
        ) : (
          <form action={formAction} style={{ display: "grid", gap: "var(--space-s)" }}>
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />

            <div className="field">
              <label className="label" htmlFor={`report-reason-${targetId}`}>
                {strings.reasonLabel}
              </label>
              <select
                className="select"
                id={`report-reason-${targetId}`}
                name="reason"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  {strings.chooseReason}
                </option>
                {/* The values are the schema's enum members and never change
                    with the language; only the labels do. */}
                {Object.entries(strings.reasons).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor={`report-note-${targetId}`}>
                {strings.noteLabel}
              </label>
              <textarea
                className="input"
                id={`report-note-${targetId}`}
                name="note"
                rows={2}
                maxLength={500}
                style={{ minBlockSize: "auto", fontFamily: "var(--font-ui)" }}
              />
              <span className="hint">{strings.noteHint}</span>
            </div>

            {state.error ? (
              <p className="error-text" role="alert">
                {state.error}
              </p>
            ) : null}

            <div>
              <button className="btn btn--small" type="submit" disabled={isPending}>
                {isPending ? strings.submitting : strings.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
}
