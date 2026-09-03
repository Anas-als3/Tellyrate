"use client";

import { useEffect, useState } from "react";

export type Viewer = { username: string } | null;

/**
 * Who is signed in, fetched client-side.
 *
 * Reading the session cookie on the server would be simpler, but `cookies()`
 * anywhere in a layout opts that layout's entire subtree into per-request
 * rendering. That would mean /about and /privacy — pure static text — could
 * never be prerendered, and no CDN could serve a facility page from a point
 * of presence near the reader. For a site whose readers are overwhelmingly
 * anonymous and mostly in one country, that caching is worth more than
 * server-rendering the header's account link.
 *
 * The cost is a brief moment where a signed-in visitor sees the signed-out
 * controls. Anonymous visitors — nearly all of them — see the correct header
 * immediately and never see a shift.
 */
export function useViewer(): { viewer: Viewer; loaded: boolean } {
  const [viewer, setViewer] = useState<Viewer>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/me", { signal: controller.signal, credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : { username: null }))
      .then((data: { username: string | null }) => {
        setViewer(data.username ? { username: data.username } : null);
        setLoaded(true);
      })
      .catch(() => {
        // An aborted or failed request just leaves the signed-out header,
        // which is a safe default — every action behind it prompts to sign in.
        if (!controller.signal.aborted) setLoaded(true);
      });

    return () => controller.abort();
  }, []);

  return { viewer, loaded };
}
