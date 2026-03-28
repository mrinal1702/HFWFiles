import { NextResponse } from "next/server";

/**
 * Smoke test for deployments: GET /api/health → 200 JSON.
 * If this 404s on Vercel, the Next.js app is not what is being served (wrong root directory, etc.).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "auction-app",
    time: new Date().toISOString(),
  });
}
