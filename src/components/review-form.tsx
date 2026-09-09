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
  formatNumber,
  getDictionary,
  lookup,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";
import {
  RATING_AXES,
  ROTATION_SPECIALTIES,
  STUDENT_FIELDS,
  traineeRoleOptions,
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
 *
 * The dictionary is read here from a `locale` prop rather than handed down as
 * finished strings the way `SiteHeader` takes its nav labels. The character
 * counter, the age of a restored draft and the privacy scan all need
 * functions of values that exist only on this side of the boundary, and a
 * function cannot be passed from a server component to a client one.
 */

const MIN_BODY = 120;
/** Below this, a counter is just pressure. Above it, it is information. */
const COUNTER_AFTER = 60;
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DRAFT_DEBOUNCE_MS = 400;
const DRAFT_VERSION = "tellyrate:draft:v1";

type ReviewStrings = Dictionary["reviewForm"];

export type ReviewFormValues = {
  overall: number | null;
  body: string;
  title: string | null;
  field: string | null;
  role: string | null;
  specialty: string | null;
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

/**
 * Text that came back from a server action.
 *
 * Those actions still answer in English and their strings have no dictionary
 * keys yet, so on an Arabic page this is foreign text inside a native
 * sentence. Tagging it is the honest handling: a screen reader switches voice
 * instead of reading English through Arabic phonemes, and `bdi` stops the
 * trailing full stop from jumping to the wrong end of the line.
 */
function Server({ locale, text }: { locale: Locale; text: string }) {
  if (locale === "en") return <>{text}</>;
  return (
    <bdi lang="en" dir="ltr">
      {text}
    </bdi>
  );
}

/** One shape for every field-level message, all of which are still English. */
function FieldError({
  locale,
  message,
}: {
  locale: Locale;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p className="error-text">
      <Server locale={locale} text={message} />
    </p>
  );
}

// ---------------------------------------------------------------------------
// The privacy scan
// ---------------------------------------------------------------------------

/** Which dictionary entry names what a pattern found. */
type ScanLabel = "scanEmail" | "scanPhone" | "scanHandle" | "scanName";

type PrivacyFlag = { id: string; label: ScanLabel; sample: string };

/**
 * Patterns for the four things that most often de-anonymise a review: a
 * contact address, a phone or ID number, a social handle, and a named
 * clinician. All of them produce false positives — "we ran 12 million tests"
 * trips the digit rule — which is exactly why nothing here blocks a post.
 *
 * Names need one rule per script. English leans on a capital letter to tell
 * "Dr Nasser" from "dr appointment"; Arabic has no capitals, so the Arabic
 * rule leans on the honorific alone and over-flags instead — which is the
 * safe direction for a warning that never stops anyone.
 */
const PATTERNS: { id: string; label: ScanLabel; re: RegExp }[] = [
  {
    id: "email",
    label: "scanEmail",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    // Latin 0-9, Arabic-Indic ٠-٩ and the Persian shapes of the same digits.
    // A phone number typed on an Arabic keyboard discloses exactly as much as
    // one typed on a Latin keyboard, and `\d` only ever sees the Latin run.
    id: "digits",
    label: "scanPhone",
    re: /[0-9٠-٩۰-۹](?:[\s-]?[0-9٠-٩۰-۹]){6,}/g,
  },
  {
    id: "handle",
    label: "scanHandle",
    re: /(?:^|[\s(])@[A-Za-z0-9_]{3,}/g,
  },
  {
    id: "name-latin",
    label: "scanName",
    re: /\b(?:Dr|Doctor|Prof|Professor|Mr|Mrs|Ms)\.?\s+[A-Z][A-Za-z'-]{2,}/g,
  },
  {
    // د. سعد · د/ سعد · الدكتور سعد · دكتورة نورة · أ.د. سعد
    //
    // The one-letter abbreviation has to carry its dot or slash, or every
    // word beginning with د would trip it. The spelled-out honorifics are
    // unambiguous on their own, so they only need a following word.
    id: "name-arabic",
    label: "scanName",
    re: /(?:^|[\s(«"،])(?:أ\s*\.?\s*د\s*[./]?|(?:ال)?دكتورة?|(?:ال)?بروفيسور|د\s*[./])\s*[ء-ي]{2,}/g,
  },
];

function scanForIdentifiers(text: string): PrivacyFlag[] {
  const found = new Map<ScanLabel, PrivacyFlag>();

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

/**
 * How long ago the draft was saved, as a whole sentence from the dictionary.
 *
 * Never a number glued to a translated unit: Arabic has a different word for
 * two of something than for three, and "قبل يومين" carries no digit at all.
 */
function agoLabel(t: ReviewStrings, timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return t.agoMoment;
  if (minutes < 60) return t.agoMinutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t.agoHours(hours);
  const days = Math.round(hours / 24);
  return t.agoDays(days);
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
  locale,
  username,
  mode = "create",
  reviewId,
  initial,
}: {
  facility: { slug: string; name: string };
  locale: Locale;
  /** Null when signed out — the form still renders in full. */
  username: string | null;
  mode?: "create" | "edit";
  reviewId?: string;
  initial?: Partial<ReviewFormValues>;
}) {
  const router = useRouter();
  const d = getDictionary(locale);
  const t = d.reviewForm;

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

  /**
   * The three kinds of placement a review may be written about, plus — when a
   * review carrying a retired answer is being edited — whatever it already
   * says.
   *
   * The question used to offer seven answers and now offers three. No review
   * in production was written under the old list, so this branch is a guard
   * rather than a migration: it exists so that editing a typo in the body can
   * never silently restate somebody's placement as one it was not.
   */
  const roleOptions = traineeRoleOptions(initial?.role);

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
          <span>{t.draftRestored(agoLabel(t, restoredAt))}</span>
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
              {t.startOver}
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--small"
              onClick={() => setRestoredAt(null)}
            >
              {t.dismiss}
            </button>
          </span>
        </div>
      ) : null}

      {/* -- action feedback ----------------------------------------------- */}
      <div ref={alertRef} tabIndex={-1} style={{ outline: "none" }}>
        {state.status === "error" ? (
          <p className="notice notice--danger" role="alert">
            <Server locale={locale} text={state.message} />
          </p>
        ) : null}

        {state.status === "duplicate" ? (
          <p className="notice notice--warn" role="alert">
            <Server locale={locale} text={state.message} />{" "}
            <Link href={state.href}>{t.duplicateLink(facility.name)}</Link>.
          </p>
        ) : null}

        {state.status === "auth" ? (
          <div className="notice notice--warn" role="alert">
            <strong>{t.authHeading}</strong>
            <p style={{ marginBlockStart: "var(--space-2xs)" }}>
              <Server locale={locale} text={state.message} /> {t.authBody}
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
                {t.createAccount}
              </Link>
              <Link className="btn btn--small" href={`/login?next=${signInNext}`}>
                {t.signIn}
              </Link>
            </p>
          </div>
        ) : null}

        {state.status === "posted" || state.status === "updated" ? (
          <p className="notice" role="status">
            <Server locale={locale} text={state.message} />{" "}
            {/* The link matters without JavaScript, where nothing navigates
                on its own after the post succeeds. */}
            <Link href={state.href}>
              {t.goTo} <bdi dir="auto">{facility.name}</bdi>
            </Link>
          </p>
        ) : null}
      </div>

      {/* -- 1. overall ----------------------------------------------------- */}
      <fieldset
        style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "var(--space-2xs)" }}
      >
        <legend className="label" style={{ padding: 0 }}>
          {t.overallLegend}
        </legend>
        <p style={{ fontSize: "var(--step-1)", fontWeight: 600 }}>
          {t.overallQuestion}
        </p>
        <StarInput
          name="overall"
          defaultValue={initial?.overall ?? undefined}
          t={d}
        />
        <FieldError locale={locale} message={errorFor("overall")} />
      </fieldset>

      {/* -- 2. the review -------------------------------------------------- */}
      <div className="field">
        <label className="label" htmlFor="review-body">
          {t.bodyLabel}
        </label>

        <p className="notice notice--warn" style={{ marginBlockEnd: "var(--space-2xs)" }}>
          {t.bodyWarning}
        </p>

        <aside
          style={{
            borderInlineStart: "3px solid var(--brand)",
            paddingInlineStart: "var(--space-s)",
            marginBlockEnd: "var(--space-s)",
          }}
        >
          <strong style={{ fontSize: "var(--step--1)" }}>
            {t.writingPrompts}
          </strong>
          <ul
            className="hint"
            style={{
              margin: "var(--space-2xs) 0 0",
              paddingInlineStart: "var(--space-m)",
              columns: "2 16rem",
            }}
          >
            {t.writingPromptItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>

        <textarea
          id="review-body"
          name="body"
          className="textarea"
          // Someone writing Arabic into an English interface should watch
          // their own paragraph line up as they type it, not after they post.
          dir="auto"
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
          placeholder={t.bodyPlaceholder}
        />

        <p id="body-help" className="hint">
          {t.bodyHelp(MIN_BODY)}
        </p>

        <p
          id="body-count"
          className="hint tnum"
          style={{ minBlockSize: "1.2em" }}
        >
          {counterArmed
            ? remaining > 0
              ? t.bodyCountRemaining(trimmedLength, remaining)
              : t.bodyCount(trimmedLength)
            : ""}
        </p>

        <FieldError locale={locale} message={errorFor("body")} />

        {flags.length > 0 ? (
          <div className="notice notice--warn" role="status">
            <strong>{t.scanHeading}</strong>
            <ul
              style={{
                margin: "var(--space-2xs) 0 0",
                paddingInlineStart: "var(--space-m)",
              }}
            >
              {flags.map((flag) => (
                <li key={flag.id}>
                  {t.scanItem(t[flag.label])}:{" "}
                  <code style={{ fontFamily: "var(--font-mono)" }}>
                    {/* The sample is the writer's own text, in whichever
                        script they wrote it in. */}
                    <bdi dir="auto">{flag.sample}</bdi>
                  </code>
                </li>
              ))}
            </ul>
            <p style={{ marginBlockStart: "var(--space-2xs)" }}>{t.scanFooter}</p>
          </div>
        ) : null}
      </div>

      {/* -- 3. field of study ---------------------------------------------- */}
      <div className="field" style={{ maxInlineSize: "26rem" }}>
        <label className="label" htmlFor="review-field">
          {t.fieldLabel}
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
            {t.fieldPlaceholder}
          </option>
          {STUDENT_FIELDS.map((value) => (
            <option key={value} value={value}>
              {lookup(d.labels.studentField, value, d.labels.healthcareFallback)}
            </option>
          ))}
        </select>
        <p className="hint">{t.fieldHint}</p>
        <FieldError locale={locale} message={errorFor("field")} />
      </div>

      {/* -- 4. role at the facility --------------------------------------- */}
      <div className="field" style={{ maxInlineSize: "26rem" }}>
        <label className="label" htmlFor="review-role">
          {t.roleLabel}
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
            {t.rolePlaceholder}
          </option>
          {roleOptions.map((value) => (
            <option key={value} value={value}>
              {lookup(d.labels.traineeRole, value, d.labels.traineeFallback)}
            </option>
          ))}
        </select>
        <p className="hint">{t.roleHint}</p>
        <FieldError locale={locale} message={errorFor("role")} />
      </div>

      {/* -- 5. broad rotation specialty ---------------------------------- */}
      <div className="field" style={{ maxInlineSize: "26rem" }}>
        <label className="label" htmlFor="review-specialty">
          {t.specialtyLabel}
        </label>
        <select
          id="review-specialty"
          name="specialty"
          className="select"
          defaultValue={initial?.specialty ?? ""}
          aria-invalid={errorFor("specialty") ? true : undefined}
        >
          <option value="">{t.specialtyPlaceholder}</option>
          {ROTATION_SPECIALTIES.map((value) => (
            <option key={value} value={value}>
              {lookup(
                d.labels.rotationSpecialty,
                value,
                d.labels.healthcareFallback,
              )}
            </option>
          ))}
        </select>
        <p className="hint">{t.specialtyHint}</p>
        <FieldError locale={locale} message={errorFor("specialty")} />
      </div>

      {/* -- everything else ------------------------------------------------ */}
      <details
        open={detailsOpen}
        onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        className="card"
        style={{ padding: "var(--space-m)" }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          {t.detailsSummary}
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
              {t.titleLabel}
            </label>
            <input
              id="review-title"
              name="title"
              className="input"
              type="text"
              dir="auto"
              maxLength={120}
              defaultValue={initial?.title ?? ""}
              placeholder={t.titlePlaceholder}
              aria-invalid={errorFor("title") ? true : undefined}
            />
            <FieldError locale={locale} message={errorFor("title")} />
          </div>

          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="label" style={{ padding: 0 }}>
              {t.axesLegend}
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
                    {d.labels.ratingAxis[axis.key].label}
                  </span>
                  <span className="hint">{d.labels.ratingAxis[axis.key].hint}</span>
                  <StarInput
                    name={axis.key}
                    required={false}
                    defaultValue={initial?.[axis.key] ?? undefined}
                    t={d}
                  />
                  <FieldError locale={locale} message={errorFor(axis.key)} />
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
                {t.departmentLabel}
              </label>
              <input
                id="review-department"
                name="department"
                className="input"
                type="text"
                dir="auto"
                maxLength={60}
                autoComplete="off"
                list="department-suggestions"
                placeholder={t.departmentPlaceholder}
                defaultValue={initial?.department ?? ""}
              />
              {/* A datalist rather than a select: departments are named
                  differently at every hospital, so a closed list would be
                  wrong more often than it was right. */}
              <datalist id="department-suggestions">
                {d.labels.departmentSuggestions.map((department) => (
                  <option key={department} value={department} />
                ))}
              </datalist>
              <p className="hint">{t.departmentHint}</p>
              <FieldError locale={locale} message={errorFor("department")} />
            </div>

            <div className="field">
              <label className="label" htmlFor="review-year">
                {t.yearLabel}
              </label>
              <select
                id="review-year"
                name="trainingYear"
                className="select"
                defaultValue={initial?.trainingYear ? String(initial.trainingYear) : ""}
              >
                <option value="">{t.yearNotSaying}</option>
                {trainingYears().map((year) => (
                  <option key={year} value={year}>
                    {formatNumber(year)}
                  </option>
                ))}
              </select>
              <p className="hint">{t.yearHint}</p>
              <FieldError locale={locale} message={errorFor("trainingYear")} />
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
          {pending ? t.submitting : mode === "edit" ? t.saveChanges : t.submit}
        </button>

        <p className="hint" style={{ maxInlineSize: "34ch" }}>
          {username ? t.signedInAs(username) : t.signedOutNote}
        </p>
      </div>
    </form>
  );
}
