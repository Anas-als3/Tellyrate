import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

/**
 * A staging deployment must never be indexable.
 *
 * If it were, a copy of the site carrying seeded test reviews would compete
 * with the real one for the same searches, and a student could land on
 * invented reviews believing they were real. That is the kind of mistake that
 * is discovered months later, so it gets a test.
 *
 * `robots.ts` reads the environment once at module load, so each case runs in
 * its own process rather than trying to mutate a frozen singleton.
 */
function robotsFor(appEnv: string): {
  rules: Array<{ userAgent?: string; allow?: unknown; disallow?: unknown }>;
  sitemap?: string;
} {
  const script = `
    import robots from "./src/app/robots.ts";
    process.stdout.write(JSON.stringify(robots()));
  `;

  const out = execFileSync(
    "npx",
    ["tsx", "--eval", script, "--tsconfig", "tsconfig.json"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        APP_ENV: appEnv,
        VERCEL_ENV: "",
        DATABASE_URL: "postgresql://user:pass@localhost:5433/test",
        NEXT_PUBLIC_SITE_URL: "https://hospirate.example",
        IP_HASH_SECRET: "test-secret-long-enough-to-pass",
      },
    },
  );

  return JSON.parse(out);
}

test("staging refuses every crawler and publishes no sitemap", () => {
  const result = robotsFor("staging");

  assert.equal(result.sitemap, undefined, "staging must not advertise a sitemap");
  assert.equal(result.rules.length, 1);
  assert.equal(result.rules[0].disallow, "/");
  assert.equal(result.rules[0].allow, undefined);
});

test("development is treated the same as staging", () => {
  const result = robotsFor("development");
  assert.equal(result.rules[0].disallow, "/");
  assert.equal(result.sitemap, undefined);
});

test("production is crawlable, minus the API and account areas", () => {
  const result = robotsFor("production");

  assert.equal(result.rules[0].allow, "/");
  assert.deepEqual(result.rules[0].disallow, ["/api/", "/account/"]);
  assert.equal(result.sitemap, "https://hospirate.example/sitemap.xml");
});
