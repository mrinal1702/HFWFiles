import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  CREATE_AUCTION_COMPETITION,
  loadCreatorDisplayName,
  loadTakenAuctionNameKeys,
  suggestAuctionName,
} from "@/lib/auction-create";
import { loadStartGameweekPreview } from "@/lib/auction-state/start-gameweek";

import { CreateAuctionForm } from "./CreateAuctionForm";

export const dynamic = "force-dynamic";

export default async function CreateAuctionPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/create-auction");

  const [displayName, taken, schedule] = await Promise.all([
    loadCreatorDisplayName(user),
    loadTakenAuctionNameKeys(),
    loadStartGameweekPreview(CREATE_AUCTION_COMPETITION.id),
  ]);
  const { outcome } = schedule;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:max-w-2xl sm:px-6 sm:py-10">
      <Link href="/dashboard" className="text-sm font-medium text-sky-700 underline hover:text-sky-900">
        ← Dashboard
      </Link>
      <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Start A New Auction
      </h1>

      {outcome.ok ? (
        <CreateAuctionForm
          suggestedName={suggestAuctionName(displayName, taken)}
          competitionName={CREATE_AUCTION_COMPETITION.name}
          firstGameweekIfStartedNow={outcome.target.displayName}
        />
      ) : (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          {outcome.message}
        </p>
      )}
    </main>
  );
}
