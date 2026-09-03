/**
 * Development seed: demo review content on top of the real OpenStreetMap
 * import.
 *
 *   npm run db:seed        # or: npx tsx prisma/seed.ts
 *
 * An empty directory hides every interesting behaviour this site has — the
 * Bayesian ranking, the helpfulness sort, the sub-rating breakdown and the
 * rotation stamp all look identical when nothing has been reviewed. So this
 * script attaches varied, realistic reviews to facilities that already exist.
 *
 * It never deletes and never inserts twice: every write is an upsert keyed on
 * something stable, so running it repeatedly converges on the same state. The
 * randomness is seeded from facility slugs rather than `Math.random`, so the
 * same database always gets the same demo content.
 *
 * It does NOT import `@/lib/aggregates` or `@/lib/db`: both pull in
 * `server-only`, which throws outside a Next request. The aggregate maths is
 * reproduced here from the pure functions in `@/lib/ranking` instead, which is
 * also a useful check that the two agree.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type StudentField,
  type TraineeRole,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/crypto";
import { bayesianScore, roundRating, wilsonLowerBound } from "../src/lib/ranking";
import { fold } from "../src/lib/slug";

/** Every demo account shares this password. Development only, obviously. */
const DEMO_PASSWORD = "ward-notes-demo";

/** How many facilities to populate, and the ceiling on reviews for each. */
const TARGET_FACILITIES = 40;
const MAX_REVIEWS_PER_FACILITY = 8;

/**
 * Deliberately anonymous, in the shape the signup page suggests: nothing in a
 * username should hint at a real person, a cohort or a school.
 */
const DEMO_USERNAMES = [
  "quiet-heron-41",
  "amber-lynx-08",
  "calm-ibis-77",
  "steady-otter-19",
  "north-falcon-33",
  "pale-marten-62",
  "brisk-plover-05",
  "olive-jackal-28",
  "slow-tapir-90",
  "grey-kestrel-14",
  "warm-oryx-56",
  "still-egret-83",
];

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/** mulberry32 — small, fast, and identical across runs for a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, so a slug maps to a stable 32-bit seed. */
function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

type Rng = () => number;

function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Review content
// ---------------------------------------------------------------------------

type Tone = "high" | "mid" | "low";

type Axis =
  | "supervision"
  | "handsOn"
  | "staffRespect"
  | "workload"
  | "resources"
  | "safety";

type Draft = {
  tone: Tone;
  field: StudentField;
  role: TraineeRole;
  /** Free text on the model, so it varies the way real answers would. */
  department?: string;
  title: string;
  body: string;
  /** Nudges applied to sub-ratings so the numbers agree with the text. */
  bias?: Partial<Record<Axis, number>>;
};

/**
 * Written in different registers on purpose — terse, chatty, analytical,
 * worn out — because a seed where every review sounds like the same person
 * makes the review list look fake and hides typography problems.
 *
 * All of them observe the site's own rule: they describe the place, never a
 * named person and never a patient.
 */
