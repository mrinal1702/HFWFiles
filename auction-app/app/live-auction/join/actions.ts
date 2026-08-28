"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase-server";

export type JoinLiveAuctionState = { ok: false; message: string } | null;

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function joinLiveAuctionAction(
  _prev: JoinLiveAuctionState | null,
  formData: FormData,
): Promise<JoinLiveAuctionState> {
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const displayName = String(formData.get("name") ?? "").trim();

  if (code.length < 4 || code.length > 12) {
    return { ok: false, message: "Enter a valid auction code." };
  }
  if (!displayName || displayName.length < 2) {
    return { ok: false, message: "Enter your name (at least 2 characters)." };
  }
  if (displayName.length > 30) {
    return { ok: false, message: "Name must be 30 characters or fewer." };
  }

  const supabase = createAdminClient();

  const { data: auction, error: aErr } = await supabase
    .from("live_auctions")
    .select("id, name, status")
    .eq("join_code", code)
    .maybeSingle();

  if (aErr) return { ok: false, message: aErr.message };
  if (!auction) return { ok: false, message: "No auction found for that code." };

  // Check for duplicate name in this auction
  const { data: existing } = await supabase
    .from("live_auction_participants")
    .select("id, display_name")
    .eq("auction_id", auction.id)
    .ilike("display_name", displayName);

  if (existing && existing.length > 0) {
    return { ok: false, message: `"${existing[0].display_name}" is already taken. Pick a different name.` };
  }

  const { data: participant, error: insErr } = await supabase
    .from("live_auction_participants")
    .insert({
      auction_id: auction.id,
      display_name: displayName,
      role: "participant",
    })
    .select("id")
    .single();

  if (insErr) return { ok: false, message: insErr.message };

  // Store participant ID in a cookie so the live auction page can identify them
  const cookieStore = await cookies();
  cookieStore.set(`la_pid_${auction.id}`, participant.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect(`/live-auction/${auction.id}`);
}
