import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EnvironmentBanner } from "@/components/environment-banner";
import {
  LOCALE_DIR,
  OG_LOCALES,
  getDictionary,
} from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Locale-aware, so `generateMetadata` rather than a static `metadata` export.
 *
 * Both languages share one URL, so there is no `alternates.languages` to
 * declare: there is no second address to point a crawler at. That is the cost
 * of the cookie-based design, and it is stated in lib/i18n/server.ts.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t.common.meta.defaultTitle,
      template: t.common.meta.titleTemplate,
    },
    description: t.common.meta.description,
    applicationName: t.common.siteName,
    openGraph: {
      type: "website",
      siteName: t.common.siteName,
      title: t.common.meta.ogTitle,
      description: t.common.meta.ogDescription,
      locale: OG_LOCALES[locale],
    },
    robots: { index: true, follow: true },
    // No verification tags, no analytics, no third-party anything.
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfafa" },
    { media: "(prefers-color-scheme: dark)", color: "#121011" },
  ],
};

/**
 * Applied before first paint so a dark-mode visitor never sees a white flash.
 * It only reads a value this site itself wrote, and touches nothing else.
 */
const themeScript = `
try {
  var t = localStorage.getItem("tellyrate-theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    // Direction is set here and nowhere else. Every rule in the stylesheet is
    // written in logical properties, so flipping this attribute mirrors the
    // whole interface without a single physical property changing hands.
    <html lang={locale} dir={LOCALE_DIR[locale]} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Only the Latin faces are preloaded; Arabic loads on demand
            through unicode-range when a page actually contains it. */}
        <link
          rel="preload"
          href="/fonts/archivo-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/literata-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* On an Arabic page the Arabic face is not "on demand" — it is the
            first glyph on screen, so it is worth the same head start. */}
        {locale === "ar" ? (
          <link
            rel="preload"
            href="/fonts/noto-sans-arabic-var.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body>
        {/* Above everything, including the skip link: whoever lands here needs
            to know it is not the live site before they act on anything. */}
        <EnvironmentBanner />
        <a className="skip-link" href="#main">
          {t.common.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
