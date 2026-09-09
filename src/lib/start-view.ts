/**
 * Everything the first-run board renders, rendered.
 *
 * The board is a client component, and the dictionary's counted strings are
 * functions — "376 places" has to pick an Arabic plural from five forms, and a
 * function cannot cross the server/client boundary. So every string it will
 * ever show is produced here, on the server, for the options that actually
 * exist: twelve fields, thirteen regions, seventy-six cities, and the eighty
 * or so (city, field) pairs anybody has written about. It comes to a few
 * kilobytes, and only for a reader who has not seen the board before.
 *
 * The button is the same trick one level further. Its count is always one of
 * the numbers already on the board, so `showLabels` holds a finished label for
 * every count it can reach, keyed by the count — rather than shipping a
 * pluraliser to the browser to rebuild one sentence.
 *
 * Deliberately not imported by any client module: it pulls in both complete
 * dictionaries. The page calls it and passes the result down.
 */

import type { StartStrings, StartView } from "@/components/start-overlay";
import { lookup, type Dictionary, type Locale } from "@/lib/i18n/dictionaries";
import { cityNameFor } from "@/lib/i18n/names";
import { STUDENT_FIELDS } from "@/lib/labels";
import {
  START_STEPS,
  startResultCounts,
  type StartCity,
  type StartOptions,
} from "@/lib/start";

export type StartProps = {
  options: StartView;
  strings: StartStrings;
  showLabels: Record<string, string>;
};

export function buildStartProps(
  options: StartOptions,
  t: Dictionary,
  locale: Locale,
): StartProps {
  const fieldLabel = (value: string) =>
    lookup(t.labels.studentField, value, value);

  const citiesByRegion = new Map<string, StartCity[]>();
  for (const city of options.cities) {
    const bucket = citiesByRegion.get(city.region);
    if (bucket) bucket.push(city);
    else citiesByRegion.set(city.region, [city]);
  }

  /** "24 with Medicine", for each field with anything behind it here. */
  function fieldNotes(counts: Record<string, number>): Record<string, string> {
    const notes: Record<string, string> = {};
    for (const field of STUDENT_FIELDS) {
      const n = counts[field] ?? 0;
      if (n > 0) notes[field] = t.start.withField(n, fieldLabel(field));
    }
    return notes;
  }

  const fields = options.fields.map((field) => ({
    ...field,
    label: fieldLabel(field.value),
    // The sentence says experiences, so the number is experiences. The place
    // counts appear from the next question on, where they are what the
    // directory will actually print.
    note: t.start.experienceCount(field.experiences),
  }));

  const regions = options.regions.map((region) => {
    const label = lookup(t.labels.region, region.key, region.key);
    const here = citiesByRegion.get(region.key) ?? [];
    const summed: Record<string, number> = {};
    for (const city of here) {
      for (const [field, n] of Object.entries(city.byField)) {
        summed[field] = (summed[field] ?? 0) + n;
      }
    }
    return {
      ...region,
      label,
      note: t.start.placeCount(region.facilities),
      fieldNotes: fieldNotes(summed),
      cityHeading: t.start.cityHeading(label),
      anywhereLabel: t.start.anywhereIn(label),
    };
  });

  const cities = options.cities.map((city) => ({
    ...city,
    // City rows are stored under their canonical English name; an Arabic page
    // shows the Arabic one.
    label: cityNameFor(locale, city.name),
    note: t.start.placeCount(city.facilities),
    fieldNotes: fieldNotes(city.byField),
  }));

  return {
    options: { fields, regions, cities },
    strings: {
      eyebrow: t.start.eyebrow,
      lede: t.start.lede,
      dialogLabel: t.start.dialogLabel,
      dismiss: t.start.dismiss,
      back: t.start.back,
      separator: t.common.separator,
      stepNames: t.start.stepNames,
      // Counted off `START_STEPS` rather than written out, so adding a fourth
      // question cannot leave the announcement saying "undefined".
      stepLabels: START_STEPS.map((_, i) =>
        t.start.step(i + 1, START_STEPS.length),
      ),
      fieldHeading: t.start.fieldHeading,
      fieldLede: t.start.fieldLede,
      fieldNothing: t.start.fieldNothing,
      regionHeading: t.start.regionHeading,
      regionLede: t.start.regionLede,
      cityLede: t.start.cityLede,
      noteWithField: t.start.noteWithField,
      noteWithoutField: t.start.noteWithoutField,
      showFallback: t.start.showFallback,
    },
    showLabels: showLabelsFor(options, t),
  };
}

/**
 * A finished button label for every count the button can show.
 *
 * The reachable set is small and enumerable — see `startResultCounts`, which
 * owns the rule and is tested against it.
 */
function showLabelsFor(
  options: StartOptions,
  t: Dictionary,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const n of startResultCounts(options))
    labels[String(n)] = t.start.show(n);
  return labels;
}
