import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type ImportRow = {
  sourceRow: number;
  facilitySlug: string;
  field: string;
  role: string;
  specialty: string;
};

const rows = JSON.parse(
  readFileSync(new URL("../data/batch17-reviews.json", import.meta.url), "utf8"),
) as ImportRow[];

test("the reviewed Batch 17 artifact contains exactly the approved source rows", () => {
  assert.equal(rows.length, 79);
  assert.deepEqual(
    rows.filter((row) => [30, 40, 69].includes(row.sourceRow)),
    [],
  );
  assert.equal(new Set(rows.map((row) => row.sourceRow)).size, rows.length);
});

test("the KASCH adult-endocrine response stays attached to KASCH", () => {
  const row = rows.find((candidate) => candidate.sourceRow === 70);
  assert.ok(row);
  assert.equal(
    row.facilitySlug,
    "king-abdullah-specialized-childrens-hospital-riyadh",
  );
  assert.equal(row.specialty, "INTERNAL_MEDICINE");
});

test("the survey import preserves the source cohort without inventing roles", () => {
  for (const row of rows) {
    assert.equal(row.field, "MEDICINE");
    assert.equal(row.role, "INTERN");
  }
});
