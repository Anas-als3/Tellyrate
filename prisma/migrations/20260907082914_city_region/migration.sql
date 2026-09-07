-- Group cities under Saudi Arabia's thirteen administrative regions.
--
-- Students look for a region before a city — "somewhere in Qassim" comes before
-- "Buraydah or Unaizah" — and a flat city list gave them no way to ask that.
--
-- Region is added nullable, backfilled by name, then made NOT NULL, because the
-- column is required and rows already exist.

CREATE TYPE "Region" AS ENUM (
  'RIYADH', 'MAKKAH', 'MADINAH', 'QASSIM', 'EASTERN_PROVINCE', 'ASIR',
  'TABUK', 'HAIL', 'NORTHERN_BORDERS', 'JAZAN', 'NAJRAN', 'AL_BAHAH', 'AL_JAWF'
);

ALTER TABLE "City" ADD COLUMN "region" "Region";

UPDATE "City" SET "region" = CASE
  WHEN lower(name) = 'abha' THEN 'ASIR'::"Region"
  WHEN lower(name) = 'abqaiq' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'abu arish' THEN 'JAZAN'::"Region"
  WHEN lower(name) = 'ad dawadimi' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'afif' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'ahad al masarihah' THEN 'JAZAN'::"Region"
  WHEN lower(name) = 'ahad rafidah' THEN 'ASIR'::"Region"
  WHEN lower(name) = 'al aflaj' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'al badai' THEN 'QASSIM'::"Region"
  WHEN lower(name) = 'al bahah' THEN 'AL_BAHAH'::"Region"
  WHEN lower(name) = 'al bukayriyah' THEN 'QASSIM'::"Region"
  WHEN lower(name) = 'al ghazalah' THEN 'HAIL'::"Region"
  WHEN lower(name) = 'al jumum' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'al kharj' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'al khobar' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'al lith' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'al majmaah' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'al mandaq' THEN 'AL_BAHAH'::"Region"
  WHEN lower(name) = 'al mithnab' THEN 'QASSIM'::"Region"
  WHEN lower(name) = 'al nairyah' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'al qunfudhah' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'al quway''iyah' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'al ula' THEN 'MADINAH'::"Region"
  WHEN lower(name) = 'al wajh' THEN 'TABUK'::"Region"
  WHEN lower(name) = 'ar rass' THEN 'QASSIM'::"Region"
  WHEN lower(name) = 'arar' THEN 'NORTHERN_BORDERS'::"Region"
  WHEN lower(name) = 'ash shinan' THEN 'HAIL'::"Region"
  WHEN lower(name) = 'az zulfi' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'badr' THEN 'MADINAH'::"Region"
  WHEN lower(name) = 'baljurashi' THEN 'AL_BAHAH'::"Region"
  WHEN lower(name) = 'baqaa' THEN 'HAIL'::"Region"
  WHEN lower(name) = 'bisha' THEN 'ASIR'::"Region"
  WHEN lower(name) = 'buraydah' THEN 'QASSIM'::"Region"
  WHEN lower(name) = 'dammam' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'dhahran' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'duba' THEN 'TABUK'::"Region"
  WHEN lower(name) = 'dumat al-jandal' THEN 'AL_JAWF'::"Region"
  WHEN lower(name) = 'farasan' THEN 'JAZAN'::"Region"
  WHEN lower(name) = 'habuna' THEN 'NAJRAN'::"Region"
  WHEN lower(name) = 'hafar al batin' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'hail' THEN 'HAIL'::"Region"
  WHEN lower(name) = 'haql' THEN 'TABUK'::"Region"
  WHEN lower(name) = 'hofuf' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'hotat bani tamim' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'jazan' THEN 'JAZAN'::"Region"
  WHEN lower(name) = 'jeddah' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'jubail' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'khafji' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'khamis mushait' THEN 'ASIR'::"Region"
  WHEN lower(name) = 'khaybar' THEN 'MADINAH'::"Region"
  WHEN lower(name) = 'khulais' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'mahayil' THEN 'ASIR'::"Region"
  WHEN lower(name) = 'mahd adh dhahab' THEN 'MADINAH'::"Region"
  WHEN lower(name) = 'mecca' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'medina' THEN 'MADINAH'::"Region"
  WHEN lower(name) = 'najran' THEN 'NAJRAN'::"Region"
  WHEN lower(name) = 'qatif' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'qilwah' THEN 'AL_BAHAH'::"Region"
  WHEN lower(name) = 'qurayyat' THEN 'AL_JAWF'::"Region"
  WHEN lower(name) = 'rabigh' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'rafha' THEN 'NORTHERN_BORDERS'::"Region"
  WHEN lower(name) = 'ras tanura' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'rijal almaa' THEN 'ASIR'::"Region"
  WHEN lower(name) = 'riyadh' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'riyadh al khabra' THEN 'QASSIM'::"Region"
  WHEN lower(name) = 'sabya' THEN 'JAZAN'::"Region"
  WHEN lower(name) = 'safwa' THEN 'EASTERN_PROVINCE'::"Region"
  WHEN lower(name) = 'sakakah' THEN 'AL_JAWF'::"Region"
  WHEN lower(name) = 'samtah' THEN 'JAZAN'::"Region"
  WHEN lower(name) = 'sarat abidah' THEN 'ASIR'::"Region"
  WHEN lower(name) = 'shaqra' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'sharurah' THEN 'NAJRAN'::"Region"
  WHEN lower(name) = 'tabarjal' THEN 'AL_JAWF'::"Region"
  WHEN lower(name) = 'tabuk' THEN 'TABUK'::"Region"
  WHEN lower(name) = 'taif' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'tathlith' THEN 'ASIR'::"Region"
  WHEN lower(name) = 'tayma' THEN 'TABUK'::"Region"
  WHEN lower(name) = 'turaif' THEN 'NORTHERN_BORDERS'::"Region"
  WHEN lower(name) = 'turubah' THEN 'MAKKAH'::"Region"
  WHEN lower(name) = 'umluj' THEN 'TABUK'::"Region"
  WHEN lower(name) = 'unaizah' THEN 'QASSIM'::"Region"
  WHEN lower(name) = 'uyun aljiwa' THEN 'QASSIM'::"Region"
  WHEN lower(name) = 'wadi ad-dawasir' THEN 'RIYADH'::"Region"
  WHEN lower(name) = 'yanbu' THEN 'MADINAH'::"Region"
  ELSE 'RIYADH'::"Region"
END;

ALTER TABLE "City" ALTER COLUMN "region" SET NOT NULL;

CREATE INDEX "City_region_name_idx" ON "City"("region", "name");
CREATE INDEX "City_region_facilityCount_idx" ON "City"("region", "facilityCount" DESC);
