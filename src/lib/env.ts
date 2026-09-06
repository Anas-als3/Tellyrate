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

  /**
   * Which deployment this is, as distinct from NODE_ENV.
   *
   * A staging build is a *production* Node build — same optimisations, same
   * strictness — that simply must not be indexed, must not share a database
   * with the live site, and must be obvious to anyone looking at it. NODE_ENV
   * cannot express that, so this does.
   *
   * On Vercel it derives from VERCEL_ENV automatically: every preview
   * deployment, including pull requests, counts as staging. Set APP_ENV
   * explicitly to override, which is what a self-hosted staging box needs.
   */
  APP_ENV: z.enum(["production", "staging", "development"]).default("development"),
});

function resolveAppEnv(): string | undefined {
  if (process.env.APP_ENV) return process.env.APP_ENV;

  switch (process.env.VERCEL_ENV) {
    case "production":
      return "production";
    case "preview":
      return "staging";
    case "development":
      return "development";
    default:
      return process.env.NODE_ENV === "production" ? "production" : undefined;
  }
}

const parsed = schema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  IP_HASH_SECRET: process.env.IP_HASH_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: resolveAppEnv(),
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

/** True only on the real, indexable, public deployment. */
export const isProductionDeployment = env.APP_ENV === "production";

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
