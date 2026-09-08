"use client";

import { useEffect } from "react";

function scrollToLinkedReview(): "done" | "missing" {
  document
    .querySelector<HTMLElement>("[data-linked-review]")
    ?.removeAttribute("data-linked-review");

  let id: string;
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "done";
  }

  if (!id.startsWith("review-")) return "done";
  const target = document.getElementById(id);
  if (!target) return "missing";
  target.setAttribute("data-linked-review", "");
  target.scrollIntoView({ block: "start" });
  return "done";
}

/**
 * Hash navigation can run before a streamed review card reaches the DOM.
 * Observe a missing target until streaming finishes so shared links still land.
 */
export function ReviewHashScroller({ navigationKey }: { navigationKey: string }) {
  useEffect(() => {
    let observer: MutationObserver | undefined;

    const settleHash = () => {
      observer?.disconnect();
      observer = undefined;
      if (scrollToLinkedReview() === "done") return;

      observer = new MutationObserver(() => {
        if (scrollToLinkedReview() === "done") {
          observer?.disconnect();
          observer = undefined;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    const frame = window.requestAnimationFrame(settleHash);
    // The observer only exists while a streamed target is missing. Bound it
    // so a deleted or moderated review cannot leave a permanent DOM watcher.
    const timeout = window.setTimeout(() => observer?.disconnect(), 5_000);
    window.addEventListener("hashchange", settleHash);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer?.disconnect();
      window.removeEventListener("hashchange", settleHash);
    };
  }, [navigationKey]);

  return <span hidden aria-hidden="true" data-review-hash-scroller />;
}
