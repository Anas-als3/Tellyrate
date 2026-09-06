import type { MetadataRoute } from "next";
import { env, isProductionDeployment } from "@/lib/env";

/**
 * The directory is meant to be crawled — a student searching for a hospital by
 * name should find its reviews. Only the two areas with nothing to index are
 * excluded: the API surface, and anything behind an account.
 *
 * Staging is a different matter: it must never be indexed. A crawled staging
 * copy competes with the real site for the same searches, and puts test
 * reviews in front of students as though they were real. So every non-
 * production deployment refuses everything, and publishes no sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionDeployment) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_SITE_URL).toString(),
  };
}
