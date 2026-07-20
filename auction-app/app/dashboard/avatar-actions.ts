"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/get-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AvatarActionResult = { ok: true } | { ok: false; message: string };

export async function setAvatarUrlAction(avatarUrl: string): Promise<AvatarActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, message: "You must be logged in." };
  }

  const trimmed = avatarUrl.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { ok: false, message: "Invalid avatar URL." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: trimmed })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function clearAvatarAction(): Promise<AvatarActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, message: "You must be logged in." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
