import assert from "node:assert/strict";
import test from "node:test";
import { facilitySearchConditions } from "../src/lib/facility-search-query";
import {
  cityNameFor,
  citySearchName,
  facilityNamesFor,
} from "../src/lib/i18n/names";

test("Saudi city names are shown in Arabic on Arabic pages", () => {
  assert.equal(cityNameFor("ar", "Riyadh"), "الرياض");
  assert.equal(cityNameFor("ar", "Al Quway'iyah"), "القويعية");
  assert.equal(cityNameFor("en", "Riyadh"), "Riyadh");
  assert.equal(cityNameFor("ar", "Unknown city"), "Unknown city");
});

test("Arabic city searches resolve to the canonical database name", () => {
  assert.equal(citySearchName("الرياض"), "Riyadh");
  assert.equal(citySearchName("  الرِّياض  "), "Riyadh");
  assert.equal(citySearchName("مكة"), "Mecca");
  assert.equal(citySearchName("محايل"), "Mahayil");
  assert.equal(citySearchName("عسير"), null);
  assert.equal(citySearchName("مدينة غير موجودة"), null);
});

test("facility names follow the interface language without duplicates", () => {
  const facility = {
    name: "King Fahad Medical City",
    nameLocal: "مدينة الملك فهد الطبية",
  };

  assert.deepEqual(facilityNamesFor("ar", facility), {
    primary: "مدينة الملك فهد الطبية",
    secondary: "King Fahad Medical City",
  });
  assert.deepEqual(facilityNamesFor("en", facility), {
    primary: "King Fahad Medical City",
    secondary: "مدينة الملك فهد الطبية",
  });
  assert.deepEqual(
    facilityNamesFor("ar", { name: "NEOM Hospital", nameLocal: null }),
    { primary: "NEOM Hospital", secondary: null },
  );
  assert.deepEqual(
    facilityNamesFor("en", {
      name: "KFMC",
      nameEn: "King Fahad Medical City",
      nameLocal: "مدينة الملك فهد الطبية",
    }),
    {
      primary: "King Fahad Medical City",
      secondary: "مدينة الملك فهد الطبية",
    },
  );
});

test("duplicate search stays name-only while global search can match cities", () => {
  const duplicateSearch = facilitySearchConditions("الرياض");
  assert.equal(duplicateSearch.length, 3);
  assert.ok(duplicateSearch.every((condition) => !("city" in condition)));

  const globalSearch = facilitySearchConditions("الرياض", {
    includeCity: true,
  });
  assert.equal(globalSearch.length, 5);
  assert.equal(
    globalSearch.filter((condition) => "city" in condition).length,
    2,
  );
});
