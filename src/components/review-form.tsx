"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { StarInput } from "@/components/stars";
import {
  submitReviewAction,
  updateReviewAction,
  type ReviewActionState,
} from "@/lib/actions/reviews";
import {
  RATING_AXES,
  STUDENT_FIELDS,
  STUDENT_FIELD_LABELS,
  TRAINEE_ROLES,
  TRAINEE_ROLE_LABELS,
  DEPARTMENT_SUGGESTIONS,
} from "@/lib/labels";

/**
 * The review form.
 *
 * One screen, not a wizard, and not behind a login wall. Three required
 * fields; everything else folds away. Two things about it are load-bearing:
 *
 *  · A signed-out visitor gets the whole form and is asked to sign in only at
 *    submit — with the draft already in local storage, so the round trip
 *    through the login page costs nothing. Asking first loses the review.
 *  · A scan for names, numbers and handles runs on blur and only ever warns.
 *    Anonymity breaks from the inside, in the text, not from the account.
 */

const MIN_BODY = 120;
/** Below this, a counter is just pressure. Above it, it is information. */
const COUNTER_AFTER = 60;
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DRAFT_DEBOUNCE_MS = 400;
const DRAFT_VERSION = "hospirate:draft:v1";

export type ReviewFormValues = {
  overall: number | null;
  body: string;
  title: string | null;
  field: string | null;
  role: string | null;
  department: string | null;
  trainingYear: number | null;
  supervision: number | null;
  handsOn: number | null;
  staffRespect: number | null;
  workload: number | null;
  resources: number | null;
  safety: number | null;
};

type StoredDraft = { savedAt: number; values: Record<string, string> };

/** Never persisted: identifiers the page supplies fresh on every render. */
const NON_DRAFT_FIELDS = new Set(["facilitySlug", "reviewId", "$ACTION_ID"]);

const INITIAL_STATE: ReviewActionState = { status: "idle" };

// ---------------------------------------------------------------------------
// The privacy scan
// ---------------------------------------------------------------------------

type PrivacyFlag = { id: string; label: string; sample: string };

/**
 * Patterns for the four things that most often de-anonymise a review: a
 * contact address, a phone or ID number, a social handle, and a named
 * clinician. All of them produce false positives — "we ran 12 million tests"
 * trips the digit rule — which is exactly why nothing here blocks a post.
 */
const PATTERNS: { id: string; label: string; re: RegExp }[] = [
  {
    id: "email",
    label: "an email address",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    id: "digits",
    label: "a long number — a phone, an ID or a bleep",
    re: /\d(?:[\s-]?\d){6,}/g,
  },
  {
    id: "handle",
    label: "a social handle",
    re: /(?:^|[\s(])@[A-Za-z0-9_]{3,}/g,
  },
  {
    id: "name",
    label: "a named person",
    re: /\b(?:Dr|Doctor|Prof|Professor|Mr|Mrs|Ms)\.?\s+[A-Z][A-Za-z'-]{2,}/g,
  },
  {
    id: "name-ar",
    label: "a named person",
    re: /(?:^|\s)د\s*[./]\s*[ء-ي]{2,}/g,
  },
];

function scanForIdentifiers(text: string): PrivacyFlag[] {
  const found = new Map<string, PrivacyFlag>();

  for (const pattern of PATTERNS) {
    // Regexes carry lastIndex between calls when they are global.
    pattern.re.lastIndex = 0;
    const match = pattern.re.exec(text);
    if (!match) continue;

    const sample = match[0].trim().slice(0, 32);
    // Two rules can name the same worry (Latin and Arabic titles); show it once.
    if (!found.has(pattern.label)) {
      found.set(pattern.label, { id: pattern.id, label: pattern.label, sample });
    }
  }

  return [...found.values()];
}

// ---------------------------------------------------------------------------
// Draft storage — every access guarded, because private browsing throws
// ---------------------------------------------------------------------------

function readDraft(key: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as StoredDraft).savedAt !== "number" ||
      typeof (parsed as StoredDraft).values !== "object"
    ) {
      return null;
    }
    return parsed as StoredDraft;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: StoredDraft): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Quota, private mode, or storage disabled. The form still works.
  }
}

function removeDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

function draftValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (NON_DRAFT_FIELDS.has(name) || name.startsWith("$")) continue;
    if (value === "") continue;
    values[name] = value;
  }
  return values;
}

/**
 * Put stored values back on the form.
 *
 * Radio groups come back from `namedItem` as a `RadioNodeList`, whose `value`
 * setter checks the matching input — which is how the star ratings restore
 * without touching React state.
 */
function applyValues(form: HTMLFormElement, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    // The body is React-controlled; setting the DOM node would be undone.
    if (name === "body") continue;
    const element = form.elements.namedItem(name);
    if (!element) continue;

    if (element instanceof RadioNodeList) {
      element.value = value;
    } else if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    ) {
      element.value = value;
    }
  }
}

function agoLabel(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "a moment ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function trainingYears(): number[] {
  const now = new Date().getUTCFullYear();
  return Array.from({ length: 10 }, (_, i) => now - i);
}

/** Open the optional section when it already has something in it. */
function hasDetails(values: Partial<ReviewFormValues> | undefined): boolean {
  if (!values) return false;
  return Boolean(
    values.title ||
      values.role ||
      values.department ||
      values.trainingYear ||
      RATING_AXES.some((axis) => values[axis.key] != null),
  );
}

// ---------------------------------------------------------------------------

