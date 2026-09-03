import Link from "next/link";
import type { ReactNode } from "react";

type Action = { href: string; label: string };

/**
 * What a reader sees when a filter combination matches nothing.
 *
 * The important part is not the apology, it is the exit. An empty result is
 * the moment a reader has told us the name of a place we do not have yet, so
 * "add it" is a primary action here and nowhere else on the page.
 */
export function EmptyState({
  title,
  children,
  primary,
  secondary,
}: {
  title: string;
  children?: ReactNode;
  primary?: Action;
  secondary?: Action;
}) {
  return (
    <div
      className="card"
      style={{
        display: "grid",
        justifyItems: "center",
        gap: "var(--space-s)",
        padding: "var(--space-2xl) var(--space-m)",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: "var(--step-1)", margin: 0 }}>{title}</h2>

      {children ? (
        <div
          style={{
            color: "var(--ink-2)",
            fontSize: "var(--step--1)",
            maxInlineSize: "46ch",
          }}
        >
          {children}
        </div>
      ) : null}

      {primary || secondary ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "var(--space-xs)",
            marginBlockStart: "var(--space-2xs)",
          }}
        >
          {primary ? (
            <Link className="btn btn--primary" href={primary.href}>
              {primary.label}
            </Link>
          ) : null}
          {secondary ? (
            <Link className="btn" href={secondary.href}>
              {secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