const DRAFTS: Draft[] = [
  {
    tone: "high",
    field: "MEDICINE",
    role: "STUDENT",
    department: "Acute medicine",
    title: "Taught, not just tolerated",
    body: "Students were put on the round from the first morning and expected to present. I was dreading that for a week and then it became the best part of the day. Nobody sent me to chase paperwork that had nothing to teach me. If you get a choice, ask for the acute take — that is where the actual teaching happens.",
    bias: { supervision: 1, handsOn: 1 },
  },
  {
    tone: "high",
    field: "NURSING",
    role: "INTERN",
    department: "Surgical ward",
    title: "Six weeks that fixed my cannulation",
    body: "I arrived able to do almost nothing under pressure and left comfortable. The charge nurse on days had a rule that students do the task and the qualified staff watch, which is terrifying for two shifts and then transformative. Handover included us instead of talking over us. The only complaint is that the changing room is a long walk from the unit.",
    bias: { handsOn: 1, staffRespect: 1, resources: -1 },
  },
  {
    tone: "mid",
    field: "PHARMACY",
    role: "SUMMER_TRAINEE",
    department: "Outpatient dispensary",
    title: "Good systems, not much teaching",
    body: "The dispensary is well run and I learned a lot just by watching how they manage stock and check prescriptions. What I did not get was anyone sitting down to explain the reasoning behind a decision. It is four weeks of competent observation. Fine if that is what you need, frustrating if you wanted to be pushed.",
    bias: { supervision: -1, resources: 1 },
  },
  {
    tone: "low",
    field: "MEDICINE",
    role: "STUDENT",
    department: "Internal medicine",
    title: "Eight weeks in a corner",
    body: "Nobody knew we were coming, and after the second week nobody was pretending otherwise. We were told to observe, and observing turned out to mean standing at the back of a room where we could not hear. Two of the registrars were genuinely good with students and the rest treated our questions as an interruption. I would not choose this placement again.",
    bias: { supervision: -2, handsOn: -2, staffRespect: -1 },
  },
  {
    tone: "high",
    field: "DENTISTRY",
    role: "STUDENT",
    department: "Restorative dentistry",
    title: "Chair time from week one",
    body: "The thing that matters in a dental placement is how much chair time you get, and here it was more than I expected. Supervision was close without being suffocating — someone checked before I started and after I finished, and left me alone in between. The equipment is older than the teaching hospital's but everything worked.",
    bias: { handsOn: 2, supervision: 1, resources: -1 },
  },
  {
    tone: "mid",
    field: "NURSING",
    role: "STUDENT",
    title: "Depends entirely on the unit",
    body: "I did four weeks split between two units in the same building and they may as well have been different hospitals. On one, students were part of the team and given a patient load with supervision. On the other, we were an inconvenience and told so. Rate it however your unit goes; the building itself is fine.",
    bias: { staffRespect: -1 },
  },
  {
    tone: "high",
    field: "LABORATORY",
    role: "SUMMER_TRAINEE",
    title: "Best training I have had, and I did not expect it",
    body: "I signed up because it was near home and expected to spend a month labelling tubes. Instead I was rotated through haematology, biochemistry and microbiology on a written plan, with someone responsible for me in each. They gave me a small validation project at the end and it was actually used. Ask for the plan on day one; not everyone gets offered it.",
    bias: { supervision: 2, handsOn: 1 },
  },
  {
    tone: "low",
    field: "PHARMACY",
    role: "INTERN",
    department: "Community pharmacy",
    title: "Unpaid, unplanned, understaffed",
    body: "Twelve-hour days covering a counter that should have had two qualified staff on it. That is not training, it is free labour, and it is not safe for the people collecting the medicines either. When I raised it I was told everyone starts this way. Go somewhere else if you have a choice.",
    bias: { workload: -2, safety: -2, staffRespect: -1 },
  },
  {
    tone: "mid",
    field: "PHYSIOTHERAPY",
    role: "STUDENT",
    department: "Outpatient physiotherapy",
    title: "Strong clinically, chaotic administratively",
    body: "The clinical side was genuinely good — a broad caseload and a supervisor who set me goals and reviewed them. Everything around it was a mess. My ID took nine days, which meant nine days of waiting to be let through doors. Bring your own paperwork and expect to chase it.",
    bias: { supervision: 1, resources: -1 },
  },
  {
    tone: "high",
    field: "MEDICINE",
    role: "RESIDENT",
    department: "Internal medicine",
    title: "Hard, and worth it",
    body: "The hours are long and the department does not pretend otherwise, but everything you do is supervised by someone who wants you to be better at it by the end of the year. Morning report is real teaching, not a formality. Feedback happens face to face and in specifics. I would come back.",
    bias: { supervision: 2, workload: -1 },
  },
  {
    tone: "low",
    field: "NURSING",
    role: "STUDENT",
    department: "Medical ward",
    title: "Short-staffed and it shows",
    body: "Students were used to fill gaps in the rota rather than to learn. I spent most of the placement doing tasks that were within my competence but repeated so many times they taught me nothing. Twice I was left responsible for more than I should have been, and saying so did not change anything.",
    bias: { safety: -2, supervision: -2, workload: -1 },
  },
  {
    tone: "mid",
    field: "RADIOLOGY",
    role: "OBSERVER",
    department: "Diagnostic radiology",
    title: "Exactly what an observership is",
    body: "You watch, you ask questions between cases, and if you are polite about it people explain what they are looking at. Nothing more than that, which is what the label says. The reporting room is small so more than two students at a time does not work.",
  },
  {
    tone: "high",
    field: "EMERGENCY_MEDICAL",
    role: "STUDENT",
    department: "Emergency",
    title: "Busy department that still teaches",
    body: "I expected to be invisible in a department that size and instead got put with a specific team each shift and held to it. Skills sign-offs actually happened rather than being promised. It is relentless, and if you want quiet reflection between patients this is not the place, but you leave able to do things.",
    bias: { handsOn: 2, workload: -1 },
  },
  {
    tone: "mid",
    field: "MEDICINE",
    role: "STUDENT",
    department: "General medicine",
    title: "Fine. Genuinely just fine.",
    body: "Nothing went wrong and nothing was memorable. The teaching timetable existed and about half of it happened. Staff were polite, the ward was calm, and I finished the rotation roughly as competent as I started it. If you want a low-stress block before exams it is a reasonable choice.",
  },
  {
    tone: "high",
    field: "PUBLIC_HEALTH",
    role: "SUMMER_TRAINEE",
    department: "Disease surveillance",
    title: "Treated like a junior colleague",
    body: "I was given a piece of the surveillance work with a deadline and a person to ask when it broke. Being trusted with something real is rare on a summer placement. The office is cramped and the coffee is terrible, and neither of those things mattered.",
    bias: { staffRespect: 2, resources: -1 },
  },
  {
    tone: "low",
    field: "DENTISTRY",
    role: "SUMMER_TRAINEE",
    department: "General dentistry",
    title: "Four weeks of watching a screen",
    body: "The clinic was busy enough that nobody had time for a student, which is understandable but should have been said before I committed a month to it. I did not touch an instrument. If you go, agree in writing beforehand what you will actually be doing.",
    bias: { handsOn: -2, supervision: -1 },
  },
  {
    tone: "mid",
    field: "RESPIRATORY",
    role: "STUDENT",
    department: "Respiratory",
    title: "Good exposure, thin supervision",
    body: "Plenty to see and a reasonable mix of acute and chronic work. What was missing was anyone checking whether I understood it — I could have spent six weeks quietly getting things wrong. Ask directly for feedback and you will get it; wait to be offered it and you will not.",
    bias: { supervision: -1 },
  },
  {
    tone: "high",
    field: "NUTRITION",
    role: "STUDENT",
    department: "Clinical nutrition",
    title: "Small department, generous with time",
    body: "There were three of them and one of me, and all three taught. I sat in on assessments from the first week and was writing plans under supervision by the third. Because it is small it depends heavily on who is there that month, but the culture seemed genuinely settled.",
    bias: { supervision: 2, staffRespect: 1 },
  },
  {
    tone: "low",
    field: "MEDICINE",
    role: "INTERN",
    title: "The rota was published the night before",
    body: "It is difficult to describe how much a rota you cannot see damages a year of your life. Shifts changed at short notice, swaps were discouraged, and the department seemed surprised that anyone minded. The clinical work itself was decent, which makes it more frustrating rather than less.",
    bias: { workload: -2, staffRespect: -1 },
  },
  {
    tone: "mid",
    field: "LABORATORY",
    role: "STUDENT",
    department: "Biochemistry",
    title: "Learn the analysers, not the reasoning",
    body: "You will come out knowing how the machines work and how samples move through the department, which is more useful than students expect. What you will not get is much discussion of why a result matters clinically. Two students at a time is the maximum the bench can absorb.",
  },
  {
    tone: "high",
    field: "PHARMACY",
    role: "STUDENT",
    department: "Inpatient pharmacy",
    title: "Ward pharmacy done properly",
    body: "I was attached to a ward team rather than parked in the dispensary, which changed everything. Doing medicines reconciliation on real admissions with someone checking every one taught me more in three weeks than a term of lectures. They also expect you to speak up on the round, so read the night before.",
    bias: { handsOn: 2, supervision: 1 },
  },
  {
    tone: "low",
    field: "PHYSIOTHERAPY",
    role: "STUDENT",
    department: "Inpatient physiotherapy",
    title: "No space, no equipment, no plan",
    body: "The gym was shared with two other services and booked out most of the day, so sessions happened in a corridor more often than not. Supervision was one hurried conversation a week. I do not think anyone there is unkind, I think the department is under-resourced and students are the first thing to be dropped.",
    bias: { resources: -2, supervision: -1 },
  },
  {
    tone: "mid",
    field: "NURSING",
    role: "SUMMER_TRAINEE",
    department: "Paediatrics",
    title: "Better than its reputation",
    body: "I was warned off this place and it was nothing like as bad as described. Staff were busy but willing, and I was given real tasks once they had watched me a couple of times. The building is tired and the air conditioning in the older wing gives up in the afternoon.",
    bias: { resources: -1 },
  },
  {
    tone: "high",
    field: "MEDICINE",
    role: "OBSERVER",
    department: "Outpatient clinics",
    title: "An observership where people explained things",
    body: "The bar for an observership is low and this cleared it easily. I was introduced to each team rather than left to hover, and two of the seniors made a point of walking me through their thinking after clinic. Not hands-on, and it never claimed to be.",
    bias: { staffRespect: 2, handsOn: -1 },
  },
  {
    tone: "low",
    field: "OTHER",
    role: "STUDENT",
    title: "Hostile to students",
    body: "Being asked to leave a room without explanation, twice in one week, is not something I have experienced anywhere else. Some individuals were fine. The prevailing attitude was that students are in the way. I finished the block and I have not been back.",
    bias: { staffRespect: -2, supervision: -1 },
  },
  {
    tone: "mid",
    field: "EMERGENCY_MEDICAL",
    role: "SUMMER_TRAINEE",
    department: "Ambulance service",
    title: "Depends on the shift you get",
    body: "Nights were the best training of the whole summer and days were mostly waiting. Nobody balances that for you, so ask for a mix when the rota is written rather than after. The crew room is clean and there is somewhere to sleep, which matters more than I thought it would.",
    bias: { workload: -1, resources: 1 },
  },
  {
    tone: "high",
    field: "NURSING",
    role: "RESIDENT",
    department: "Critical care",
    title: "The induction alone was worth it",
    body: "Two full days of induction before touching a patient, with the emergency equipment and the escalation policy covered properly rather than as a slide. That set the tone for the rest of the year. Workload is heavy and the staffing is honest about being tight, but the safety culture is the best I have seen.",
    bias: { safety: 2, workload: -1 },
  },
  {
    tone: "mid",
    field: "MEDICINE",
    role: "STUDENT",
    title: "Great clinic, difficult ward",
    body: "The outpatient side was well organised and I was given my own room with a supervisor next door, which is the ideal setup. The inpatient weeks were less useful — too many students on one round and not enough for us to do. Split your expectations accordingly.",
  },
  {
    tone: "low",
    field: "LABORATORY",
    role: "SUMMER_TRAINEE",
    department: "Microbiology",
    title: "Signed the logbook, taught nothing",
    body: "The stated purpose was training and the actual purpose was covering a staffing gap during the holidays. My logbook was signed for competencies I was never assessed on, which I refused in the end and it caused a difficult conversation. Whatever the paperwork says, this was not a training placement.",
    bias: { supervision: -2, staffRespect: -1 },
  },
  {
    tone: "high",
    field: "PHYSIOTHERAPY",
    role: "INTERN",
    department: "Musculoskeletal outpatients",
    title: "Structured, with real feedback",
    body: "Weekly supervision happened on the day it was scheduled, every week, which sounds trivial until you have been somewhere it does not. Goals were written down and reviewed. I got a broad musculoskeletal caseload and enough time per patient to think. The department is small so places are limited.",
    bias: { supervision: 2 },
  },
  {
    tone: "mid",
    field: "PUBLIC_HEALTH",
    role: "OBSERVER",
    department: "Health promotion",
    title: "Interesting work, no role for a student",
    body: "The team is doing genuinely good work and were happy to talk about it. There was just nothing for me to do beyond read and listen. Come with specific questions and you will get a lot out of a fortnight; come expecting a project and you will be disappointed.",
    bias: { handsOn: -1 },
  },
  {
    tone: "high",
    field: "RADIOLOGY",
    role: "STUDENT",
    department: "Diagnostic radiology",
    title: "They let students report under supervision",
    body: "Being made to commit to a report before being told the answer is uncomfortable and it is also the only way anyone learns to read a film. The consultants here do exactly that and then talk you through the misses. Long days sitting in a dark room, so bring a jumper.",
    bias: { supervision: 2, handsOn: 1 },
  },
  {
    tone: "mid",
    field: "DENTISTRY",
    role: "FELLOW",
    department: "Oral surgery",
    title: "Solid, unspectacular, well run",
    body: "Instruments sterilised on time, notes done properly, nobody cutting corners. Teaching was adequate rather than generous — you get shown once and then supervised at a distance. A safe place to consolidate what you can already do, less good for learning something new.",
    bias: { safety: 1 },
  },
  {
    tone: "low",
    field: "RESPIRATORY",
    role: "STUDENT",
    department: "Respiratory",
    title: "Equipment shortages every single week",
    body: "Sharing one working device between two areas is not a supply problem, it is a patient safety problem, and everyone there knows it. Staff were doing their best around it and were kind to students. I am rating the placement, not the people in it, and as a placement it was poor.",
    bias: { resources: -2, safety: -2, staffRespect: 1 },
  },
];

