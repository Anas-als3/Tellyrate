import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

/**
 * The shell every readable page sits in.
 *
 * Deliberately does NOT read the session. `cookies()` in a layout opts the
 * whole subtree into per-request rendering, which would stop /about and
 * /privacy from being prerendered at all and stop any CDN from serving a
 * facility page near the reader. The header fetches the viewer itself.
 *
 * The locale cookie is a different matter: the root layout has to read it
 * before it can emit `<html dir>`, so the whole tree is already per-request
 * and reading it again here costs nothing. `cookies()` is memoised per
 * request, so this is the same read, not a second one.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minBlockSize: "100dvh",
      }}
    >
      {/* The header is a client component, so it is handed the strings it
          needs rather than reaching for the server-only dictionary itself. */}
      <SiteHeader
        locale={locale}
        nav={t.nav}
        language={t.common.language}
        theme={t.common.theme}
      />
      {/* The root layout's skip link points at this id. */}
      <main id="main" style={{ flex: "1 0 auto" }}>
        {children}
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
