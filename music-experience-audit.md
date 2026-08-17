# BeatBox Music Experience Audit

## Current State

The current mobile pages correctly preserve the BeatBox marketplace and social workflows, but they still present as a desktop storefront rather than as a cohesive listening application. The supplied reference screens establish the desired interaction direction: dense but readable listening rows, horizontally scrolling cover-art shelves, persistent playback context, concise discovery categories, and a clear five-target mobile navigation system.

## Verified Constraints

- All music, artist, catalog, ranking, follower, and engagement presentation must be based on real BeatBox data. No reference artists, tracks, counts, reviews, or chart positions will be copied into the application.
- Guest full-stream playback, download entitlement, marketplace filters, privacy, creator uploads, community posts, messaging, and the existing routes must remain intact.
- The visual work will use BeatBox’s dark/gold identity rather than reproducing another service’s brand, logo, copy, advertising, or assets.

## Priority Corrections

| Area | Finding | Upgrade direction |
|---|---|---|
| Mobile shell | The shell contains two duplicate bottom-navigation elements and lacks an always-available listening context. | Consolidate to one bottom navigation and reserve space for a compact data-backed player.
| Discover | The home page has good data loading but is structured as a large marketing landing page. | Establish music-first hero shortcuts, compact rows, category chips, cover-art shelves, and genuine creator spotlights.
| Explore | The catalog has real cursor pagination but renders as a tall sequence of full cards on a small phone. | Add a compact listening-row view and horizontal featured shelves while retaining filters and load-more correctness.
| Search | Search behavior is real but the empty state is sparse. | Add entry-point tiles and recognizable categories that only initiate existing public search routes.
| Library | Signed-out privacy handling is correct; signed-in saved content must remain private. | Improve clarity and layout without exposing bookmark data or inventing playback history.

