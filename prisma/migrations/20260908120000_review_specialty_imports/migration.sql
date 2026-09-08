-- Imported survey experiences have useful text but no numeric rating. Keep
-- them in the same review stream, while separating "experiences" from the
-- denominator used for star averages.

ALTER TYPE "FacilitySource" ADD VALUE 'CURATED';

CREATE TYPE "RotationSpecialty" AS ENUM (
  'FAMILY_MEDICINE',
  'EMERGENCY_MEDICINE',
  'INTERNAL_MEDICINE',
  'GENERAL_SURGERY',
  'PEDIATRICS',
  'OBSTETRICS_GYNECOLOGY',
  'ANESTHESIOLOGY',
  'INTENSIVE_CARE',
  'OTOLARYNGOLOGY',
  'UROLOGY',
  'ORTHOPEDICS',
  'PSYCHIATRY',
  'RADIOLOGY',
  'PATHOLOGY',
  'ONCOLOGY',
  'OPHTHALMOLOGY',
  'DERMATOLOGY',
  'NEUROLOGY',
  'NEONATOLOGY',
  'PEDIATRIC_EMERGENCY',
  'PEDIATRIC_SUBSPECIALTY',
  'SURGICAL_SUBSPECIALTY',
  'PHARMACY',
  'DENTISTRY',
  'LABORATORY',
  'REHABILITATION',
  'PUBLIC_HEALTH',
  'OTHER'
);

CREATE TYPE "ReviewSource" AS ENUM ('USER', 'BATCH17_SURVEY');

ALTER TABLE "Facility"
  ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Review"
  ALTER COLUMN "overall" DROP NOT NULL,
  ADD COLUMN "specialty" "RotationSpecialty",
  ADD COLUMN "source" "ReviewSource" NOT NULL DEFAULT 'USER',
  ADD COLUMN "sourceKey" TEXT;

-- Existing rows pre-date unrated imports, so every published review with an
-- overall value contributes to ratingCount. Recalculate instead of copying
-- reviewCount so hidden rows cannot leak into the rating denominator.
UPDATE "Facility" AS facility
SET "ratingCount" = rated.count
FROM (
  SELECT "facilityId", COUNT("overall")::INTEGER AS count
  FROM "Review"
  WHERE "status" = 'PUBLISHED'
  GROUP BY "facilityId"
) AS rated
WHERE facility.id = rated."facilityId";

-- Best-effort backfill for reviews that already used the optional department
-- field. The original free text remains untouched for display.
UPDATE "Review"
SET "specialty" = CASE
  WHEN lower("department") ~ '(family|طب الأسرة)' THEN 'FAMILY_MEDICINE'::"RotationSpecialty"
  WHEN lower("department") ~ '(emergency|طوارئ)' THEN 'EMERGENCY_MEDICINE'::"RotationSpecialty"
  WHEN lower("department") ~ '(internal|general medicine|باطنة)' THEN 'INTERNAL_MEDICINE'::"RotationSpecialty"
  WHEN lower("department") ~ '(general surgery|جراحة عامة)' THEN 'GENERAL_SURGERY'::"RotationSpecialty"
  WHEN lower("department") ~ '(paediatric|pediatric|أطفال)' THEN 'PEDIATRICS'::"RotationSpecialty"
  WHEN lower("department") ~ '(obstetric|gynaec|gynec|نساء|ولادة)' THEN 'OBSTETRICS_GYNECOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(anaesth|anesth|تخدير)' THEN 'ANESTHESIOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(intensive|icu|عناية مركزة)' THEN 'INTENSIVE_CARE'::"RotationSpecialty"
  WHEN lower("department") ~ '(ent|أنف|أذن)' THEN 'OTOLARYNGOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(orthop|عظام)' THEN 'ORTHOPEDICS'::"RotationSpecialty"
  WHEN lower("department") ~ '(psychi|نفسي)' THEN 'PSYCHIATRY'::"RotationSpecialty"
  WHEN lower("department") ~ '(radiolog|أشعة)' THEN 'RADIOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(patholog|علم الأمراض)' THEN 'PATHOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(oncolog|أورام)' THEN 'ONCOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(pharmacy|صيدل)' THEN 'PHARMACY'::"RotationSpecialty"
  WHEN lower("department") ~ '(dent|أسنان)' THEN 'DENTISTRY'::"RotationSpecialty"
  WHEN lower("department") ~ '(laboratory|microbiology|مختبر|أحياء دقيقة)' THEN 'LABORATORY'::"RotationSpecialty"
  WHEN lower("department") ~ '(physiotherap|rehab|علاج طبيعي|تأهيل)' THEN 'REHABILITATION'::"RotationSpecialty"
  ELSE NULL
END
WHERE "department" IS NOT NULL;

CREATE UNIQUE INDEX "Review_sourceKey_key" ON "Review"("sourceKey");
CREATE INDEX "Review_facilityId_status_field_idx"
  ON "Review"("facilityId", "status", "field");
CREATE INDEX "Review_facilityId_status_specialty_idx"
  ON "Review"("facilityId", "status", "specialty");
