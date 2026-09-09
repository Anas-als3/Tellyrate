/**
 * Human-readable labels for every enum the UI shows.
 *
 * Kept in one place so a facility kind reads identically on a card, a filter
 * pill and a review stamp — and so adding a value to the schema surfaces as
 * one obvious edit rather than four scattered ones.
 */

export const FACILITY_KIND_LABELS: Record<string, string> = {
  HOSPITAL: "Hospital",
  CLINIC: "Clinic",
  HEALTH_CENTER: "Health centre",
  DENTAL_CLINIC: "Dental clinic",
  PHARMACY: "Pharmacy",
  LABORATORY: "Laboratory",
  REHAB_CENTER: "Rehabilitation",
  MENTAL_HEALTH: "Mental health",
  OTHER: "Other",
};

export const FACILITY_KINDS = Object.keys(FACILITY_KIND_LABELS);

export const STUDENT_FIELD_LABELS: Record<string, string> = {
  MEDICINE: "Medicine",
  NURSING: "Nursing",
  PHARMACY: "Pharmacy",
  DENTISTRY: "Dentistry",
  LABORATORY: "Laboratory science",
  RADIOLOGY: "Radiology",
  PHYSIOTHERAPY: "Physiotherapy",
  RESPIRATORY: "Respiratory therapy",
  NUTRITION: "Nutrition",
  EMERGENCY_MEDICAL: "Emergency medical services",
  PUBLIC_HEALTH: "Public health",
  OTHER: "Other",
};

export const STUDENT_FIELDS = Object.keys(STUDENT_FIELD_LABELS);

/**
 * What the reviewer was doing at the facility. Read together with their field,
 * so a review is placed as "Pharmacy · Internship" or "Medicine · Summer
 * training".
 *
 * Every value the database recognises is here, because every one of them is on
 * a review somebody wrote. Only three are still offered — see
 * `TRAINEE_ROLES_OFFERED` below.
 */
export const TRAINEE_ROLE_LABELS: Record<string, string> = {
  INTERN: "Internship year",
  SUMMER_TRAINEE: "Summer training",
  VOLUNTEER: "Volunteering",
  STUDENT: "Student on rotation",
  RESIDENT: "Resident",
  FELLOW: "Fellow",
  OBSERVER: "Observer",
  OTHER: "Other",
};

export const TRAINEE_ROLES = Object.keys(TRAINEE_ROLE_LABELS);

/**
 * The three a new review may choose from, in the order they are offered.
 *
 * These are the three ways a Saudi health student actually turns up at a
 * facility outside their coursework: the internship year, a summer placement,
 * and volunteering.
 *
 * The rest of `TRAINEE_ROLES` is recognised but not offered. Nobody in
 * production has written a review under the old, longer list — every published
 * review is an internship year, and all of them came from the batch survey
 * import rather than from the form. So this is a guard rather than a
 * migration: if a review carrying a retired value ever does turn up, from a
 * seeded database or a future import, it displays what its author said and
 * survives being edited, instead of being quietly restated as an internship.
 */
export const TRAINEE_ROLES_OFFERED = [
  "INTERN",
  "SUMMER_TRAINEE",
  "VOLUNTEER",
] as const;

export type OfferedTraineeRole = (typeof TRAINEE_ROLES_OFFERED)[number];

export function isOfferedTraineeRole(value: string): boolean {
  return (TRAINEE_ROLES_OFFERED as readonly string[]).includes(value);
}

/**
 * Whether a review may be saved carrying this role.
 *
 * `existing` is what the review already says, and passing it is what lets
 * somebody fix a typo in a review written under the old question without being
 * made to restate their placement as one of the three. A new review has no
 * existing role, so it gets the three and nothing else.
 */
export function traineeRoleAllowed(next: string, existing?: string): boolean {
  return isOfferedTraineeRole(next) || next === existing;
}

/**
 * The roles to put in the form's menu: the three, plus whatever this review
 * already says if the question no longer offers it.
 */
