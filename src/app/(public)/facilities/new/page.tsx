import type { Metadata } from "next";
import Link from "next/link";
import { FacilitySearch } from "@/components/facility-search";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale, getT } from "@/lib/i18n/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();

  return {
    title: t.facilities.addPage.metaTitle,
    description: t.facilities.addPage.metaDescription,
    robots: { index: true, follow: true },
  };
}

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NewFacilityPage({ searchParams }: PageProps) {
  const [params, user, cities, locale] = await Promise.all([
    searchParams,
    getCurrentUser(),
    listCities(),
    getLocale(),
  ]);

  const t = getDictionary(locale);
  const add = t.facilities.addPage;

  const rawQuery = params.q;
  const initialQuery = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? "";
  const next = encodeURIComponent("/facilities/new");

  return (
    // The `(public)` layout owns the `<main>` landmark; this is just the page.
    <div className="page" style={{ paddingBlock: "var(--space-xl)" }}>
      <div style={{ maxInlineSize: "52rem", marginInline: "auto" }}>
        <header style={{ display: "grid", gap: "var(--space-2xs)" }}>
          <p className="label">{add.eyebrow}</p>
          <h1 style={{ fontSize: "var(--step-3)" }}>{add.heading}</h1>
          <p className="prose" style={{ color: "var(--ink-2)" }}>
            {add.lede}
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
              {add.signedOutPrefix}
              <Link href={`/login?next=${next}`}>{add.signIn}</Link>
              {add.or}
              <Link href={`/signup?next=${next}`}>{add.createOne}</Link>
              {add.signedOutSuffix}
            </p>
          ) : null}
        </div>

        <FacilitySearch
          cities={cities}
          locale={locale}
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
          {add.provenance}
        </p>
      </div>
    </div>
  );
}
