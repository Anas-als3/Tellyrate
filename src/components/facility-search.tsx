"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createFacilityAction,
  type FacilityActionState,
} from "@/lib/actions/facilities";
import {
  getDictionary,
  lookup,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { FACILITY_KINDS } from "@/lib/labels";

/**
 * "Add a facility", which is really "search for the facility, and add one only
 * if it is genuinely missing".
 *
 * Step one is a search, not a form. Every duplicate record in a review site
 * splits one place's reviews into two half-truths, and the moment when someone
 * is about to create a duplicate is the only moment you can cheaply stop it.
 * The disabled button here is a courtesy; the real enforcement is the signed
 * token the server demands, minted only by an actual search.
 *
 * The dictionary is read here rather than handed down as props: the counts in
 * "3 places match" are only known after a fetch that happens on this side of
 * the boundary, and a plural function cannot be serialised across it.
 */

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

type Candidate = {
  slug: string;
  name: string;
  nameLocal: string | null;
  kind: string;
  reviewCount: number;
  ratingAvg: number;
  city: { name: string; slug: string };
};

type SearchResult = {
  /** Query plus city filter — a result is only current for both together. */
  key: string;
  query: string;
  candidates: Candidate[];
  token: string | null;
};

const searchKey = (query: string, citySlug: string) => `${citySlug}\u0000${query}`;

export type SearchCity = {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
};

const INITIAL_STATE: FacilityActionState = { status: "idle" };

/**
 * Text that came back from a server action.
 *
 * Those actions still answer in English and their strings have no dictionary
 * keys, so on an Arabic page this is foreign text inside a native sentence.
 * Tagging it lets a screen reader switch voice, and `bdi` keeps its trailing
 * punctuation from jumping to the wrong end of the line.
 */
function Server({ locale, text }: { locale: Locale; text: string }) {
  if (locale === "en") return <>{text}</>;
  return (
    <bdi lang="en" dir="ltr">
      {text}
    </bdi>
  );
}

export function FacilitySearch({
  cities,
  locale,
  initialQuery = "",
  signedIn,
}: {
  cities: SearchCity[];
  locale: Locale;
  initialQuery?: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const t = getDictionary(locale);
  const add = t.facilities.addPage;

  const [query, setQuery] = useState(initialQuery);
  const [citySlug, setCitySlug] = useState("");
  /**
   * One piece of state for one search, keyed by the exact query and city it
   * ran for. Splitting it into separate `candidates` / `token` / `loading`
   * pieces is how a type-ahead ends up showing one query's results under
   * another query's heading.
   */
  const [result, setResult] = useState<SearchResult | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [step, setStep] = useState<"search" | "create">("search");

  const [state, formAction, pending] = useActionState(
    createFacilityAction,
    INITIAL_STATE,
  );
  const nameRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const searchNext = encodeURIComponent("/facilities/new");
  // The one arrow on this screen points onward, which is leftward in Arabic.
  const forward = locale === "ar" ? "←" : "→";

  // Derived rather than stored: what is on screen is a function of the last
  // completed search and what is in the box right now, and holding that in
  // state would mean an effect that re-renders twice on every keystroke.
  const key = searchKey(trimmed, citySlug);
  const tooShort = trimmed.length < MIN_QUERY;
  const current = result?.key === key ? result : null;
  const shown = tooShort ? [] : (result?.candidates ?? []);
  const searchFailed = failedKey === key;
  const searching = !tooShort && !searchFailed && current === null;
  const searchToken = current?.token ?? null;

  // -- the search itself ---------------------------------------------------
  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (citySlug) params.set("city", citySlug);

        const response = await fetch(`/api/facilities/search?${params}`, {
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(String(response.status));

        const data: {
          candidates?: Candidate[];
          searchToken?: string | null;
        } = await response.json();

        setResult({
          key: searchKey(trimmed, citySlug),
          query: trimmed,
          candidates: data.candidates ?? [],
          token: data.searchToken ?? null,
        });
        setFailedKey(null);
      } catch (error) {
        // An aborted request is the normal case — the next keystroke won.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailedKey(searchKey(trimmed, citySlug));
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, citySlug]);

  useEffect(() => {
    if (state.status === "created") {
      router.push(state.href);
    }
  }, [state, router]);

  useEffect(() => {
    if (state.status !== "idle") alertRef.current?.focus();
  }, [state]);

  // A search must have completed for exactly what is in the box before adding
  // a new record is offered: enabling it off a stale result would let someone
  // search one name, type another, and add a duplicate of a place they never
  // looked for.
  const searchRan = !tooShort && searchToken !== null;

  const fieldErrors: Record<string, string> =
    state.status === "error" ? state.fieldErrors : {};

  return (
    <div style={{ display: "grid", gap: "var(--space-l)" }}>
      {/* -- step 1 --------------------------------------------------------- */}
      <section
        aria-labelledby="search-heading"
        style={{ display: "grid", gap: "var(--space-s)" }}
      >
        <h2 id="search-heading" style={{ fontSize: "var(--step-2)" }}>
          {add.searchLabel}
        </h2>

        <div
          style={{
            display: "grid",
            gap: "var(--space-s)",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
            alignItems: "end",
          }}
        >
          <div className="field">
            <label className="label" htmlFor="facility-query">
              {t.facilities.searchFieldLabel}
            </label>
            <input
              id="facility-query"
              className="input"
              type="search"
              // Facility names are as often Arabic as Latin, so the box
              // follows whatever is typed into it rather than the interface.
              dir="auto"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={add.searchPlaceholder}
              aria-describedby="search-status"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="facility-city-filter">
              {add.cityFilterLabel}
            </label>
            <select
              id="facility-city-filter"
              className="select"
              value={citySlug}
              onChange={(event) => setCitySlug(event.target.value)}
            >
              <option value="">{add.everywhere}</option>
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p id="search-status" className="hint" role="status">
          {tooShort
            ? add.typeMore
            : searching
              ? add.searching
              : searchFailed
                ? add.searchFailed
                : shown.length > 0
                  ? add.matches(shown.length, result?.query ?? trimmed)
                  : add.noMatches(result?.query ?? trimmed)}
        </p>

        {shown.length > 0 ? (
          <div style={{ display: "grid", gap: "var(--space-xs)" }}>
            <h3 className="label" style={{ fontSize: "var(--step--2)" }}>
              {t.facilities.resultsHeading}
            </h3>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: "var(--space-xs)",
              }}
            >
              {shown.map((candidate) => (
                <li
                  key={candidate.slug}
                  className="card"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-s)",
                    padding: "var(--space-s) var(--space-m)",
                  }}
                >
                  <div style={{ display: "grid", gap: "var(--space-3xs)" }}>
                    <Link
                      href={`/facilities/${candidate.slug}`}
                      style={{ fontWeight: 600 }}
                    >
                      <bdi dir="auto">{candidate.name}</bdi>
                    </Link>
                    {candidate.nameLocal ? (
                      <bdi
                        dir="auto"
                        style={{
                          fontSize: "var(--step--1)",
                          color: "var(--ink-3)",
                        }}
                      >
                        {candidate.nameLocal}
                      </bdi>
                    ) : null}
                    <span
                      className="hint tnum"
                      style={{ display: "flex", gap: "var(--space-2xs)" }}
                    >
                      <span>
                        {lookup(
                          t.labels.facilityKind,
                          candidate.kind,
                          t.labels.facilityFallback,
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{candidate.city.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {candidate.reviewCount === 0
                          ? t.common.noReviewsYet
                          : t.common.reviewCount(candidate.reviewCount)}
                      </span>
                    </span>
                  </div>

                  <Link
                    className="btn btn--small"
                    href={`/facilities/${candidate.slug}/review`}
                    // Five identical "Review it" links in a row are useless in
                    // a links list; the name is what tells them apart.
                    aria-label={`${add.reviewIt}${t.common.separator}${candidate.name}`}
                  >
                    {add.reviewIt} <span aria-hidden="true">{forward}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === "search" ? (
          <div>
            <button
              type="button"
              className="btn"
              disabled={!searchRan}
              onClick={() => {
                setStep("create");
                // Focus follows the step change, or a keyboard user is left
                // at the bottom of a search box that no longer matters.
                window.setTimeout(() => nameRef.current?.focus(), 0);
              }}
            >
              {add.noneOfThese}
            </button>
            {!searchRan ? (
              <p className="hint" style={{ marginBlockStart: "var(--space-2xs)" }}>
                {add.searchFirst}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* -- step 2 --------------------------------------------------------- */}
      {step === "create" ? (
        <section
          aria-labelledby="create-heading"
          className="card"
          style={{ padding: "var(--space-l)", display: "grid", gap: "var(--space-m)" }}
        >
          <div>
            <h2 id="create-heading" style={{ fontSize: "var(--step-2)" }}>
              {add.createHeading}
            </h2>
            <p className="hint" style={{ marginBlockStart: "var(--space-2xs)" }}>
              {add.createHint}
            </p>
          </div>

          <div ref={alertRef} tabIndex={-1} style={{ outline: "none" }}>
            {state.status === "error" ? (
              <p className="notice notice--danger" role="alert">
                <Server locale={locale} text={state.message} />
              </p>
            ) : null}

            {state.status === "auth" ? (
              <div className="notice notice--warn" role="alert">
                <strong>{add.needAccount}</strong>
                <p style={{ marginBlockStart: "var(--space-2xs)" }}>
                  <Server locale={locale} text={state.message} />
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
                    href={`/signup?next=${searchNext}`}
                  >
                    {add.createOne}
                  </Link>
                  <Link
                    className="btn btn--small"
                    href={`/login?next=${searchNext}`}
                  >
                    {add.signIn}
                  </Link>
                </p>
              </div>
            ) : null}

            {state.status === "duplicate" ? (
              <div className="notice notice--warn" role="alert">
                <strong>
                  <Server locale={locale} text={state.message} />
                </strong>
                <p style={{ marginBlockStart: "var(--space-2xs)" }}>
                  <bdi dir="auto">{state.facility.name}</bdi>
                  {state.facility.nameLocal ? (
                    <>
                      {" — "}
                      <bdi dir="auto">{state.facility.nameLocal}</bdi>
                    </>
                  ) : null}{" "}
                  {add.duplicateIn(state.facility.cityName)}{" "}
                  <span className="tnum">
                    {t.common.reviewCount(state.facility.reviewCount)}
                  </span>
                  .
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
                    href={`/facilities/${state.facility.slug}/review`}
                  >
                    {add.thatsTheOne}
                  </Link>
                  <Link
                    className="btn btn--small"
                    href={`/facilities/${state.facility.slug}`}
                  >
                    {add.lookFirst}
                  </Link>
                </p>
              </div>
            ) : null}

            {state.status === "created" ? (
              <p className="notice" role="status">
                <Server locale={locale} text={state.message} /> {add.createdRedirect}
              </p>
            ) : null}
          </div>

          {!signedIn ? (
            <p className="notice">
              {add.needAccountToSave}{" "}
              <Link href={`/login?next=${searchNext}`}>
                {t.reviewForm.signIn}
              </Link>
              {add.or}
              <Link href={`/signup?next=${searchNext}`}>{add.createOne}</Link>.
            </p>
          ) : null}

          <form action={formAction} style={{ display: "grid", gap: "var(--space-m)" }}>
            {/* Proof that a search ran; the action refuses the post without it. */}
            <input type="hidden" name="searchToken" value={searchToken ?? ""} />

            <div className="field">
              <label className="label" htmlFor="facility-name">
                {add.nameLabel}
              </label>
              <input
                ref={nameRef}
                id="facility-name"
                name="name"
                className="input"
                type="text"
                dir="auto"
                required
                minLength={2}
                maxLength={120}
                defaultValue={query.trim()}
                aria-invalid={fieldErrors.name ? true : undefined}
              />
              {fieldErrors.name ? (
                <p className="error-text">
                  <Server locale={locale} text={fieldErrors.name} />
                </p>
              ) : null}
            </div>

            <div
              style={{
                display: "grid",
                gap: "var(--space-m)",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <div className="field">
                <label className="label" htmlFor="facility-city">
                  {add.cityLabel}
                </label>
                <select
                  id="facility-city"
                  name="citySlug"
                  className="select"
                  required
                  defaultValue={citySlug}
                  aria-invalid={fieldErrors.citySlug ? true : undefined}
                >
                  <option value="" disabled>
                    {add.chooseCity}
                  </option>
                  {cities.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                      {t.common.separator}
                      {city.country}
                    </option>
                  ))}
                </select>
                {fieldErrors.citySlug ? (
                  <p className="error-text">
                    <Server locale={locale} text={fieldErrors.citySlug} />
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label className="label" htmlFor="facility-kind">
                  {add.kindLabel}
                </label>
                <select
                  id="facility-kind"
                  name="kind"
                  className="select"
                  required
                  defaultValue=""
                  aria-invalid={fieldErrors.kind ? true : undefined}
                >
                  <option value="" disabled>
                    {add.chooseKind}
                  </option>
                  {FACILITY_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {lookup(
                        t.labels.facilityKind,
                        kind,
                        t.labels.facilityFallback,
                      )}
                    </option>
                  ))}
                </select>
                {fieldErrors.kind ? (
                  <p className="error-text">
                    <Server locale={locale} text={fieldErrors.kind} />
                  </p>
                ) : null}
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="facility-name-local">
                {add.nameLocalLabel}
              </label>
              <input
                id="facility-name-local"
                name="nameLocal"
                className="input"
                type="text"
                dir="auto"
                maxLength={120}
                placeholder={add.nameLocalPlaceholder}
                aria-invalid={fieldErrors.nameLocal ? true : undefined}
              />
              <p className="hint">{add.nameLocalHint}</p>
              {fieldErrors.nameLocal ? (
                <p className="error-text">
                  <Server locale={locale} text={fieldErrors.nameLocal} />
                </p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="facility-address">
                {add.addressLabel}
              </label>
              <input
                id="facility-address"
                name="address"
                className="input"
                type="text"
                dir="auto"
                maxLength={200}
                aria-invalid={fieldErrors.address ? true : undefined}
              />
              {fieldErrors.address ? (
                <p className="error-text">
                  <Server locale={locale} text={fieldErrors.address} />
                </p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="facility-website">
                {t.facility.website} — {t.common.optional}
              </label>
              <input
                id="facility-website"
                name="website"
                className="input"
                type="url"
                // A URL has no right-to-left reading, and letting it inherit
                // the page direction puts the scheme on the wrong side.
                dir="ltr"
                inputMode="url"
                maxLength={300}
                placeholder="hospital.example.sa"
                aria-invalid={fieldErrors.website ? true : undefined}
              />
              {fieldErrors.website ? (
                <p className="error-text">
                  <Server locale={locale} text={fieldErrors.website} />
                </p>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: "var(--space-s)", flexWrap: "wrap" }}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={pending || !searchToken}
              >
                {pending ? add.submitting : add.submit}
              </button>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setStep("search")}
              >
                {t.common.back}
              </button>
            </div>

            {!searchToken ? <p className="hint">{add.searchFirst}</p> : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
