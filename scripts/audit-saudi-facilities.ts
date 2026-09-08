/**
 * Compare every published OpenStreetMap facility with OSM's Saudi Arabia
 * administrative area.
 *
 *   npm run audit:saudi-facilities
 *   npm run audit:saudi-facilities -- --apply
 *
 * Dry-run is the default. `--apply` only hides records with no reviews; a
 * reviewed record is reported for manual moderation rather than disappearing.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  pointInBoundary,
  type BoundaryGeometry,
} from "../src/lib/geo";

const apply = process.argv.slice(2).includes("--apply");

type NominatimResult = {
  features?: Array<{
    geometry?: BoundaryGeometry;
    properties?: { osm_id?: number };
  }>;
};

async function loadSaudiBoundary(): Promise<BoundaryGeometry> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    format: "geojson",
    polygon_geojson: "1",
    country: "Saudi Arabia",
    countrycodes: "sa",
    limit: "1",
  }).toString();

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Tellyrate/1.0 (Saudi facility boundary audit; https://github.com/Anas-als3/Tellyrate)",
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim boundary request returned ${response.status}`);
  }

  const result = (await response.json()) as NominatimResult;
  const feature = result.features?.[0];
  if (
    !feature?.geometry ||
    (feature.geometry.type !== "Polygon" &&
      feature.geometry.type !== "MultiPolygon") ||
    feature.properties?.osm_id !== 307584
  ) {
    throw new Error("Saudi Arabia boundary relation 307584 was not returned");
  }
  return feature.geometry;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

  console.log("Loading Saudi Arabia's OpenStreetMap boundary…");
  const boundary = await loadSaudiBoundary();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const rows = await prisma.facility.findMany({
    where: {
      source: "OPENSTREETMAP",
      status: "PUBLISHED",
      osmType: { not: null },
      osmId: { not: null },
    },
    select: {
      id: true,
      name: true,
      osmType: true,
      osmId: true,
      reviewCount: true,
      lat: true,
      lon: true,
      cityId: true,
      city: { select: { name: true } },
      _count: {
        select: { edits: true },
      },
    },
  });

  const unknownLocation = rows.filter(
    (row) => row.lat === null || row.lon === null,
  );
  const outside = rows.filter(
    (row) =>
      row.lat !== null &&
      row.lon !== null &&
      !pointInBoundary(row.lon, row.lat, boundary),
  );
  const protectedRows = outside.filter(
    (row) => row.reviewCount > 0 || row._count.edits > 0,
  );
  const safeToHide = outside.filter(
    (row) => row.reviewCount === 0 && row._count.edits === 0,
  );

  console.log(
    `Checked ${rows.length} published OSM records against country relation 307584.`,
  );
  console.log(
    `${outside.length} coordinates are outside Saudi Arabia: ${safeToHide.length} untouched/unreviewed, ${protectedRows.length} protected.`,
  );
  if (unknownLocation.length > 0) {
    console.warn(
      `${unknownLocation.length} OSM records have no coordinates and require manual inspection.`,
    );
  }

  for (const row of outside.slice(0, 80)) {
    console.log(
      `  ${row.reviewCount > 0 || row._count.edits > 0 ? "PROTECTED" : "hide"}  ${row.osmType}/${String(row.osmId)}  ${row.name} — assigned to ${row.city.name}`,
    );
  }
  if (outside.length > 80) console.log(`  …and ${outside.length - 80} more`);

  if (protectedRows.length > 0) {
    console.warn(
      "Reviewed records were left published. Inspect and merge or moderate them manually before re-running.",
    );
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to hide the unreviewed rows.");
    await prisma.$disconnect();
    return;
  }

  if (safeToHide.length === 0) {
    console.log("Nothing safe to change.");
    await prisma.$disconnect();
    return;
  }

  const affectedCities = [...new Set(safeToHide.map((row) => row.cityId))];
  await prisma.$transaction(async (tx) => {
    await tx.facility.updateMany({
      where: { id: { in: safeToHide.map((row) => row.id) } },
      data: { status: "REJECTED" },
    });

    await tx.facilityEdit.createMany({
      data: safeToHide.map((row) => ({
        facilityId: row.id,
        editorId: null,
        field: "status:country-audit",
        oldValue: "PUBLISHED",
        newValue: "REJECTED",
      })),
    });

    for (const cityId of affectedCities) {
      const [facilityCount, reviewTotals] = await Promise.all([
        tx.facility.count({ where: { cityId, status: "PUBLISHED" } }),
        tx.facility.aggregate({
          where: { cityId, status: "PUBLISHED" },
          _sum: { reviewCount: true },
        }),
      ]);
      await tx.city.update({
        where: { id: cityId },
        data: {
          facilityCount,
          reviewCount: reviewTotals._sum.reviewCount ?? 0,
        },
      });
    }
  });

  console.log(
    `Hidden ${safeToHide.length} unreviewed records and refreshed ${affectedCities.length} city counters.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