export function traineeRoleOptions(
  current?: string | null,
): readonly string[] {
  return current && !isOfferedTraineeRole(current)
    ? [...TRAINEE_ROLES_OFFERED, current]
    : TRAINEE_ROLES_OFFERED;
}

/** The short form used in the rotation stamp, where space is tight. */
export const TRAINEE_ROLE_SHORT: Record<string, string> = {
  INTERN: "Internship",
  SUMMER_TRAINEE: "Summer training",
  VOLUNTEER: "Volunteer",
  STUDENT: "Student",
  RESIDENT: "Resident",
  FELLOW: "Fellow",
  OBSERVER: "Observer",
  OTHER: "Trainee",
};

/** Broad, filterable placement areas. The optional department remains free
 * text for a hospital's own unit or team name. */
export const ROTATION_SPECIALTY_LABELS: Record<string, string> = {
  FAMILY_MEDICINE: "Family medicine",
  EMERGENCY_MEDICINE: "Emergency medicine",
  INTERNAL_MEDICINE: "Internal medicine",
  GENERAL_SURGERY: "General surgery",
  PEDIATRICS: "Paediatrics",
  OBSTETRICS_GYNECOLOGY: "Obstetrics & gynaecology",
  ANESTHESIOLOGY: "Anaesthesiology",
  INTENSIVE_CARE: "Intensive care",
  OTOLARYNGOLOGY: "ENT",
  UROLOGY: "Urology",
  ORTHOPEDICS: "Orthopaedics",
  PSYCHIATRY: "Psychiatry",
  RADIOLOGY: "Radiology",
  PATHOLOGY: "Pathology",
  ONCOLOGY: "Oncology",
  OPHTHALMOLOGY: "Ophthalmology",
  DERMATOLOGY: "Dermatology",
  NEUROLOGY: "Neurology",
  NEONATOLOGY: "Neonatology / NICU",
  PEDIATRIC_EMERGENCY: "Paediatric emergency",
  PEDIATRIC_SUBSPECIALTY: "Paediatric subspecialty",
  SURGICAL_SUBSPECIALTY: "Surgical subspecialty",
  PHARMACY: "Pharmacy",
  DENTISTRY: "Dentistry",
  LABORATORY: "Laboratory medicine",
  REHABILITATION: "Rehabilitation",
  PUBLIC_HEALTH: "Public health",
  OTHER: "Other",
};

export const ROTATION_SPECIALTIES = Object.keys(ROTATION_SPECIALTY_LABELS);

/**
 * Suggestions for the free-text department field. Offered through a
 * `<datalist>` rather than a `<select>`, because departments are named
 * differently at every hospital and a closed list would just be wrong.
 */
export const DEPARTMENT_SUGGESTIONS = [
  "Emergency",
  "Internal medicine",
  "General surgery",
  "Paediatrics",
  "Obstetrics & gynaecology",
  "Intensive care",
  "Anaesthesia",
  "Orthopaedics",
  "Psychiatry",
  "Radiology",
  "Cardiology",
  "Oncology",
  "Family medicine",
  "Inpatient pharmacy",
  "Outpatient pharmacy",
  "Clinical pharmacy",
  "Laboratory",
  "Microbiology",
  "Physiotherapy",
  "Dentistry",
  "Nursing ward",
  "Outpatient clinics",
];

/**
 * The sub-rating axes, in the order they are shown.
 *
 * These are the six things students actually compare placements on. Each maps
 * to a nullable column on Review and an average on Facility.
 */
