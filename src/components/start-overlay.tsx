"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  START_COOKIE,
  START_COOKIE_MAX_AGE_SECONDS,
  START_COOKIE_VALUE,
  startFieldMatches,
  startHref,
  startResultCount,
  type StartChoice,
  type StartCity,
  type StartField,
  type StartOptions,
  type StartRegion,
} from "@/lib/start";

/**
 * The first-run chooser — a directory board.
 *
 * Shown once, on a reader's first visit to the home page, and never again. It
 * asks what they study, which region, which city, and hands them the directory
 * already filtered to the answers. Every later visit is the ordinary site.
 *
 * The three questions are all on the board from the first frame: answered ones
 * collapse to a sign line that is also the button back to them, the open one
 * shows its options, and the ones still to come are stated but inert. So the
 * shape of the flow is visible before any of it is answered, and there is no
 * separate progress bar to keep in step with anything.
 *
 * Two structural decisions worth knowing before changing this file:
 *
 *   · It is a `<dialog>` promoted with `showModal()`. `.skip-link` already
 *     claims `z-index: 100`, so a positioned div would have to outbid it and
 *     would still lose to any future ancestor that creates a stacking context.
 *     The top layer sidesteps that, and supplies real inertness for the page
 *     behind, Escape, and focus restored on close — three things a hand-rolled
 *     modal in a codebase with no other modal would have nothing to check
 *     itself against.
 *
 *     It is rendered `open` from the server and promoted on mount, which buys
 *     a board that is in the first paint rather than one that pops in once
 *     React has hydrated. The cost is the window in between: for those few
 *     hundred milliseconds the dialog is open but not modal, so the page
 *     behind it is still focusable and Escape does nothing. Rendering it
 *     closed would trade a real flash on every first visit for that, and the
 *     flash is the worse of the two.
 *
 *   · Every string arrives finished. The dictionary's counted strings are
 *     functions, and a function cannot cross the server/client boundary, so
 *     the page renders them for the options that exist and passes them down.
 *     `showLabels` is the same trick for the button: the count it can show is
 *     one of the ~170 numbers already on the board, so all of them are
 *     rendered up front rather than shipping a pluraliser to the browser.
 */

/** Only plain strings: see the note above on why nothing here is a function. */
export type StartStrings = {
  eyebrow: string;
  lede: string;
  dialogLabel: string;
  dismiss: string;
  back: string;
  separator: string;
  /** "Field", "Region", "City" — the name of each row on the board. */
  stepNames: string[];
  /** "Step 2 of 3", rendered ahead of time; announced, never displayed. */
  stepLabels: string[];
  fieldHeading: string;
  fieldLede: string;
  fieldNothing: string;
  regionHeading: string;
  regionLede: string;
  cityLede: string;
  noteWithField: string;
  noteWithoutField: string;
  /** Never seen in practice; see the note where the button is rendered. */
  showFallback: string;
};

/**
 * The option shapes, each one the raw counts from `lib/start.ts` plus the
 * strings the server rendered for them. Written as intersections so the whole
 * object still satisfies `StartOptions` and can be handed straight to
 * `startHref` — one payload, not two copies of the same numbers.
 */
export type StartFieldView = StartField & {
  label: string;
  /** "110 experiences", or `fieldNothing` when there are none. */
  note: string;
};

export type StartRegionView = StartRegion & {
  label: string;
  /** "376 places". */
  note: string;
  /** "24 with Medicine", for the fields that have any. */
  fieldNotes: Record<string, string>;
  /** "Where in Riyadh?" */
  cityHeading: string;
  /** "Anywhere in Riyadh" */
  anywhereLabel: string;
};

export type StartCityView = StartCity & {
  label: string;
  note: string;
  fieldNotes: Record<string, string>;
};

export type StartView = {
  fields: StartFieldView[];
  regions: StartRegionView[];
  cities: StartCityView[];
};

/** How long the board takes to fade out; matches `.start--closing` in globals. */
const CLOSE_MS = 180;

