import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveStartOptions,
  startFieldMatches,
  startHref,
  startResultCount,
  startResultCounts,
  type StartOptions,
} from "../src/lib/start";
import { buildHref } from "../src/lib/facility-query";
import { DEFAULT_SORT } from "../src/lib/ranking";

/**
 * The first-run chooser exists to save a new reader three decisions. It is
 * worth exactly nothing if the three decisions land on "No facilities match
 * these filters", which is the likely outcome for most of them: there are two
 * hundred experiences spread over nearly two thousand facilities, so almost
 * every (city, field) pair is empty.
 *
 * So these tests are about one thing — the chooser is never allowed to hand
 * over a URL with nothing behind it.
 */

const reviews = [
  // Riyadh: two medical facilities, one of them written up twice.
  { facilityId: "f1", field: "MEDICINE", citySlug: "riyadh-sa" },
  { facilityId: "f1", field: "MEDICINE", citySlug: "riyadh-sa" },
  { facilityId: "f2", field: "MEDICINE", citySlug: "riyadh-sa" },
  // Riyadh: one nursing facility, which happens to be a medical one too.
  { facilityId: "f1", field: "NURSING", citySlug: "riyadh-sa" },
  // Jeddah: one medical facility.
  { facilityId: "f3", field: "MEDICINE", citySlug: "jeddah-sa" },
];

const cities = [
  { slug: "riyadh-sa", name: "Riyadh", region: "RIYADH", facilityCount: 376 },
  {
    slug: "al-kharj-sa",
    name: "Al Kharj",
    region: "RIYADH",
    facilityCount: 40,
  },
  { slug: "jeddah-sa", name: "Jeddah", region: "MAKKAH", facilityCount: 341 },
  // Listed by the loader only if it has facilities; guarded here as well.
  { slug: "empty-sa", name: "Empty", region: "MAKKAH", facilityCount: 0 },
];

const regions = [
  { key: "RIYADH", slug: "riyadh", facilityCount: 416, cityCount: 2 },
  { key: "MAKKAH", slug: "makkah", facilityCount: 341, cityCount: 1 },
  { key: "AL_BAHAH", slug: "al-bahah", facilityCount: 0, cityCount: 1 },
];

const options: StartOptions = deriveStartOptions({ reviews, cities, regions });

test("a field counts facilities, not experiences", () => {
  const medicine = options.fields.find((f) => f.value === "MEDICINE");
  assert.ok(medicine);
  // Four experiences, but only three places anyone could apply to.
  assert.equal(medicine.experiences, 4);
  assert.equal(medicine.facilities, 3);
});

test("every field is offered, including the ones nobody has written about", () => {
  assert.equal(options.fields.length, 12);
  const pharmacy = options.fields.find((f) => f.value === "PHARMACY");
  assert.ok(pharmacy);
  assert.equal(pharmacy.experiences, 0);
  assert.equal(pharmacy.facilities, 0);
});

test("fields keep their declared order rather than sorting by popularity", () => {
  // Someone scanning for their own subject needs the list to sit still.
  assert.equal(options.fields[0].value, "MEDICINE");
  assert.equal(options.fields.at(-1)?.value, "OTHER");
});

test("a city's field counts deduplicate a facility written up twice", () => {
  const riyadh = options.cities.find((c) => c.slug === "riyadh-sa");
  assert.ok(riyadh);
  assert.equal(riyadh.byField.MEDICINE, 2);
  assert.equal(riyadh.byField.NURSING, 1);
  // Sparse: a field with nothing behind it is absent, not zero.
  assert.equal("PHARMACY" in riyadh.byField, false);
});

test("places with nothing in them are never offered", () => {
  assert.equal(
    options.cities.some((c) => c.slug === "empty-sa"),
    false,
  );
  assert.equal(
    options.regions.some((r) => r.slug === "al-bahah"),
    false,
  );
});

