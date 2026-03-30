import Link from "next/link";

import { createAdminClient } from "@/lib/supabase-server";
import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";

export const dynamic = "force-dynamic";

type TeamRow = { player_id: string; purchase_price: number };
type SectionId = "gk" | "def" | "mid" | "fwd" | "other";

const SECTION_ORDER: Array<{ id: SectionId; label: string }> = [
  { id: "gk", label: "Goalkeepers" },
  { id: "def", label: "Defenders" },
  { id: "mid", label: "Midfielders" },
  { id: "fwd", label: "Forwards" },
  { id: "other", label: "Other" },
];

function sectionForPosition(position: string | null | undefined): SectionId {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward")) return "fwd";
  return "other";
}

export default async function MyTeamPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const d = await loadAuctionDashboardForViewer(auctionId);
  const returnTo = `/auctions/${auctionId}/team`;

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
  const rows = (data ?? []) as TeamRow[];
  const enrichedRows = rows.map((row) => {
    const meta = byPlayer.get(String(row.player_id));
    return {
      ...row,
      meta,
      section: sectionForPosition(meta?.position),
    };
  });
  const grouped = SECTION_ORDER.map((section) => {
    const sectionRows = enrichedRows
      .filter((r) => r.section === section.id)
      .sort((a, b) => {
        const clubA = (a.meta?.club ?? "").toLowerCase();
        const clubB = (b.meta?.club ?? "").toLowerCase();
        if (clubA !== clubB) return clubA.localeCompare(clubB);
        const nameA = (a.meta?.player_name ?? "").toLowerCase();
        const nameB = (b.meta?.player_name ?? "").toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.player_id.localeCompare(b.player_id);
      });
    return {
      ...section,
      rows: sectionRows,
    };
  }).filter((s) => s.rows.length > 0);

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
            <div className="space-y-4 md:hidden">
              {grouped.map((group, groupIdx) => (
                <div key={group.id} className={groupIdx > 0 ? "pt-2" : ""}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    {group.label} ({group.rows.length})
                  </h3>
                  <ul className="mt-2 space-y-3">
                    {group.rows.map((t, i) => (
                      <li
                        key={`${group.id}-${t.player_id}`}
                        className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
                          i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="text-base font-medium text-slate-900">
                            <Link
                              href={`/auctions/${auctionId}/players/${t.player_id}?returnTo=${encodeURIComponent(
                                returnTo,
                              )}`}
                              className="hover:underline"
                            >
                              {t.meta?.player_name ?? "—"}
                            </Link>
                          </h4>
                          <span className="font-mono text-sm font-medium text-slate-900">
                            {t.purchase_price}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {(t.meta?.club ?? "—") + " · " + (t.meta?.position ?? "—")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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
                  {grouped.flatMap((group, groupIdx) => {
                    const rowsForGroup = group.rows.map((t, i) => (
                      <tr
                        key={`${group.id}-${t.player_id}`}
                        className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/50" : "bg-white"}`}
                      >
                        <td className="px-3 py-3 text-slate-900">
                          <Link
                            href={`/auctions/${auctionId}/players/${t.player_id}?returnTo=${encodeURIComponent(
                              returnTo,
                            )}`}
                            className="hover:underline"
                          >
                            {t.meta?.player_name ?? "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{t.meta?.club ?? "—"}</td>
                        <td className="px-3 py-3 text-slate-600">{t.meta?.position ?? "—"}</td>
                        <td className="px-3 py-3 font-mono font-medium text-slate-900">{t.purchase_price}</td>
                      </tr>
                    ));
                    return [
                      <tr
                        key={`${group.id}-header`}
                        className={groupIdx === 0 ? "bg-slate-100/70" : "border-t-2 border-slate-200 bg-slate-100/70"}
                      >
                        <td colSpan={4} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {group.label} ({group.rows.length})
                        </td>
                      </tr>,
                      ...rowsForGroup,
                    ];
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
