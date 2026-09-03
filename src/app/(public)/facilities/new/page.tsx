import type { Metadata } from "next";
import Link from "next/link";
import { FacilitySearch } from "@/components/facility-search";
import { listCities } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

/**
 * Add a place.
 *
 * The page is mostly a search box, and that is the point: roughly every
 * hospital and clinic in the covered cities is already here from
 * OpenStreetMap, so the useful answer to "add a facility" is almost always
 * "here it is, go and review it".
 */

export const metadata: Metadata = {
  title: "Add a place",
  description:
    "Can't find the hospital or clinic you trained at? Search first — it is probably already listed — and add it if it genuinely isn't.",
  robots: { index: true, follow: true },
};

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NewFacilityPage({ searchParams }: PageProps) {
  const [params, user, cities] = await Promise.all([
    searchParams,
    getCurrentUser(),
    listCities(),
  ]);

  const rawQuery = params.q;
  const initialQuery = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? "";
  const next = encodeURIComponent("/facilities/new");

  return (
    // The `(public)` layout owns the `<main>` landmark; this is just the page.
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <div style={{ maxInlineSize: "52rem", marginInline: "auto" }}>
        <header style={{ display: "grid", gap: "var(--space-2xs)" }}>
          <p className="label">Missing a placement</p>
          <h1 style={{ fontSize: "var(--step-3)" }}>Add a place</h1>
          <p className="prose" style={{ color: "var(--ink-2)" }}>
            Most hospitals, clinics and health centres in the cities we cover are
            already listed. Search for yours first — if it is here, you can go
            straight to reviewing it.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gap: "var(--space-m)",
            marginBlock: "var(--space-l)",
          }}
        >
          {!user ? (
            <p className="notice">
              Searching is open to everyone. Adding a place needs an account —{" "}
              <Link href={`/login?next=${next}`}>sign in</Link> or{" "}
              <Link href={`/signup?next=${next}`}>create one</Link>. It is a
              username and a password; we never ask for an email.
            </p>
          ) : null}
        </div>

        <FacilitySearch
          cities={cities}
          initialQuery={initialQuery}
          signedIn={Boolean(user)}
        />

        <p
          className="hint"
          style={{
            marginBlockStart: "var(--space-xl)",
            paddingBlockStart: "var(--space-m)",
            borderBlockStart: "1px solid var(--line)",
          }}
        >
          Facility records come from OpenStreetMap and from students. If one is
          wrong, out of date or duplicated, say so from the facility&rsquo;s own
          page and a moderator will look at it.
        </p>
      </div>
    </div>
  );
}
