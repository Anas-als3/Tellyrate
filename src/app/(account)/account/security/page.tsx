import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ChangePasswordForm,
  DeleteAccountForm,
  SignOutEverywhereForm,
} from "@/components/auth-form";
import { prisma } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale, getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    title: t.account.securityMetaTitle,
    robots: { index: false, follow: false },
  };
}

function Section({
  id,
  title,
  children,
  tone = "normal",
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  tone?: "normal" | "danger";
}) {
  return (
    <section
      className="card"
      aria-labelledby={id}
      style={{
        padding: "var(--space-l)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-m)",
        borderInlineStart:
          tone === "danger" ? "3px solid var(--danger)" : undefined,
      }}
    >
      <h2 id={id} style={{ fontSize: "var(--step-2)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/account/security")}`);

  const [account, reviewCount, commentCount, locale] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { recoveryCodeHash: true, recoveryUsedAt: true },
    }),
    prisma.review.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
    getLocale(),
  ]);

  const t = getDictionary(locale);

  const hasRecoveryCode =
    account?.recoveryCodeHash != null && account.recoveryUsedAt == null;

  return (
    <>
      <nav className="tabs" aria-label={t.account.tabsLabel}>
        <Link className="tab" href="/account">
          {t.account.tabAccount}
        </Link>
        <Link className="tab" href="/account/security" aria-current="page">
          {t.account.tabSecurity}
        </Link>
      </nav>

      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2xs)",
        }}
      >
        <h1 style={{ fontSize: "var(--step-3)" }}>{t.account.securityHeading}</h1>
        <p style={{ color: "var(--ink-2)" }}>
          {t.account.securitySignedInAs}{" "}
          <bdi dir="auto">{user.username}</bdi>.
        </p>
      </header>

      <p className={hasRecoveryCode ? "notice" : "notice notice--warn"}>
        {hasRecoveryCode ? t.account.recoveryUnused : t.account.recoveryUsed}
      </p>

      <Section id="change-password" title={t.account.changePassword}>
        <p style={{ color: "var(--ink-2)" }}>{t.account.changePasswordBody}</p>
        <ChangePasswordForm locale={locale} />
      </Section>

      <Section id="sign-out-everywhere" title={t.account.signOutEverywhere}>
        <p style={{ color: "var(--ink-2)" }}>
          {t.account.signOutEverywhereBody}
        </p>
        <SignOutEverywhereForm locale={locale} />
      </Section>

      <Section id="delete-account" title={t.account.deleteAccount} tone="danger">
        <p style={{ color: "var(--ink-2)" }}>{t.account.deleteBody}</p>
        <p style={{ color: "var(--ink-2)" }}>
          {reviewCount + commentCount > 0
            ? t.account.deleteKeepsContent(reviewCount, commentCount)
            : t.account.deleteNothingPosted}
        </p>
        <DeleteAccountForm locale={locale} />
      </Section>
    </>
  );
}