/** Occasionally appended so two facilities never read identically. */
const TAILS = [
  "Worth checking whether that has changed since — things move quickly there.",
  "Transport at the end of an evening shift is the practical problem nobody mentions.",
  "Bring your own stethoscope and do not put it down anywhere.",
  "The canteen closes far earlier than you would expect.",
  "Ask about parking before your first day rather than after.",
  "There is a prayer room in the older block, which not everyone is told.",
  "Ask for the teaching timetable in writing; it exists.",
  "Wear something you can stand up in for nine hours.",
  "Get your ID sorted in advance if you possibly can.",
  "The seniors change every few months, so treat any of this as a snapshot.",
];

const COMMENTS = [
  "Is the morning teaching session still at seven? I am placed there in March.",
  "This matches my experience two years earlier, except the on-call room had closed by then.",
  "Which building were you in? The main tower and the outpatient block are run completely differently.",
  "Thank you for mentioning the badge. I turned up without one and lost most of a day.",
  "Fair, though I would add that the workload depends entirely on which unit you land in.",
  "It changed in 2024 — the rota is published a month ahead now.",
  "Same experience, different field. Useful to know it is not just us.",
  "Was there anywhere to eat on site, or is it the shop across the road?",
  "I would rate the teaching higher than this, but I agree completely about the hours.",
  "I was choosing between here and the other one across the city, and this settles it.",
  "Did you have to arrange your own transport for the evening shift?",
  "Worth adding that the lab side is far better organised than the ward side.",
  "This is the most accurate thing written about the place.",
  "Any advice on what to read before starting?",
  "The equipment problem is real and it has been like that for years.",
  "It was the same during my summer training, so it is not a one-off month.",
];

