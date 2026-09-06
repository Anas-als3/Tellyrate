"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/** Must match the key the pre-paint script in src/app/layout.tsx reads. */
/**
 * Passed in rather than read from `getT()`: this is a client component, and
 * `@/lib/i18n/server` must not enter the client bundle.
 */
export type ThemeStrings = {
  switchUnknown: string;
  switchToLight: string;
  switchToDark: string;
};

const STORAGE_KEY = "tellyrate-theme";

/**
 * The theme is not React state — it lives on the document element, was applied
 * before React existed on the page, and can change without React's help when
 * the operating system flips at sunset. So it is read as an external store.
 */
const listeners = new Set<() => void>();
let snapshot: Theme | null = null;

function readTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "dark" || chosen === "light") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function publish() {
  snapshot = null;
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // A visitor who has never pressed the button keeps following the OS.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", publish);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) media.removeEventListener("change", publish);
  };
}

function getSnapshot(): Theme {
  if (snapshot === null) snapshot = readTheme();
  return snapshot;
}

/**
 * The server cannot know what the browser resolved, so it renders a neutral
 * icon. React re-reads the real value straight after hydration, which keeps
 * the first paint free of a mismatch and free of a flash.
 */
function getServerSnapshot(): null {
  return null;
}

export function ThemeToggle({ strings }: { strings: ThemeStrings }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    // Read the document rather than the snapshot, so the button behaves
    // correctly even if it is pressed before hydration has settled.
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing or a full quota: the theme still applies to this page
      // view, it just will not be remembered.
    }
    publish();
  }

  const label =
    theme === null
      ? strings.switchUnknown
      : theme === "dark"
        ? strings.switchToLight
        : strings.switchToDark;

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn--quiet btn--small"
      aria-label={label}
      title={label}
      style={{
        inlineSize: 34,
        minInlineSize: 34,
        blockSize: 34,
        minBlockSize: 34,
        padding: 0,
        color: "var(--ink-2)",
      }}
    >
      {theme === null ? (
        <ContrastIcon />
      ) : theme === "dark" ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  );
}

const iconProps = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** The pre-hydration placeholder: a half-filled disc, committing to neither. */
function ContrastIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.6 8.6 0 1 0 10.6 10.6z" />
    </svg>
  );
}
