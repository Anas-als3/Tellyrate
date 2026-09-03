"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  addCommentAction,
  deleteCommentAction,
  type CommentFormState,
} from "@/lib/actions/comments";
import { VoteButtons } from "@/components/vote-buttons";

/**
 * Comments hanging off one review.
 *
 * Collapsed by default and deliberately plain. Most readers come for the
 * reviews; auto-expanding every thread would double the length of a facility
 * page with follow-up chatter they did not ask for.
 */

export type ThreadComment = {
  id: string;
  parentId: string | null;
  body: string;
  /** Coarsened on the server — see the note on exact dates in review-card. */
  age: string;
  likeCount: number;
  dislikeCount: number;
  viewerVote: number;
  author: { id: string; username: string } | null;
};

export type ThreadViewer = {
  id: string;
  canModerate: boolean;
} | null;

export function CommentThread({
  reviewId,
  comments,
  viewer,
  nextPath,
}: {
  reviewId: string;
  comments: ThreadComment[];
  viewer: ThreadViewer;
  nextPath: string;
}) {
  const roots = comments.filter((c) => c.parentId === null);

  const repliesByParent = new Map<string, ThreadComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const bucket = repliesByParent.get(comment.parentId);
    if (bucket) bucket.push(comment);
    else repliesByParent.set(comment.parentId, [comment]);
  }

  const total = comments.length;

  return (
    <details style={{ marginBlockStart: "var(--space-xs)" }}>
      <summary
        className="btn btn--quiet btn--small"
        style={{ color: "var(--ink-3)", listStyle: "none" }}
      >
        {total === 0
          ? "Comments"
          : `${total} ${total === 1 ? "comment" : "comments"}`}
      </summary>

      <div
        style={{
          display: "grid",
          gap: "var(--space-m)",
          marginBlockStart: "var(--space-s)",
          paddingInlineStart: "var(--space-m)",
          borderInlineStart: "2px solid var(--line)",
        }}
      >
        {roots.length === 0 ? (
          <p className="hint">
            No comments yet. Reviewers are anonymous, so ask about the placement
            rather than the person.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-m)" }}>
            {roots.map((comment) => (
              <li key={comment.id}>
                <CommentItem
                  comment={comment}
                  reviewId={reviewId}
                  viewer={viewer}
                  nextPath={nextPath}
                  canReply
                />

                {(repliesByParent.get(comment.id) ?? []).length > 0 ? (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: "var(--space-s) 0 0",
                      padding: "0 0 0 var(--space-m)",
                      borderInlineStart: "2px solid var(--line)",
                      display: "grid",
                      gap: "var(--space-s)",
                    }}
                  >
                    {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                      <li key={reply.id}>
                        <CommentItem
                          comment={reply}
                          reviewId={reviewId}
                          viewer={viewer}
                          nextPath={nextPath}
                          canReply={false}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {viewer ? (
          <CommentForm
            reviewId={reviewId}
            parentId={null}
            label="Add a comment"
            placeholder="Ask a question, or add what you saw on the same rotation."
          />
        ) : (
          <p className="hint">
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
              Log in to comment
            </Link>{" "}
            — an account is a username and a password, nothing else.
          </p>
        )}
      </div>
    </details>
  );
}

function CommentItem({
  comment,
  reviewId,
  viewer,
  nextPath,
  canReply,
}: {
  comment: ThreadComment;
  reviewId: string;
  viewer: ThreadViewer;
  nextPath: string;
  canReply: boolean;
}) {
  const isAuthor = viewer !== null && comment.author?.id === viewer.id;
  const canDelete = isAuthor || (viewer?.canModerate ?? false);

  return (
    <article style={{ display: "grid", gap: "var(--space-2xs)" }}>
      <p className="label" style={{ margin: 0 }}>
        {/* An account whose user was deleted keeps its words and loses its name. */}
        <bdi dir="auto">@{comment.author?.username ?? "deleted"}</bdi>
        <span style={{ textTransform: "none", letterSpacing: 0 }}>
          {" · "}
          {comment.age}
        </span>
      </p>

      <p style={{ whiteSpace: "pre-wrap", fontSize: "var(--step-0)" }}>
        {comment.body}
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--space-2xs)",
        }}
      >
        <VoteButtons
          target="comment"
          id={comment.id}
          likeCount={comment.likeCount}
          dislikeCount={comment.dislikeCount}
          viewerVote={comment.viewerVote}
          signedIn={viewer !== null}
          isOwn={isAuthor}
          nextPath={nextPath}
        />

        {canReply && viewer ? (
          <details style={{ display: "inline-block" }}>
            <summary
              className="btn btn--quiet btn--small"
              style={{ color: "var(--ink-3)", listStyle: "none" }}
            >
              Reply
            </summary>
            <div style={{ marginBlockStart: "var(--space-xs)" }}>
              <CommentForm
                reviewId={reviewId}
                parentId={comment.id}
                label={`Reply to @${comment.author?.username ?? "deleted"}`}
                placeholder="Keep it about the placement."
              />
            </div>
          </details>
        ) : null}

        {canDelete ? <DeleteCommentForm commentId={comment.id} /> : null}
      </div>
    </article>
  );
}

function CommentForm({
  reviewId,
  parentId,
  label,
  placeholder,
}: {
  reviewId: string;
  parentId: string | null;
  label: string;
  placeholder: string;
}) {
  const [state, formAction, isPending] = useActionState<CommentFormState, FormData>(
    addCommentAction,
    {},
  );
  const [value, setValue] = useState(state.body ?? "");
  const [settled, setSettled] = useState(state);

  // Clear on success, and put a rejected comment back in the box on failure so
  // a rate limit never costs someone what they wrote. Adjusted during render
  // rather than in an effect — the action result is the trigger, and an effect
  // would commit the stale value first and then correct it.
  if (state !== settled) {
    setSettled(state);
    setValue(state.ok ? "" : (state.body ?? ""));
  }

  const fieldId = `comment-body-${parentId ?? reviewId}`;

  return (
    <form action={formAction} style={{ display: "grid", gap: "var(--space-xs)" }}>
      <input type="hidden" name="reviewId" value={reviewId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}

      <div className="field">
        <label className="label" htmlFor={fieldId}>
          {label}
        </label>
        <textarea
          className="input"
          id={fieldId}
          name="body"
          rows={3}
          minLength={2}
          maxLength={2000}
          required
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          style={{ fontFamily: "var(--font-ui)", lineHeight: "var(--lh-body)" }}
        />
      </div>

      {state.error ? (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      ) : null}

      <div>
        <button className="btn btn--small" type="submit" disabled={isPending}>
          {isPending ? "Posting…" : "Post comment"}
        </button>
      </div>
    </form>
  );
}

function DeleteCommentForm({ commentId }: { commentId: string }) {
  const [state, formAction, isPending] = useActionState<CommentFormState, FormData>(
    deleteCommentAction,
    {},
  );

  return (
    <form action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}>
      <input type="hidden" name="commentId" value={commentId} />
      <button
        className="btn btn--quiet btn--small"
        type="submit"
        disabled={isPending}
        style={{ color: "var(--ink-3)" }}
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {state.error ? (
        <span className="error-text" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
