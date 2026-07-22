import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Batch-load public avatar URLs for auth user ids from `profiles`.
 * Missing `avatar_url` column (SQL not applied) returns an empty map.
 */
export async function fetchAvatarUrlsByUserIds(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return map;

  const { data, error } = await admin.from("profiles").select("id, avatar_url").in("id", unique);

  if (error) {
    if (String(error.message).includes("avatar_url")) return map;
    throw new Error(`profiles: ${error.message}`);
  }

  for (const row of data ?? []) {
    const id = String((row as { id: string }).id);
    const url = (row as { avatar_url: string | null }).avatar_url;
    map.set(id, url?.trim() || null);
  }
  return map;
}
