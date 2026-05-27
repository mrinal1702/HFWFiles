import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

export default async function LiveAuctionRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/live-auction");
  }

  return <>{children}</>;
}
