/**
 * Slugs and search-folding.
 *
 * Facility and city names arrive from OpenStreetMap in every script there is,
 * so neither function may assume Latin text. `slugify` degrades to an empty
 * string for names it cannot transliterate, and callers append a short id.
 */

/**
 * Fold a string for comparison: lower-cased, accent-stripped, punctuation
 * collapsed. Used for case-insensitive uniqueness and for matching "Ar Riyāḍ"
 * against "Ar Riyad".
 */
export function fold(input: string): string {
  return input
    .normalize("NFKD")
    // Strip combining marks so "Málaga" folds onto "malaga". The Arabic block
    // is excluded: its marks are letters, not accents.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** URL-safe slug. Returns "" when the name has no ASCII-representable part. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * A slug that is guaranteed to be non-empty and, with the suffix, unique.
 * Arabic- or Chinese-only names produce something like `facility-k3n8x2`,
 * which is ugly but honest — better than a transliteration we'd get wrong.
 */
export function slugWithSuffix(name: string, suffix: string, fallback = "facility"): string {
  const base = slugify(name) || fallback;
  return `${base}-${suffix.toLowerCase()}`;
}

/** Short, collision-resistant, unambiguous suffix for slugs. */
export function shortId(seed?: string): string {
  const alphabet = "23456789abcdefghjkmnpqrstvwxyz";
  if (seed) {
    // Deterministic from a seed, so re-imports produce the same slug.
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    let out = "";
    for (let i = 0; i < 6; i++) {
      out += alphabet[h % alphabet.length];
      h = Math.floor(h / alphabet.length) + 7919;
    }
    return out;
  }
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
