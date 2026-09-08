import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHref,
  parseFacilityQuery,
} from "../src/lib/facility-query";
import {
  buildReviewHref,
  buildReviewPermalink,
  parseLinkedReviewId,
  parseReviewQuery,
  reviewPageForPrecedingCount,
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

test("review previews link to the exact review in newest order", () => {
  assert.equal(
    buildReviewPermalink("example-hospital", "review-123"),
    "/facilities/example-hospital?rsort=newest&rreview=review-123#review-review-123",
  );
});

test("review deep links accept one safe id and reject malformed input", () => {
  assert.equal(parseLinkedReviewId(" cm123_ABC-9 "), "cm123_ABC-9");
  assert.equal(parseLinkedReviewId(["first", "second"]), "first");
  assert.equal(parseLinkedReviewId("../../../account"), undefined);
  assert.equal(parseLinkedReviewId("x".repeat(129)), undefined);
});

test("review deep links resolve pagination boundaries", () => {
  assert.equal(reviewPageForPrecedingCount(0, 10), 1);
  assert.equal(reviewPageForPrecedingCount(9, 10), 1);
  assert.equal(reviewPageForPrecedingCount(10, 10), 2);
  assert.equal(reviewPageForPrecedingCount(25, 10), 3);
});
