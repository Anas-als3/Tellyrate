import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * The directory is meant to be crawled — a student searching for a hospital by
 * name should find its reviews. Only the two areas with nothing to index are
 * excluded: the API surface, and anything behind an account.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
