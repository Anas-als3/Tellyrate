/**
 * Import the privacy-sanitised Batch 17 clinical-placement survey.
 *
 *   npm run import:batch17                    # validate and preview
 *   npm run import:batch17 -- --apply         # upsert facilities + reviews
 *   npm run import:batch17 -- --file path.json
 *
 * The raw spreadsheet is deliberately not consumed here: it contains named
 * staff and, in one response, a respondent's name and phone number. Only the
 * reviewed, public-safe JSON artifact may reach a database. Imports are
 * idempotent through Review.sourceKey and never invent a star rating.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  RotationSpecialty,
  StudentField,
  TraineeRole,
  type FacilityKind,
} from "../src/generated/prisma/client";

const SOURCE_FINGERPRINT = "03430678bcb0";

type ImportRow = {
  sourceRow: number;
  facilitySlug: string;
  field: string;
  role: string;
  specialty: string;
  department: string | null;
  body: string;
};

type CuratedFacility = {
  slug: string;
  nameEn: string;
  nameLocal: string;
  kind: FacilityKind;
};

/** Missing OSM records that are identifiable from the survey itself. */
const CURATED_FACILITIES: CuratedFacility[] = [
  {
    slug: "king-abdullah-specialized-childrens-hospital-riyadh",
    nameEn: "King Abdullah Specialized Children's Hospital",
    nameLocal: "مستشفى الملك عبدالله التخصصي للأطفال",
    kind: "HOSPITAL",
  },
  {
    slug: "womens-health-hospital-kamc-riyadh",
    nameEn: "Women's Health Hospital – King Abdulaziz Medical City",
    nameLocal: "مستشفى صحة المرأة بمدينة الملك عبدالعزيز الطبية",
    kind: "HOSPITAL",
  },
  {
    slug: "iskan-family-medicine-center-riyadh",
    nameEn: "Iskan Family Medicine Center",
    nameLocal: "مركز إسكان لطب الأسرة",
    kind: "HEALTH_CENTER",
  },
  {
    slug: "khashm-al-aan-family-medicine-center-riyadh",
    nameEn: "Khashm Al-Aan Family Medicine Center",
    nameLocal: "مركز خشم العان لطب الأسرة",
    kind: "HEALTH_CENTER",
  },
  {
    slug: "umm-al-hammam-family-medicine-center-riyadh",
    nameEn: "Umm Al-Hammam Family Medicine Center",
    nameLocal: "مركز أم الحمام لطب الأسرة",
    kind: "HEALTH_CENTER",
  },
  {
    slug: "king-khalid-university-hospital-riyadh",
    nameEn: "King Khalid University Hospital",
    nameLocal: "مستشفى الملك خالد الجامعي",
    kind: "HOSPITAL",
  },
  {
    slug: "salah-al-din-primary-healthcare-center-riyadh",
    nameEn: "Salah Al-Din Primary Healthcare Center",
    nameLocal: "مركز صلاح الدين للرعاية الصحية الأولية",
    kind: "HEALTH_CENTER",
  },
  {
    slug: "al-nuzha-primary-healthcare-center-riyadh",
    nameEn: "Al Nuzha Primary Healthcare Center",
    nameLocal: "مركز النزهة للرعاية الصحية الأولية",
    kind: "HEALTH_CENTER",
  },
];

/**
 * Known Riyadh facilities used by the survey. Update the matching OSM record
 * when it exists; create a curated fallback when an older production snapshot
 * does not contain it. Existing moderation status is always preserved.
 */
const VERIFIED_NAMES: Array<CuratedFacility & { slug: string }> = [
  {
    slug: "medical-city-a4fykz",
    nameEn: "King Abdulaziz Medical City – Riyadh",
    nameLocal: "مدينة الملك عبدالعزيز الطبية بالرياض",
    kind: "HOSPITAL",
  },
  {
    slug: "al-dyria-tpmh8t",
    nameEn: "Diriyah Hospital",
    nameLocal: "مستشفى الدرعية",
    kind: "HOSPITAL",
  },
  {
    slug: "king-fahad-medical-city-hbmcfq",
    nameEn: "King Fahad Medical City",
    nameLocal: "مدينة الملك فهد الطبية",
    kind: "HOSPITAL",
  },
  {
    slug: "about-kaauh-king-abdullah-bin-abdulaziz-university-hospital-zdepct",
    nameEn: "King Abdullah bin Abdulaziz University Hospital",
    nameLocal: "مستشفى الملك عبدالله بن عبدالعزيز الجامعي",
    kind: "HOSPITAL",
  },
  {
    slug: "king-faisal-specialist-hospital-4pw2c7",
    nameEn: "King Faisal Specialist Hospital & Research Centre – Riyadh",
    nameLocal: "مستشفى الملك فيصل التخصصي ومركز الأبحاث بالرياض",
    kind: "HOSPITAL",
  },
  {
    slug: "mustashfaalamirmuhammadbin-abdal-aziz-ybb48v",
    nameEn: "Prince Mohammed bin Abdulaziz Hospital – Riyadh",
    nameLocal: "مستشفى الأمير محمد بن عبدالعزيز بالرياض",
    kind: "HOSPITAL",
  },
  {
    slug: "primary-health-care-clinic-alwadi-fbjkq5",
    nameEn: "Al Wadi Primary Healthcare Center",
    nameLocal: "مركز الوادي للرعاية الصحية الأولية",
    kind: "HEALTH_CENTER",
  },
  {
    slug: "almuhammadiyah-clinic-93hsrc",
    nameEn: "Al Muhammadiyah Primary Healthcare Center",
    nameLocal: "مركز المحمدية للرعاية الصحية الأولية",
    kind: "HEALTH_CENTER",
  },
];

