"use client";

import { forwardRef, useRef } from "react";
import Link from "next/link";
import type { FilterFacets, FilterOption } from "@/components/filter-rail";

type Strings = {
  region: string;
  city: string;
  field: string;
  specialty: string;
  kind: string;
  rating: string;
  anyRegion: string;
  anyCity: string;
  anyField: string;
  anySpecialty: string;
  anyKind: string;
  anyRating: string;
  apply: string;
  clear: string;
};

export function MobileFilterForm({
  base,
  values,
  facets,
  regions,
  clearHref,
  strings,
}: {
  base: string;
  values: {
    q: string;
    sort?: string;
    country?: string;
    region?: string;
    city?: string;
    field?: string;
    specialty?: string;
    kind?: string;
    min?: string;
  };
  facets: FilterFacets;
  regions: FilterOption[];
  clearHref: string;
  strings: Strings;
}) {
  const cityRef = useRef<HTMLSelectElement>(null);

  return (
    <form
      action={base}
      method="get"
      onSubmit={(event) => {
        // Empty selects represent "any" and should not clutter the resulting
        // URL. Without JavaScript they are harmless and the page still works.
        for (const control of event.currentTarget.elements) {
          if (control instanceof HTMLSelectElement && control.value === "") {
            control.disabled = true;
          }
        }
      }}
      style={{ display: "grid", gap: "var(--space-s)" }}
    >
      {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
      {values.sort ? (
        <input type="hidden" name="sort" value={values.sort} />
      ) : null}
      {values.country ? (
        <input type="hidden" name="country" value={values.country} />
      ) : null}

      <FilterSelect
        name="region"
        label={strings.region}
        anyLabel={strings.anyRegion}
        options={regions}
        value={values.region}
        onChange={() => {
          if (cityRef.current) cityRef.current.value = "";
        }}
      />
      <FilterSelect
        ref={cityRef}
        name="city"
        label={strings.city}
        anyLabel={strings.anyCity}
        options={facets.cities}
        value={values.city}
      />
      <FilterSelect
        name="field"
        label={strings.field}
        anyLabel={strings.anyField}
        options={facets.fields}
        value={values.field}
        lowerCase
      />
      <FilterSelect
        name="specialty"
        label={strings.specialty}
        anyLabel={strings.anySpecialty}
        options={facets.specialties}
        value={values.specialty}
        lowerCase
      />
      <FilterSelect
        name="kind"
        label={strings.kind}
        anyLabel={strings.anyKind}
        options={facets.kinds}
        value={values.kind}
        lowerCase
      />
      <FilterSelect
        name="min"
        label={strings.rating}
        anyLabel={strings.anyRating}
        options={facets.ratings}
        value={values.min}
      />

      <div style={{ display: "flex", gap: "var(--space-xs)" }}>
        <button className="btn btn--primary" type="submit" style={{ flex: 1 }}>
          {strings.apply}
        </button>
        <Link className="btn btn--quiet" href={clearHref}>
          {strings.clear}
        </Link>
      </div>
    </form>
  );
}

const FilterSelect = forwardRef<
  HTMLSelectElement,
  {
    name: string;
    label: string;
    anyLabel: string;
    options: FilterOption[];
    value?: string;
    lowerCase?: boolean;
    onChange?: () => void;
  }
>(function FilterSelect(
  { name, label, anyLabel, options, value, lowerCase = false, onChange },
  ref,
) {
  const visible = options.filter(
    (option) =>
      option.value === value || option.count === undefined || option.count > 0,
  );
  const selected = lowerCase ? value?.toLowerCase() : value;

  return (
    <label className="field">
      <span className="label">{label}</span>
      <select
        ref={ref}
        className="select"
        name={name}
        defaultValue={selected ?? ""}
        onChange={onChange}
      >
        <option value="">{anyLabel}</option>
        {visible.map((option) => {
          const optionValue = lowerCase
            ? option.value.toLowerCase()
            : option.value;
          return (
            <option key={option.value} value={optionValue}>
              {option.label}
              {option.count === undefined ? "" : ` (${option.count})`}
            </option>
          );
        })}
      </select>
    </label>
  );
});
