import { BackButton } from "./_components/BackButton";
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
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3">
          <BackButton />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Announcements</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          A shared feed of purchases, releases, transfers, and World Cup elimination refunds in
          this auction. Most recent events appear first.
        </p>
      </div>

      <AnnouncementsPageTabs
        announcements={announcements}
        eliminationReleases={eliminationReleases}
      />
    </section>
  );
}
