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
 * What the reviewer was at the facility. Read together with their field, so a
 * review is placed as "Pharmacy · Intern" or "Medicine · Summer trainee".
 */
export const TRAINEE_ROLE_LABELS: Record<string, string> = {
  STUDENT: "Student on rotation",
  SUMMER_TRAINEE: "Summer trainee",
  INTERN: "Intern",
  RESIDENT: "Resident",
  FELLOW: "Fellow",
  OBSERVER: "Observer",
  OTHER: "Other",
};

export const TRAINEE_ROLES = Object.keys(TRAINEE_ROLE_LABELS);

/** The short form used in the rotation stamp, where space is tight. */
export const TRAINEE_ROLE_SHORT: Record<string, string> = {
  STUDENT: "Student",
  SUMMER_TRAINEE: "Summer trainee",
  INTERN: "Intern",
  RESIDENT: "Resident",
  FELLOW: "Fellow",
  OBSERVER: "Observer",
  OTHER: "Trainee",
};

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
