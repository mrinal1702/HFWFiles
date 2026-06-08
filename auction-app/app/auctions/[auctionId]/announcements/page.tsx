import { BackButton } from "./_components/BackButton";
import { AnnouncementsFeed } from "./_components/AnnouncementsFeed";
import { loadAnnouncements } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const announcements = await loadAnnouncements(auctionId);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3">
          <BackButton />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Announcements</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          A shared news feed of every completed purchase, release, and transfer in this auction.
          Most recent events appear first.
        </p>
      </div>

      <AnnouncementsFeed announcements={announcements} />
    </section>
  );
}
