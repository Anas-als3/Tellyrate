import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * One sitemap file may hold 50,000 URLs. Staying under that with room to spare
 * means the whole directory fits in a single document, which is simpler for
 * crawlers than a sitemap index — and the ordering below guarantees that if
 * the directory ever outgrows the cap, the pages that get dropped are the ones
 * with nothing on them yet.
 */
const MAX_FACILITY_URLS = 40_000;

/**
 * Built per request rather than at build time: the Docker image and CI both
 * build without a reachable database, and a directory that grows daily should
 * not be frozen into the bundle anyway.
 */
export const dynamic = "force-dynamic";

function url(path: string): string {
  return new URL(path, siteUrl).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: url("/facilities"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: url("/cities"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: url("/about"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: url("/guidelines"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: url("/privacy"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];

  try {
    const [cities, facilities] = await Promise.all([
      prisma.city.findMany({
        where: { facilityCount: { gt: 0 } },
        select: { slug: true, updatedAt: true },
        orderBy: { reviewCount: "desc" },
      }),
      // PENDING submissions are deliberately absent: they are visible to
      // whoever submitted them, but they are not part of the public directory
      // until they clear the duplicate check.
      prisma.facility.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true, reviewCount: true },
        orderBy: [{ reviewCount: "desc" }, { updatedAt: "desc" }],
        take: MAX_FACILITY_URLS,
      }),
    ]);

    return [
      ...staticRoutes,
      ...cities.map((city) => ({
        url: url(`/cities/${city.slug}`),
        lastModified: city.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...facilities.map((facility) => ({
        url: url(`/facilities/${facility.slug}`),
        lastModified: facility.updatedAt,
        // A facility page changes when someone reviews it, and most never do.
        changeFrequency:
          facility.reviewCount > 0 ? ("weekly" as const) : ("monthly" as const),
        priority: facility.reviewCount > 0 ? 0.8 : 0.5,
      })),
    ];
  } catch (error) {
    // A sitemap that is briefly short is better than a 500 that teaches a
    // crawler the file is broken.
    console.error("sitemap: database unavailable", error);
    return staticRoutes;
  }
}
