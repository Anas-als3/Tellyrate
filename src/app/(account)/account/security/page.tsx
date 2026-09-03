import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ChangePasswordForm,
  DeleteAccountForm,
  SignOutEverywhereForm,
} from "@/components/auth-form";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Password and account",
  robots: { index: false, follow: false },
};

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

  const [account, reviewCount, commentCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { recoveryCodeHash: true, recoveryUsedAt: true },
    }),
    prisma.review.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id } }),
  ]);

  const hasRecoveryCode =
    account?.recoveryCodeHash != null && account.recoveryUsedAt == null;

  return (
    <>
      <nav className="tabs" aria-label="Account">
        <Link className="tab" href="/account">
          Account
        </Link>
        <Link className="tab" href="/account/security" aria-current="page">
          Security
        </Link>
      </nav>

      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2xs)",
        }}
      >
        <h1 style={{ fontSize: "var(--step-3)" }}>Password and account</h1>
        <p style={{ color: "var(--ink-2)" }}>
          Signed in as <bdi dir="auto">{user.username}</bdi>.
        </p>
      </header>

      <p className={hasRecoveryCode ? "notice" : "notice notice--warn"}>
        {hasRecoveryCode
          ? "Your recovery code is still unused. It is the only way back into " +
            "this account if you forget your password, so keep it somewhere " +
            "you will find it again."
          : "This account has no unused recovery code left. If you forget " +
            "your password there is no way back in — there is no email to " +
            "reset with."}
      </p>

      <Section id="change-password" title="Change password">
        <p style={{ color: "var(--ink-2)" }}>
          Changing it signs out every other device. This one stays signed in.
        </p>
        <ChangePasswordForm />
      </Section>

      <Section id="sign-out-everywhere" title="Sign out everywhere">
        <p style={{ color: "var(--ink-2)" }}>
          Ends every session, including this one — the right move if you left
          yourself signed in on a ward computer. Your password does not change,
          so you can sign straight back in.
        </p>
        <SignOutEverywhereForm />
      </Section>

      <Section id="delete-account" title="Delete account" tone="danger">
        <p style={{ color: "var(--ink-2)" }}>
          Your account, your password hash and your votes are deleted outright
          and cannot be restored.
        </p>
        <p style={{ color: "var(--ink-2)" }}>
          {reviewCount + commentCount > 0 ? (
            <>
              Your{" "}
              <strong className="tnum">
                {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </strong>{" "}
              and{" "}
              <strong className="tnum">
                {commentCount} {commentCount === 1 ? "comment" : "comments"}
              </strong>{" "}
              stay up, unattributed — they will read as{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>@deleted</span>.
              Other students are relying on them, and pulling them would quietly
              rewrite the ratings they helped build.
            </>
          ) : (
            <>
              You have not posted anything, so nothing will be left behind. Had
              you posted, the text would stay up without your name on it.
            </>
          )}
        </p>
        <DeleteAccountForm />
      </Section>
    </>
  );
}
