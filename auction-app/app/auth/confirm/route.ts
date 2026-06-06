import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/auth/route-handler-client";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=confirm", requestUrl.origin));
  }

  const supabase = await createSupabaseRouteHandlerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirm", requestUrl.origin));
  }

  const destination = type === "recovery" ? "/reset-password" : next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
