import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * The privacy promise of this site is that nothing you read or write here is
 * shared with anyone else, so the policy is written to make that structurally
 * true rather than merely intended: no third-party origin can be contacted at
 * all — no analytics, no font CDN, no embeds.
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
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
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
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the Docker deployment path.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
