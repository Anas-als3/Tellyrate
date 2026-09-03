"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundaries have to be Client Components — React needs to re-render
 * this subtree in the browser after `reset()`.
 *
 * The message itself is never shown. In production Next replaces it with a
 * generic string anyway, and a stack trace on screen would only tell a visitor
 * things about the server that are none of their business. The digest is
 * shown, because it is the one token that lets a report be matched to a line
 * in the server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Stays in the browser console — there is no error-reporting service to
    // send it to, and there is not going to be one.
    console.error(error);
  }, [error]);

  return (
    <div className="page" style={{ paddingBlock: "var(--space-3xl)" }}>
      <section
        aria-labelledby="error-title"
        style={{ maxInlineSize: "var(--measure)" }}
      >
        <p className="label">Error</p>
        <h1
          id="error-title"
          style={{
            fontSize: "var(--step-4)",
            marginBlockStart: "var(--space-xs)",
          }}
        >
          Something broke on our side
        </h1>
        <p
          className="prose"
          style={{ marginBlockStart: "var(--space-m)", color: "var(--ink-2)" }}
        >
          This page failed to render. Nothing you were reading or writing was
          sent anywhere, and trying again often works — most failures of this
          kind are a database connection that dropped for a second.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-xs)",
            marginBlockStart: "var(--space-l)",
          }}
        >
          <button type="button" className="btn btn--primary" onClick={reset}>
            Try again
          </button>
          <Link className="btn" href="/facilities">
            Browse facilities
          </Link>
          <Link className="btn btn--quiet" href="/">
            Home
          </Link>
        </div>

        {error.digest ? (
          <p
            className="stamp"
            style={{ marginBlockStart: "var(--space-xl)" }}
          >
            Reference {error.digest}
          </p>
        ) : null}
      </section>
    </div>
  );
}
