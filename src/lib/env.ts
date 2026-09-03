import { z } from "zod";

/**
 * Environment is validated once, at module load, so a misconfigured deployment
 * fails at boot with a readable message instead of throwing on a random
 * request. Import this rather than reading `process.env` directly.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),
  /**
   * Secret used to derive the daily rotating salt that pseudonymises IPs for
   * rate limiting. Optional in development, required in production — without
   * it, throttling buckets would be guessable.
   */
  IP_HASH_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = schema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  IP_HASH_SECRET: process.env.IP_HASH_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment variables:\n${issues}\n\nCopy .env.example to .env and fill in the blanks.`,
  );
}

export const env = parsed.data;

/**
 * A production deployment without this secret has guessable rate-limit
 * buckets, so refuse to serve. The build is exempt: `next build` evaluates
 * every module to collect page data, and requiring runtime secrets there
 * would force CI and `docker build` to hold production credentials they have
 * no business seeing.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (env.NODE_ENV === "production" && !isBuildPhase && !env.IP_HASH_SECRET) {
  throw new Error(
    "IP_HASH_SECRET must be set in production — rate limiting depends on it.",
  );
}
