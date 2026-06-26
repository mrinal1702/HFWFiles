import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth/get-user";
import { fetchMemeBuildScores } from "@/lib/meme-builds-data";
import { MEME_BUILD_GAME_WEEK_IDS } from "@/lib/meme-builds/types";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { playerIds?: string[]; gameWeekIds?: number[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const playerIds = Array.isArray(body.playerIds)
    ? body.playerIds.map(String).filter(Boolean)
    : [];
  const gameWeekIds = Array.isArray(body.gameWeekIds)
    ? body.gameWeekIds.filter((id): id is number => typeof id === "number" && id > 0)
    : [...MEME_BUILD_GAME_WEEK_IDS];

  if (playerIds.length > 500) {
    return NextResponse.json({ error: "Too many player IDs" }, { status: 400 });
  }

  try {
    const scores = await fetchMemeBuildScores(playerIds, gameWeekIds);
    return NextResponse.json({ scores });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
