import type { Prisma } from "@/generated/prisma/client";
import { citySearchName } from "@/lib/i18n/names";

/**
 * Keep the three facility-name fields in one search contract. Global directory
 * search may also match a city; duplicate prevention deliberately may not,
 * because that flow already has a separate city selector.
 */
export function facilitySearchConditions(
  query: string,
  options: { includeCity?: boolean } = {},
): Prisma.FacilityWhereInput[] {
  const q = query.trim();
  if (!q) return [];

  const conditions: Prisma.FacilityWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { nameEn: { contains: q, mode: "insensitive" } },
    { nameLocal: { contains: q } },
  ];

  if (options.includeCity) {
    conditions.push({
      city: { name: { contains: q, mode: "insensitive" } },
    });

    const englishCity = citySearchName(q);
    if (englishCity) {
      conditions.push({
        city: { name: { equals: englishCity, mode: "insensitive" } },
      });
    }
  }

  return conditions;
}
