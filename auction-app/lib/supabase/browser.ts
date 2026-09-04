import { createBrowserClient } from "@supabase/ssr";

/**
 * Avoid navigator.locks deadlocks: failed recovery/PKCE attempts (or React
 * Strict Mode) can orphan a Web Lock so signInWithPassword hangs forever on
 * "Signing in…". In-process no-op lock is fine for this app's browser client.
 */
async function authLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return fn();
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createBrowserClient(url, key, {
    auth: {
      lock: authLock,
    },
  });
}
