/**
 * Where Supabase should send users after verifying a password-reset email.
 * Prefer the TokenHash email template → /auth/confirm (works across devices).
 * /auth/callback remains supported for legacy ConfirmationURL + PKCE code links.
 */
export function passwordRecoveryRedirectUrl(origin: string): string {
  return `${origin}/auth/confirm?next=${encodeURIComponent("/reset-password")}`;
}
