import { createAdminClient } from "@/lib/supabase-server";
import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";

export const dynamic = "force-dynamic";

export default async function MyTeamPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const d = await loadAuctionDashboardForViewer(auctionId);

  if (!d.me) {
    return (
      <p className="text-sm text-neutral-500">
        Choose a manager in the header to see your drafted team, or stay in view-only mode.
      </p>
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auction_teams")
    .select("player_id, purchase_price")
    .eq("auction_id", auctionId)
    .eq("auction_user_id", d.me.id)
    .order("player_id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const byPlayer = new Map(d.lots.map((l) => [l.player_id, l]));
  const rows = (data ?? []) as { player_id: string; purchase_price: number }[];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">My team</h2>
      <p className="text-sm text-neutral-500">
        Only players you have won (sold to you). Leading bids appear under Bids held, not here.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No players on your roster yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">Club</th>
                <th className="px-3 py-2 font-medium">Pos</th>
                <th className="px-3 py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const meta = byPlayer.get(String(t.player_id));
                return (
                  <tr key={t.player_id} className="border-b border-neutral-800/80">
                    <td className="px-3 py-2">{meta?.player_name ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-400">{meta?.club ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-400">{meta?.position ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{t.purchase_price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
