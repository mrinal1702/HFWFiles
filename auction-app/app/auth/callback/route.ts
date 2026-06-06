import { NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/auth/route-handler-client";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", requestUrl.origin));
  }

  const supabase = await createSupabaseRouteHandlerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", requestUrl.origin));
  }

  const destination = next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
