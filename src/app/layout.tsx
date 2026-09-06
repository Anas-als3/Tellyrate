import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Hospirate — know where to train before you apply",
    template: "%s · Hospirate",
  },
  description:
    "Anonymous reviews of Saudi hospitals and clinics by the healthcare students who did their training year there — so you know which ones are worth applying to. No email, no real name, just a username.",
  applicationName: "Hospirate",
  openGraph: {
    type: "website",
    siteName: "Hospirate",
    title: "Hospirate",
    description:
      "Where Saudi healthcare students actually trained, and which hospitals are worth applying to.",
  },
  robots: { index: true, follow: true },
  // No verification tags, no analytics, no third-party anything.
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1513" },
  ],
};

/**
 * Applied before first paint so a dark-mode visitor never sees a white flash.
 * It only reads a value this site itself wrote, and touches nothing else.
 */
const themeScript = `
try {
  var t = localStorage.getItem("hospirate-theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
