import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * City records come from the import in English because the database currently
 * has one canonical city-name column. Keep the small Saudi directory mapped
 * here so Arabic pages do not fall back to transliterated Latin names.
 */
export const SAUDI_CITY_NAMES_AR: Readonly<Record<string, string>> = {
  Riyadh: "الرياض",
  Jeddah: "جدة",
  Mecca: "مكة المكرمة",
  Medina: "المدينة المنورة",
  Dammam: "الدمام",
  "Al Khobar": "الخبر",
  Dhahran: "الظهران",
  Taif: "الطائف",
  Buraydah: "بريدة",
  Unaizah: "عنيزة",
  Tabuk: "تبوك",
  Abha: "أبها",
  "Khamis Mushait": "خميس مشيط",
  Najran: "نجران",
  Jazan: "جازان",
  Hail: "حائل",
  Arar: "عرعر",
  Sakakah: "سكاكا",
  "Al Bahah": "الباحة",
  Yanbu: "ينبع",
  "Al Kharj": "الخرج",
  "Hafar Al Batin": "حفر الباطن",
  Qatif: "القطيف",
  Hofuf: "الهفوف",
  Jubail: "الجبيل",
  Bisha: "بيشة",
  "Al Qunfudhah": "القنفذة",
  Rabigh: "رابغ",
  "Al Majmaah": "المجمعة",
  Shaqra: "شقراء",
  "Ad Dawadimi": "الدوادمي",
  "Az Zulfi": "الزلفي",
  Qurayyat: "القريات",
  "Wadi ad-Dawasir": "وادي الدواسر",
  Sharurah: "شرورة",
  "Ras Tanura": "رأس تنورة",
  Safwa: "صفوى",
  Turaif: "طريف",
  Duba: "ضباء",
  "Al Wajh": "الوجه",
  Afif: "عفيف",
  "Al Quway'iyah": "القويعية",
  Baljurashi: "بلجرشي",
  Mahayil: "محايل عسير",
  "Al Mandaq": "المندق",
  Qilwah: "قلوة",
  "Dumat al-Jandal": "دومة الجندل",
  Tabarjal: "طبرجل",
  "Ahad Rafidah": "أحد رفيدة",
  "Rijal Almaa": "رجال ألمع",
  "Sarat Abidah": "سراة عبيدة",
  Tathlith: "تثليث",
  Abqaiq: "بقيق",
  Khafji: "الخفجي",
  "Al Ghazalah": "الغزالة",
  "Ash Shinan": "الشنان",
  Baqaa: "بقعاء",
  "Abu Arish": "أبو عريش",
  "Ahad al Masarihah": "أحد المسارحة",
  Farasan: "فرسان",
  Sabya: "صبيا",
  Samtah: "صامطة",
  "Al Ula": "العلا",
  Badr: "بدر",
  Khaybar: "خيبر",
  "Mahd adh Dhahab": "مهد الذهب",
  "Al Jumum": "الجموم",
  "Al Lith": "الليث",
  Turubah: "تربة",
  Habuna: "حبونا",
  Rafha: "رفحاء",
  "Al Badai": "البدائع",
  "Al Bukayriyah": "البكيرية",
  "Al Mithnab": "المذنب",
  "Ar Rass": "الرس",
  "Riyadh Al Khabra": "رياض الخبراء",
  "Al Aflaj": "الأفلاج",
  "Hotat Bani Tamim": "حوطة بني تميم",
  Haql: "حقل",
  Tayma: "تيماء",
  Umluj: "أملج",
};

const ENGLISH_CITY_BY_ARABIC = new Map(
  Object.entries(SAUDI_CITY_NAMES_AR).map(([english, arabic]) => [
    normalizeArabic(arabic),
    english,
  ]),
);

export function cityNameFor(locale: Locale, name: string): string {
  return locale === "ar" ? (SAUDI_CITY_NAMES_AR[name] ?? name) : name;
}

/** Let a search for "الرياض" match the canonical `Riyadh` city row. */
export function citySearchName(query: string): string | null {
  const normalized = normalizeArabic(query);
  const exact = ENGLISH_CITY_BY_ARABIC.get(normalized);
  if (exact) return exact;

  // People naturally shorten "مكة المكرمة" to "مكة" and "محايل عسير" to
  // "محايل". Accept a unique prefix, but never an arbitrary substring such
  // as "عسير", which names a region rather than Mahayil specifically.
  if (normalized.length < 3) return null;
  const matches = [...ENGLISH_CITY_BY_ARABIC.entries()]
    .filter(([arabic]) => arabic.startsWith(normalized))
    .map(([, english]) => english);

  return matches.length === 1 ? matches[0] : null;
}

type FacilityNames = {
  name: string;
  nameEn?: string | null;
  nameLocal?: string | null;
};

/**
 * Put the name that matches the interface language first while retaining one
 * genuinely different alternate name for readers who know the other script.
 */
export function facilityNamesFor(
  locale: Locale,
  facility: FacilityNames,
): { primary: string; secondary: string | null } {
  const source = clean(facility.name) ?? facility.name;
  const english = clean(facility.nameEn) ?? source;
  const local = clean(facility.nameLocal);
  const primary = locale === "ar" ? (local ?? english) : english;
  const alternatives = locale === "ar" ? [english, source] : [local];
  const secondary = alternatives.find(
    (candidate): candidate is string =>
      candidate !== null && normalizeName(candidate) !== normalizeName(primary),
  );

  return { primary, secondary: secondary ?? null };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function normalizeArabic(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/\s+/gu, " ")
    .trim();
}