test("a region's field matches sum the cities inside it", () => {
  assert.equal(
    startFieldMatches(options, { field: "MEDICINE", region: "riyadh" }),
    2,
  );
  assert.equal(
    startFieldMatches(options, { field: "MEDICINE", region: "makkah" }),
    1,
  );
});

test("a chosen field that matches something is carried into the URL", () => {
  assert.equal(
    startHref(options, {
      field: "MEDICINE",
      region: "riyadh",
      city: "riyadh-sa",
    }),
    "/facilities?region=riyadh&city=riyadh-sa&field=medicine",
  );
});

test("a chosen field that matches nothing steps aside instead of emptying the page", () => {
  // Nobody has written up a pharmacy placement in Al Kharj — and answering
  // three questions to be told so is the failure this whole rule prevents.
  assert.equal(
    startHref(options, {
      field: "PHARMACY",
      region: "riyadh",
      city: "al-kharj-sa",
    }),
    "/facilities?region=riyadh&city=al-kharj-sa",
  );
});

test("skipping the city keeps the whole region", () => {
  assert.equal(
    startHref(options, { field: "MEDICINE", region: "riyadh" }),
    "/facilities?region=riyadh&field=medicine",
  );
});

test("the count on the button is the count the directory will show", () => {
  // Field kept: the number of places with that field's experiences.
  assert.equal(
    startResultCount(options, {
      field: "MEDICINE",
      region: "riyadh",
      city: "riyadh-sa",
    }),
    2,
  );
  // Field dropped: every place in the city, which is what the URL now asks for.
  assert.equal(
    startResultCount(options, {
      field: "PHARMACY",
      region: "riyadh",
      city: "al-kharj-sa",
    }),
    40,
  );
  assert.equal(
    startResultCount(options, { field: "PHARMACY", region: "riyadh" }),
    416,
  );
});

test("the sort is left at its default so the URL carries no redundant parameter", () => {
  assert.equal(
    startHref(options, { region: "makkah" }),
    "/facilities?region=makkah",
  );
});

/**
 * `startHref` serialises the destination itself rather than calling
 * `buildHref`, to keep zod off the home page — see the note on that function.
 * This is the guard that keeps the copy honest: every URL it can produce has
 * to be the one the directory's own serialiser would have produced.
 */
test("the hand-rolled serialiser agrees with buildHref everywhere", () => {
  const fields = [undefined, "MEDICINE", "PHARMACY", "EMERGENCY_MEDICAL"];
  const regions = [undefined, "riyadh", "makkah"];
  const cities = [undefined, "riyadh-sa", "al-kharj-sa", "jeddah-sa"];

  for (const field of fields) {
    for (const region of regions) {
      for (const city of cities) {
        const choice = { field, region, city };
        const keepsField = startFieldMatches(options, choice) > 0;
        assert.equal(
          startHref(options, choice),
          buildHref("/facilities", {
            q: "",
            sort: DEFAULT_SORT,
            page: 1,
            region,
            city,
            field: keepsField ? field : undefined,
          }),
          `disagreed for ${JSON.stringify(choice)}`,
        );
      }
    }
  }
});

/**
 * The button's label is looked up, not built, because pluralising it in Arabic
 * needs five forms that live in the server-side dictionary. That only works
 * while the enumeration is complete, so this walks every choice the board can
 * actually reach and checks the count it would show was rendered ahead of it.
 */
test("every count the button can show was enumerated in advance", () => {
  const available = new Set(startResultCounts(options));

  const fields = [undefined, ...options.fields.map((f) => f.value)];
  for (const field of fields) {
    assert.ok(available.has(startResultCount(options, { field })));

    for (const region of options.regions) {
      const choice = { field, region: region.slug };
      assert.ok(
        available.has(startResultCount(options, choice)),
        `missing count for ${JSON.stringify(choice)}`,
      );

      for (const city of options.cities.filter(
        (c) => c.region === region.key,
      )) {
        const withCity = { ...choice, city: city.slug };
        assert.ok(
          available.has(startResultCount(options, withCity)),
          `missing count for ${JSON.stringify(withCity)}`,
        );
      }
    }
  }
});
