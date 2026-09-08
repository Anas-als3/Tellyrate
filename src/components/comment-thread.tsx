"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  addCommentAction,
  deleteCommentAction,
  type CommentFormState,
} from "@/lib/actions/comments";
import { VoteButtons, type VoteStrings } from "@/components/vote-buttons";

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

/**
 * Must match `USERNAME_TOKEN` in review-card.tsx, which builds these strings.
 *
 * Duplicated rather than imported for the same reason the locale cookie name
 * is duplicated in the language switcher: this module is a client island, and
 * importing a value from a server module here would drag it into the bundle.
 */
const USERNAME_TOKEN = "{username}";

/**
 * Finished sentences, not fragments to be concatenated here.
 *
 * Server actions and the dictionary both live on the server, and the
 * dictionary's builders are functions, which cannot cross the boundary. The
 * one string that still varies per comment carries a `{username}` token
 * instead, so Arabic keeps the name in the place Arabic puts it.
 */
export type ThreadStrings = {
  /** "Comments", or the count once there are some. */
  summary: string;
  empty: string;
  logIn: string;
  logInSuffix: string;
  addComment: string;
  addPlaceholder: string;
  reply: string;
  replyTo: string;
  replyPlaceholder: string;
  post: string;
  posting: string;
  remove: string;
  removing: string;
  authorDeleted: string;
  separator: string;
  vote: VoteStrings;
};

export function CommentThread({
  reviewId,
  comments,
  viewer,
  nextPath,
  strings,
}: {
  reviewId: string;
  comments: ThreadComment[];
  viewer: ThreadViewer;
  nextPath: string;
  strings: ThreadStrings;
}) {
  const roots = comments.filter((c) => c.parentId === null);

  const repliesByParent = new Map<string, ThreadComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const bucket = repliesByParent.get(comment.parentId);
    if (bucket) bucket.push(comment);
    else repliesByParent.set(comment.parentId, [comment]);
  }

  return (
    <details style={{ marginBlockStart: "var(--space-xs)" }}>
      <summary
        className="btn btn--quiet btn--small"
        style={{ color: "var(--ink-3)", listStyle: "none" }}
      >
        {strings.summary}
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
          <p className="hint">{strings.empty}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-m)" }}>
            {roots.map((comment) => (
              <li key={comment.id}>
                <CommentItem
                  comment={comment}
                  reviewId={reviewId}
                  viewer={viewer}
                  nextPath={nextPath}
                  strings={strings}
                  canReply
                />

                {(repliesByParent.get(comment.id) ?? []).length > 0 ? (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: "var(--space-s) 0 0",
                      // The rail sits on the reading edge, so the reply
                      // indent mirrors with the rest of the page.
                      padding: 0,
                      paddingInlineStart: "var(--space-m)",
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
                          strings={strings}
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
            label={strings.addComment}
            placeholder={strings.addPlaceholder}
            submit={strings.post}
            submitting={strings.posting}
          />
        ) : (
          <p className="hint">
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
              {strings.logIn}
            </Link>
            {strings.logInSuffix}
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
  strings,
  canReply,
}: {
  comment: ThreadComment;
  reviewId: string;
  viewer: ThreadViewer;
  nextPath: string;
  strings: ThreadStrings;
  canReply: boolean;
}) {
  const isAuthor = viewer !== null && comment.author?.id === viewer.id;
  const canDelete = isAuthor || (viewer?.canModerate ?? false);
  const username = comment.author?.username ?? strings.authorDeleted;
  const authorLabel = comment.author
    ? `@${comment.author.username}`
    : strings.authorDeleted;

  return (
    <article style={{ display: "grid", gap: "var(--space-2xs)" }}>
      <p className="label" style={{ margin: 0 }}>
        {/* An account whose user was deleted keeps its words and loses its name. */}
        <bdi dir="auto">{authorLabel}</bdi>
        <span style={{ textTransform: "none", letterSpacing: 0 }}>
          {strings.separator}
          {comment.age}
        </span>
      </p>

      {/* A comment may be in either script whatever language the interface is
          in, so it decides its own direction. */}
      <bdi
        dir="auto"
        style={{
          display: "block",
          whiteSpace: "pre-wrap",
          fontSize: "var(--step-0)",
        }}
      >
        {comment.body}
      </bdi>

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
          strings={strings.vote}
        />

        {canReply && viewer ? (
          <details style={{ display: "inline-block" }}>
            <summary
              className="btn btn--quiet btn--small"
              style={{ color: "var(--ink-3)", listStyle: "none" }}
            >
              {strings.reply}
            </summary>
            <div style={{ marginBlockStart: "var(--space-xs)" }}>
              <CommentForm
                reviewId={reviewId}
                parentId={comment.id}
                label={strings.replyTo.replace(USERNAME_TOKEN, username)}
                placeholder={strings.replyPlaceholder}
                submit={strings.post}
                submitting={strings.posting}
              />
            </div>
          </details>
        ) : null}

        {canDelete ? (
          <DeleteCommentForm
            commentId={comment.id}
            label={strings.remove}
            pendingLabel={strings.removing}
          />
        ) : null}
      </div>
    </article>
  );
}

function CommentForm({
  reviewId,
  parentId,
  label,
  placeholder,
  submit,
  submitting,
}: {
  reviewId: string;
  parentId: string | null;
  label: string;
  placeholder: string;
  submit: string;
  submitting: string;
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
          {/* The label carries a Latin username inside otherwise Arabic text. */}
          <bdi dir="auto">{label}</bdi>
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
          // The box follows what is typed into it, not the interface: a
          // reader on an Arabic page may well answer in English.
          dir="auto"
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
          {isPending ? submitting : submit}
        </button>
      </div>
    </form>
  );
}

function DeleteCommentForm({
  commentId,
  label,
  pendingLabel,
}: {
  commentId: string;
  label: string;
  pendingLabel: string;
}) {
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
        {isPending ? pendingLabel : label}
      </button>
      {state.error ? (
        <span className="error-text" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
