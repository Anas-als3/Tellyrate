import assert from "node:assert/strict";
import test from "node:test";
import { fold, shortId, slugify, slugWithSuffix } from "../src/lib/slug";
import { rotationStamp } from "../src/lib/labels";

test("folding collapses transliteration and accent variants", () => {
  // The reason this exists: OpenStreetMap spells the same city several ways.
  assert.equal(fold("Ar Riyāḍ"), fold("ar riyad"));
  assert.equal(fold("Málaga"), "malaga");
  assert.equal(fold("Hôpital Saint-Louis"), "hopital saint louis");
});

test("folding normalises punctuation and whitespace", () => {
  assert.equal(fold("St. Mary's  Hospital & Clinic"), "st mary s hospital clinic");
  assert.equal(fold("  King   Fahd  "), "king fahd");
});

test("folding leaves non-Latin scripts intact", () => {
  // Arabic combining marks are letters, not accents — stripping them would
  // change the word.
  assert.equal(fold("مستشفى الملك فيصل"), "مستشفى الملك فيصل");
});

test("slugify produces URL-safe slugs from Latin names", () => {
  assert.equal(slugify("King Fahd Medical City"), "king-fahd-medical-city");
  assert.equal(slugify("Hôpital Saint-Louis"), "hopital-saint-louis");
  assert.equal(slugify("St. Mary's Hospital"), "st-mary-s-hospital");
  // No leading, trailing or doubled separators.
  assert.equal(slugify("  --Weird--  Name--  "), "weird-name");
});

test("slugify returns empty for names with no Latin part", () => {
  // Honest failure beats a transliteration we would get wrong.
  assert.equal(slugify("مستشفى الملك فيصل التخصصي"), "");
  assert.equal(slugify("北京协和医院"), "");
});

test("slugWithSuffix always yields a usable, non-empty slug", () => {
  assert.match(slugWithSuffix("King Fahd Medical City", "abc123"), /^king-fahd-medical-city-abc123$/);
  // Arabic-only names fall back to the placeholder rather than a bare suffix.
  assert.match(slugWithSuffix("مستشفى الملك", "abc123"), /^facility-abc123$/);
});

test("seeded shortId is deterministic, so re-imports keep their slugs", () => {
  assert.equal(shortId("node/12345"), shortId("node/12345"));
  assert.notEqual(shortId("node/12345"), shortId("node/12346"));
  assert.match(shortId("node/12345"), /^[a-z0-9]{6}$/);
});

test("unseeded shortId is random", () => {
  const ids = new Set(Array.from({ length: 50 }, () => shortId()));
  assert.ok(ids.size > 45, "expected mostly-unique ids");
});

test("rotation dates coarsen while a facility has few reviews", () => {
  // With enough reviews the exact year is safe to show.
  assert.equal(rotationStamp(2025, 12), "2025");
  assert.equal(rotationStamp(2025, 5), "2025");

  // Below the threshold, a year plus a small department could name one
  // person, so it blurs to a band.
  assert.equal(rotationStamp(2025, 4), "2025–2029");
  assert.equal(rotationStamp(2023, 1), "2020–2024");

  assert.equal(rotationStamp(null, 20), null);
});