function parseArgs(argv: string[]) {
  let file = resolve(process.cwd(), "data", "batch17-reviews.json");
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file") file = resolve(argv[++i] ?? "");
    else if (argv[i] === "--apply") apply = true;
  }
  return { file, apply };
}

function sourceKey(row: number): string {
  return `batch17:${SOURCE_FINGERPRINT}:r${String(row).padStart(4, "0")}`;
}

function validateRows(value: unknown): ImportRow[] {
  if (!Array.isArray(value)) throw new Error("Import file must contain an array");
  const rows = value as ImportRow[];
  if (rows.length !== 79) throw new Error(`Expected 79 reviews; found ${rows.length}`);

  const sourceRows = new Set<number>();
  const facilitySlugs = new Set([
    ...CURATED_FACILITIES.map((row) => row.slug),
    ...VERIFIED_NAMES.map((row) => row.slug),
  ]);
  const specialties = new Set(Object.values(RotationSpecialty));
  const fields = new Set(Object.values(StudentField));
  const roles = new Set(Object.values(TraineeRole));

  for (const [index, row] of rows.entries()) {
    const label = `Entry ${index + 1}`;
    if (!Number.isInteger(row.sourceRow) || row.sourceRow < 2) {
      throw new Error(`${label} has an invalid sourceRow`);
    }
    if (sourceRows.has(row.sourceRow)) {
      throw new Error(`Source row ${row.sourceRow} appears more than once`);
    }
    sourceRows.add(row.sourceRow);
    if ([30, 40, 69].includes(row.sourceRow)) {
      throw new Error(`Source row ${row.sourceRow} must remain excluded`);
    }
    if (!facilitySlugs.has(row.facilitySlug)) {
      throw new Error(`${label} has an unknown facilitySlug: ${row.facilitySlug}`);
    }
    if (!fields.has(row.field as never) || row.field !== "MEDICINE") {
      throw new Error(`${label} has an invalid field`);
    }
    if (!roles.has(row.role as never) || row.role !== "INTERN") {
      throw new Error(`${label} has an invalid role`);
    }
    if (!specialties.has(row.specialty as never)) {
      throw new Error(`${label} has an invalid specialty`);
    }
    if (typeof row.body !== "string" || row.body.trim().length < 120) {
      throw new Error(`${label} body is shorter than 120 characters`);
    }
    if (row.body.length > 8000) throw new Error(`${label} body is too long`);

    const piiPatterns: Array<[RegExp, string]> = [
      [/(?:\+?966|05)[\s-]*\d(?:[\s-]*\d){7,}/u, "phone number"],
      [/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u, "email address"],
      [/(?:^|\s)@[\p{L}\p{N}_.-]+/u, "social handle"],
      [/\b(?:Dr\.?\s+[A-Z][A-Za-z'’-]+|dr\.\s+[A-Za-z'’-]{2,}|[Dd]octor\s+[A-Z][A-Za-z'’-]+|[Pp]rof(?:essor)?\.?\s+[A-Z][A-Za-z'’-]+)/u, "named staff member"],
      [/(?:^|[\s،:؛(])(?:د(?:\.\s*|\s+)|دكتور(?:ة)?\s+|أ\.د\.?\s*)[\p{L}]{2,}/u, "named staff member"],
      [/\b(?:Mr|Mrs|Ms)\.?\s+[A-Z][\p{L}'’-]+/u, "named person"],
    ];
    for (const [pattern, kind] of piiPatterns) {
      if (pattern.test(row.body)) {
        throw new Error(`${label} may contain a ${kind}`);
      }
    }
  }

  return rows.sort((a, b) => a.sourceRow - b.sourceRow);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = validateRows(JSON.parse(readFileSync(args.file, "utf8")));
  const byFacility = new Map<string, number>();
  for (const row of rows) {
    byFacility.set(row.facilitySlug, (byFacility.get(row.facilitySlug) ?? 0) + 1);
  }

  console.log(`Validated ${rows.length} privacy-sanitised, unrated reviews.`);
  for (const [slug, count] of [...byFacility].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(2)}  ${slug}`);
  }
  if (!args.apply) {
    console.log("Dry run only. Re-run with --apply to write the import.");
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const riyadh = await prisma.city.findUnique({
      where: { nameFold_countryCode: { nameFold: "riyadh", countryCode: "SA" } },
      select: { id: true },
    });
    if (!riyadh) throw new Error("Riyadh city row is missing");

    await prisma.$transaction(
      async (tx) => {
        for (const facility of CURATED_FACILITIES) {
          await tx.facility.upsert({
            where: { slug: facility.slug },
            create: {
              slug: facility.slug,
              name: facility.nameEn,
              nameEn: facility.nameEn,
              nameLocal: facility.nameLocal,
              kind: facility.kind,
              source: "CURATED",
              status: "PUBLISHED",
              cityId: riyadh.id,
            },
            update: {
              name: facility.nameEn,
              nameEn: facility.nameEn,
              nameLocal: facility.nameLocal,
              kind: facility.kind,
              cityId: riyadh.id,
            },
          });
        }

        for (const facility of VERIFIED_NAMES) {
          await tx.facility.upsert({
            where: { slug: facility.slug },
            create: {
              slug: facility.slug,
              name: facility.nameEn,
              nameEn: facility.nameEn,
              nameLocal: facility.nameLocal,
              kind: facility.kind,
              source: "CURATED",
              status: "PUBLISHED",
              cityId: riyadh.id,
            },
            update: {
              name: facility.nameEn,
              nameEn: facility.nameEn,
              nameLocal: facility.nameLocal,
              kind: facility.kind,
              cityId: riyadh.id,
            },
          });
        }

        const facilities = await tx.facility.findMany({
          where: { slug: { in: [...byFacility.keys()] }, status: "PUBLISHED" },
          select: { id: true, slug: true },
        });
        const ids = new Map(
          facilities.map((facility) => [facility.slug, facility.id]),
        );
        if (ids.size !== byFacility.size) {
          const missing = [...byFacility.keys()].filter((slug) => !ids.has(slug));
          throw new Error(`Missing target facilities: ${missing.join(", ")}`);
        }

        for (const row of rows) {
          const facilityId = ids.get(row.facilitySlug)!;
          const data = {
            facilityId,
            authorId: null,
            overall: null,
            supervision: null,
            handsOn: null,
            staffRespect: null,
            workload: null,
            resources: null,
            safety: null,
            title: null,
            body: row.body.trim(),
            field: row.field as (typeof StudentField)[keyof typeof StudentField],
            role: row.role as (typeof TraineeRole)[keyof typeof TraineeRole],
            specialty:
              row.specialty as (typeof RotationSpecialty)[keyof typeof RotationSpecialty],
            department: row.department?.trim() || null,
            trainingYear: null,
            source: "BATCH17_SURVEY" as const,
          };
          await tx.review.upsert({
            where: { sourceKey: sourceKey(row.sourceRow) },
            create: {
              ...data,
              sourceKey: sourceKey(row.sourceRow),
              status: "PUBLISHED",
            },
            update: data,
          });
        }

        for (const facilityId of ids.values()) {
          const reviewCount = await tx.review.count({
            where: { facilityId, status: "PUBLISHED" },
          });
          await tx.facility.update({
            where: { id: facilityId },
            data: { reviewCount },
          });
        }

        const [facilityCount, reviewCount, totalReviews] = await Promise.all([
          tx.facility.count({ where: { cityId: riyadh.id, status: "PUBLISHED" } }),
          tx.review.count({
            where: {
              facility: { cityId: riyadh.id, status: "PUBLISHED" },
              status: "PUBLISHED",
            },
          }),
          tx.review.count({ where: { status: "PUBLISHED" } }),
        ]);
        await tx.city.update({
          where: { id: riyadh.id },
          data: { facilityCount, reviewCount },
        });
        await tx.siteStat.upsert({
          where: { id: "global" },
          create: { id: "global", reviewCount: totalReviews },
          update: { reviewCount: totalReviews },
        });
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    const imported = await prisma.review.count({
      where: { source: "BATCH17_SURVEY" },
    });
    console.log(`Import complete. Database now contains ${imported} Batch 17 reviews.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
