/**
 * Re-apply the facility classifier to rows already in the database.
 *
 *   npm run reclassify -- --dry-run
 *   npm run reclassify
 *
 * The importer classifies on the way in, so this only matters when the rules
 * change — which they did once already, when it turned out that Arabic
 * primary-care centres ("مركز صحي", "مستوصف") were landing in OTHER while
 * opticians and cupping clinics were being imported as healthcare.
 *
 * Only the name is available here, not the original OpenStreetMap tags, which
 * is enough: both rules are name-based. A facility that already carries
 * reviews is never deleted — someone trained there and said so, which is
 * better evidence than any keyword list.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { classifyFacility, isTrainingSite } from "../src/lib/osm";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const facilities = await prisma.facility.findMany({
    select: {
      id: true,
      name: true,
      nameEn: true,
      nameLocal: true,
      kind: true,
      reviewCount: true,
      source: true,
      cityId: true,
    },
  });

  console.log(`Checking ${facilities.length} facilities${dryRun ? " (dry run)" : ""}\n`);

  const toDelete: typeof facilities = [];
  const toReclassify: Array<{ id: string; name: string; from: string; to: string }> = [];

  for (const f of facilities) {
    const searchName = [f.name, f.nameEn, f.nameLocal].filter(Boolean).join(" ");

    // A facility somebody has reviewed stays, whatever the keywords think.
    if (!isTrainingSite({}, searchName) && f.reviewCount === 0) {
      toDelete.push(f);
      continue;
    }

    // Reclassify from the name alone. Tags are gone, so only trust the name
    // when it is decisive — otherwise leave a specific kind alone.
    // Only promote rows currently sitting in OTHER; a specific kind already
    // came from real tags and is better evidence than a name match.
    if (f.kind !== "OTHER") continue;
    const guess = classifyFacility({}, searchName);
    if (guess !== "OTHER") {
      toReclassify.push({ id: f.id, name: f.name, from: f.kind, to: guess });
    }
  }

  console.log(`Not training sites (would delete): ${toDelete.length}`);
  for (const f of toDelete.slice(0, 15)) console.log(`  - ${f.name}`);
  if (toDelete.length > 15) console.log(`  … and ${toDelete.length - 15} more`);

  console.log(`\nMisclassified as OTHER (would fix): ${toReclassify.length}`);
  for (const f of toReclassify.slice(0, 15)) {
    console.log(`  - ${f.name} → ${f.to}`);
  }
  if (toReclassify.length > 15) {
    console.log(`  … and ${toReclassify.length - 15} more`);
  }

  if (dryRun) {
    console.log("\nDry run — nothing changed.");
    await prisma.$disconnect();
    return;
  }

  const cityIds = new Set(toDelete.map((f) => f.cityId));

  if (toDelete.length > 0) {
    await prisma.facility.deleteMany({
      where: { id: { in: toDelete.map((f) => f.id) } },
    });
  }

  for (const f of toReclassify) {
    await prisma.facility.update({
      where: { id: f.id },
      // The cast is safe: classifyFacility only ever returns schema values.
      data: { kind: f.to as "HOSPITAL" },
    });
  }

  // Facility counts on the affected cities are now wrong.
  for (const cityId of cityIds) {
    const facilityCount = await prisma.facility.count({
      where: { cityId, status: "PUBLISHED" },
    });
    await prisma.city.update({ where: { id: cityId }, data: { facilityCount } });
  }

  console.log(
    `\nDone. ${toDelete.length} removed, ${toReclassify.length} reclassified, ${cityIds.size} city counts refreshed.`,
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
