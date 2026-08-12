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

Apply every SQL file under `supabase/migrations/` in filename order using the Supabase SQL Editor, the Supabase CLI, or the owner’s migration pipeline. Apply the pending profile RPC and admin-audit/report-taxonomy migrations in particular. Verify that the connected account has permission to create functions, triggers, indexes, RLS policies, and storage policies before running them.

After migration, verify that the database contains profiles, beats/listings, orders, payment requests, notifications, favorites, social posts, comments, reactions, bookmarks, reposts, follows, blocks, mutes, conversations, messages, reports, creator analytics, advertiser tables, and the audit log. Do not insert fake users, orders, payments, reviews, ratings, or testimonials.

## 3. Supabase authentication

Under **Authentication → Providers**, enable Email and Google. Configure the production site URL and redirect URLs. At minimum, add the deployed Vercel URL and the local development URL used by the project. The OAuth callback must return to the application’s auth callback route.

For email/password authentication, configure SMTP or Supabase’s email provider, set the confirmation URL to the production site, and test signup, email confirmation, login, logout, password recovery, and session refresh.

For Google OAuth, create a Google Cloud OAuth web client. Use the Supabase-provided callback URL as the Google authorized redirect URI. Add the client ID and client secret to Supabase Authentication → Providers, then add the Vercel production URL and local URL to the authorized origins. Test Google signup and returning-user login in a private browser window.

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

## 9. Local validation commands

Run these commands before every production push:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

A successful local build does not prove that owner-controlled Supabase migrations, OAuth providers, SMS, storage policies, Vercel variables, or AI credentials are configured. Those must be verified in the production accounts.

## 10. Troubleshooting

If `/api` returns the SPA shell or a 404, inspect `vercel.json` and ensure API routing precedes the filesystem and SPA fallback rules. If Google OAuth loops, compare the Google and Supabase callback URLs exactly and confirm the Vercel production URL is configured. If profile updates fail, apply the guarded profile RPC with an owner-level Supabase session. If signed downloads fail, verify private bucket policies, entitlement status, server-side signing configuration, and clock consistency. If AI fails, inspect server logs, verify provider variable names, lower the timeout, and test the fallback provider without exposing credentials.

## 11. Credential hygiene

Rotate any credential previously pasted into chat, including GitHub tokens and AI/provider keys, before production. Use separate development and production secrets, least-privilege provider keys, branch protection on `main`, GitHub secret scanning, and Vercel encrypted environment variables. Do not use customer reviews, ratings, testimonials, or demo payment records as seeded data.
