"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Must match the key the pre-paint script in src/app/layout.tsx reads. */
const STORAGE_KEY = "hospirate-theme";

/**
 * What the page is showing right now — the explicit choice if there is one,
 * otherwise whatever the operating system asked for.
 */
function resolveTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "dark" || chosen === "light") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  // Null until mounted. The server cannot know which theme the browser
  // resolved, so guessing here would swap the icon during hydration.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(resolveTheme());

    // A visitor who has never pressed the button should keep following the OS,
    // including when it flips at sunset.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (!document.documentElement.dataset.theme) {
        setTheme(media.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  function toggle() {
    // Read the live value rather than state, so the button still does the
    // right thing if it is pressed before the effect has run.
    const next: Theme = resolveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing or a full quota — the theme still applies for this
      // page view, it just will not be remembered.
    }
    setTheme(next);
  }

  const label =
    theme === null
      ? "Switch colour theme"
      : `Switch to ${theme === "dark" ? "light" : "dark"} theme`;

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

/** The pre-mount placeholder: half-filled disc, committing to neither state. */
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
