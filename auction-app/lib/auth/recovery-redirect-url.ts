/** Where Supabase should send users after a password-reset email link is verified. */
export function passwordRecoveryRedirectUrl(origin: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
}
