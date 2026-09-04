# Password recovery

Last updated: August 2026

Users can reset a forgotten password via **Forgot password?** on `/login`, or a commissioner can still send a reset email from Supabase Dashboard → Authentication → Users.

---

## Critical: Recovery email template (do this once)

Password reset emails **must** use the `TokenHash` link format. The default Supabase template (`{{ .ConfirmationURL }}`) uses a PKCE `code` that only works in the **same browser** that requested the reset. Opening Gmail/Outlook on a phone (or any other browser) fails and dumps the user on `/login` — this is what broke resets for multiple managers.

**Supabase Dashboard → Authentication → Email Templates → Reset password**

Replace the link with:

```html
<h2>Reset your password</h2>
<p>We received a request to reset your password. Follow the link below to choose a new one.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password"
    >Reset password</a
  >
</p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

Save the template, then have the user request a **new** reset email (old links stay on the broken format).

---

## App routes

| Route | Purpose |
|-------|---------|
| `/forgot-password` | User enters email; calls `resetPasswordForEmail` |
| `/auth/confirm` | Verifies `token_hash` recovery links (preferred; any device) |
| `/auth/callback` | Also accepts `token_hash` or legacy PKCE `code` links |
| `/reset-password` | User sets a new password via `updateUser({ password })` |

If a dashboard reset email lands on the site root with a recovery session, `AuthRecoveryRedirect` sends the user to `/reset-password` automatically.

---

## Supabase Dashboard setup (required once)

**Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| **Site URL** | `https://hfwauction.vercel.app` |
| **Redirect URLs** | Add each line below (plus `http://localhost:3000/...` for local dev) |

```
https://hfwauction.vercel.app/auth/callback
https://hfwauction.vercel.app/auth/confirm
https://hfwauction.vercel.app/reset-password
```

Without these redirect URLs, email links may fail or skip the reset form.

---

## User flows

### Self-service (recommended)

1. `/login` → **Forgot password?**
2. Enter email → receive link
3. Link → `/auth/confirm?token_hash=…&type=recovery` → `/reset-password`
4. Set new password → redirected to dashboard

### Commissioner sends reset from Supabase

1. Dashboard → Authentication → Users → **Send password reset email**
2. Same email template as above must be configured (otherwise same PKCE failure)
3. User sets new password on `/reset-password`

---

## Scope

Auth-only (`auth.users` password). Does **not** touch auction tables, bids, budgets, or squads.
