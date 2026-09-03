import { issueSearchToken } from "@/lib/actions/facilities";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/ratelimit";
import { getCurrentUser } from "@/lib/session";
import { fold } from "@/lib/slug";

/**
 * Type-ahead behind "is this place already here?".
 *
 * It searches our own database and nothing else — no geocoder, no map tile, no
 * third-party autocomplete. Handing every keystroke of "which hospital did you
 * train at" to somebody else's API would give away exactly the thing this site
 * exists to protect.
 *
 * The response carries a signed token proving a search ran for this query;
 * `createFacilityAction` refuses a submission without one.
 */

// Prisma and node:crypto both need the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS = 8;
/** Fetched wider than we return, so the ranking below has something to choose from. */
const CANDIDATE_POOL = 24;
const MIN_QUERY_LENGTH = 2;

export type FacilitySearchCandidate = {
  slug: string;
  name: string;
  nameLocal: string | null;
  kind: string;
  reviewCount: number;
  ratingAvg: number;
  city: { name: string; slug: string };
};

export type FacilitySearchResponse = {
  query: string;
  searchToken: string | null;
  candidates: FacilitySearchCandidate[];
};

function json(body: FacilitySearchResponse | { error: string }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The token is per-request and the results are cheap; caching either in
      // a shared proxy would be all cost and no benefit.
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 120);
  const citySlug = (params.get("city") ?? "").trim();

  if (fold(query).length < MIN_QUERY_LENGTH) {
    return json({ query, searchToken: null, candidates: [] });
  }

  const user = await getCurrentUser();
  const limit = await checkRateLimit("search", user?.id);
  if (!limit.ok) {
    return json({ error: "Too many searches. Wait a moment." }, 429);
  }

  try {
    const rows = await prisma.facility.findMany({
      where: {
        // PENDING places are searchable on purpose: a record somebody added an
        // hour ago has to be findable, or the next person adds it again.
        status: { in: ["PUBLISHED", "PENDING"] },
        ...(citySlug ? { city: { slug: citySlug } } : {}),
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { nameEn: { contains: query, mode: "insensitive" } },
          { nameLocal: { contains: query } },
        ],
      },
      take: CANDIDATE_POOL,
      orderBy: [{ reviewCount: "desc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        nameEn: true,
        nameLocal: true,
        kind: true,
        reviewCount: true,
        ratingAvg: true,
        city: { select: { name: true, slug: true } },
      },
    });

    const folded = fold(query);

    const candidates: FacilitySearchCandidate[] = rows
      .map((row) => {
        // A name that *starts* with what was typed is nearly always the one
        // meant; ordering by review count alone buries it under busier places.
        const names = [row.name, row.nameEn, row.nameLocal]
          .filter((value): value is string => Boolean(value))
          .map(fold);
        const rank = names.some((name) => name.startsWith(folded))
          ? 0
          : names.some((name) => name.includes(folded))
            ? 1
            : 2;
        return { row, rank };
      })
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          b.row.reviewCount - a.row.reviewCount ||
          a.row.name.length - b.row.name.length,
      )
      .slice(0, MAX_RESULTS)
      .map(({ row }) => ({
        slug: row.slug,
        name: row.name,
        nameLocal: row.nameLocal,
        kind: row.kind,
        reviewCount: row.reviewCount,
        ratingAvg: row.ratingAvg,
        city: row.city,
      }));

    return json({
      query,
      searchToken: await issueSearchToken(query),
      candidates,
    });
  } catch {
    return json({ error: "Search is unavailable right now." }, 500);
  }
}
