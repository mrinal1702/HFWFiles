import { getAuthUser } from "@/lib/auth/get-user";
import { getMemeBuildsPageData } from "@/lib/meme-builds-data";
import { MemeBuildsApp } from "./_components/MemeBuildsApp";

export const dynamic = "force-dynamic";

export default async function MemeBuildsPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const { pool, gameWeeks, matchPositionsByGw } = await getMemeBuildsPageData();

  return (
    <MemeBuildsApp
      userId={user.id}
      pool={pool}
      gameWeeks={gameWeeks}
      matchPositionsByGw={matchPositionsByGw}
    />
  );
}
