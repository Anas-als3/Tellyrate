import assert from "node:assert/strict";
import test from "node:test";
import { normaliseElement } from "../src/lib/osm";

test("OSM Arabic names are retained when the default name is English", () => {
  const facility = normaliseElement({
    type: "node",
    id: 123,
    lat: 24.7,
    lon: 46.7,
    tags: {
      amenity: "hospital",
      name: "KFMC",
      "name:en": "King Fahad Medical City",
      "name:ar": "مدينة الملك فهد الطبية",
    },
  });

  assert.ok(facility);
  assert.equal(facility.name, "KFMC");
  assert.equal(facility.nameEn, "King Fahad Medical City");
  assert.equal(facility.nameLocal, "مدينة الملك فهد الطبية");
});

test("an Arabic default name and English name keep both scripts", () => {
  const facility = normaliseElement({
    type: "way",
    id: 456,
    center: { lat: 21.5, lon: 39.2 },
    tags: {
      amenity: "clinic",
      name: "عيادة الجامعة",
      "name:en": "University Clinic",
    },
  });

  assert.ok(facility);
  assert.equal(facility.name, "University Clinic");
  assert.equal(facility.nameEn, null);
  assert.equal(facility.nameLocal, "عيادة الجامعة");
});
