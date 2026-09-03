import assert from "node:assert/strict";
import test from "node:test";
import {
  BAYES_CONFIDENCE,
  bayesianScore,
  wilsonLowerBound,
} from "../src/lib/ranking";

const MEAN = 3.8;

test("a single five-star review cannot outrank a well-reviewed facility", () => {
  const newcomer = bayesianScore(5, 1, MEAN); // one 5-star review
  const established = bayesianScore(184, 40, MEAN); // forty averaging 4.6
  assert.ok(
    newcomer < established,
    `expected ${newcomer} < ${established}: this is the whole point of the ranking`,
  );
});

test("more evidence at the same average scores higher", () => {
  // Both average 4.5; the one with more reviews should win.
  const few = bayesianScore(9, 2, MEAN);
  const many = bayesianScore(90, 20, MEAN);
  assert.ok(few < many);
});

test("scores are pulled toward the site mean in proportion to evidence", () => {
  // With no reviews of its own, a facility would sit exactly at the mean.
  const oneReview = bayesianScore(5, 1, MEAN);
  assert.ok(oneReview > MEAN && oneReview < 5);

  // With many reviews, the score converges on the facility's own average.
  const converged = bayesianScore(5 * 500, 500, MEAN);
  assert.ok(Math.abs(converged - 5) < 0.05);
});

test("the confidence constant is the crossover point", () => {
  // At n = C, the score sits exactly halfway between the mean and the average.
  const n = BAYES_CONFIDENCE;
  const score = bayesianScore(5 * n, n, MEAN);
  assert.ok(Math.abs(score - (MEAN + 5) / 2) < 1e-9);
});

test("an unreviewed facility scores zero rather than the prior", () => {
  // Otherwise every empty facility would rank mid-table on the rating sort.
  assert.equal(bayesianScore(0, 0, MEAN), 0);
});

test("Wilson prefers a confident small majority over a shaky large one", () => {
  const unanimous = wilsonLowerBound(20, 0);
  const contested = wilsonLowerBound(600, 400);
  assert.ok(
    unanimous > contested,
    `expected 20/0 (${unanimous}) to beat 600/400 (${contested})`,
  );
});

test("Wilson discounts a lone vote heavily", () => {
  const single = wilsonLowerBound(1, 0);
  assert.ok(single < 0.5, `a single like should not score ${single}`);
  assert.ok(single > 0);
  // And more of the same evidence raises confidence.
  assert.ok(wilsonLowerBound(10, 0) > single);
});

test("Wilson stays within [0, 1] at the boundaries", () => {
  for (const [likes, dislikes] of [
    [0, 0],
    [0, 5],
    [5, 0],
    [1, 1],
    [10_000, 1],
  ]) {
    const score = wilsonLowerBound(likes, dislikes);
    assert.ok(
      Number.isFinite(score) && score >= 0 && score <= 1,
      `out of range for ${likes}/${dislikes}: ${score}`,
    );
  }
});
