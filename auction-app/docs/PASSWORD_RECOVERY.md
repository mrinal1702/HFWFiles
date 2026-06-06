# Password recovery

Last updated: June 2026

Users can reset a forgotten password via **Forgot password?** on `/login`, or a commissioner can still send a reset email from Supabase Dashboard → Authentication → Users.

---

## App routes

| Route | Purpose |
|-------|---------|
| `/forgot-password` | User enters email; calls `resetPasswordForEmail` |
| `/auth/callback` | Exchanges PKCE `code` from email link for a session |
| `/auth/confirm` | Verifies `token_hash` links (some Supabase email formats) |
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
3. Link → `/auth/callback?next=/reset-password` → `/reset-password`
4. Set new password → redirected to dashboard

### Commissioner sends reset from Supabase

1. Dashboard → Authentication → Users → **Send password reset email**
2. User clicks link (may land on `/` first)
3. App redirects to `/reset-password` when Supabase fires `PASSWORD_RECOVERY`
4. User sets new password

---

## Scope

Auth-only (`auth.users` password). Does **not** touch auction tables, bids, budgets, or squads.
