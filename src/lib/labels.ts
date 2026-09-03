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

export const TRAINING_KIND_LABELS: Record<string, string> = {
  CLINICAL_ROTATION: "Clinical rotation",
  INTERNSHIP: "Internship",
  RESIDENCY: "Residency",
  SUMMER_TRAINING: "Summer training",
  OBSERVERSHIP: "Observership",
  OTHER: "Other",
};

export const TRAINING_KINDS = Object.keys(TRAINING_KIND_LABELS);

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

/** Country names for the codes present in the seed data. */
export const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BD: "Bangladesh",
  BE: "Belgium",
  BH: "Bahrain",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CO: "Colombia",
  DE: "Germany",
  DK: "Denmark",
  DZ: "Algeria",
  EG: "Egypt",
  ES: "Spain",
  ET: "Ethiopia",
  FR: "France",
  GB: "United Kingdom",
  GH: "Ghana",
  ID: "Indonesia",
  IE: "Ireland",
  IN: "India",
  IQ: "Iraq",
  IT: "Italy",
  JO: "Jordan",
  KE: "Kenya",
  KW: "Kuwait",
  LB: "Lebanon",
  LK: "Sri Lanka",
  MA: "Morocco",
  MX: "Mexico",
  MY: "Malaysia",
  NG: "Nigeria",
  NL: "Netherlands",
  NO: "Norway",
  NP: "Nepal",
  NZ: "New Zealand",
  OM: "Oman",
  PE: "Peru",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  QA: "Qatar",
  SA: "Saudi Arabia",
  SD: "Sudan",
  SE: "Sweden",
  SG: "Singapore",
  SY: "Syria",
  TH: "Thailand",
  TN: "Tunisia",
  TR: "Türkiye",
  US: "United States",
  ZA: "South Africa",
};

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
