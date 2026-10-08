import { ManagerChip } from "@/app/_components/entity/ManagerChip";

/**
 * The only manager link allowed on the leaderboard: always opens that manager's
 * Competitors – Points page (never Competitors – Bidding, ManagerChip's default).
 * `from` picks the Back target on that page. Enforced by scripts/check-gameweek-surfaces.mjs.
 */
export function pointsCompetitorHref(
  auctionId: number,
  userId: number,
  opts: { from?: "standings" | "competitors"; gw?: string | null } = {},
): string {
  const qs = new URLSearchParams();
  if (opts.gw) qs.set("gw", opts.gw);
  if (opts.from === "standings") qs.set("from", "standings");
  const q = qs.toString();
  return `/auctions/${auctionId}/leaderboard/competitors/${userId}${q ? `?${q}` : ""}`;
}

export function PointsManagerChip({
  auctionId,
  userId,
  name,
  teamName,
  avatarUrl,
  labelClassName,
  from,
  gw,
}: {
  auctionId: number;
  userId: number;
  name: string | null;
  teamName: string | null;
  avatarUrl: string | null;
  labelClassName?: string;
  from?: "standings" | "competitors";
  gw?: string | null;
}) {
  return (
    <ManagerChip
      auctionId={auctionId}
      auctionUserId={userId}
      name={name}
      teamName={teamName}
      avatarUrl={avatarUrl}
      preferTeamLabel
      labelClassName={labelClassName}
      href={pointsCompetitorHref(auctionId, userId, { from, gw })}
    />
  );
}
