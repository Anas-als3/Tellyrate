import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 *
 * The privacy promise of this site is that nothing you read or write here is
 * shared with anyone else, so the policy is written to make that structurally
 * true rather than merely intended: no third-party origin can be contacted at
 * all — no analytics, no font CDN, no map tiles, no embeds. Fonts are
 * self-hosted precisely so this line can stay `'self'`.
 *
 * `'unsafe-inline'` is present for scripts because the App Router emits inline
 * hydration payloads on every page. The alternative — per-request nonces from
 * middleware — would force every page to render dynamically and give up static
 * caching for a directory site that is overwhelmingly read traffic. The
 * residual risk is small here: there are no third-party scripts, and user text
 * is only ever rendered as text, never as HTML.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // React's development build uses eval() for debugging features such as
  // reconstructing cross-environment stacks. It never does in production, so
  // this relaxation is scoped to dev and the shipped policy stays strict.
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  // Would break nothing on localhost, but there is no reason to send it there.
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Never leak which facility page a reader came from.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Only over HTTPS. Sending it in development would be meaningless at best.
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the Docker deployment path.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        /**
         * The sitemap lists every published facility, so each request is a
         * full-table read. It cannot be prerendered — that would need a
         * database during `next build` — so let the CDN absorb the crawlers
         * instead. Six hours is far fresher than any crawler needs, and it
         * keeps a serverless database from being woken up by robots.
         */
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Font filenames are stable, so cache them for a year.
        source: "/fonts/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