const REPLIES = [
  "Still at seven when I left, yes.",
  "Main tower. I cannot speak for the outpatient side.",
  "The shop across the road, and it closes early on Fridays.",
  "Nothing specific — just be able to present a history cleanly.",
  "You do, and nobody reimburses it.",
  "Agreed, the lab side is a different place entirely.",
  "Ask on the first day; they will usually let you swap units.",
  "Every other weekend for us, but it varies by unit.",
];

const AXES: readonly Axis[] = [
  "supervision",
  "handsOn",
  "staffRespect",
  "workload",
  "resources",
  "safety",
];

function overallFor(rng: Rng, tone: Tone): number {
  if (tone === "high") return rng() < 0.55 ? 5 : 4;
  if (tone === "mid") return rng() < 0.6 ? 3 : 4;
  return rng() < 0.35 ? 1 : 2;
}

function clamp5(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

/** Sub-ratings orbit the overall score, nudged by whatever the text implies. */
function subRatings(rng: Rng, overall: number, draft: Draft) {
  const out: Record<Axis, number> = {} as Record<Axis, number>;
  for (const axis of AXES) {
    const jitter = pick(rng, [-1, 0, 0, 0, 1]);
    out[axis] = clamp5(overall + jitter + (draft.bias?.[axis] ?? 0));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

type Candidate = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  cityId: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  nameEn: string | null;
  nameLocal: string | null;
};

/**
 * "Highest profile" without a popularity signal to sort on: a fuller
 * OpenStreetMap record is a decent proxy for a place that matters locally,
 * and it is stable across runs, which sorting by review count would not be
 * once this script has written some.
 */
function profileScore(f: Candidate): number {
  let score = 0;
  if (f.website) score += 3;
  if (f.phone) score += 2;
  if (f.address) score += 2;
  if (f.nameEn) score += 1;
  if (f.nameLocal) score += 1;
  if (f.kind === "HOSPITAL") score += 4;
  else if (f.kind === "HEALTH_CENTER") score += 2;
  else if (f.kind === "REHAB_CENTER" || f.kind === "MENTAL_HEALTH") score += 1;
  // A slug that is not the `facility-xxxxxx` fallback means the name survived
  // slugification, i.e. it is a real name rather than an unlabelled node.
  if (!f.slug.startsWith("facility-")) score += 2;
  return score;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const summary = {
    usersCreated: 0,
    usersExisting: 0,
    facilities: 0,
    reviews: 0,
    comments: 0,
    reviewVotes: 0,
    commentVotes: 0,
  };

  // -- 1. Demo accounts ---------------------------------------------------

  const users: { id: string; username: string }[] = [];

  for (const username of DEMO_USERNAMES) {
    const usernameFold = fold(username);
    const existing = await prisma.user.findUnique({
      where: { usernameFold },
      select: { id: true, username: true },
    });

    if (existing) {
      users.push(existing);
      summary.usersExisting++;
      continue;
    }

    // Only hash when the account is genuinely new — scrypt at these cost
    // parameters is ~110ms a time, and re-running the seed should be quick.
    const created = await prisma.user.create({
      data: {
        username,
        usernameFold,
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
      select: { id: true, username: true },
    });

    users.push(created);
    summary.usersCreated++;
  }

  // -- 2. Choose the facilities to populate -------------------------------

  const cities = await prisma.city.findMany({
    where: { facilityCount: { gt: 0 } },
    orderBy: [{ facilityCount: "desc" }, { slug: "asc" }],
    select: { id: true, name: true },
  });

  if (cities.length === 0) {
    console.error(
      "No cities with facilities found. Run `npm run import:facilities` first.",
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const perCity = Math.max(3, Math.ceil(TARGET_FACILITIES / cities.length) + 2);
  const shortlists: Candidate[][] = [];

  for (const city of cities) {
    const candidates = await prisma.facility.findMany({
      where: {
        cityId: city.id,
        status: "PUBLISHED",
        kind: {
          in: ["HOSPITAL", "HEALTH_CENTER", "CLINIC", "REHAB_CENTER", "MENTAL_HEALTH"],
        },
      },
      // Ordered by slug so the candidate set — and therefore the shortlist —
      // does not depend on anything this script writes.
      orderBy: { slug: "asc" },
      take: 300,
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        cityId: true,
        website: true,
        phone: true,
        address: true,
        nameEn: true,
        nameLocal: true,
      },
    });

    shortlists.push(
      candidates
        .sort(
          (a, b) =>
            profileScore(b) - profileScore(a) || a.slug.localeCompare(b.slug),
        )
        .slice(0, perCity),
    );
  }

  // Round-robin across cities so the demo data is not all in one place.
  const chosen: Candidate[] = [];
  for (let rank = 0; rank < perCity && chosen.length < TARGET_FACILITIES; rank++) {
    for (const list of shortlists) {
      if (chosen.length >= TARGET_FACILITIES) break;
      if (list[rank]) chosen.push(list[rank]);
    }
  }

  // -- 3. Reviews, comments and votes -------------------------------------

  const touchedFacilities = new Set<string>();
  const reviewIds: string[] = [];
  const commentIds: string[] = [];

  for (const facility of chosen) {
    const rng = mulberry32(seedFrom(facility.slug));

    const wanted = pick(rng, [1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 7, 8]);
    const count = Math.min(wanted, MAX_REVIEWS_PER_FACILITY, users.length);

    const authors = shuffled(rng, users).slice(0, count);
    const drafts = shuffled(rng, DRAFTS).slice(0, count);

    for (let i = 0; i < count; i++) {
      const author = authors[i];
      const draft = drafts[i];
      const overall = overallFor(rng, draft.tone);

      const body =
        rng() < 0.35 ? `${draft.body} ${pick(rng, TAILS)}` : draft.body;

      // Sub-ratings on roughly half the reviews: the UI has to look right both
      // when they are present and when the breakdown has nothing to show.
      const withAxes = rng() < 0.55;
      const axes = withAxes ? subRatings(rng, overall, draft) : null;

      const trainingYear = rng() < 0.15 ? null : intBetween(rng, 2018, 2025);

      const payload = {
        overall,
        supervision: axes?.supervision ?? null,
        handsOn: axes?.handsOn ?? null,
        staffRespect: axes?.staffRespect ?? null,
        workload: axes?.workload ?? null,
        resources: axes?.resources ?? null,
        safety: axes?.safety ?? null,
        title: rng() < 0.8 ? draft.title : null,
        body,
        field: draft.field,
        role: draft.role,
        department: draft.department ?? null,
        trainingYear,
        status: "PUBLISHED" as const,
      };

      // (facilityId, authorId) is unique, which makes the whole review layer
      // idempotent without inventing ids.
      const review = await prisma.review.upsert({
        where: {
          facilityId_authorId: {
            facilityId: facility.id,
            authorId: author.id,
          },
        },
        create: { facilityId: facility.id, authorId: author.id, ...payload },
        update: payload,
        select: { id: true },
      });

      reviewIds.push(review.id);
      touchedFacilities.add(facility.id);
      summary.reviews++;

      // -- votes ----------------------------------------------------------
      // Negative reviews still get liked: "was this useful" is not "do I
      // agree", and the helpfulness sort is only interesting if both kinds
      // of review compete.
      const likeRate =
        draft.tone === "high" ? 0.88 : draft.tone === "mid" ? 0.7 : 0.62;

      for (const voter of users) {
        if (voter.id === author.id) continue;
        const voteRng = mulberry32(seedFrom(`${facility.slug}:${voter.username}`));
        if (voteRng() > 0.45) continue;

        const value = voteRng() < likeRate ? 1 : -1;
        await prisma.reviewVote.upsert({
          where: { reviewId_userId: { reviewId: review.id, userId: voter.id } },
          create: { reviewId: review.id, userId: voter.id, value },
          update: { value },
        });
        summary.reviewVotes++;
      }

      // -- comments -------------------------------------------------------
      if (rng() < 0.45) {
        const commenters = shuffled(rng, users).filter(
          (u) => u.id !== author.id,
        );
        const commentCount = intBetween(rng, 1, 3);

        for (let c = 0; c < commentCount && c < commenters.length; c++) {
          // Comments have no natural unique key, so give them deterministic
          // ids built from data that does not change between runs.
          const id = `seed-${facility.slug}-${i}-c${c}`;
          const body = pick(rng, COMMENTS);

          await prisma.comment.upsert({
            where: { id },
            create: {
              id,
              reviewId: review.id,
              authorId: commenters[c].id,
              body,
              status: "PUBLISHED",
            },
            update: { body },
          });
          commentIds.push(id);
          summary.comments++;

          // One level of replies only, matching what the schema allows.
          if (rng() < 0.4) {
            const replyId = `${id}-r`;
            await prisma.comment.upsert({
              where: { id: replyId },
              create: {
                id: replyId,
                reviewId: review.id,
                parentId: id,
                // Usually the reviewer answering the question.
                authorId: rng() < 0.7 ? author.id : commenters[c].id,
                body: pick(rng, REPLIES),
                status: "PUBLISHED",
              },
              update: {},
            });
            commentIds.push(replyId);
            summary.comments++;
          }

          // A few comment votes, so those counters are not uniformly zero.
          for (const voter of users) {
            const cRng = mulberry32(seedFrom(`${id}:${voter.username}`));
            if (cRng() > 0.18) continue;
            await prisma.commentVote.upsert({
              where: { commentId_userId: { commentId: id, userId: voter.id } },
              create: {
                commentId: id,
                userId: voter.id,
                value: cRng() < 0.85 ? 1 : -1,
              },
              update: {},
            });
            summary.commentVotes++;
          }
        }
      }
    }

    summary.facilities++;
  }

  // -- 4. Aggregates ------------------------------------------------------
  //
  // `@/lib/aggregates` cannot be imported here — it pulls in `server-only`,
  // which throws outside a Next request — so the same maths is reproduced
  // from the pure functions in `@/lib/ranking`.

  // 4a. Review vote counters and helpfulness.
  const votes = await prisma.reviewVote.findMany({
    where: { reviewId: { in: reviewIds } },
    select: { reviewId: true, value: true },
  });

  const tally = new Map<string, { likes: number; dislikes: number }>();
  for (const id of reviewIds) tally.set(id, { likes: 0, dislikes: 0 });
  for (const vote of votes) {
    const row = tally.get(vote.reviewId);
    if (!row) continue;
    if (vote.value > 0) row.likes++;
    else row.dislikes++;
  }

  const commentCounts = await prisma.comment.groupBy({
    by: ["reviewId"],
    where: { reviewId: { in: reviewIds }, status: "PUBLISHED" },
    _count: { _all: true },
  });
  const commentsByReview = new Map(
    commentCounts.map((row) => [row.reviewId, row._count._all]),
  );

  for (const [reviewId, { likes, dislikes }] of tally) {
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        likeCount: likes,
        dislikeCount: dislikes,
        helpfulScore: wilsonLowerBound(likes, dislikes),
        commentCount: commentsByReview.get(reviewId) ?? 0,
      },
    });
  }

  // 4b. Comment vote counters.
  const cVotes = await prisma.commentVote.findMany({
    where: { commentId: { in: commentIds } },
    select: { commentId: true, value: true },
  });
  const cTally = new Map<string, { likes: number; dislikes: number }>();
  for (const id of commentIds) cTally.set(id, { likes: 0, dislikes: 0 });
  for (const vote of cVotes) {
    const row = cTally.get(vote.commentId);
    if (!row) continue;
    if (vote.value > 0) row.likes++;
    else row.dislikes++;
  }
  for (const [commentId, { likes, dislikes }] of cTally) {
    if (likes === 0 && dislikes === 0) continue;
    await prisma.comment.update({
      where: { id: commentId },
      data: { likeCount: likes, dislikeCount: dislikes },
    });
  }

  // 4c. Facility rollups. bayesScore is filled in below, once the site-wide
  //     mean it depends on has been recomputed.
  for (const facilityId of touchedFacilities) {
    const stats = await prisma.review.aggregate({
      where: { facilityId, status: "PUBLISHED" },
      _count: { _all: true },
      _sum: { overall: true },
      _avg: {
        supervision: true,
        handsOn: true,
        staffRespect: true,
        workload: true,
        resources: true,
        safety: true,
      },
    });

    const reviewCount = stats._count._all;
    const ratingSum = stats._sum.overall ?? 0;

    await prisma.facility.update({
      where: { id: facilityId },
      data: {
        reviewCount,
        ratingSum,
        ratingAvg: roundRating(reviewCount > 0 ? ratingSum / reviewCount : 0),
        avgSupervision: round1(stats._avg.supervision),
        avgHandsOn: round1(stats._avg.handsOn),
        avgStaffRespect: round1(stats._avg.staffRespect),
        avgWorkload: round1(stats._avg.workload),
        avgResources: round1(stats._avg.resources),
        avgSafety: round1(stats._avg.safety),
      },
    });
  }

  // 4d. Site-wide mean — the prior the Bayesian ranking rests on.
  const siteAgg = await prisma.review.aggregate({
    where: { status: "PUBLISHED" },
    _avg: { overall: true },
    _count: { _all: true },
  });
  const meanRating = siteAgg._avg.overall ?? 0;
  const siteReviewCount = siteAgg._count._all;

  await prisma.siteStat.upsert({
    where: { id: "global" },
    create: { id: "global", meanRating, reviewCount: siteReviewCount },
    update: { meanRating, reviewCount: siteReviewCount },
  });

  // 4e. Rescore every rated facility against the mean that now exists.
  const rated = await prisma.facility.findMany({
    where: { reviewCount: { gt: 0 } },
    select: { id: true, ratingSum: true, reviewCount: true },
  });
  for (const f of rated) {
    await prisma.facility.update({
      where: { id: f.id },
      data: {
        bayesScore: bayesianScore(f.ratingSum, f.reviewCount, meanRating),
      },
    });
  }

  // 4f. City counters.
  const allCities = await prisma.city.findMany({ select: { id: true } });
  for (const city of allCities) {
    const [facilityCount, agg] = await Promise.all([
      prisma.facility.count({
        where: { cityId: city.id, status: "PUBLISHED" },
      }),
      prisma.facility.aggregate({
        where: { cityId: city.id, status: "PUBLISHED" },
        _sum: { reviewCount: true },
      }),
    ]);

    await prisma.city.update({
      where: { id: city.id },
      data: { facilityCount, reviewCount: agg._sum.reviewCount ?? 0 },
    });
  }

  // -- 5. Report ----------------------------------------------------------

  const top = await prisma.facility.findMany({
    where: { reviewCount: { gt: 0 } },
    orderBy: { bayesScore: "desc" },
    take: 5,
    select: {
      name: true,
      ratingAvg: true,
      reviewCount: true,
      bayesScore: true,
      city: { select: { name: true } },
    },
  });

  console.log("\nSeed complete.\n");
  console.log(
    `  accounts        ${summary.usersCreated} created, ${summary.usersExisting} already present`,
  );
  console.log(`  password        ${DEMO_PASSWORD}  (every demo account)`);
  console.log(`  facilities      ${summary.facilities} populated`);
  console.log(`  reviews         ${summary.reviews} written or refreshed`);
  console.log(`  comments        ${summary.comments}`);
  console.log(
    `  votes           ${summary.reviewVotes} on reviews, ${summary.commentVotes} on comments`,
  );
  console.log(
    `  site mean       ${meanRating.toFixed(3)} over ${siteReviewCount} published reviews`,
  );

  console.log("\n  Highest rated after Bayesian adjustment:");
  for (const f of top) {
    console.log(
      `    ${f.bayesScore.toFixed(2)}  (avg ${f.ratingAvg.toFixed(1)} from ${String(
        f.reviewCount,
      ).padStart(2)})  ${f.name} — ${f.city.name}`,
    );
  }
  console.log("");

  await prisma.$disconnect();
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
