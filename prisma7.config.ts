import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migrations need a DIRECT connection: a transaction pooler (PgBouncer,
 * Supavisor, Neon's -pooler host) cannot run DDL, so `prisma migrate deploy`
 * fails against the same URL the app uses at runtime. DIRECT_URL falls back to
 * DATABASE_URL for single-server deployments, where there is no pooler and the
 * two are the same thing.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
