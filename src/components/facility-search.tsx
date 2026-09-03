"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createFacilityAction,
  type FacilityActionState,
} from "@/lib/actions/facilities";
import { FACILITY_KINDS, FACILITY_KIND_LABELS } from "@/lib/labels";

/**
 * "Add a facility", which is really "search for the facility, and add one only
 * if it is genuinely missing".
 *
 * Step one is a search, not a form. Every duplicate record in a review site
 * splits one place's reviews into two half-truths, and the moment when someone
 * is about to create a duplicate is the only moment you can cheaply stop it.
 * The disabled button here is a courtesy; the real enforcement is the signed
 * token the server demands, minted only by an actual search.
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

export function FacilitySearch({
  cities,
  initialQuery = "",
  signedIn,
}: {
  cities: SearchCity[];
  initialQuery?: string;
  signedIn: boolean;
}) {
  const router = useRouter();

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
          What&rsquo;s the facility called?
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
              Name
            </label>
            <input
              id="facility-query"
              className="input"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="King Fahad Medical City"
              aria-describedby="search-status"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="facility-city-filter">
              City
            </label>
            <select
              id="facility-city-filter"
              className="select"
              value={citySlug}
              onChange={(event) => setCitySlug(event.target.value)}
            >
              <option value="">Everywhere</option>
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
            ? "Type at least two letters. Almost every hospital and clinic in the country is already here."
            : searching
              ? "Searching…"
              : searchFailed
                ? "Search is not responding. Try again in a moment."
                : shown.length > 0
                  ? `${shown.length} ${shown.length === 1 ? "place" : "places"} match “${result?.query ?? trimmed}”.`
                  : `Nothing here matches “${result?.query ?? trimmed}”.`}
        </p>

        {shown.length > 0 ? (
          <div style={{ display: "grid", gap: "var(--space-xs)" }}>
            <h3 className="label" style={{ fontSize: "var(--step--2)" }}>
              Did you mean one of these?
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
                        {FACILITY_KIND_LABELS[candidate.kind] ?? "Facility"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{candidate.city.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {candidate.reviewCount === 0
                          ? "no reviews yet"
                          : `${candidate.reviewCount} ${candidate.reviewCount === 1 ? "review" : "reviews"}`}
                      </span>
                    </span>
                  </div>

                  <Link
                    className="btn btn--small"
                    href={`/facilities/${candidate.slug}/review`}
                  >
                    This is it →
                    <span className="sr-only"> — review {candidate.name}</span>
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
              None of these — add it
            </button>
            {!searchRan ? (
              <p className="hint" style={{ marginBlockStart: "var(--space-2xs)" }}>
                Search first. Adding a place that is already listed splits its
                reviews in two.
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
              Add it to Hospirate
            </h2>
            <p className="hint" style={{ marginBlockStart: "var(--space-2xs)" }}>
              New places stay off the directory listings until they have their
              first review, so nothing appears that nobody has been to.
            </p>
          </div>

          <div ref={alertRef} tabIndex={-1} style={{ outline: "none" }}>
            {state.status === "error" ? (
              <p className="notice notice--danger" role="alert">
                {state.message}
              </p>
            ) : null}

            {state.status === "auth" ? (
              <div className="notice notice--warn" role="alert">
                <strong>You need an account to add a place.</strong>
                <p style={{ marginBlockStart: "var(--space-2xs)" }}>
                  {state.message}
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
                    Create an account
                  </Link>
                  <Link
                    className="btn btn--small"
                    href={`/login?next=${searchNext}`}
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            ) : null}

            {state.status === "duplicate" ? (
              <div className="notice notice--warn" role="alert">
                <strong>{state.message}</strong>
                <p style={{ marginBlockStart: "var(--space-2xs)" }}>
                  <bdi dir="auto">{state.facility.name}</bdi>
                  {state.facility.nameLocal ? (
                    <>
                      {" — "}
                      <bdi dir="auto">{state.facility.nameLocal}</bdi>
                    </>
                  ) : null}{" "}
                  in {state.facility.cityName}, with{" "}
                  <span className="tnum">{state.facility.reviewCount}</span>{" "}
                  {state.facility.reviewCount === 1 ? "review" : "reviews"}.
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
                    That&rsquo;s the one — review it
                  </Link>
                  <Link
                    className="btn btn--small"
                    href={`/facilities/${state.facility.slug}`}
                  >
                    Look at it first
                  </Link>
                </p>
              </div>
            ) : null}

            {state.status === "created" ? (
              <p className="notice" role="status">
                {state.message} Taking you to its review page…
              </p>
            ) : null}
          </div>

          {!signedIn ? (
            <p className="notice">
              You will need an account to save this — a username and a password,
              no email.{" "}
              <Link href={`/login?next=${searchNext}`}>Sign in</Link> or{" "}
              <Link href={`/signup?next=${searchNext}`}>create one</Link>.
            </p>
          ) : null}

          <form action={formAction} style={{ display: "grid", gap: "var(--space-m)" }}>
            {/* Proof that a search ran; the action refuses the post without it. */}
            <input type="hidden" name="searchToken" value={searchToken ?? ""} />

            <div className="field">
              <label className="label" htmlFor="facility-name">
                Name — required
              </label>
              <input
                ref={nameRef}
                id="facility-name"
                name="name"
                className="input"
                type="text"
                required
                minLength={2}
                maxLength={120}
                defaultValue={query.trim()}
                aria-invalid={fieldErrors.name ? true : undefined}
              />
              {fieldErrors.name ? (
                <p className="error-text">{fieldErrors.name}</p>
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
                  City — required
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
                    Choose a city
                  </option>
                  {cities.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}, {city.country}
                    </option>
                  ))}
                </select>
                {fieldErrors.citySlug ? (
                  <p className="error-text">{fieldErrors.citySlug}</p>
                ) : null}
              </div>

              <div className="field">
                <label className="label" htmlFor="facility-kind">
                  Kind — required
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
                    Choose one
                  </option>
                  {FACILITY_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {FACILITY_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
                {fieldErrors.kind ? (
                  <p className="error-text">{fieldErrors.kind}</p>
                ) : null}
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="facility-name-local">
                Name in its own script — optional
              </label>
              <input
                id="facility-name-local"
                name="nameLocal"
                className="input"
                type="text"
                dir="auto"
                maxLength={120}
                placeholder="مدينة الملك فهد الطبية"
                aria-invalid={fieldErrors.nameLocal ? true : undefined}
              />
              <p className="hint">
                Helps the next person find it in whichever language they search.
              </p>
              {fieldErrors.nameLocal ? (
                <p className="error-text">{fieldErrors.nameLocal}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="facility-address">
                Street or district — optional
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
                <p className="error-text">{fieldErrors.address}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="facility-website">
                Website — optional
              </label>
              <input
                id="facility-website"
                name="website"
                className="input"
                type="url"
                inputMode="url"
                maxLength={300}
                placeholder="hospital.example.sa"
                aria-invalid={fieldErrors.website ? true : undefined}
              />
              {fieldErrors.website ? (
                <p className="error-text">{fieldErrors.website}</p>
              ) : null}
            </div>

            <p className="hint">
              We ask for nothing about you here — no phone number, no email, no
              contact person. A facility record is about a building, not a
              person.
            </p>

            <div style={{ display: "flex", gap: "var(--space-s)", flexWrap: "wrap" }}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={pending || !searchToken}
              >
                {pending ? "Adding…" : "Add this place"}
              </button>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setStep("search")}
              >
                Back to search
              </button>
            </div>

            {!searchToken ? (
              <p className="hint">
                Your search expired while this was open. Change the name above to
                run it again.
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
