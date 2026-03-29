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
      <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm leading-relaxed text-slate-600">
          Choose your manager in the header to see your roster here.
        </p>
      </section>
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
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">My team</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your squad for this auction — everyone here is yours to keep. Still fighting for someone? They&apos;ll
          show up under <span className="font-medium text-slate-800">Bids held</span> until the auction
          wraps up.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600">No players on your roster yet.</p>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {rows.map((t, i) => {
                const meta = byPlayer.get(String(t.player_id));
                return (
                  <li
                    key={t.player_id}
                    className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
                      i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-base font-medium text-slate-900">{meta?.player_name ?? "—"}</h3>
                      <span className="font-mono text-sm font-medium text-slate-900">{t.purchase_price}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {(meta?.club ?? "—") + " · " + (meta?.position ?? "—")}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Player</th>
                    <th className="px-3 py-3 font-semibold">Club</th>
                    <th className="px-3 py-3 font-semibold">Pos</th>
                    <th className="px-3 py-3 font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t, i) => {
                    const meta = byPlayer.get(String(t.player_id));
                    return (
                      <tr
                        key={t.player_id}
                        className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/50" : "bg-white"}`}
                      >
                        <td className="px-3 py-3 text-slate-900">{meta?.player_name ?? "—"}</td>
                        <td className="px-3 py-3 text-slate-600">{meta?.club ?? "—"}</td>
                        <td className="px-3 py-3 text-slate-600">{meta?.position ?? "—"}</td>
                        <td className="px-3 py-3 font-mono font-medium text-slate-900">{t.purchase_price}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
