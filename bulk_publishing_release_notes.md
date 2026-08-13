# Bulk Publishing and Cross-Device Release Notes

## Verified delivery

BeatBox now includes a Professional Mode creator workspace for selecting and publishing **1–20 audio beats** as a secure batch. Each selected beat has editable metadata, independent progress, resumable storage upload behavior, retryable failure states, a shared cover choice, and the existing free-versus-paid entitlement boundary. Paid beat masters remain private; the system only stores metadata and protected paths.

The additive production migration `20260813_beatbox_collections_bulk_publishing.sql` was applied to the connected Supabase project. It introduces creator-owned albums, podcast series, ordered collection entries, and immutable batch records. The follow-up access migration `20260813_beatbox_creator_beat_publishing_access.sql` was also applied, allowing authenticated Professional Mode creators to publish only their own beat records and objects in their own storage folders.

Albums organize existing BeatBox beats in a creator-selected order. Podcast series group already-published audio items into ordered episodes; an episode is first published with the existing protected-content flow, then added to a podcast series. This avoids exposing private originals or fabricating any listener activity.

## Cross-device validation

The interface was checked at a desktop viewport and a 375×812 phone viewport. The phone shell now uses exactly five bottom-navigation targets—Discover, Feed, Reels, Create, and Account—matching the five-column grid and respecting safe-area padding. Full creator navigation remains available in the mobile menu and the desktop header.

## Automated validation

`pnpm test` passed with **25 files and 93 tests**. Strict TypeScript checking and the production build also completed successfully. The build reports existing bundle-size advisories only; no type or production compilation errors were reported.
