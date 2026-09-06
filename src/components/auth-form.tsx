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
import { getDictionary, type Locale } from "@/lib/i18n/dictionaries";

/**
 * Every credential form on the site.
 *
 * They live together because they share one contract — the `AuthState` an
 * action returns — and because the error wiring (`aria-describedby` pointing
 * at a message that only exists when there is one) is fiddly enough that
 * having a single copy of it is what keeps it correct.
 *
 * Each export takes a `locale` and reads the dictionary itself, rather than
 * being handed its strings the way `SiteHeader` is. The header can be handed
 * `t.nav` because every value in it is a string; `t.auth` holds functions
 * (`signedInAs(username)`), and a function cannot cross the server/client
 * boundary. The username those functions need is only known here anyway —
 * it comes back inside the action's result, after this tree has rendered.
 */

const EMPTY: AuthState = {};

/** `aria-describedby` wants a space-separated list, or no attribute at all. */
function describe(
  ...ids: (string | false | null | undefined)[]
): string | undefined {
  const list = ids.filter(Boolean).join(" ");
  return list.length > 0 ? list : undefined;
}

/**
 * Text that came back from a server action.
 *
 * Those actions answer in English and their strings are not in the dictionary
 * yet, so on an Arabic page this is foreign text inside a native sentence.
 * Tagging it is the honest handling: a screen reader switches voice instead of
 * spelling English out in Arabic phonemes, and `bdi` isolates it so its
 * trailing full stop does not jump to the wrong end of the line.
 */
function Server({ locale, text }: { locale: Locale; text: string }) {
  if (locale === "en") return <>{text}</>;
  return (
    <bdi lang="en" dir="ltr">
      {text}
    </bdi>
  );
}

function FormError({ locale, message }: { locale: Locale; message?: string }) {
  if (!message) return null;
  return (
    <p className="notice notice--danger" role="alert">
      <Server locale={locale} text={message} />
    </p>
  );
}

function FormOk({ locale, message }: { locale: Locale; message?: string }) {
  if (!message) return null;
  return (
    <p className="notice" role="status">
      <Server locale={locale} text={message} />
    </p>
  );
}

function FieldError({
  id,
  locale,
  message,
}: {
  id: string;
  locale: Locale;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p className="error-text" id={id}>
      <Server locale={locale} text={message} />
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
  locale,
  signedInAs = null,
  intro = null,
  outro = null,
}: {
  mode: "login" | "signup";
  next: string;
  locale: Locale;
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
  const t = getDictionary(locale).auth;
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
          locale={locale}
        />
      </Framed>
    );
  }

  if (signedInAs) {
    return (
      <Framed>
        <p className="notice">{t.alreadySignedIn(signedInAs)}</p>
        <div style={{ display: "flex", gap: "var(--space-s)", flexWrap: "wrap" }}>
          <a className="btn btn--primary" href="/account">
            {t.yourAccount}
          </a>
          <form method="post" action="/logout">
            <button type="submit" className="btn">
              {t.signOut}
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
          <FormError locale={locale} message={state.error} />

          <div className="field">
            <label className="label" htmlFor={usernameId}>
              {t.usernameLabel}
            </label>
            <input
              className="input"
              id={usernameId}
              name="username"
              type="text"
              // Usernames are chosen, not written in a language, so the box
              // follows whichever script the first character is typed in.
              dir="auto"
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
                {t.usernameHint}
              </p>
            ) : null}
            <FieldError
              id={usernameErrorId}
              locale={locale}
              message={fieldErrors.username}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor={passwordId}>
              {t.passwordLabel}
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
                {t.passwordHint}
              </p>
            ) : null}
            <FieldError
              id={passwordErrorId}
              locale={locale}
              message={fieldErrors.password}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={isPending}
            style={{ inlineSize: "100%" }}
          >
            {isPending
              ? isSignup
                ? t.creatingAccount
                : t.signingIn
              : isSignup
                ? t.submitSignUp
                : t.submitSignIn}
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
  locale,
}: {
  code: string;
  username: string;
  next: string;
  locale: Locale;
}) {
  const t = getDictionary(locale).auth;
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
        {t.accountCreated}
      </h2>

      <p style={{ color: "var(--ink-2)" }}>{t.signedInAs(username)}</p>

      <p className="notice notice--warn">{t.recoverySaveWarning}</p>

      <div className="field">
        <span className="label" id={`${base}-code-label`}>
          {t.recoveryCodeLabel}
        </span>
        <p
          aria-labelledby={`${base}-code-label`}
          // The code is generated from a Latin alphabet, so it is read and
          // laid out as Latin even when the page around it runs right to left.
          dir="ltr"
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
            {t.copyCode}
          </button>
          <span className="hint" role="status">
            {copy === "copied"
              ? t.copied
              : copy === "failed"
                ? t.copyBlocked
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
        <label htmlFor={confirmId}>{t.recoveryConfirm}</label>
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
        {t.continue}
      </a>
      {!saved ? <p className="hint">{t.tickTheBox}</p> : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Security page                                                               */
/* -------------------------------------------------------------------------- */

export function ChangePasswordForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).account;
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
      <FormError locale={locale} message={state.error} />
      <FormOk locale={locale} message={state.ok} />

      <div className="field">
        <label className="label" htmlFor={currentId}>
          {t.currentPassword}
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
        <FieldError
          id={currentErrorId}
          locale={locale}
          message={fieldErrors.currentPassword}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor={newId}>
          {t.newPassword}
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
          {t.newPasswordHint}
        </p>
        <FieldError
          id={newErrorId}
          locale={locale}
          message={fieldErrors.newPassword}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor={confirmId}>
          {t.confirmPassword}
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
        <FieldError
          id={confirmErrorId}
          locale={locale}
          message={fieldErrors.confirmPassword}
        />
      </div>

      <button
        type="submit"
        className="btn btn--primary"
        disabled={isPending}
        style={{ alignSelf: "flex-start" }}
      >
        {isPending ? t.changingPassword : t.changePasswordSubmit}
      </button>
    </form>
  );
}

export function SignOutEverywhereForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).account;
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signOutEverywhereAction,
    EMPTY,
  );

  return (
    <form action={formAction} style={formStyle}>
      <FormError locale={locale} message={state.error} />
      <button
        type="submit"
        className="btn"
        disabled={isPending}
        style={{ alignSelf: "flex-start" }}
      >
        {isPending ? t.signingOut : t.signOutEverywhere}
      </button>
    </form>
  );
}

export function DeleteAccountForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).account;
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
      <FormError locale={locale} message={state.error} />

      <div className="field">
        <label className="label" htmlFor={passwordId}>
          {t.yourPassword}
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
        <FieldError
          id={passwordErrorId}
          locale={locale}
          message={fieldErrors.password}
        />
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
          <label htmlFor={confirmId}>{t.deleteConfirm}</label>
        </div>
        <FieldError
          id={confirmErrorId}
          locale={locale}
          message={fieldErrors.confirm}
        />
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
        {isPending ? t.deleting : t.deleteSubmit}
      </button>
    </form>
  );
}
