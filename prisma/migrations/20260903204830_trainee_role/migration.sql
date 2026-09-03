-- Replace the "kind of training" field with an explicit trainee role.
--
-- Asking both what you were and what the placement was is the same question
-- twice. TraineeRole absorbs every TrainingKind value, so existing reviews
-- carry across without losing meaning.

CREATE TYPE "TraineeRole" AS ENUM (
  'STUDENT', 'SUMMER_TRAINEE', 'INTERN', 'RESIDENT', 'FELLOW', 'OBSERVER', 'OTHER'
);

-- Added nullable so existing rows can be backfilled before the NOT NULL.
ALTER TABLE "Review" ADD COLUMN "role" "TraineeRole";
ALTER TABLE "Review" ADD COLUMN "department" TEXT;

UPDATE "Review" SET "role" = CASE "training"
  WHEN 'CLINICAL_ROTATION' THEN 'STUDENT'::"TraineeRole"
  WHEN 'INTERNSHIP'        THEN 'INTERN'::"TraineeRole"
  WHEN 'RESIDENCY'         THEN 'RESIDENT'::"TraineeRole"
  WHEN 'SUMMER_TRAINING'   THEN 'SUMMER_TRAINEE'::"TraineeRole"
  WHEN 'OBSERVERSHIP'      THEN 'OBSERVER'::"TraineeRole"
  ELSE 'OTHER'::"TraineeRole"
END;

ALTER TABLE "Review" ALTER COLUMN "role" SET NOT NULL;

ALTER TABLE "Review" DROP COLUMN "training";
DROP TYPE "TrainingKind";
