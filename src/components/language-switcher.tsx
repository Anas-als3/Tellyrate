"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * Must match `LOCALE_COOKIE` in src/lib/i18n/dictionaries.ts.
 *
 * Duplicated rather than imported: importing that module here would pull both
 * complete dictionaries into the client bundle for the sake of one string.
 * The `Locale` type above is erased at compile time and costs nothing.
 */
const LOCALE_COOKIE = "tellyrate-locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const DIR: Record<Locale, "ltr" | "rtl"> = { en: "ltr", ar: "rtl" };

/**
 * Switches the interface language.
 *
 * Shows the language it would switch *to*, the way the theme toggle beside it
 * shows the theme it would switch to — one control, one obvious outcome, and
 * no second row of chrome in a header that is already tight on a phone.
 */
export function LanguageSwitcher({
  locale,
  label,
  targetName,
  className = "btn btn--quiet btn--small",
}: {
  locale: Locale;
  /** The accessible name, written in the language of the page it sits on. */
  label: string;
  /** The other language, named in its own script — what the button says. */
  targetName: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const target: Locale = locale === "en" ? "ar" : "en";

  function switchLanguage() {
    const parts = [
      `${LOCALE_COOKIE}=${target}`,
      "path=/",
      `max-age=${ONE_YEAR_SECONDS}`,
      "samesite=lax",
    ];
    // Not hard-coded: the same build serves http on localhost, and a `Secure`
    // cookie there would simply be dropped.
    if (window.location.protocol === "https:") parts.push("secure");

    try {
      document.cookie = parts.join("; ");
    } catch {
      // Cookies refused. The refresh below will come back in the old language,
      // which is the honest outcome — the choice cannot be remembered.
    }

    // Applied here as well as on the server so the page turns around
    // immediately instead of after the round trip. The refresh renders the
    // same two values, so React reconciles onto what is already there.
    document.documentElement.lang = target;
    document.documentElement.dir = DIR[target];

    // `router.refresh()` re-renders the server components in place; a reload
    // would throw away the scroll position and everything below the fold.
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      className={className}
      aria-label={label}
      title={label}
      // Pressing it twice while the first refresh is in flight would write the
      // cookie back to where it started.
      disabled={pending}
      style={{
        // `.btn` is an inline-flex item, so inside the header's flex row it
        // would otherwise shrink to its 34px floor and clip "العربية".
        flexShrink: 0,
        minInlineSize: 34,
        blockSize: 34,
        minBlockSize: 34,
        paddingInline: "var(--space-2xs)",
        fontSize: "var(--step--1)",
        fontWeight: 600,
        color: "var(--ink-2)",
        whiteSpace: "nowrap",
      }}
    >
      {/* The name is in the target language, so it is tagged as such: it picks
          the right face through unicode-range and is read out correctly. */}
      <span lang={target}>{targetName}</span>
    </button>
  );
}
