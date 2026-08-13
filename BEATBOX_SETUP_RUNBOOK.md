# BeatBox Complete Setup Runbook

This runbook activates the validated BeatBox source in `expoxtechinc/BEAT-BOX`. The repository contains the React/Vite application, server routes, Supabase integration, private-media boundaries, marketplace workflows, social Feed/Reels, messaging, Creator Studio, AI fallback, PWA/SEO assets, tests, and Vercel routing.

> **Security rule:** Never commit API keys, service-role keys, OAuth secrets, payment credentials, or passwords. Values listed below are variable names only. Any credentials previously pasted into chat should be revoked and rotated before production use.

## 1. GitHub repository

Open [expoxtechinc/BEAT-BOX](https://github.com/expoxtechinc/BEAT-BOX) and confirm that the default branch is `main`. The latest synchronized commit is the commit shown on the repository after the final push. Vercel should be connected to this repository and branch, with automatic deployments enabled only after the owner confirms the correct Vercel project and team.

For local development, clone the repository and install the committed dependencies:

```bash
gh repo clone expoxtechinc/BEAT-BOX
cd BEAT-BOX
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

## 2. Create or select the Supabase project

In Supabase, create a project or select the production project that will own BeatBox data. Copy the project URL and publishable browser key from **Project Settings → API**. Do not place the service-role key in browser code. The application expects the following browser-safe variables in Vercel and local development:

| Variable | Purpose | Exposure |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Browser-safe |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key | Browser-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional server-only administrative operations | Server-only; never expose to Vite |
| `JWT_SECRET` | Server session/signing secret where required | Server-only |

Apply `BEATBOX_SUPABASE_MIGRATIONS.sql` from the repository root in the Supabase SQL Editor, or apply the individual files under `supabase/migrations/` in the same dependency order. This export is the exact concatenation of the committed migration files and is intended for an owner-level database session; it is not executed automatically by the application. Take a database backup first, paste the export into a fresh SQL Editor query, run it, and stop immediately on the first SQL error rather than continuing partially. Apply the profile RPC and admin-audit/report-taxonomy migrations in particular. Verify that the connected account has permission to create functions, triggers, indexes, RLS policies, and storage policies before running them.

After execution, run these read-only verification queries in Supabase SQL Editor:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','beats','listings','orders','payment_requests','notifications','social_posts','comments','messages','reports','creator_analytics','admin_audit_log')
order by table_name;

select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('ensure_self_profile','register_as_seller','update_my_profile_metadata')
order by routine_name;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

The committed export file is `BEATBOX_SUPABASE_MIGRATIONS.sql`. Do not insert fake users, orders, payments, reviews, ratings, or testimonials.

After migration, verify that the database contains profiles, beats/listings, orders, payment requests, notifications, favorites, social posts, comments, reactions, bookmarks, reposts, follows, blocks, mutes, conversations, messages, reports, creator analytics, advertiser tables, and the audit log. Do not insert fake users, orders, payments, reviews, ratings, or testimonials.

## 3. Supabase authentication

Under **Authentication → URL Configuration**, set the Site URL to the exact production origin, for example `https://sastechorg-beatbox.vercel.app` without a trailing slash. Add these redirect URLs exactly, one per line:

| Environment | Redirect URL | Used for |
|---|---|---|
| Production | `https://sastechorg-beatbox.vercel.app/auth/callback` | Email confirmation, Google OAuth, password recovery |
| Managed preview | `https://beatmarket-zqk4krwh.manus.space/auth/callback` | Managed BeatBox preview, if used for testing |
| Local Vite | `http://localhost:5173/auth/callback` | Local `pnpm dev` when Vite uses port 5173 |
| Local managed server | `http://localhost:3000/auth/callback` | Local server when the app is served on port 3000 |

If the Vercel project uses a different production domain, replace the production origin with that exact domain and add both the apex and `www` variant only if both are configured. The application generates these callback paths from `window.location.origin`: Google and email signup use `/auth/callback`; password recovery uses `/auth/callback?mode=recovery`. Add the base `/auth/callback` URL to Supabase’s allow-list; query-string variants are covered by the base callback route. Under **Authentication → Providers**, enable Email and Google. The OAuth callback that Google itself receives is the Supabase callback shown in the Google provider panel, not the BeatBox `/auth/callback` URL.

For email/password authentication, configure SMTP or Supabase’s email provider, set the confirmation URL to the production site, and test signup, email confirmation, login, logout, password recovery, and session refresh.

For Google OAuth, create a Google Cloud OAuth web client. In Google Cloud, add the Supabase-provided callback URL displayed under Supabase **Authentication → Providers → Google** as the Google authorized redirect URI. Add `https://sastechorg-beatbox.vercel.app` and `http://localhost:5173` as authorized JavaScript origins, plus the managed preview origin only if you test OAuth there. Copy the Google client ID and client secret into Supabase’s Google provider settings, save, and test signup and returning-user login in a private browser window. Do not put Google secrets in Vercel client variables.

For phone OTP, enable the Supabase phone provider and configure the required SMS provider. Test country-code formatting, OTP request, invalid OTP, expired OTP, successful verification, logout, and re-login. Phone auth cannot be validated fully until an owner configures a real SMS provider.

## 4. Supabase Storage

Create or verify the buckets required by the migration and application. Public social media may use public delivery only where the migration explicitly permits it. Marketplace masters, payment proofs, private message attachments, administrative files, and other sensitive originals must remain private.

| Asset | Required access | Delivery rule |
|---|---|---|
| Beat preview and approved cover | Public or policy-approved | Safe preview only |
| Paid master beat | Private | Short-lived signed URL after verified entitlement |
| Payment proof | Private | Seller/admin scoped |
| Message attachments | Private | Conversation participant scoped and signed |
| Social post media | Public only when the post is public | Do not reuse marketplace master URLs |

Verify upload, metadata persistence, RLS/storage policies, signed-download expiry, denial without entitlement, and denial for another user. Never make a paid master public to simplify deployment.

## 5. Vercel deployment

In Vercel, import `expoxtechinc/BEAT-BOX`, select the `main` branch, and use the project defaults. The repository includes Vercel routing that sends `/api` requests to the server handler before SPA fallback. Do not replace this with a catch-all rewrite that sends API calls to `index.html`.

Set the following variables in **Project Settings → Environment Variables** for Development, Preview, and Production as appropriate:

| Variable | Required when | Purpose |
|---|---|---|
| `VITE_APP_TITLE` | Always | BeatBox browser/app title |
| `VITE_APP_LOGO` | Always | Official BeatBox logo URL |
| `VITE_SUPABASE_URL` | Always | Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Always | Supabase browser key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only operations | Never expose client-side |
| `JWT_SECRET` | Server sessions | Strong random secret |
| `OAUTH_SERVER_URL` | Manus OAuth path is used | OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuth path is used | Login portal URL |
| `OWNER_OPEN_ID` / `OWNER_NAME` | Owner/admin workflows | Owner association |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | Built-in server integrations | Server-only platform APIs |
| `VITE_FRONTEND_FORGE_API_URL` / `VITE_FRONTEND_FORGE_API_KEY` | Frontend platform integration | Only use the intended browser-safe key |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini AI fallback | Server-side AI provider |
| `GROQ_API_KEY` / `GROQ_MODEL` | Groq AI fallback | Server-side AI provider |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | OpenRouter AI fallback | Server-side AI provider |
| `AI_ROUTER_ENABLED` / `AI_ROUTER_TIMEOUT_MS` | AI routing policy | Provider timeout/fallback controls |
| `VITE_SUPPORT_FACEBOOK_URL` | Facebook support is available | Optional public support destination |

Use the real values only in Vercel’s encrypted environment-variable interface. Do not copy `.env` files into GitHub. If Stripe is not configured, leave Stripe disabled; BeatBox must continue using truthful Mobile Money, Orange Money, and WhatsApp payment-request workflows without fake payment-success states.

## 6. AI provider activation

Configure at least two server-side AI providers for resilience. The application’s AI router should return one explicit JSON success/error contract, handle timeout and malformed responses, and never reveal provider secrets. Use real provider keys only in Vercel server environment variables.

After deployment, check the public health endpoint documented by the current AI production notes. Then sign in and send an authenticated chat request. Confirm that a valid provider response renders normally, a provider timeout returns a readable error, malformed provider output does not break the page, and fallback routing works when the primary provider is unavailable. Never test by exposing keys in browser developer tools or client bundles.

## 7. Owner/admin activation

After the owner creates the first account, use the owner-controlled Supabase SQL path to associate the owner safely and promote only the intended account. Confirm that admin procedures and RLS policies reject ordinary users. Apply the profile update RPC and audit-log migration with an owner-level database session if the connected migration account lacks permission.

Test seller registration from a normal account. It must be immediate and idempotent, must not require approval, and must never allow a user to self-assign admin privileges. Test admin moderation, report resolution, account suspension, listing removal, and audit-log creation with an admin account only.

## 8. Production smoke test

Run the following in order after Vercel deploys the `main` branch:

1. Open the production URL and confirm the BeatBox logo, title, navigation, PWA manifest, robots, sitemap, and public routes load.
2. Create an email/password account and verify confirmation, login, logout, and password recovery.
3. Test Google OAuth and phone OTP if configured.
4. Edit profile metadata and confirm persistence after refresh; verify privacy fields do not expose private data.
5. Become a seller instantly and publish a free preview, a paid listing, an audio/video item, and a product/service listing.
6. Browse, search, favorite, save, share, comment, react, report, follow, block, and mute using a second account.
7. Open Reels and Messages. Confirm public media is visible only when published and private attachments remain signed and participant-scoped.
8. Submit a real Mobile Money, Orange Money, or WhatsApp payment request. Confirm that a request is not treated as paid until an authorized reviewer verifies it.
9. Verify that a paid master cannot be downloaded without entitlement and that the signed link expires.
10. Open Creator Studio and confirm persisted profile views, plays, earnings, orders, advertising, and settings states.
11. Test AI health and authenticated chat with valid provider configuration and at least one fallback provider.
12. Review Vercel runtime logs and Supabase Auth, Database, Storage, and Edge Function logs for errors.

## 9. Exact SQL export and Auth activation checklist

The repository now includes `BEATBOX_SUPABASE_MIGRATIONS.sql`, which is the owner-runnable SQL export. Use the Supabase dashboard’s **SQL Editor → New query**, paste the file contents, and execute it with a project owner session. If the dashboard rejects a statement for insufficient privileges, do not weaken the SQL or disable RLS; reconnect with the project owner or use the approved Supabase migration pipeline. After execution, run the verification queries in Section 2 and confirm that no migration stopped halfway.

For Auth, first configure the Supabase Site URL and redirect allow-list, then enable Email, Google, and optionally Phone. In Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Preview and Production, redeploy, open `/auth`, create an email account, follow the confirmation link, test Google, and test password recovery. The email and Google flows must return to `/auth/callback`; recovery may include `?mode=recovery`. Phone OTP additionally requires a real SMS provider and cannot be considered active until a real phone receives a code.

## 10. Local validation commands

Run these commands before every production push:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

A successful local build does not prove that owner-controlled Supabase migrations, OAuth providers, SMS, storage policies, Vercel variables, or AI credentials are configured. Those must be verified in the production accounts.

## 11. Troubleshooting

If `/api` returns the SPA shell or a 404, inspect `vercel.json` and ensure API routing precedes the filesystem and SPA fallback rules. If Google OAuth loops, compare the Google and Supabase callback URLs exactly and confirm the Vercel production URL is configured. If profile updates fail, apply the guarded profile RPC with an owner-level Supabase session. If signed downloads fail, verify private bucket policies, entitlement status, server-side signing configuration, and clock consistency. If AI fails, inspect server logs, verify provider variable names, lower the timeout, and test the fallback provider without exposing credentials.

## 12. Credential hygiene

Rotate any credential previously pasted into chat, including GitHub tokens and AI/provider keys, before production. Use separate development and production secrets, least-privilege provider keys, branch protection on `main`, GitHub secret scanning, and Vercel encrypted environment variables. Do not use customer reviews, ratings, testimonials, or demo payment records as seeded data.

## 13. Exact AI variables for Vercel

BeatBox reads AI credentials only on the server. In Vercel, open **Settings → Environment Variables** and add the following variable names for **Production**, **Preview**, and **Development** as needed. Never add provider secrets to `VITE_*` variables, browser code, committed files, or public documentation.

| Variable | Value to enter |
|---|---|
| `GEMINI_API_KEY` | Your Google AI Studio API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` or another enabled Gemini model |
| `GROQ_API_KEY` | Your Groq API key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` or another enabled Groq model |
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `OPENROUTER_MODEL` | `deepseek/deepseek-chat-v3-0324:free` or another enabled model |
| `AI_ROUTER_ENABLED` | `true` |
| `AI_ROUTER_TIMEOUT_MS` | `20000` |

At least one provider key/model pair is required for the assistant to answer. The AI status card intentionally reports **No server-side AI provider is configured** when no valid server-side pair is available. After saving the variables, redeploy the Vercel project and confirm that the provider readiness card changes to configured. The recommended resilient setup is Gemini first, Groq second, and OpenRouter third; the server performs fallback when a provider times out, reaches quota, or returns an unusable response.

If a key has ever been exposed publicly, revoke it at the provider immediately and create a replacement before adding it to Vercel. The AI assistant does not require `FAL_AI`, `REPLICATE_API_TOKEN`, Hugging Face, Cohere, Cerebras, Mistral, Together, Fireworks, Cloudflare, or GitHub variables for text chat unless a future server integration explicitly documents them. Do not paste secret values into GitHub, chat, screenshots, client bundles, or `VITE_*` variables.

After redeployment, verify `/ai`, send an authenticated message, and inspect Vercel runtime logs if the status remains unavailable. A successful local build alone cannot verify that Vercel has the variables assigned to the correct environment.
