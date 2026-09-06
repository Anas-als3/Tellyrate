import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale, getT } from "@/lib/i18n/server";
import { safeRedirectPath } from "@/lib/net";
import { getCurrentUser } from "@/lib/session";

/**
 * The title and description follow the locale cookie, so they cannot be a
 * static `metadata` export any more.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    title: t.auth.signInTitle,
    description: t.auth.signInMetaDescription,
    // Nothing here is worth a search result, and a crawled sign-in form is only
    // ever a source of accidental `?next=` URLs.
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = typeof params.next === "string" ? params.next : undefined;
  const next = safeRedirectPath(raw, "/");

  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (user) redirect(next);

  const t = getDictionary(locale);

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
        <h1 style={{ fontSize: "var(--step-3)" }}>{t.auth.signInTitle}</h1>
        <p style={{ color: "var(--ink-2)" }}>{t.auth.signInLede}</p>
      </div>

      <AuthForm
        mode="login"
        next={next}
        locale={locale}
        outro={
          <>
            <p className="notice notice--warn">{t.auth.signInNoReset}</p>

            <p style={{ color: "var(--ink-2)" }}>
              {t.auth.noAccountYet}{" "}
              <Link href={signUpHref}>{t.auth.createOne}</Link>
              {t.auth.createOneSuffix}
            </p>
          </>
        }
      />
    </>
  );
}
