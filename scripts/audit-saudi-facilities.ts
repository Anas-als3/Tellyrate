/**
 * Verify every published facility before it remains in the Saudi directory.
 *
 *   npm run audit:saudi-facilities
 *   npm run audit:saudi-facilities -- --apply
 *
 * Dry-run is the default. `--apply` rejects OSM/curated records that cannot be
 * verified as Saudi and returns legacy user submissions to moderation. Reviews
 * are retained even when their facility is no longer publicly listed.
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
      status: "PUBLISHED",
    },
    select: {
      id: true,
      name: true,
      source: true,
      osmType: true,
      osmId: true,
      reviewCount: true,
      lat: true,
      lon: true,
      cityId: true,
      city: { select: { name: true, countryCode: true } },
      edits: {
        where: { field: "status:moderation", newValue: "PUBLISHED" },
        select: { id: true },
        take: 1,
      },
    },
  });

  const osmRows = rows.filter((row) => row.source === "OPENSTREETMAP");
  const unknownOsm = osmRows.filter(
    (row) =>
      row.osmType === null ||
      row.osmId === null ||
      row.lat === null ||
      row.lon === null,
  );
  const outsideOsm = osmRows.filter(
    (row) =>
      row.osmType !== null &&
      row.osmId !== null &&
      row.lat !== null &&
      row.lon !== null &&
      !pointInBoundary(row.lon, row.lat, boundary),
  );
  const invalidOsm = [...unknownOsm, ...outsideOsm];
  const unverifiedUserRows = rows.filter(
    (row) =>
      row.source === "USER_SUBMITTED" &&
      (row.city.countryCode !== "SA" || row.edits.length === 0),
  );
  const invalidCuratedRows = rows.filter(
    (row) => row.source === "CURATED" && row.city.countryCode !== "SA",
  );
  const changeCount =
    invalidOsm.length + unverifiedUserRows.length + invalidCuratedRows.length;

  console.log(
    `Checked ${rows.length} published facilities; ${osmRows.length} OSM records were compared with country relation 307584.`,
  );
  console.log(
    `${outsideOsm.length} OSM coordinates are outside Saudi Arabia and ${unknownOsm.length} OSM records cannot be located.`,
  );
  console.log(
    `${unverifiedUserRows.length} user submissions need moderation; ${invalidCuratedRows.length} curated records have a non-Saudi city.`,
  );

  for (const row of invalidOsm.slice(0, 80)) {
    console.log(
      `  reject  ${row.osmType ?? "unknown"}/${String(row.osmId ?? "unknown")}  ${row.name} — assigned to ${row.city.name}${row.reviewCount > 0 ? ` (${row.reviewCount} reviews retained)` : ""}`,
    );
  }
  if (invalidOsm.length > 80) {
    console.log(`  …and ${invalidOsm.length - 80} more invalid OSM records`);
  }

  if (!apply) {
    console.log(`Dry run only. Re-run with --apply to update ${changeCount} records.`);
    await prisma.$disconnect();
    return;
  }

  if (changeCount === 0) {
    console.log("Nothing safe to change.");
    await prisma.$disconnect();
    return;
  }

  const changed = await prisma.$transaction(
    async (tx) => {
      const rejectedOsm =
        invalidOsm.length === 0
          ? []
          : await tx.facility.updateManyAndReturn({
              where: {
                source: "OPENSTREETMAP",
                status: "PUBLISHED",
                // Recheck the exact coordinates/identity observed by this audit.
                // A concurrent OSM refresh therefore wins instead of being hidden
                // using stale data.
                OR: invalidOsm.map((row) => ({
                  id: row.id,
                  osmType: row.osmType,
                  osmId: row.osmId,
                  lat: row.lat,
                  lon: row.lon,
                })),
              },
              data: { status: "REJECTED" },
              select: { id: true, cityId: true },
            });

      const pendingUsers =
        unverifiedUserRows.length === 0
          ? []
          : await tx.facility.updateManyAndReturn({
              where: {
                id: { in: unverifiedUserRows.map((row) => row.id) },
                source: "USER_SUBMITTED",
                status: "PUBLISHED",
                OR: [
                  { city: { countryCode: { not: "SA" } } },
                  {
                    edits: {
                      none: {
                        field: "status:moderation",
                        newValue: "PUBLISHED",
                      },
                    },
                  },
                ],
              },
              data: { status: "PENDING" },
              select: { id: true, cityId: true },
            });

      const rejectedCurated =
        invalidCuratedRows.length === 0
          ? []
          : await tx.facility.updateManyAndReturn({
              where: {
                id: { in: invalidCuratedRows.map((row) => row.id) },
                source: "CURATED",
                status: "PUBLISHED",
                city: { countryCode: { not: "SA" } },
              },
              data: { status: "REJECTED" },
              select: { id: true, cityId: true },
            });

      const changedRows = [
        ...rejectedOsm.map((row) => ({ ...row, status: "REJECTED" as const })),
        ...pendingUsers.map((row) => ({ ...row, status: "PENDING" as const })),
        ...rejectedCurated.map((row) => ({ ...row, status: "REJECTED" as const })),
      ];

      if (changedRows.length > 0) {
        await tx.facilityEdit.createMany({
          data: changedRows.map((row) => ({
            facilityId: row.id,
            editorId: null,
            field: "status:country-audit",
            oldValue: "PUBLISHED",
            newValue: row.status,
          })),
        });
      }

      const affectedCities = [...new Set(changedRows.map((row) => row.cityId))];
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

      return {
        affectedCities: affectedCities.length,
        pending: pendingUsers.length,
        rejected: rejectedOsm.length + rejectedCurated.length,
      };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.log(
    `Rejected ${changed.rejected} invalid records, returned ${changed.pending} user submissions to moderation, and refreshed ${changed.affectedCities} city counters.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
