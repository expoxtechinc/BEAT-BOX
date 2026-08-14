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

## Official Google Play references

Google requires new Play applications to be published as Android App Bundles, and Google Play uses the bundle to generate optimized APKs for different device configurations. New apps must enroll in Play App Signing before upload. Play Console requires accurate developer and app information, a privacy policy, a completed Data safety declaration, and active reviewer sign-in details when access is restricted. Store listings should use genuine, current app visuals and descriptive metadata.

| Topic | Official source |
|---|---|
| Android App Bundle format | <https://developer.android.com/guide/app-bundle> |
| Uploading a signed bundle and internal testing | <https://developer.android.com/studio/publish/upload-bundle> |
| Play Console account and review requirements | <https://support.google.com/googleplay/android-developer/answer/10788890?hl=en> |
| Store listing guidance | <https://play.google.com/console/about/storelistings/> |

## Uptodown submission steps

1. Create a free publisher account at <https://www.uptodown.dev/#/sign-up> with the SASTECH INC organization name, an email address, and a secure password; then verify the email address.
2. In the Developers Console, create the organization profile and select **Apps → Add new app**.
3. Upload the tested Android release file in a format Uptodown currently accepts. The package name/application ID is read from the Android upload; keep it aligned with the release package ID (`com.sastechinc.beatbox`).
4. Supply accurate app information: **BeatBox** name, SASTECH INC as author, Music & Audio category, the official website, relevant age information, and global distribution unless a country restriction is deliberately required.
5. Upload a square PNG app icon of at least 256 × 256, genuine screenshots, and a **1024 × 500** featured image. Use only current BeatBox assets and product screens.
6. Add the short description (maximum 70 characters on Uptodown) and a complete feature description of at least 50 words. Set the truthful distribution model and disclose any in-app purchases, subscriptions, or advertising only if they exist in the submitted build.
7. Submit the application for Uptodown review. Retain control of updates in the Developers Console and issue each update with an incremented Android version code.

Uptodown states that account registration and publishing are free, supports Android distribution, and lets publishers choose country restrictions. It also requires a compliant application, accurate metadata, and review before publication.

| Uptodown topic | Official source |
|---|---|
| Developer Console sign-up | <https://support.uptodown.com/hc/en-us/articles/360052729052-How-to-create-an-account-in-Uptodown-s-Developers-Console> |
| Registration and publication overview | <https://support.uptodown.com/hc/en-us/articles/4424141383181-Basic-guide-to-register-and-publish-apps-on-Uptodown> |
| Upload, listing, screenshots, and review steps | <https://support.uptodown.com/hc/en-us/articles/360053260491-How-to-publish-an-app-on-Uptodown> |
