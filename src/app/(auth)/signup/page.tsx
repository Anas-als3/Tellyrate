import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { safeRedirectPath } from "@/lib/net";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "An account here is a username and a password. No email, no real name, no school.",
  robots: { index: false, follow: false },
};

/**
 * Stated before the form rather than after it. Someone about to write about
 * the department they are still rotating through deserves to know exactly what
 * the account holds before they type anything into it, not on a policy page
 * they would have to go looking for.
 */
const STORED = [
  "The username you invent — the only name attached to anything you post.",
  "Your password, as a scrypt hash. Nobody here can read it back.",
  "The date you joined, and the reviews, comments and votes you make.",
];

const NOT_STORED = [
  "Email address. There is no field for one and no way to add one.",
  "Real name, school, programme, or student number.",
  "Exact rotation dates — reviews record a year at most.",
  "Analytics, trackers, third-party fonts or scripts of any kind.",
];

function ItemList({
  items,
  marker,
  markerColor,
}: {
  items: string[];
  marker: string;
  markerColor: string;
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
      }}
    >
      {items.map((item) => (
        <li
          key={item}
          style={{
            display: "flex",
            gap: "var(--space-xs)",
            fontSize: "var(--step--1)",
            color: "var(--ink-2)",
          }}
        >
          <span aria-hidden="true" style={{ color: markerColor, fontWeight: 700 }}>
            {marker}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = typeof params.next === "string" ? params.next : undefined;
  const next = safeRedirectPath(raw, "/");

  // Not redirected away when signed in — see the note in `signUpAction`. The
  // form itself explains the situation instead, and the action refuses.
  const user = await getCurrentUser();

  const signInHref =
    next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
        }}
      >
        <h1 style={{ fontSize: "var(--step-3)" }}>Create an account</h1>
        <p style={{ color: "var(--ink-2)" }}>
          Two fields, and nothing that could be traced back to you.
        </p>
      </div>

      <AuthForm
        mode="signup"
        next={next}
        signedInAs={user?.username ?? null}
        intro={
          <section
            className="card"
            style={{
              padding: "var(--space-m)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-m)",
            }}
            aria-labelledby="collected-heading"
          >
            <h2 id="collected-heading" className="sr-only">
              What this account holds
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-xs)",
              }}
            >
              <p className="label">What we keep</p>
              <ItemList items={STORED} marker="+" markerColor="var(--brand)" />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-xs)",
                borderBlockStart: "1px solid var(--line)",
                paddingBlockStart: "var(--space-m)",
              }}
            >
              <p className="label">What we never ask for</p>
              <ItemList
                items={NOT_STORED}
                marker="−"
                markerColor="var(--danger)"
              />
            </div>
          </section>
        }
        outro={
          <>
            <p className="notice notice--warn">
              You will be shown a recovery code once, on the next screen. With
              no email on file it is the only way back in if you forget your
              password, so write it down before you go anywhere.
            </p>

            <p style={{ color: "var(--ink-2)" }}>
              Already have an account? <Link href={signInHref}>Sign in</Link>.
            </p>
          </>
        }
      />
    </>
  );
}
