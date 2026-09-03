import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Liveness probe for the container orchestrator and the Docker HEALTHCHECK.
 *
 * A health check that only proves the Node process is alive is worth very
 * little — this app is a thin layer over Postgres, and the failure that
 * actually takes it down is a connection pool that cannot reach the database.
 * So the check runs a real query and reports 503 when it fails, which is what
 * makes a load balancer take the instance out of rotation.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: "ok", db: "up" },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("health: database unreachable", error);

    // Deliberately no error detail in the body: this endpoint is public, and
    // a connection string in an error message is a credential leak.
    return NextResponse.json(
      { status: "error", db: "down" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
