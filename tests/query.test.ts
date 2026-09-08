import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHref,
  parseFacilityQuery,
} from "../src/lib/facility-query";
import {
  buildReviewHref,
  parseReviewQuery,
} from "../src/lib/review-query";

test("facility directory parses and serialises field and specialty filters", () => {
  const query = parseFacilityQuery({
    field: "medicine",
    specialty: "emergency_medicine",
    region: "riyadh",
    city: "riyadh-sa",
    page: "3",
  });

  assert.equal(query.field, "MEDICINE");
  assert.equal(query.specialty, "EMERGENCY_MEDICINE");
  assert.equal(
    buildHref("/facilities", query),
    "/facilities?region=riyadh&city=riyadh-sa&field=medicine&specialty=emergency_medicine&page=3",
  );
});

test("changing region clears an incompatible city and resets paging", () => {
  const query = parseFacilityQuery({ region: "riyadh", city: "riyadh-sa", page: "4" });
  assert.equal(
    buildHref("/facilities", query, { region: "makkah" }),
    "/facilities?region=makkah",
  );
});

test("unknown field and specialty values are safely ignored", () => {
  const query = parseFacilityQuery({ field: "card wizard", specialty: "magic" });
  assert.equal(query.field, undefined);
  assert.equal(query.specialty, undefined);
});

test("facility review links preserve specialty context and use the review anchor", () => {
  const query = parseReviewQuery({
    rfield: "medicine",
    rspecialty: "pediatrics",
    rsort: "newest",
    rpage: "2",
  });

  assert.equal(query.field, "MEDICINE");
  assert.equal(query.specialty, "PEDIATRICS");
  assert.equal(
    buildReviewHref("example-hospital", query),
    "/facilities/example-hospital?rsort=newest&rfield=medicine&rspecialty=pediatrics&rpage=2#reviews",
  );
});
