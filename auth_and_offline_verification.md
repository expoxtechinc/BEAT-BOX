# BeatBox authentication and offline-lite verification record

## Live non-interactive checks — 2026-08-14

The public BeatBox authentication page at `https://sastechorg-beatbox.vercel.app/auth` renders the Google, email/password, phone-OTP, and password-reset entry points within the existing responsive layout. Selecting **Continue with Google** redirected successfully to Google’s account-selection page through Supabase Auth, using the BeatBox Supabase callback and the configured production `/auth/callback` return path. No Google credential was entered and no account session was created during this structural check.

The live AI route at `https://sastechorg-beatbox.vercel.app/ai` correctly requires sign-in before allowing a chat mutation. The previously verified production `/api/trpc/ai.health` reports the configured provider chain, while the protected `ai.chat` procedure remains inaccessible to unauthenticated visitors as designed. An end-to-end chat completion will require a user-controlled authenticated session; it must not be simulated with an invented account.

## Offline-lite boundary

Offline-lite is browser cache support for previously visited public shell, public pages, and already fetched public media. Authentication, uploads, messages, payments, purchase-reference submissions, AI chat requests, and fresh data require an active internet connection and are intentionally excluded from the service-worker cache strategy.

## WhatsApp commerce release deployment — 2026-08-14

GitHub commit `05c9f5f311e0c8474ee22273d223647a95ce69f7` was deployed to the production `sastechorg-beatbox` Vercel project as deployment `dpl_CqbgQydeKC9UrSug2NM4HzaNwKVf`. Vercel reported the deployment as `READY` with the production alias `https://sastechorg-beatbox.vercel.app`. The deployment uses the repository’s `main` branch and contains the WhatsApp contact setting, truthful payment-reference handoff, and offline-lite update.

## Current public production alias — 2026-08-14

The legacy `https://sastechorg-beatbox.vercel.app` hostname is serving an older BeatBox SPA deployment and therefore must not be used as the validation target for the current GitHub project. The current linked Vercel project is publicly available at `https://sastechorg-beatbox-expoxtechincs-projects.vercel.app` after Vercel Authentication was disabled for this intended public marketplace. Its `/api/health` route returned `200` with Gemini and Supabase both configured and reachable. The only outstanding check is a real, user-controlled signed-in AI chat completion; this cannot be responsibly fabricated without a user session.
