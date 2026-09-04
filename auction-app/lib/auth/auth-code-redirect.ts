import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Exchanges a recovery/auth link for a session and redirects, writing cookies
 * onto the redirect response (required on Next.js 15+; cookies().set alone
 * does not attach Set-Cookie to a separately constructed NextResponse.redirect).
 */
export async function completeAuthLinkRedirect(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextRaw = requestUrl.searchParams.get("next") ?? "/dashboard";
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const failPath =
    tokenHash && type ? "/login?error=confirm" : "/login?error=callback";

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(new URL(failPath, requestUrl.origin));
  }

  const successPath =
    type === "recovery" || next.startsWith("/reset-password") ? "/reset-password" : next;
  const redirectResponse = NextResponse.redirect(new URL(successPath, requestUrl.origin));

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          redirectResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return NextResponse.redirect(new URL("/login?error=confirm", requestUrl.origin));
    }
    return redirectResponse;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", requestUrl.origin));
  }

  return redirectResponse;
}
