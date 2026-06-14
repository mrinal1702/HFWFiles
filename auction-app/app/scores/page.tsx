import { redirect } from "next/navigation";

/** @deprecated Use `/match-scores` — kept for old links and bookmarks. */
export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string }>;
}) {
  const { match } = await searchParams;
  redirect(match ? `/match-scores?match=${encodeURIComponent(match)}` : "/match-scores");
}
