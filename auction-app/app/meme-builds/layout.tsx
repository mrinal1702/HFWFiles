import Link from "next/link";
import { redirect } from "next/navigation";

import { RefreshButton } from "@/app/auctions/_components/RefreshButton";
import { getAuthUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

export default async function MemeBuildsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=%2Fmeme-builds");
  }

  return (
    <div className="mx-auto max-w-5xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            <Link href="/dashboard" className="font-medium text-sky-700 hover:underline">
              ← Dashboard
            </Link>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Meme Builds
            <span className="ml-2 font-normal text-slate-400">· for fun</span>
          </h1>
        </div>
        <RefreshButton />
      </header>
      {children}
    </div>
  );
}
