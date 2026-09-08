-- Correct the first specialty backfill before this release is exposed. The
-- earlier broad `ent` expression also matched words such as "dentistry" and
-- "inpatient". Specific clinical areas come first here and ENT is matched as
-- a standalone abbreviation (or by its full name) only.
UPDATE "Review"
SET "specialty" = CASE
  WHEN lower("department") ~ '(pharmacy|صيدل)' THEN 'PHARMACY'::"RotationSpecialty"
  WHEN lower("department") ~ '(dentistry|dental|dentist|أسنان)' THEN 'DENTISTRY'::"RotationSpecialty"
  WHEN lower("department") ~ '(laboratory|microbiology|مختبر|أحياء دقيقة)' THEN 'LABORATORY'::"RotationSpecialty"
  WHEN lower("department") ~ '(physiotherap|rehab|علاج طبيعي|تأهيل)' THEN 'REHABILITATION'::"RotationSpecialty"
  WHEN lower("department") ~ '(pediatric emergency|paediatric emergency|peds? er|طوارئ الأطفال)' THEN 'PEDIATRIC_EMERGENCY'::"RotationSpecialty"
  WHEN lower("department") ~ '(pediatric surgery|paediatric surgery|breast surgery|vascular surgery|hepatobiliary surgery|surgical oncology)' THEN 'SURGICAL_SUBSPECIALTY'::"RotationSpecialty"
  WHEN lower("department") ~ '(family|طب الأسرة)' THEN 'FAMILY_MEDICINE'::"RotationSpecialty"
  WHEN lower("department") ~ '(emergency|(^|[^[:alnum:]_])er([^[:alnum:]_]|$)|طوارئ)' THEN 'EMERGENCY_MEDICINE'::"RotationSpecialty"
  WHEN lower("department") ~ '(internal|general medicine|باطنة)' THEN 'INTERNAL_MEDICINE'::"RotationSpecialty"
  WHEN lower("department") ~ '(general surgery|جراحة عامة)' THEN 'GENERAL_SURGERY'::"RotationSpecialty"
  WHEN lower("department") ~ '(paediatric|pediatric|peds|أطفال)' THEN 'PEDIATRICS'::"RotationSpecialty"
  WHEN lower("department") ~ '(obstetric|gynaec|gynec|نساء|ولادة)' THEN 'OBSTETRICS_GYNECOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(anaesth|anesth|تخدير)' THEN 'ANESTHESIOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(intensive|(^|[^[:alnum:]_])icu([^[:alnum:]_]|$)|عناية مركزة)' THEN 'INTENSIVE_CARE'::"RotationSpecialty"
  WHEN lower("department") ~ '(otolaryng|(^|[^[:alnum:]_])e[.]?n[.]?t[.]?([^[:alnum:]_]|$)|أنف|أذن)' THEN 'OTOLARYNGOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(urolog|مسالك)' THEN 'UROLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(orthop|عظام)' THEN 'ORTHOPEDICS'::"RotationSpecialty"
  WHEN lower("department") ~ '(psychi|mental health|نفسي)' THEN 'PSYCHIATRY'::"RotationSpecialty"
  WHEN lower("department") ~ '(radiolog|أشعة)' THEN 'RADIOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(patholog|علم الأمراض)' THEN 'PATHOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(oncolog|أورام)' THEN 'ONCOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(ophthalm|عيون)' THEN 'OPHTHALMOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(dermatolog|جلد)' THEN 'DERMATOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(neurolog|أعصاب)' THEN 'NEUROLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(neonat|nicu|حديثي الولادة)' THEN 'NEONATOLOGY'::"RotationSpecialty"
  WHEN lower("department") ~ '(public health|صحة عامة)' THEN 'PUBLIC_HEALTH'::"RotationSpecialty"
  ELSE NULL
END
WHERE "source" = 'USER'
  AND "department" IS NOT NULL;
