/**
 * OpenStreetMap facility lookup.
 *
 * Everything here is shared between the bulk importer (scripts/) and the
 * "add a facility" flow in the app, so that a facility a user pulls in one at
 * a time is normalised exactly like one that arrived in a batch.
 *
 * Data © OpenStreetMap contributors, ODbL. See /about for the attribution the
 * site is required to display.
 */

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type FacilityKindValue =
  | "HOSPITAL"
  | "CLINIC"
  | "HEALTH_CENTER"
  | "DENTAL_CLINIC"
  | "PHARMACY"
  | "LABORATORY"
  | "REHAB_CENTER"
  | "MENTAL_HEALTH"
  | "OTHER";

/**
 * Public Overpass instances, tried in order. The main `overpass-api.de`
 * endpoint rate-limits hard and returns 429/504 under load — measured, not
 * assumed — so a mirror leads and the list exists at all.
 */
export const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export const USER_AGENT =
  "Hospirate/1.0 (student placement reviews; https://github.com/Anas-als3/Hospirate)";

/** Tags that make an OSM element a place a healthcare student might train in. */
const AMENITY_MATCH = "^(hospital|clinic|doctors|dentist|pharmacy|nursing_home)$";

export function buildBboxQuery(
  bbox: [number, number, number, number],
  timeoutSeconds = 120,
): string {
  const [south, west, north, east] = bbox;
  const box = `${south},${west},${north},${east}`;
  return `[out:json][timeout:${timeoutSeconds}];
(
  nwr["amenity"~"${AMENITY_MATCH}"](${box});
  nwr["healthcare"](${box});
);
out center tags;`;
}

/** Narrow, fast query used by the in-app "search OpenStreetMap" step. */
export function buildNameSearchQuery(
  name: string,
  bbox: [number, number, number, number],
  timeoutSeconds = 30,
): string {
  const [south, west, north, east] = bbox;
  const box = `${south},${west},${north},${east}`;
  // Escape for an Overpass regex string literal.
  const safe = name.replace(/["\\]/g, "\\$&").slice(0, 80);
  return `[out:json][timeout:${timeoutSeconds}];
(
  nwr["amenity"~"${AMENITY_MATCH}"]["name"~"${safe}",i](${box});
  nwr["healthcare"]["name"~"${safe}",i](${box});
);
out center tags 40;`;
}

export class OverpassError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "OverpassError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run an Overpass query, rotating endpoints and backing off on the 429 and 504
 * responses the public instances routinely return when busy.
 */
export async function runOverpass(
  query: string,
  options: { attempts?: number; signal?: AbortSignal } = {},
): Promise<OsmElement[]> {
  const attempts = options.attempts ?? OVERPASS_ENDPOINTS.length * 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({ data: query }),
        signal: options.signal,
      });

      if (res.status === 429 || res.status === 504 || res.status === 503) {
        lastError = new OverpassError(
          `${endpoint} responded ${res.status}`,
          res.status,
        );
        // Exponential backoff, capped — these are shared community servers.
        await sleep(Math.min(2000 * 2 ** Math.floor(attempt / OVERPASS_ENDPOINTS.length), 30_000));
        continue;
      }

      if (!res.ok) {
        lastError = new OverpassError(
          `${endpoint} responded ${res.status}`,
          res.status,
        );
        continue;
      }

      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await sleep(1500);
    }
  }

  throw lastError ?? new OverpassError("Overpass request failed");
}

/** Map OSM tags onto our facility taxonomy. */
export function classifyFacility(
  tags: Record<string, string>,
): FacilityKindValue {
  const amenity = tags.amenity ?? "";
  const healthcare = tags.healthcare ?? "";
  const speciality = tags["healthcare:speciality"] ?? "";

  if (amenity === "hospital" || healthcare === "hospital") return "HOSPITAL";
  if (amenity === "dentist" || healthcare === "dentist") return "DENTAL_CLINIC";
  if (amenity === "pharmacy" || healthcare === "pharmacy") return "PHARMACY";
  if (healthcare === "laboratory") return "LABORATORY";
  if (healthcare === "rehabilitation" || amenity === "nursing_home") {
    return "REHAB_CENTER";
  }
  if (
    healthcare === "psychotherapist" ||
    speciality.includes("psychiatry") ||
    speciality.includes("mental")
  ) {
    return "MENTAL_HEALTH";
  }
  if (healthcare === "centre" || amenity === "health_post") return "HEALTH_CENTER";
  if (amenity === "clinic" || healthcare === "clinic") return "CLINIC";
  if (amenity === "doctors" || healthcare === "doctor") return "CLINIC";

  return "OTHER";
}

export type NormalisedFacility = {
  osmType: string;
  osmId: bigint;
  name: string;
  nameEn: string | null;
  nameLocal: string | null;
  kind: FacilityKindValue;
  lat: number | null;
  lon: number | null;
  address: string | null;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  cityHint: string | null;
};

const LATIN = /[A-Za-z]/;

/**
 * Turn a raw OSM element into a facility row, or null when it is unusable.
 *
 * Unnamed elements are dropped: a review of "an unnamed clinic somewhere in
 * Cairo" helps nobody, and they make up a fifth of the raw results.
 */
export function normaliseElement(el: OsmElement): NormalisedFacility | null {
  const tags = el.tags;
  if (!tags) return null;

  const nameEn = tags["name:en"] ?? null;
  const rawName = tags.name ?? nameEn ?? tags["name:ar"] ?? null;
  if (!rawName) return null;

  // Prefer a Latin-script display name where OSM offers one, since the site's
  // interface is English — but keep the local name so it stays searchable.
  const isLatin = LATIN.test(rawName);
  const name = isLatin ? rawName : (nameEn ?? rawName);
  const nameLocal = isLatin ? null : rawName;

  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;

  const street = tags["addr:street"];
  const housenumber = tags["addr:housenumber"];
  const address =
    [housenumber, street].filter(Boolean).join(" ").trim() || null;

  return {
    osmType: el.type,
    osmId: BigInt(el.id),
    name: name.slice(0, 200),
    nameEn: nameEn && nameEn !== name ? nameEn.slice(0, 200) : null,
    nameLocal: nameLocal ? nameLocal.slice(0, 200) : null,
    kind: classifyFacility(tags),
    lat,
    lon,
    address,
    postcode: tags["addr:postcode"] ?? null,
    website: normaliseUrl(tags.website ?? tags["contact:website"]),
    phone: (tags.phone ?? tags["contact:phone"] ?? null)?.slice(0, 40) ?? null,
    cityHint: tags["addr:city"] ?? null,
  };
}

function normaliseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

/** Great-circle distance in kilometres, for nearest-city assignment. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
