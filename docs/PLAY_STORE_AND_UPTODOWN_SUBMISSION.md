# BeatBox Android Store Submission Pack

## Product identity

| Field | Prepared value |
|---|---|
| App name | BeatBox |
| Publisher name | SASTECH INC |
| Recommended Android package ID | `com.sastechinc.beatbox` |
| Public website | `https://sastechorg-beatbox.vercel.app` |
| Product category | Music & Audio / Music marketplace |
| Short description | Discover, stream, license, and sell original beats from Liberia and beyond. |
| Core functionality | Public full-stream playback, producer profiles, beat publishing, protected downloads, paid-entitlement workflow, music community features, and creator tools. |

The recommended package ID is an identifier to reserve when an Android App Bundle is created. It is not created by the website or PWA manifest alone. Confirm availability in the selected Android project and never change it after a Play Store release has begun.

## Truthful store description

BeatBox is a mobile-first music marketplace and community for listeners, producers, and creators in Liberia and beyond. Explore original beats, listen to released tracks in full, follow producers, and discover music community content. Creators can publish beats and build a public catalog. Free downloads require sign-in; paid downloads are released only after the seller confirms the payment request or delivery entitlement.

BeatBox does not claim verified reviews, a star rating, guaranteed sales, guaranteed placement in Google Search, or automatic payment approval. Store screenshots and listing copy must accurately reflect the live application at submission time.

## Required submission materials

| Material | Status / action needed |
|---|---|
| Signed Android App Bundle (`.aab`) | Create from an Android wrapper or native Android project; not produced by the website alone. |
| Package ID | Reserve `com.sastechinc.beatbox` when creating the Android project, subject to availability. |
| Store icon | Prepare a 512 × 512 PNG based on the supplied BeatBox artwork, with safe padding and no tiny text. |
| Phone screenshots | Capture current signed-out discovery, streaming, creator upload, profile, and purchase-request screens from a release build. |
| Feature graphic | Prepare a 1024 × 500 image using the supplied brand artwork and approved app screenshots. |
| Privacy policy URL | `https://sastechorg-beatbox.vercel.app/privacy` |
| Support URL | `https://sastechorg-beatbox.vercel.app/contact` |
| Data-safety declaration | Complete in the store console from the app's real data flows, including account, user-generated content, audio/media uploads, messages, and purchase-request data. |
| Age/content declarations | Complete truthfully based on the finalized release and moderation controls. |

## Distribution approach

BeatBox is currently an installable Progressive Web App. It can be distributed directly from supported browsers through its install prompt. A store listing additionally requires a release-ready Android package. A **Trusted Web Activity (TWA)** is a practical route for a web-first application: it packages the same verified website inside an Android App Bundle. The Android package must be configured with the selected package ID, release signing key, Digital Asset Links verification, and a tested store build.

Before beginning Android packaging, test the public web app on an Android phone while signed out and signed in. Confirm PWA install, full guest playback, sign-in, uploads, downloads, messaging, privacy controls, and offline-lite behavior. Do not ship a wrapper until these paths have passed on a real release device.
