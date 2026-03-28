import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Full-access Supabase client — use only in Server Components, Server Actions, and Route Handlers.
 * Never import this file from client components (the service role key must stay on the server).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to auction-app/.env.local for the auction lab page.",
    );
  }
  return createClient(url, key);
}
