import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The signed-in user as the app uses it: only the id and email are ever read. */
export type AuthUser = {
  id: string;
  email: string | undefined;
};

/**
 * Who is signed in, or null for a guest.
 *
 * Uses `getClaims()`, which verifies the session token locally against the project's
 * published ES256 signing key (fetched once and cached) instead of calling Supabase Auth
 * on every request like `getUser()` did. `cache()` makes repeat calls within one request
 * (layout + page + loaders) share a single check.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return null;
  }
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
});
