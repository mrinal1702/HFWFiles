"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import { JOIN_DEFAULT_BUDGET } from "@/lib/join-constants";
import { createAdminClient } from "@/lib/supabase-server";

export type JoinAuctionState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function profileDisplayName(
  admin: ReturnType<typeof createAdminClient>,
  user: { id: string; email?: string | null },
): Promise<string> {
  const { data: prof } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  return (
    (prof as { display_name: string } | null)?.display_name ??
    user.email?.split("@")[0] ??
    "Player"
  );
}

export async function joinAuctionByCodeAction(
  _prev: JoinAuctionState | null,
  formData: FormData,
): Promise<JoinAuctionState> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, message: "You must be logged in." };
  }

  const code = normalizeJoinCode(String(formData.get("code") ?? ""));
  if (code.length < 6 || code.length > 8) {
    return { ok: false, message: "Enter a join code (6–8 letters or numbers)." };
  }

  const admin = createAdminClient();

  // ── Online async auction (existing product) ───────────────────────────────
  const { data: onlineAuction, error: onlineLookupErr } = await admin
    .from("Auctions")
    .select("id,max_participants,join_code")
    .eq("join_code", code)
    .maybeSingle();

  if (onlineLookupErr) return { ok: false, message: onlineLookupErr.message };

  if (onlineAuction) {
    const auctionId = Number(onlineAuction.id);
    const maxP = Math.min(32, Math.max(1, Number(onlineAuction.max_participants ?? 12)));

    const { data: existing } = await admin
      .from("auction_users")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return { ok: false, message: "You are already part of this auction." };
    }

    const { count, error: cErr } = await admin
      .from("auction_users")
      .select("id", { count: "exact", head: true })
      .eq("auction_id", auctionId);

    if (cErr) return { ok: false, message: cErr.message };
    if ((count ?? 0) >= maxP) {
      return { ok: false, message: "This auction is full." };
    }

    const displayName = await profileDisplayName(admin, user);

    const { error: insErr } = await admin.from("auction_users").insert({
      auction_id: auctionId,
      name: displayName,
      budget_remaining: JOIN_DEFAULT_BUDGET,
      active_budget: JOIN_DEFAULT_BUDGET,
      user_id: user.id,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return { ok: false, message: "You are already part of this auction." };
      }
      return { ok: false, message: insErr.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/auctions", "layout");
    redirect(`/auctions/${auctionId}/bidding-room`);
  }

  // ── Live auction — participant code ───────────────────────────────────────
  const { data: liveParticipantAuction, error: livePartErr } = await admin
    .from("live_auctions")
    .select("id, name, max_participants")
    .eq("join_code", code)
    .maybeSingle();

  if (livePartErr) return { ok: false, message: livePartErr.message };

  if (liveParticipantAuction) {
    const { data: existing } = await admin
      .from("live_auction_participants")
      .select("id")
      .eq("auction_id", liveParticipantAuction.id)
      .eq("user_id", user.id)
      .eq("role", "participant")
      .maybeSingle();

    if (existing) {
      return { ok: false, message: "You are already in this live auction." };
    }

    const maxP = Math.min(32, Math.max(1, Number(liveParticipantAuction.max_participants ?? 16)));

    const { count, error: cErr } = await admin
      .from("live_auction_participants")
      .select("id", { count: "exact", head: true })
      .eq("auction_id", liveParticipantAuction.id)
      .eq("role", "participant")
      .not("user_id", "is", null);

    if (cErr) return { ok: false, message: cErr.message };
    if ((count ?? 0) >= maxP) {
      return { ok: false, message: "This live auction is full." };
    }

    const displayName = await profileDisplayName(admin, user);

    const { error: insErr } = await admin.from("live_auction_participants").insert({
      auction_id: liveParticipantAuction.id,
      user_id: user.id,
      display_name: displayName,
      role: "participant",
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return { ok: false, message: "You are already in this live auction." };
      }
      return { ok: false, message: insErr.message };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/live-auction/${liveParticipantAuction.id}`);
    revalidatePath(`/live-auction/${liveParticipantAuction.id}/admin`);

    return {
      ok: true,
      message: `Joined "${liveParticipantAuction.name}". Open it from Active Auctions above.`,
    };
  }

  // ── Live auction — admin code ─────────────────────────────────────────────
  const { data: liveAdminAuction, error: liveAdminErr } = await admin
    .from("live_auctions")
    .select("id, name")
    .eq("admin_code", code)
    .maybeSingle();

  if (liveAdminErr) return { ok: false, message: liveAdminErr.message };

  if (liveAdminAuction) {
    const { data: existing } = await admin
      .from("live_auction_admin_grants")
      .select("id")
      .eq("auction_id", liveAdminAuction.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return { ok: false, message: "You already have admin access to this live auction." };
    }

    const { error: insErr } = await admin.from("live_auction_admin_grants").insert({
      auction_id: liveAdminAuction.id,
      user_id: user.id,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return { ok: false, message: "You already have admin access to this live auction." };
      }
      return { ok: false, message: insErr.message };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/live-auction/${liveAdminAuction.id}/admin`);

    return {
      ok: true,
      message: `Admin access granted for "${liveAdminAuction.name}". Open it from Active Auctions above.`,
    };
  }

  return { ok: false, message: "No auction found for that code." };
}
