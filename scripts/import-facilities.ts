/**
 * Bulk-import health facilities from OpenStreetMap.
 *
 *   npm run import:facilities                    # every city in data/cities.json
 *   npm run import:facilities -- --city Riyadh   # one city
 *   npm run import:facilities -- --country SA    # one country
 *   npm run import:facilities -- --limit 5 --dry-run
 *
 * This is an offline job, never a request handler: the public Overpass
 * instances are shared community infrastructure and take seconds to minutes
 * per city. Re-running is safe — facilities are keyed on their OSM identity,
 * so a second run updates rather than duplicates.
 *
 * Data © OpenStreetMap contributors, licensed under the ODbL.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Region as CityRegion } from "../src/generated/prisma/client";
import {
  buildBboxQuery,
  haversineKm,
  normaliseElement,
  runOverpass,
  type NormalisedFacility,
} from "../src/lib/osm";
import { fold, shortId, slugWithSuffix, slugify } from "../src/lib/slug";

type SeedCity = {
  name: string;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number];
  osmType: string;
  osmId: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv: string[]) {
  const args = {
    city: null as string | null,
    country: null as string | null,
    limit: Infinity,
    dryRun: false,
    pauseMs: 4000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--city") args.city = argv[++i] ?? null;
    else if (a === "--country") args.country = (argv[++i] ?? "").toUpperCase();
    else if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--pause") args.pauseMs = Number(argv[++i]);
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const seed: SeedCity[] = JSON.parse(
    readFileSync(join(process.cwd(), "data", "cities.json"), "utf8"),
  );

  let cities = seed;
  if (args.city) {
    const wanted = fold(args.city);
    cities = cities.filter((c) => fold(c.name) === wanted);
  }
  if (args.country) {
    cities = cities.filter((c) => c.countryCode === args.country);
  }
  cities = cities.slice(0, args.limit);

  if (cities.length === 0) {
    console.error("No cities matched. Check --city / --country.");
    process.exit(1);
  }

  console.log(
    `Importing ${cities.length} cit${cities.length === 1 ? "y" : "ies"}${args.dryRun ? " (dry run)" : ""}\n`,
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const [index, city] of cities.entries()) {
    const label = `${city.name}, ${city.countryCode}`;
    process.stdout.write(`[${index + 1}/${cities.length}] ${label} ... `);

    let elements;
    try {
      elements = await runOverpass(
        buildBboxQuery(city.bbox, 120, city.countryCode),
      );
    } catch (error) {
      console.log(`FAILED (${(error as Error).message})`);
      continue;
    }

    const normalised = elements
      .map(normaliseElement)
      .filter((f): f is NormalisedFacility => f !== null);

    if (args.dryRun) {
      console.log(`${elements.length} raw -> ${normalised.length} usable`);
      await sleep(args.pauseMs);
      continue;
    }

    // Upsert the city itself first, so facilities always have a home.
    const citySlug = slugify(city.name) || `city-${shortId(String(city.osmId))}`;
    const cityRow = await prisma.city.upsert({
      where: {
        nameFold_countryCode: {
          nameFold: fold(city.name),
          countryCode: city.countryCode,
        },
      },
      create: {
        slug: `${citySlug}-${city.countryCode.toLowerCase()}`,
        name: city.name,
        nameFold: fold(city.name),
        country: city.country,
        countryCode: city.countryCode,
        region: city.region as SeedCity["region"] & CityRegion,
        lat: city.lat,
        lon: city.lon,
        bboxSouth: city.bbox[0],
        bboxWest: city.bbox[1],
        bboxNorth: city.bbox[2],
        bboxEast: city.bbox[3],
      },
      update: {
        region: city.region as SeedCity["region"] & CityRegion,
        lat: city.lat,
        lon: city.lon,
        bboxSouth: city.bbox[0],
        bboxWest: city.bbox[1],
        bboxNorth: city.bbox[2],
        bboxEast: city.bbox[3],
      },
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const facility of normalised) {
      // Bounding boxes overlap around dense metros, so a facility could land
      // in two cities' results. Keep it with whichever centre is nearest;
      // that also stops a later city's import from stealing it back.
      if (facility.lat !== null && facility.lon !== null) {
        const distance = haversineKm(
          facility.lat,
          facility.lon,
          city.lat,
          city.lon,
        );
        const nearer = seed.find(
          (other) =>
            other !== city &&
            haversineKm(facility.lat!, facility.lon!, other.lat, other.lon) <
              distance,
        );
        if (nearer) {
          skipped++;
          continue;
        }
      }

      const osmKey = `${facility.osmType}/${facility.osmId}`;
      const existing = await prisma.facility.findUnique({
        where: {
          osmType_osmId: { osmType: facility.osmType, osmId: facility.osmId },
        },
        select: { id: true },
      });

      const data = {
        name: facility.name,
        nameEn: facility.nameEn,
        nameLocal: facility.nameLocal,
        kind: facility.kind,
        cityId: cityRow.id,
        address: facility.address,
        postcode: facility.postcode,
        lat: facility.lat,
        lon: facility.lon,
        website: facility.website,
        phone: facility.phone,
      };

      if (existing) {
        await prisma.facility.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.facility.create({
          data: {
            ...data,
            slug: slugWithSuffix(facility.name, shortId(osmKey)),
            source: "OPENSTREETMAP",
            status: "PUBLISHED",
            osmType: facility.osmType,
            osmId: facility.osmId,
          },
        });
        created++;
      }
    }

    await prisma.city.update({
      where: { id: cityRow.id },
      data: { facilityCount: await prisma.facility.count({ where: { cityId: cityRow.id, status: "PUBLISHED" } }) },
    });

    totalCreated += created;
    totalUpdated += updated;
    totalSkipped += skipped;

    console.log(
      `${elements.length} raw -> +${created} new, ${updated} updated, ${skipped} reassigned`,
    );

    // Be a good citizen of shared community servers.
    if (index < cities.length - 1) await sleep(args.pauseMs);
  }

  if (args.dryRun) {
    console.log("\nDry run complete. No database rows or counters were changed.");
    console.log("Facility data © OpenStreetMap contributors (ODbL).");
    await prisma.$disconnect();
    return;
  }

  // Reassignment moves a facility from one city to another, and only the
  // receiving city's counter was touched as we went — so the city it left is
  // now overstated. Recompute every city rather than track which ones moved.
  const allCities = await prisma.city.findMany({ select: { id: true } });
  for (const { id } of allCities) {
    const [facilityCount, agg] = await Promise.all([
      prisma.facility.count({ where: { cityId: id, status: "PUBLISHED" } }),
      prisma.facility.aggregate({
        where: { cityId: id, status: "PUBLISHED" },
        _sum: { reviewCount: true },
      }),
    ]);
    await prisma.city.update({
      where: { id },
      data: { facilityCount, reviewCount: agg._sum.reviewCount ?? 0 },
    });
  }

  console.log(
    `\nDone. ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} reassigned to nearer cities.`,
  );
  console.log(`Counters refreshed for ${allCities.length} cities.`);
  console.log("Facility data © OpenStreetMap contributors (ODbL).");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