export const RATING_AXES = [
  {
    key: "supervision",
    avgKey: "avgSupervision",
    label: "Supervision & teaching",
    hint: "Were you taught, or left to watch?",
  },
  {
    key: "handsOn",
    avgKey: "avgHandsOn",
    label: "Hands-on experience",
    hint: "Did you get to do things yourself?",
  },
  {
    key: "staffRespect",
    avgKey: "avgStaffRespect",
    label: "How students are treated",
    hint: "Were you treated as a colleague or an inconvenience?",
  },
  {
    key: "workload",
    avgKey: "avgWorkload",
    label: "Workload & hours",
    hint: "Were the hours reasonable and predictable?",
  },
  {
    key: "resources",
    avgKey: "avgResources",
    label: "Facilities & equipment",
    hint: "Somewhere to sit, eat, change, and working equipment?",
  },
  {
    key: "safety",
    avgKey: "avgSafety",
    label: "Safety & wellbeing",
    hint: "PPE, incident reporting, and how concerns were handled.",
  },
] as const;

export type RatingAxis = (typeof RATING_AXES)[number];

export const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: "Spam or advertising",
  HARASSMENT: "Harassment or abuse",
  PERSONAL_INFO: "Identifies a person",
  MISINFORMATION: "Factually untrue",
  OFF_TOPIC: "Not about clinical training",
  DUPLICATE: "Duplicate",
  OTHER: "Something else",
};

/**
 * Tellyrate covers Saudi Arabia only.
 *
 * The scope is deliberate rather than a starting point: a review site is only
 * useful once a given hospital has several reviews, and spreading thin across
 * many countries would leave every facility with one. The schema keeps a
 * country column so this can widen later without a migration.
 */
export const SITE_COUNTRY_CODE = "SA";
export const SITE_COUNTRY_NAME = "Saudi Arabia";

export const COUNTRY_NAMES: Record<string, string> = {
  SA: "Saudi Arabia",
};


/**
 * The thirteen administrative regions, in the order they are shown.
 *
 * Ordered by population rather than alphabetically: a student scanning the list
 * is far likelier to want Riyadh or Makkah than Al Jawf, and alphabetical order
 * would bury them. Display names come from the dictionary; this file owns only
 * the order and the URL slugs.
 */
export const REGIONS = [
  { key: "RIYADH", slug: "riyadh" },
  { key: "MAKKAH", slug: "makkah" },
  { key: "MADINAH", slug: "madinah" },
  { key: "QASSIM", slug: "qassim" },
  { key: "EASTERN_PROVINCE", slug: "eastern-province" },
  { key: "ASIR", slug: "asir" },
  { key: "TABUK", slug: "tabuk" },
  { key: "HAIL", slug: "hail" },
  { key: "NORTHERN_BORDERS", slug: "northern-borders" },
  { key: "JAZAN", slug: "jazan" },
  { key: "NAJRAN", slug: "najran" },
  { key: "AL_BAHAH", slug: "al-bahah" },
  { key: "AL_JAWF", slug: "al-jawf" },
] as const;

export type RegionKey = (typeof REGIONS)[number]["key"];

export const REGION_SLUGS: Record<string, string> = {
  RIYADH: "riyadh",
  MAKKAH: "makkah",
  MADINAH: "madinah",
  QASSIM: "qassim",
  EASTERN_PROVINCE: "eastern-province",
  ASIR: "asir",
  TABUK: "tabuk",
  HAIL: "hail",
  NORTHERN_BORDERS: "northern-borders",
  JAZAN: "jazan",
  NAJRAN: "najran",
  AL_BAHAH: "al-bahah",
  AL_JAWF: "al-jawf",
};

/** Reverse lookup, for resolving a URL segment back to an enum value. */
export const REGION_BY_SLUG: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.slug, r.key]),
);

/**
 * Coarsen a rotation date when a facility has few reviews.
 *
 * An exact month plus a small department can narrow a reviewer down to one
 * person, which is exactly the failure this site cannot afford.
 */
export function rotationStamp(
  year: number | null,
  facilityReviewCount: number,
): string | null {
  if (!year) return null;
  if (facilityReviewCount >= 5) return String(year);
  // Below the threshold, blur to a half-decade band.
  const band = Math.floor(year / 5) * 5;
  return `${band}–${band + 4}`;
}
