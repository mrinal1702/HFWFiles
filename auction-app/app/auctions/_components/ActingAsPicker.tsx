"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setAuctionActorAction } from "@/app/auctions/actions";

type UserOpt = { id: number; name: string | null };

export function ActingAsPicker({
  auctionId,
  users,
  viewerMode,
  actorUserId,
}: {
  auctionId: number;
  users: UserOpt[];
  viewerMode: boolean;
  actorUserId: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (users.length === 0) {
    return <span className="text-sm text-neutral-500">No managers in this auction.</span>;
  }

  const selectValue = viewerMode ? "__viewer__" : String(actorUserId ?? users[0].id);

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-neutral-500">Acting as</span>
      <select
        className="max-w-[16rem] rounded-md border border-neutral-600 bg-neutral-900 px-2 py-1.5 text-neutral-100"
        disabled={pending}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            if (v === "__viewer__") {
              await setAuctionActorAction(auctionId, null);
            } else {
              await setAuctionActorAction(auctionId, Number(v));
            }
            router.refresh();
          });
        }}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name ?? `Manager #${u.id}`}
          </option>
        ))}
        <option value="__viewer__">View only (no bidding)</option>
      </select>
    </label>
  );
}
