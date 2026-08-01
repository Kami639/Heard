import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The build the server is currently running. The client compares this to its
 *  own baked-in id to notice a new deployment without a force-quit. */
export async function GET() {
  return new NextResponse(
    JSON.stringify({ buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } }
  );
}
