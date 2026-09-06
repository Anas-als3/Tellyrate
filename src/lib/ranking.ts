/**
 * Ranking maths for Tellyrate.
 *
 * The whole point of a review site is that the ordering is honest, so both
 * formulas here are about the same thing: not letting a tiny sample shout down
 * a large one.
 */

/**
 * How much evidence a facility needs before its own average outweighs the
 * site-wide average. At C = 8, a place with two reviews is still pulled most
 * of the way toward the global mean, while one with fifty is essentially its
 * own average. Tuned for a directory where a busy teaching hospital collects
 * tens of reviews and a small clinic collects two or three.
 */
export const BAYES_CONFIDENCE = 8;

/** Fallback prior used before enough reviews exist to measure a real mean. */
export const DEFAULT_MEAN_RATING = 3.8;

/**
 * Bayesian average — the "highest rated" sort.
 *
 *   score = (C · m + Σ ratings) / (C + n)
 *
 * where `m` is the site-wide mean rating and `C` is the confidence constant.
 * A single 5★ review scores (8 · 3.8 + 5) / 9 ≈ 3.93, comfortably below a
 * facility with forty reviews averaging 4.6, which is the behaviour a reader
 * expects and a naive `AVG()` gets wrong.
 */
export function bayesianScore(
  ratingSum: number,
  reviewCount: number,
  meanRating: number = DEFAULT_MEAN_RATING,
): number {
  if (reviewCount <= 0) return 0;
  const m = Number.isFinite(meanRating) ? meanRating : DEFAULT_MEAN_RATING;
  return (BAYES_CONFIDENCE * m + ratingSum) / (BAYES_CONFIDENCE + reviewCount);
}

/**
 * Wilson lower bound of a binomial proportion at 95% confidence — the "most
 * helpful" sort for reviews.
 *
 * Sorting by `likes - dislikes` lets a 600/400 review beat a 20/0 one, and
 * sorting by raw ratio lets a 1/0 review top the page. Wilson asks instead:
 * given this sample, what is the lowest plausible true like-rate? That answers
 * both at once.
 */
export function wilsonLowerBound(likes: number, dislikes: number): number {
  const n = likes + dislikes;
  if (n <= 0) return 0;

  const z = 1.959963984540054; // 97.5th percentile of the standard normal
  const phat = likes / n;
  const z2 = z * z;

  const numerator =
    phat +
    z2 / (2 * n) -
    z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);

  return numerator / (1 + z2 / n);
}

/** Round to 2dp for display without letting float noise show through. */
export function roundRating(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The sort options offered in the UI, and what each one orders by. */
export const SORT_OPTIONS = {
  most_reviewed: "Most reviewed",
  highest_rated: "Highest rated",
  newest: "Recently added",
  name: "Name (A–Z)",
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export const DEFAULT_SORT: SortKey = "most_reviewed";

export function isSortKey(value: string | undefined): value is SortKey {
  return value !== undefined && value in SORT_OPTIONS;
}

export const REVIEW_SORT_OPTIONS = {
  helpful: "Most helpful",
  newest: "Newest",
  oldest: "Oldest",
  highest: "Highest rated",
  lowest: "Lowest rated",
} as const;

export type ReviewSortKey = keyof typeof REVIEW_SORT_OPTIONS;

export function isReviewSortKey(
  value: string | undefined,
): value is ReviewSortKey {
  return value !== undefined && value in REVIEW_SORT_OPTIONS;
}