export function ReviewForm({
  facility,
  username,
  mode = "create",
  reviewId,
  initial,
}: {
  facility: { slug: string; name: string };
  /** Null when signed out — the form still renders in full. */
  username: string | null;
  mode?: "create" | "edit";
  reviewId?: string;
  initial?: Partial<ReviewFormValues>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    mode === "edit" ? updateReviewAction : submitReviewAction,
    INITIAL_STATE,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [body, setBody] = useState(initial?.body ?? "");
  const [flags, setFlags] = useState<PrivacyFlag[]>([]);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  // Latched rather than recomputed: a counter that vanishes while you delete
  // is a distraction, and it is only ever meant to appear once, quietly.
  const [counterArmed, setCounterArmed] = useState(
    () => (initial?.body?.trim().length ?? 0) >= COUNTER_AFTER,
  );
  const [detailsOpen, setDetailsOpen] = useState(() => hasDetails(initial));

  // Drafts belong to the create flow. An edit already has a saved version to
  // fall back on, and a stale draft over it would be a nasty surprise.
  const draftsEnabled = mode === "create";
  const draftKey = `${DRAFT_VERSION}:${facility.slug}`;
  const signInNext = encodeURIComponent(`/facilities/${facility.slug}/review`);

  const clearDraft = useCallback(() => {
    if (!draftsEnabled) return;
    removeDraft(draftKey);
  }, [draftKey, draftsEnabled]);

  // -- restore ------------------------------------------------------------
  //
  // Reading local storage has to happen after hydration — the server has no
  // access to it, and seeding the initial state from it instead would make the
  // first client render disagree with the HTML and throw the draft away. The
  // lint rule below cannot express "read an external store once on mount",
  // which is exactly what this is.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!draftsEnabled) return;
    const form = formRef.current;
    if (!form) return;

    const draft = readDraft(draftKey);
    if (!draft) return;

    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      removeDraft(draftKey);
      return;
    }

    applyValues(form, draft.values);
    if (typeof draft.values.body === "string") {
      setBody(draft.values.body);
      if (draft.values.body.trim().length >= COUNTER_AFTER) setCounterArmed(true);
    }
    if (
      RATING_AXES.some((axis) => draft.values[axis.key]) ||
      draft.values.role ||
      draft.values.department ||
      draft.values.trainingYear ||
      draft.values.title
    ) {
      setDetailsOpen(true);
    }
    setRestoredAt(draft.savedAt);
  }, [draftKey, draftsEnabled]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // -- save ---------------------------------------------------------------
  const saveNow = useCallback(() => {
    if (!draftsEnabled) return;
    const form = formRef.current;
    if (!form) return;
    const values = draftValues(new FormData(form));
    if (Object.keys(values).length === 0) return;
    writeDraft(draftKey, { savedAt: Date.now(), values });
  }, [draftKey, draftsEnabled]);

  const scheduleSave = useCallback(() => {
    if (!draftsEnabled) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, DRAFT_DEBOUNCE_MS);
  }, [draftsEnabled, saveNow]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // -- after the action ---------------------------------------------------
  useEffect(() => {
    if (state.status === "posted" || state.status === "updated") {
      clearDraft();
      router.push(state.href);
    }
  }, [state, clearDraft, router]);

  useEffect(() => {
    if (
      state.status === "error" ||
      state.status === "auth" ||
      state.status === "duplicate"
    ) {
      alertRef.current?.focus();
    }
  }, [state]);

  const fieldErrors: Record<string, string> =
    state.status === "error" ? state.fieldErrors : {};
  const errorFor = (name: string) => fieldErrors[name];

  const trimmedLength = body.trim().length;
  const remaining = MIN_BODY - trimmedLength;

  const runScan = () => setFlags(scanForIdentifiers(body));

  return (
    <form
      ref={formRef}
      // The action is passed through untouched so React can emit the hidden
      // fields that make this form post without JavaScript at all. Wrapping it
      // in an arrow function — the obvious way to hook submit — silently turns
      // that off, and a review form that needs a working bundle is a review
      // form that fails on a locked-down hospital machine.
      action={formAction}
      onSubmit={(event) => {
        // Runs before the action dispatch. A signed-out submit is answered
        // with a sign-in prompt, so the draft has to already be on disk by the
        // time the visitor clicks through to the login page.
        if (!draftsEnabled) return;
        const values = draftValues(new FormData(event.currentTarget));
        if (Object.keys(values).length > 0) {
          writeDraft(draftKey, { savedAt: Date.now(), values });
        }
      }}
      onInput={scheduleSave}
      onChange={scheduleSave}
      style={{ display: "grid", gap: "var(--space-l)" }}
    >
      <input type="hidden" name="facilitySlug" value={facility.slug} />
      {mode === "edit" && reviewId ? (
        <input type="hidden" name="reviewId" value={reviewId} />
      ) : null}

      {/* -- draft restored ------------------------------------------------ */}
      {restoredAt !== null ? (
        <div
          className="notice"
          role="status"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "var(--space-s)",
            justifyContent: "space-between",
          }}
        >
          <span>
            Draft restored — saved {agoLabel(restoredAt)} on this device.
          </span>
          <span style={{ display: "flex", gap: "var(--space-2xs)" }}>
            <button
              type="button"
              className="btn btn--quiet btn--small"
              onClick={() => {
                clearDraft();
                formRef.current?.reset();
                setBody("");
                setFlags([]);
                setCounterArmed(false);
                setRestoredAt(null);
              }}
            >
              Start over
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--small"
              onClick={() => setRestoredAt(null)}
            >
              Dismiss
            </button>
          </span>
        </div>
      ) : null}

      {/* -- action feedback ----------------------------------------------- */}
      <div ref={alertRef} tabIndex={-1} style={{ outline: "none" }}>
        {state.status === "error" ? (
          <p className="notice notice--danger" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "duplicate" ? (
          <p className="notice notice--warn" role="alert">
            {state.message}{" "}
            <Link href={state.href}>Edit your review of {facility.name}</Link>.
          </p>
        ) : null}

        {state.status === "auth" ? (
          <div className="notice notice--warn" role="alert">
            <strong>Almost there — you need an account to post.</strong>
            <p style={{ marginBlockStart: "var(--space-2xs)" }}>
              {state.message} An account is a username and a password. No email,
              no name, nothing that can be traced back to you.
            </p>
            <p
              style={{
                display: "flex",
                gap: "var(--space-xs)",
                marginBlockStart: "var(--space-s)",
              }}
            >
              <Link
                className="btn btn--primary btn--small"
                href={`/signup?next=${signInNext}`}
              >
                Create an account
              </Link>
              <Link className="btn btn--small" href={`/login?next=${signInNext}`}>
                Sign in
              </Link>
            </p>
          </div>
        ) : null}

        {state.status === "posted" || state.status === "updated" ? (
          <p className="notice" role="status">
            {state.message}{" "}
            {/* The link matters without JavaScript, where nothing navigates
                on its own after the post succeeds. */}
            <Link href={state.href}>
              Go to <bdi dir="auto">{facility.name}</bdi>
            </Link>
          </p>
        ) : null}
      </div>

      {/* -- 1. overall ----------------------------------------------------- */}
      <fieldset
        style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "var(--space-2xs)" }}
      >
        <legend className="label" style={{ padding: 0 }}>
          Overall — required
        </legend>
        <p style={{ fontSize: "var(--step-1)", fontWeight: 600 }}>
          Would you send a friend on this placement?
        </p>
        <StarInput name="overall" defaultValue={initial?.overall ?? undefined} />
        {errorFor("overall") ? (
          <p className="error-text">{errorFor("overall")}</p>
        ) : null}
      </fieldset>

      {/* -- 2. the review -------------------------------------------------- */}
      <div className="field">
        <label className="label" htmlFor="review-body">
          What was it like — required
        </label>

        <p className="notice notice--warn" style={{ marginBlockEnd: "var(--space-2xs)" }}>
          Write about the place, not the people. Don&rsquo;t name staff,
          patients, or yourself — that&rsquo;s how anonymity breaks.
        </p>

        <textarea
          id="review-body"
          name="body"
          className="textarea"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (!counterArmed && event.target.value.trim().length >= COUNTER_AFTER) {
              setCounterArmed(true);
            }
          }}
          onBlur={runScan}
          required
          minLength={MIN_BODY}
          maxLength={8000}
          aria-describedby="body-help body-count"
          aria-invalid={errorFor("body") ? true : undefined}
          placeholder="What did a normal day look like? How much did you actually get to do? What would you want to know before you started?"
        />

        <p id="body-help" className="hint">
          At least {MIN_BODY} characters. Specifics beat adjectives — one
          concrete morning tells a reader more than a paragraph of “great
          experience”.
        </p>

        <p
          id="body-count"
          className="hint tnum"
          style={{ minBlockSize: "1.2em" }}
        >
          {counterArmed
            ? remaining > 0
              ? `${trimmedLength} characters — ${remaining} more to go`
              : `${trimmedLength} characters`
            : ""}
        </p>

        {errorFor("body") ? <p className="error-text">{errorFor("body")}</p> : null}

        {flags.length > 0 ? (
          <div className="notice notice--warn" role="status">
            <strong>Before you post — this might identify someone.</strong>
            <ul
              style={{
                margin: "var(--space-2xs) 0 0",
                paddingInlineStart: "var(--space-m)",
              }}
            >
              {flags.map((flag) => (
                <li key={flag.id}>
                  Looks like {flag.label}:{" "}
                  <code style={{ fontFamily: "var(--font-mono)" }}>
                    {flag.sample}
                  </code>
                </li>
              ))}
            </ul>
            <p style={{ marginBlockStart: "var(--space-2xs)" }}>
              We guess from patterns and we guess wrong often — if this is fine,
              carry on. Nothing here stops you posting.
            </p>
          </div>
        ) : null}
      </div>

      {/* -- 3. field of study ---------------------------------------------- */}
      <div className="field" style={{ maxInlineSize: "26rem" }}>
        <label className="label" htmlFor="review-field">
          What were you training in — required
        </label>
        <select
          id="review-field"
          name="field"
          className="select"
          required
          defaultValue={initial?.field ?? ""}
          aria-invalid={errorFor("field") ? true : undefined}
        >
          <option value="" disabled>
            Choose your field
          </option>
          {STUDENT_FIELDS.map((value) => (
            <option key={value} value={value}>
              {STUDENT_FIELD_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="hint">
          Kept broad on purpose — a narrower list would make a small cohort easy
          to pick apart.
        </p>
        {errorFor("field") ? <p className="error-text">{errorFor("field")}</p> : null}
      </div>

      {/* -- 4. role at the facility --------------------------------------- */}
      <div className="field" style={{ maxInlineSize: "26rem" }}>
        <label className="label" htmlFor="review-role">
          What were you there as — required
        </label>
        <select
          id="review-role"
          name="role"
          className="select"
          required
          defaultValue={initial?.role ?? ""}
          aria-invalid={errorFor("role") ? true : undefined}
        >
          <option value="" disabled>
            Choose your role
          </option>
          {TRAINEE_ROLES.map((value) => (
            <option key={value} value={value}>
              {TRAINEE_ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="hint">
          A reader weighs the same placement differently depending on whether it
          came from a first-week student or a second-year resident.
        </p>
        {errorFor("role") ? <p className="error-text">{errorFor("role")}</p> : null}
      </div>

      {/* -- everything else ------------------------------------------------ */}
      <details
        open={detailsOpen}
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        className="card"
        style={{ padding: "var(--space-m)" }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Add details — optional
        </summary>

        <div
          style={{
            display: "grid",
            gap: "var(--space-l)",
            marginBlockStart: "var(--space-m)",
          }}
        >
          <div className="field">
            <label className="label" htmlFor="review-title">
              A one-line summary
            </label>
            <input
              id="review-title"
              name="title"
              className="input"
              type="text"
              maxLength={120}
              defaultValue={initial?.title ?? ""}
              placeholder="Busy, well taught, no room to sit"
              aria-invalid={errorFor("title") ? true : undefined}
            />
            {errorFor("title") ? (
              <p className="error-text">{errorFor("title")}</p>
            ) : null}
          </div>

          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="label" style={{ padding: 0 }}>
              Rate the parts that matter
            </legend>
            <div
              style={{
                display: "grid",
                gap: "var(--space-m)",
                marginBlockStart: "var(--space-s)",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              }}
            >
              {RATING_AXES.map((axis) => (
                <div key={axis.key} style={{ display: "grid", gap: "var(--space-3xs)" }}>
                  <span style={{ fontWeight: 600 }} id={`axis-${axis.key}`}>
                    {axis.label}
                  </span>
                  <span className="hint">{axis.hint}</span>
                  <StarInput
                    name={axis.key}
                    required={false}
                    defaultValue={initial?.[axis.key] ?? undefined}
                  />
                  {errorFor(axis.key) ? (
                    <p className="error-text">{errorFor(axis.key)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </fieldset>

          <div
            style={{
              display: "grid",
              gap: "var(--space-m)",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div className="field">
              <label className="label" htmlFor="review-department">
                Department or unit
              </label>
              <input
                id="review-department"
                name="department"
                className="input"
                type="text"
                maxLength={60}
                autoComplete="off"
                list="department-suggestions"
                placeholder="Emergency, ICU, inpatient pharmacy…"
                defaultValue={initial?.department ?? ""}
              />
              {/* A datalist rather than a select: departments are named
                  differently at every hospital, so a closed list would be
                  wrong more often than it was right. */}
              <datalist id="department-suggestions">
                {DEPARTMENT_SUGGESTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <p className="hint">
                Helpful, but skip it on a quiet facility — a department plus a
                year can narrow you down.
              </p>
              {errorFor("department") ? (
                <p className="error-text">{errorFor("department")}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="review-year">
                Year you were there
              </label>
              <select
                id="review-year"
                name="trainingYear"
                className="select"
                defaultValue={initial?.trainingYear ? String(initial.trainingYear) : ""}
              >
                <option value="">Not saying</option>
                {trainingYears().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <p className="hint">
                Year only. A month plus a small department can narrow a reviewer
                down to one person.
              </p>
              {errorFor("trainingYear") ? (
                <p className="error-text">{errorFor("trainingYear")}</p>
              ) : null}
            </div>
          </div>
        </div>
      </details>

      {/* -- submit ---------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--space-m)",
          paddingBlockStart: "var(--space-m)",
          borderBlockStart: "1px solid var(--line)",
        }}
      >
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending
            ? "Posting…"
            : mode === "edit"
              ? "Save changes"
              : "Post review"}
        </button>

        <p className="hint" style={{ maxInlineSize: "34ch" }}>
          {username ? (
            <>
              Posted anonymously as <strong>@{username}</strong>. Your account
              has no email or name attached.
            </>
          ) : (
            <>
              You can write first. We&rsquo;ll ask you to sign in when you post,
              and your draft will be waiting when you come back.
            </>
          )}
        </p>
      </div>
    </form>
  );
}
