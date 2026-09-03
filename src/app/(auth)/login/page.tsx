import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { safeRedirectPath } from "@/lib/net";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in with the username and password you chose. No email is involved.",
  // Nothing here is worth a search result, and a crawled sign-in form is only
  // ever a source of accidental `?next=` URLs.
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = typeof params.next === "string" ? params.next : undefined;
  const next = safeRedirectPath(raw, "/");

  const user = await getCurrentUser();
  if (user) redirect(next);

  // Carry the destination across, but drop it when it is just the home page so
  // the sign-up link has one canonical form.
  const signUpHref =
    next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
        }}
      >
        <h1 style={{ fontSize: "var(--step-3)" }}>Sign in</h1>
        <p style={{ color: "var(--ink-2)" }}>
          To post a review, comment, or vote. Reading needs nothing.
        </p>
      </div>

      <AuthForm
        mode="login"
        next={next}
        outro={
          <>
            <p className="notice notice--warn">
              There is no email attached to your account, so there is nothing
              for us to send a reset link to. If you have lost both your
              password and your recovery code, the account cannot be reopened —
              by us or by anyone.
            </p>

            <p style={{ color: "var(--ink-2)" }}>
              No account yet? <Link href={signUpHref}>Create one</Link> — it
              takes a username and a password.
            </p>
          </>
        }
      />
    </>
  );
}
