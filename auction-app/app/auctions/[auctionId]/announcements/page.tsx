import { AnnouncementsPageTabs } from "./_components/AnnouncementsPageTabs";
import { loadAnnouncements, loadEliminationReleases } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const [announcements, eliminationReleases] = await Promise.all([
    loadAnnouncements(auctionId),
    loadEliminationReleases(auctionId),
  ]);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-3 pl-5 pr-3 shadow-sm sm:gap-4 sm:py-4 sm:pl-6 sm:pr-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200 sm:h-11 sm:w-11"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Zm13-3a5 5 0 0 1 0 8m2.5-10.5a8.5 8.5 0 0 1 0 13"
            />
          </svg>
        </span>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Announcements</h2>
      </div>

      <AnnouncementsPageTabs
        announcements={announcements}
        eliminationReleases={eliminationReleases}
        auctionId={auctionId}
      />
    </section>
  );
}
