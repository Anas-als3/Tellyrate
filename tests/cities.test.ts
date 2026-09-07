import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type SeedCity = {
  name: string;
  region: string;
  lat: number;
  lon: number;
  /** [south, west, north, east] */
  bbox: [number, number, number, number];
};

const cities: SeedCity[] = JSON.parse(
  readFileSync(new URL("../data/cities.json", import.meta.url), "utf8"),
);

/**
 * These tests exist because of a bug that shipped.
 *
 * The seed was built by asking Nominatim for each city by name and preferring
 * an administrative relation. For half the country that returned the *province*
 * rather than the city: Riyadh's stored centre sat 205km from Riyadh, inside a
 * box 943km tall. Facilities are assigned to whichever city centre is nearest,
 * so the assignment was close to arbitrary — and nothing failed, so nobody knew.
 *
 * A bad centre is invisible in the code and obvious in the data, so the data is
 * what gets checked.
 */

/** Saudi Arabia's extent, generously. */
const BOUNDS = { south: 16, north: 32.5, west: 34, east: 56 };

/** Larger than any Saudi metro, smaller than any province. */
const MAX_SPAN_DEG = 0.75;
/** Small enough for a town, big enough to catch its outskirts. */
const MIN_SPAN_DEG = 0.15;

test("every city sits inside Saudi Arabia", () => {
  for (const c of cities) {
    assert.ok(
      c.lat >= BOUNDS.south && c.lat <= BOUNDS.north,
      `${c.name} latitude ${c.lat} is outside the country`,
    );
    assert.ok(
      c.lon >= BOUNDS.west && c.lon <= BOUNDS.east,
      `${c.name} longitude ${c.lon} is outside the country`,
    );
  }
});

test("bounding boxes are city-sized, not province-sized", () => {
  for (const c of cities) {
    const [south, west, north, east] = c.bbox;
    const spanLat = north - south;
    const spanLon = east - west;

    assert.ok(
      spanLat <= MAX_SPAN_DEG && spanLon <= MAX_SPAN_DEG,
      `${c.name} has a ${Math.round(spanLat * 111)}km box — that is a province, not a city`,
    );
    assert.ok(
      spanLat >= MIN_SPAN_DEG && spanLon >= MIN_SPAN_DEG,
      `${c.name} has a ${Math.round(spanLat * 111)}km box — too small to catch its outskirts`,
    );
  }
});

test("a city's centre lies inside its own bounding box", () => {
  for (const c of cities) {
    const [south, west, north, east] = c.bbox;
    assert.ok(
      c.lat >= south && c.lat <= north && c.lon >= west && c.lon <= east,
      `${c.name} centre (${c.lat}, ${c.lon}) falls outside its box`,
    );
  }
});

/**
 * Hand-checked coordinates for cities whose names repeat across Saudi Arabia,
 * or which resolved to the wrong place at least once. Turubah exists in both
 * Makkah and Ha'il, 790km apart, and the seed picked the wrong one.
 */
const KNOWN: Array<[string, number, number]> = [
  ["Riyadh", 24.71, 46.68],
  ["Jeddah", 21.54, 39.17],
  ["Mecca", 21.42, 39.83],
  ["Medina", 24.47, 39.61],
  ["Dammam", 26.43, 50.1],
  ["Buraydah", 26.33, 43.98],
  ["Abha", 18.22, 42.51],
  ["Tabuk", 28.38, 36.57],
  ["Hail", 27.52, 41.69],
  ["Jazan", 16.89, 42.57],
  ["Najran", 17.49, 44.13],
  ["Turubah", 21.22, 41.63],
  ["Al Quway'iyah", 24.07, 45.28],
];

test("cities resolve to the right place, not a same-named one elsewhere", () => {
  for (const [name, lat, lon] of KNOWN) {
    const city = cities.find((c) => c.name === name);
    assert.ok(city, `${name} is missing from the seed`);

    // Rough kilometres: a degree of latitude is ~111km, and longitude at
    // Saudi latitudes ~101km. Exactness is not the point — 790km is.
    const km = Math.hypot((city.lat - lat) * 111, (city.lon - lon) * 101);
    assert.ok(
      km < 30,
      `${name} is ${Math.round(km)}km from where it should be — likely a different place with the same name`,
    );
  }
});

test("every city carries a region", () => {
  for (const c of cities) {
    assert.ok(c.region, `${c.name} has no region`);
  }
  // All thirteen should be represented, or a region page would be empty.
  assert.equal(new Set(cities.map((c) => c.region)).size, 13);
});
