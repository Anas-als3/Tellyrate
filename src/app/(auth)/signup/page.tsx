import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale, getT } from "@/lib/i18n/server";
import { safeRedirectPath } from "@/lib/net";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    title: t.auth.signUpTitle,
    description: t.auth.signUpMetaDescription,
    robots: { index: false, follow: false },
  };
}

/**
 * The two lists are stated before the form rather than after it. Someone about
 * to write about the department they are still rotating through deserves to
 * know exactly what the account holds before they type anything into it, not
 * on a policy page they would have to go looking for.
 */
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
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = getDictionary(locale);

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
        <h1 style={{ fontSize: "var(--step-3)" }}>{t.auth.signUpTitle}</h1>
        <p style={{ color: "var(--ink-2)" }}>{t.auth.signUpLede}</p>
      </div>

      <AuthForm
        mode="signup"
        next={next}
        locale={locale}
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
              {t.auth.accountHoldsHeading}
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-xs)",
              }}
            >
              <p className="label">{t.auth.weKeep}</p>
              <ItemList
                items={t.auth.stored}
                marker="+"
                markerColor="var(--brand)"
              />
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
              <p className="label">{t.auth.weNeverAsk}</p>
              <ItemList
                items={t.auth.notStored}
                marker="−"
                markerColor="var(--danger)"
              />
            </div>
          </section>
        }
        outro={
          <>
            <p className="notice notice--warn">{t.auth.recoveryWarning}</p>

            <p style={{ color: "var(--ink-2)" }}>
              {t.auth.alreadyHaveAccount}{" "}
              <Link href={signInHref}>{t.auth.signIn}</Link>.
            </p>
          </>
        }
      />
    </>
  );
}