export function StartOverlay({
  options,
  strings,
  showLabels,
}: {
  options: StartView;
  strings: StartStrings;
  /** Every count the button can show, already pluralised. Keyed by the count. */
  showLabels: Record<string, string>;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const promoted = useRef(false);

  const closeTimer = useRef<number | undefined>(undefined);

  /**
   * Whether this browser has already answered, read once per mount.
   *
   * Whether to render the board at all is decided on the server, and Next
   * keeps that answer in its client Router Cache. Pressing Back after
   * completing the flow replays the payload from before the cookie existed, so
   * the board returns on a browser that has already answered it — which is the
   * one thing this feature promises not to do.
   *
   * A `useState` initialiser rather than an effect or `useSyncExternalStore`:
   * it has to be read afresh on every mount (a cached module-level value would
   * still say "not answered" on the way back) but stay fixed within one mount,
   * because `remember()` flips the cookie mid-visit and the board must not
   * vanish from under the fade or the navigation it just started. On the
   * server it reads false, which is exactly what the server already decided.
   */
  const [answered] = useState(
    () =>
      typeof document !== "undefined" &&
      document.cookie
        .split("; ")
        .includes(`${START_COOKIE}=${START_COOKIE_VALUE}`),
  );

  const headingId = useId();

  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<StartChoice>({});
  const [closing, setClosing] = useState(false);
  const [gone, setGone] = useState(false);
  const [leaving, startLeaving] = useTransition();

  /**
   * The board is server-rendered `open`, so it is in the first paint rather
   * than popping in once React has hydrated. This promotes it to the top
   * layer. The close and the re-open happen in the same tick, so the browser
   * never gets a frame between them to paint.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || answered || promoted.current) return;
    promoted.current = true;
    if (dialog.open) dialog.close();
    dialog.showModal();
    // `answered` is fixed for the life of this mount; it is listed only
    // because the linter cannot know that.
  }, [answered]);

  // Focus follows the question, on open and on every move between them. The
  // heading is the anchor rather than the first option, so a screen-reader
  // user hears what is being asked before what the answers are.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    return () => window.clearTimeout(closeTimer.current);
  }, []);

  if (gone || answered) return null;

  const field = choice.field
    ? options.fields.find((f) => f.value === choice.field)
    : undefined;
  const region = choice.region
    ? options.regions.find((r) => r.slug === choice.region)
    : undefined;
  const city = choice.city
    ? options.cities.find((c) => c.slug === choice.city)
    : undefined;

  const heading =
    step === 0
      ? strings.fieldHeading
      : step === 1
        ? strings.regionHeading
        : (region?.cityHeading ?? strings.regionHeading);
  const lede =
    step === 0
      ? strings.fieldLede
      : step === 1
        ? strings.regionLede
        : strings.cityLede;

  const total = startResultCount(options, choice);
  const keepsField = startFieldMatches(options, choice) > 0;
  // Every count the button can show was rendered by the page and
  // `tests/start.test.ts` proves that enumeration exhaustive. The fallback is
  // there so that a future count escaping it degrades to a plainer button
  // rather than to a blank one.
  const showLabel = showLabels[String(total)] ?? strings.showFallback;

  /**
   * Remember that the question was put — not what was answered.
   *
   * Written the way the language switcher writes its own cookie, including the
   * conditional `secure`: the same build serves plain http on localhost, where
   * a `Secure` cookie is simply dropped.
   */
  function remember() {
    const parts = [
      `${START_COOKIE}=${START_COOKIE_VALUE}`,
      "path=/",
      `max-age=${START_COOKIE_MAX_AGE_SECONDS}`,
      "samesite=lax",
    ];
    if (window.location.protocol === "https:") parts.push("secure");
    try {
      document.cookie = parts.join("; ");
    } catch {
      // Cookies refused. The board comes back on the next visit, which is the
      // honest outcome — the choice cannot be remembered.
    }
  }

  // Dismissal counts as answered. A panel that returns after being waved away
  // is worse than one that was never shown.
  function dismiss() {
    // Escape reaches this twice — once as the dialog's own cancel, once
    // through the key handler that covers the moment before the dialog has
    // been promoted to a modal and has no cancel of its own. And once a
    // navigation has been committed to, the board stays up until it lands
    // rather than being torn away from underneath it.
    if (closing || leaving) return;
    remember();
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      // Closed, not merely removed. Unmounting an open modal drops it out of
      // the top layer without running the dialog's own closing steps, so focus
      // is never handed back to whatever the reader was on before it opened —
      // and focus restoration is one of the three reasons this is a `<dialog>`
      // at all.
      dialogRef.current?.close();
      setGone(true);
    }, CLOSE_MS);
  }

  function go() {
    if (leaving) return;
    remember();
    // The cookie is written first, synchronously: if the navigation won the
    // race the answer would be lost and the board would return next visit.
    startLeaving(() => router.push(startHref(options, choice)));
  }

  function pickField(value: string) {
    // A new field invalidates the place counts shown further down, so the
    // answers below it are cleared rather than carried into a different set.
    setChoice({ field: value });
    setStep(1);
  }

  function pickRegion(slug: string) {
    setChoice((current) => ({ field: current.field, region: slug }));
    setStep(2);
  }

  function pickCity(slug: string | undefined) {
    setChoice((current) => ({ ...current, city: slug }));
  }

  /**
   * Reopen an answered question, and drop everything answered under it.
   *
   * Without the drop, the board and the button disagree: pressing "Region" to
   * change it puts the city row back to "not answered yet" while the chosen
   * city is still in `choice`, so the button keeps counting a city the board
   * says has not been picked. Collapsing the levels below is also what the
   * board's own shape promises — a question reopens, the ones under it close.
   */
  function reopen(index: number) {
    setStep(index);
    if (index === 0) setChoice((current) => ({ field: current.field }));
    if (index === 1) {
      setChoice((current) => ({
        field: current.field,
        region: current.region,
      }));
    }
  }

  const citiesHere = region
    ? options.cities.filter((c) => c.region === region.key)
    : [];

  return (
    <>
      {/*
        With scripting off there is no way to answer any of this and no way to
        write the cookie that would stop it being asked again, so the board is
        removed rather than left as a wall across the home page. Nothing is
        lost: the directory, its filters and its sort are all plain links.
      */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: "<style>.start{display:none!important}</style>",
        }}
      />
      <dialog
        ref={dialogRef}
        open
        className={closing ? "start start--closing" : "start"}
        aria-label={strings.dialogLabel}
        // Escape, twice over. `cancel` is what a promoted modal fires, and the
        // default would close the dialog outright, taking the fade with it.
        // The key handler covers the window before promotion, when the board
        // is a plain open dialog that Escape does not reach at all.
        onCancel={(event) => {
          event.preventDefault();
          dismiss();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dismiss();
          }
        }}
      >
        {/* A real element rather than `::backdrop`: the palette lives on :root,
          and `::backdrop` only inherits from its originating element on recent
          engines — everywhere else `var(--scrim)` would quietly become the
          browser's own grey. Clicking it is the same as pressing Skip. */}
        <div className="start__scrim" onClick={dismiss} />

        <div className="start__board">
          <div className="start__head">
            <div className="start__eyebrow">
              <span className="label">{strings.eyebrow}</span>
              <button
                type="button"
                className="btn btn--quiet btn--small"
                style={{ marginInlineStart: "auto" }}
                onClick={dismiss}
              >
                {strings.dismiss}
              </button>
            </div>

            {/* Focused on open and on every move between questions, so a
                screen reader hears what is being asked before it hears the
                answers, and it names each option list below. Whether it shows
                a focus ring is decided in globals.css. */}
            <h2
              id={headingId}
              ref={headingRef}
              tabIndex={-1}
              style={{ fontSize: "var(--step-2)" }}
            >
              {heading}
            </h2>
            <p
              className="hint"
              style={{ marginBlockStart: "var(--space-2xs)" }}
            >
              {lede}
            </p>
            {step === 0 ? (
              <p
                className="hint"
                style={{ marginBlockStart: "var(--space-2xs)" }}
              >
                {strings.lede}
              </p>
            ) : null}
          </div>

          {/*
            Mounted with the board and rebuilt from the whole choice, not just
            from the step. Picking a city does not advance the board, so keying
            this on `step` alone would let the two facts the design rests on —
            whether the field filter survives, and how many places the button
            is about to show — change in silence for anyone not watching the
            screen. The destination page announces its own result count on
            arrival, so nothing here repeats that.
          */}
          <p role="status" className="sr-only">
            {[
              strings.stepLabels[step],
              heading,
              choice.field
                ? keepsField
                  ? strings.noteWithField
                  : strings.noteWithoutField
                : null,
              choice.field ? showLabel : null,
            ]
              .filter(Boolean)
              .join(strings.separator)}
          </p>

          <div className="start__levels">
            <Row
              index={0}
              step={step}
              name={strings.stepNames[0]}
              answer={field?.label}
              onReopen={() => reopen(0)}
            >
              <ul className="start__options" aria-labelledby={headingId}>
                {options.fields.map((option, i) => (
                  <li key={option.value}>
                    <Option
                      separator={strings.separator}
                      label={option.label}
                      note={
                        option.experiences > 0
                          ? option.note
                          : strings.fieldNothing
                      }
                      percent={share(
                        option.experiences,
                        maxExperiences(options),
                      )}
                      selected={choice.field === option.value}
                      index={i}
                      onSelect={() => pickField(option.value)}
                    />
                  </li>
                ))}
              </ul>
            </Row>

            <Row
              index={1}
              step={step}
              name={strings.stepNames[1]}
              answer={region?.label}
              onReopen={() => reopen(1)}
            >
              <ul className="start__options" aria-labelledby={headingId}>
                {options.regions.map((option, i) => (
                  <li key={option.slug}>
                    <Option
                      separator={strings.separator}
                      label={option.label}
                      note={option.note}
                      fieldNote={
                        choice.field
                          ? option.fieldNotes[choice.field]
                          : undefined
                      }
                      percent={share(
                        option.facilities,
                        maxFacilities(options.regions),
                      )}
                      selected={choice.region === option.slug}
                      index={i}
                      onSelect={() => pickRegion(option.slug)}
                    />
                  </li>
                ))}
              </ul>
            </Row>

            <Row
              index={2}
              step={step}
              name={strings.stepNames[2]}
              answer={city?.label}
              onReopen={() => reopen(2)}
            >
              <ul className="start__options" aria-labelledby={headingId}>
                {/* First, and always available: a region is a perfectly good
                  answer on its own, and in the thinner regions it is the only
                  one with anything behind it. */}
                <li>
                  <Option
                    separator={strings.separator}
                    label={region?.anywhereLabel ?? ""}
                    note={region?.note ?? ""}
                    fieldNote={
                      choice.field && region
                        ? region.fieldNotes[choice.field]
                        : undefined
                    }
                    percent={100}
                    selected={choice.city === undefined}
                    index={0}
                    onSelect={() => pickCity(undefined)}
                  />
                </li>
                {citiesHere.map((option, i) => (
                  <li key={option.slug}>
                    <Option
                      separator={strings.separator}
                      label={option.label}
                      note={option.note}
                      fieldNote={
                        choice.field
                          ? option.fieldNotes[choice.field]
                          : undefined
                      }
                      percent={share(
                        option.facilities,
                        region?.facilities ?? 0,
                      )}
                      selected={choice.city === option.slug}
                      index={i + 1}
                      onSelect={() => pickCity(option.slug)}
                    />
                  </li>
                ))}
              </ul>
            </Row>
          </div>

          {/* Nothing to say until a field has been chosen, and an empty strip
              with a rule across it reads as a broken footer rather than as an
              absent one. */}
          {step > 0 || choice.field ? (
            <div className="start__foot">
              {step > 0 ? (
                <button
                  type="button"
                  className="btn btn--quiet btn--small"
                  onClick={() => reopen(step - 1)}
                >
                  {strings.back}
                </button>
              ) : null}

              {choice.field ? (
                <>
                  <p className="start__note">
                    {keepsField
                      ? strings.noteWithField
                      : strings.noteWithoutField}
                  </p>
                  <button
                    type="button"
                    className="btn btn--primary start__cta"
                    onClick={go}
                    aria-disabled={leaving}
                  >
                    {showLabel}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

/**
 * One question on the board: open, answered, or still to come.
 *
 * Declared at module scope rather than inside `StartOverlay` — a component
 * defined during render is a new type on every render, which remounts its
 * whole subtree and is an error under this repo's lint rules.
 */
function Row({
  index,
  step,
  name,
  answer,
  onReopen,
  children,
}: {
  index: number;
  step: number;
  name: string;
  /** The chosen value, once there is one. */
  answer?: string;
  onReopen: () => void;
  children: React.ReactNode;
}) {
  if (index === step) {
    return <div className="start__row start__row--open">{children}</div>;
  }

  // Answered: the sign line is the answer, and pressing it is how you change
  // it. That is the back button, in the place the eye is already looking.
  if (answer !== undefined && index < step) {
    return (
      <div className="start__row">
        <button type="button" className="start__sign" onClick={onReopen}>
          <span className="label start__rowname">{name}</span>
          <bdi dir="auto">{answer}</bdi>
        </button>
      </div>
    );
  }

  return (
    <div className="start__row">
      <p className="start__pending">
        <span className="label start__rowname">{name}</span>
      </p>
    </div>
  );
}

/**
 * One option.
 *
 * A `<button aria-pressed>` rather than a radio in a radiogroup, which is the
 * other defensible reading of a one-of-N list. Two reasons. On the first two
 * questions a press advances the board immediately, so a radio's "2 of 13,
 * selected" is announcing a state that is already gone. And a radiogroup wants
 * roving tabindex with arrow-key navigation, where Left and Right have to swap
 * meaning under `dir="rtl"` — a direction bug waiting to happen in a component
 * that otherwise has none. The list is named by the question above it, and the
 * pressed state is announced, which is what a reader actually needs here.
 */
function Option({
  label,
  note,
  fieldNote,
  separator,
  percent,
  selected,
  index,
  onSelect,
}: {
  label: string;
  note: string;
  /** "24 with Medicine" — only where the chosen field has anything here. */
  fieldNote?: string;
  /** From the dictionary, so the two counts are joined the same way twice. */
  separator: string;
  percent: number;
  selected: boolean;
  /** Position in the list, used only to stagger the entrance. */
  index: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="start__option"
      aria-pressed={selected}
      onClick={onSelect}
      // Capped, so a twelve-item list has a tail of eight steps rather than
      // twelve. The global reduced-motion rule zeroes delays as well as
      // durations, so this disappears entirely for anyone who asked it to.
      style={{ animationDelay: `${Math.min(index, 8) * 14}ms` }}
    >
      <Marker active={selected} />
      <span className="start__label">
        {/* A city or region name may be in the other script; it must not
            reorder the reading beside it. */}
        <bdi dir="auto">{label}</bdi>
        <span
          style={{
            display: "block",
            fontSize: "var(--step--2)",
            fontWeight: 400,
            color: "var(--ink-3)",
          }}
        >
          {note}
          {/* Both numbers, never one instead of the other: how much is here at
              all, and how much of it is about the reader's own field. */}
          {fieldNote ? (
            <>
              {separator}
              <span style={{ color: "var(--brand-ink)", fontWeight: 600 }}>
                {fieldNote}
              </span>
            </>
          ) : null}
        </span>
      </span>
      <span className="start__reading">
        <GraduatedBar percent={percent} />
      </span>
    </button>
  );
}

/**
 * The facet marker from the filter rail, copied rather than imported: that
 * module reaches for the server-only dictionary and cannot enter a client
 * bundle. Kept identical on purpose — the mark that means "this filter is on"
 * in the directory should mean "chosen" here, because this board is the
 * directory's front door.
 */
function Marker({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: "0 0 auto",
        inlineSize: 11,
        blockSize: 11,
        borderRadius: 2,
        border: `1px solid ${active ? "var(--brand)" : "var(--line-strong)"}`,
        background: active ? "var(--brand)" : "transparent",
      }}
    />
  );
}

/**
 * The site's signature bar, at the size the option rows need it.
 *
 * Always `--tier-5`, never the tier ramp: that ramp is a quality scale, and
 * using it here would tell a reader that a city with few places is a badly
 * rated one. What this measures is volume.
 */
function GraduatedBar({ percent }: { percent: number }) {
  return (
    <span
      className="gbar gbar--mini"
      aria-hidden="true"
      style={
        {
          "--pct": `${Math.max(0, Math.min(100, percent))}%`,
          "--tier": "var(--tier-5)",
        } as React.CSSProperties
      }
    >
      <span className="gbar__fill" />
    </span>
  );
}

function share(value: number, largest: number): number {
  return largest > 0 ? (value / largest) * 100 : 0;
}

function maxExperiences(options: StartOptions): number {
  return options.fields.reduce((most, f) => Math.max(most, f.experiences), 0);
}

function maxFacilities(rows: Array<{ facilities: number }>): number {
  return rows.reduce((most, row) => Math.max(most, row.facilities), 0);
}
