"use client";

import { useActionState, useId, useState } from "react";

import {
  changePasswordAction,
  deleteAccountAction,
  logInAction,
  signOutEverywhereAction,
  signUpAction,
  type AuthState,
} from "@/lib/actions/auth";

/**
 * Every credential form on the site.
 *
 * They live together because they share one contract — the `AuthState` an
 * action returns — and because the error wiring (`aria-describedby` pointing
 * at a message that only exists when there is one) is fiddly enough that
 * having a single copy of it is what keeps it correct.
 */

const EMPTY: AuthState = {};

/** `aria-describedby` wants a space-separated list, or no attribute at all. */
function describe(
  ...ids: (string | false | null | undefined)[]
): string | undefined {
  const list = ids.filter(Boolean).join(" ");
  return list.length > 0 ? list : undefined;
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="notice notice--danger" role="alert">
      {message}
    </p>
  );
}

function FormOk({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="notice" role="status">
      {message}
    </p>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="error-text" id={id}>
      {message}
    </p>
  );
}

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-m)",
};

/** The card the sign-in and sign-up panels sit on, whichever one is showing. */
function Framed({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ ...formStyle, padding: "var(--space-l)" }}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sign in / sign up                                                           */
/* -------------------------------------------------------------------------- */

export function AuthForm({
  mode,
  next,
  signedInAs = null,
  intro = null,
  outro = null,
}: {
  mode: "login" | "signup";
  next: string;
  /**
   * Whose session is already active, if any. Decided here rather than on the
   * page, because the page cannot tell "arrived while signed in" apart from
   * "signed in a moment ago by the form below" — and the second of those has
   * a recovery code on screen that must not be navigated away from.
   */
  signedInAs?: string | null;
  /**
   * Copy that belongs to the form rather than to the page. It is written on
   * the page, where the words live, but rendered here so that it can leave
   * when the form does: "you will be shown a recovery code on the next
   * screen" must not still be sitting underneath the recovery code.
   */
  intro?: React.ReactNode;
  outro?: React.ReactNode;
}) {
  const isSignup = mode === "signup";
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    isSignup ? signUpAction : logInAction,
    EMPTY,
  );
  const base = useId();

  // Signing up is the one flow that ends on the page it started on: the
  // recovery code exists for exactly this render and no other.
  if (state.recoveryCode) {
    return (
      <Framed>
        <RecoveryCode
          code={state.recoveryCode}
          username={state.username ?? ""}
          next={next}
        />
      </Framed>
    );
  }

  if (signedInAs) {
    return (
      <Framed>
        <p className="notice">
          You are already signed in as <strong>{signedInAs}</strong>. An account
          is only a username and a password, so there is nothing to merge — to
          make a second one, sign out of this one first.
        </p>
        <div style={{ display: "flex", gap: "var(--space-s)", flexWrap: "wrap" }}>
          <a className="btn btn--primary" href="/account">
            Your account
          </a>
          <form method="post" action="/logout">
            <button type="submit" className="btn">
              Sign out
            </button>
          </form>
        </div>
      </Framed>
    );
  }

  const fieldErrors = state.fieldErrors ?? {};
  const usernameId = `${base}-username`;
  const usernameHintId = `${base}-username-hint`;
  const usernameErrorId = `${base}-username-error`;
  const passwordId = `${base}-password`;
  const passwordHintId = `${base}-password-hint`;
  const passwordErrorId = `${base}-password-error`;

  return (
    <>
      {intro}

      <Framed>
        <form action={formAction} style={formStyle} noValidate>
          <input type="hidden" name="next" value={next} />
          <FormError message={state.error} />

          <div className="field">
            <label className="label" htmlFor={usernameId}>
              Username
            </label>
            <input
              className="input"
              id={usernameId}
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              defaultValue={state.username ?? ""}
              aria-invalid={fieldErrors.username ? true : undefined}
              aria-describedby={describe(
                isSignup && usernameHintId,
                fieldErrors.username && usernameErrorId,
              )}
            />
            {isSignup ? (
              <p className="hint" id={usernameHintId}>
                3–24 characters: letters, numbers, hyphens, underscores. This is
                the only name anyone will see, so pick one that is not yours.
              </p>
            ) : null}
            <FieldError id={usernameErrorId} message={fieldErrors.username} />
          </div>

          <div className="field">
            <label className="label" htmlFor={passwordId}>
              Password
            </label>
            <input
              className="input"
              id={passwordId}
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={isSignup ? 10 : undefined}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={describe(
                isSignup && passwordHintId,
                fieldErrors.password && passwordErrorId,
              )}
            />
            {isSignup ? (
              <p className="hint" id={passwordHintId}>
                At least 10 characters. No symbol-and-digit rules — a phrase you
                will remember is worth more than a puzzle you won&rsquo;t.
              </p>
            ) : null}
            <FieldError id={passwordErrorId} message={fieldErrors.password} />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={isPending}
            style={{ inlineSize: "100%" }}
          >
            {isPending
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      </Framed>

      {outro}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The recovery code, shown once                                               */
/* -------------------------------------------------------------------------- */

function RecoveryCode({
  code,
  username,
  next,
}: {
  code: string;
  username: string;
  next: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const base = useId();
  const confirmId = `${base}-confirm`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopy("copied");
    } catch {
      // Clipboard access can be refused outright. The code is selectable, so
      // say so rather than letting the button look broken.
      setCopy("failed");
    }
  }

  return (
    <section
      style={{ ...formStyle }}
      aria-labelledby={`${base}-heading`}
    >
      <h2 id={`${base}-heading`} style={{ fontSize: "var(--step-2)" }}>
        Account created
      </h2>

      <p style={{ color: "var(--ink-2)" }}>
        You are signed in as <strong>{username}</strong>.
      </p>

      <p className="notice notice--warn">
        Save this. It is the only way back into your account if you forget your
        password — there is no email to reset with.
      </p>

      <div className="field">
        <span className="label" id={`${base}-code-label`}>
          Recovery code
        </span>
        <p
          aria-labelledby={`${base}-code-label`}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--step-2)",
            letterSpacing: "0.06em",
            wordBreak: "break-word",
            userSelect: "all",
            padding: "var(--space-s) var(--space-m)",
            background: "var(--surface-2)",
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--r-1)",
          }}
        >
          {code}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-s)",
            flexWrap: "wrap",
          }}
        >
          <button type="button" className="btn btn--small" onClick={copyCode}>
            Copy code
          </button>
          <span className="hint" role="status">
            {copy === "copied"
              ? "Copied to your clipboard."
              : copy === "failed"
                ? "Copying was blocked — select the code above instead."
                : ""}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-xs)",
        }}
      >
        <input
          type="checkbox"
          id={confirmId}
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          style={{ marginBlockStart: "0.3em", accentColor: "var(--brand)" }}
        />
        <label htmlFor={confirmId}>
          I have written this code down somewhere I can find it again.
        </label>
      </div>

      {/* A full navigation rather than a client-side one: the session was
          created after this tree was rendered, so the next page has to come
          from the server for the header to know about it. */}
      <a
        href={next}
        className="btn btn--primary"
        aria-disabled={!saved}
        onClick={(event) => {
          if (!saved) event.preventDefault();
        }}
        style={{ inlineSize: "100%" }}
      >
        Continue
      </a>
      {!saved ? (
        <p className="hint">Tick the box above once the code is safe.</p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Security page                                                               */
/* -------------------------------------------------------------------------- */

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    changePasswordAction,
    EMPTY,
  );
  const base = useId();

  const fieldErrors = state.fieldErrors ?? {};
  const currentId = `${base}-current`;
  const currentErrorId = `${base}-current-error`;
  const newId = `${base}-new`;
  const newHintId = `${base}-new-hint`;
  const newErrorId = `${base}-new-error`;
  const confirmId = `${base}-confirm`;
  const confirmErrorId = `${base}-confirm-error`;

  return (
    <form action={formAction} style={formStyle} noValidate>
      <FormError message={state.error} />
      <FormOk message={state.ok} />

      <div className="field">
        <label className="label" htmlFor={currentId}>
          Current password
        </label>
        <input
          className="input"
          id={currentId}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={fieldErrors.currentPassword ? true : undefined}
          aria-describedby={describe(
            fieldErrors.currentPassword && currentErrorId,
          )}
        />
        <FieldError id={currentErrorId} message={fieldErrors.currentPassword} />
      </div>

      <div className="field">
        <label className="label" htmlFor={newId}>
          New password
        </label>
        <input
          className="input"
          id={newId}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-invalid={fieldErrors.newPassword ? true : undefined}
          aria-describedby={describe(
            newHintId,
            fieldErrors.newPassword && newErrorId,
          )}
        />
        <p className="hint" id={newHintId}>
          At least 10 characters.
        </p>
        <FieldError id={newErrorId} message={fieldErrors.newPassword} />
      </div>

      <div className="field">
        <label className="label" htmlFor={confirmId}>
          New password again
        </label>
        <input
          className="input"
          id={confirmId}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fieldErrors.confirmPassword ? true : undefined}
          aria-describedby={describe(
            fieldErrors.confirmPassword && confirmErrorId,
          )}
        />
        <FieldError id={confirmErrorId} message={fieldErrors.confirmPassword} />
      </div>

      <button
        type="submit"
        className="btn btn--primary"
        disabled={isPending}
        style={{ alignSelf: "flex-start" }}
      >
        {isPending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

export function SignOutEverywhereForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signOutEverywhereAction,
    EMPTY,
  );

  return (
    <form action={formAction} style={formStyle}>
      <FormError message={state.error} />
      <button
        type="submit"
        className="btn"
        disabled={isPending}
        style={{ alignSelf: "flex-start" }}
      >
        {isPending ? "Signing out…" : "Sign out everywhere"}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    deleteAccountAction,
    EMPTY,
  );
  const base = useId();

  const fieldErrors = state.fieldErrors ?? {};
  const passwordId = `${base}-password`;
  const passwordErrorId = `${base}-password-error`;
  const confirmId = `${base}-confirm`;
  const confirmErrorId = `${base}-confirm-error`;

  return (
    <form action={formAction} style={formStyle} noValidate>
      <FormError message={state.error} />

      <div className="field">
        <label className="label" htmlFor={passwordId}>
          Your password
        </label>
        <input
          className="input"
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={describe(fieldErrors.password && passwordErrorId)}
        />
        <FieldError id={passwordErrorId} message={fieldErrors.password} />
      </div>

      <div className="field">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-xs)",
          }}
        >
          <input
            type="checkbox"
            id={confirmId}
            name="confirm"
            required
            defaultChecked={state.confirmed ?? false}
            aria-invalid={fieldErrors.confirm ? true : undefined}
            aria-describedby={describe(fieldErrors.confirm && confirmErrorId)}
            style={{ marginBlockStart: "0.3em", accentColor: "var(--danger)" }}
          />
          <label htmlFor={confirmId}>
            I understand this cannot be undone, and that my reviews and comments
            stay up without a name on them.
          </label>
        </div>
        <FieldError id={confirmErrorId} message={fieldErrors.confirm} />
      </div>

      <button
        type="submit"
        className="btn"
        disabled={isPending}
        style={{
          alignSelf: "flex-start",
          borderColor: "var(--danger)",
          color: "var(--danger)",
        }}
      >
        {isPending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
