# BeatBox Track Experience Plan

## Direction

BeatBox will use a dark listening-room surface with warm gold interaction accents, bright artwork, and a subtle waveform motif. The supplied Audiomack screens are treated as interaction references only. BeatBox will not copy Audiomack branding, proprietary artwork, user content, text, or exact visual identity.

## Track hero

The beat detail route will lead with a large responsive cover-art panel, an overlaid play affordance, the real title and producer, genre and release metadata, and a compact access badge. The hero must use the existing signed cover URL and never expose a master-file URL.

## Visual player

The shared player will remain the source of truth for full-stream playback and engagement recording. The detail route will wrap it in a richer visual player with a responsive waveform-style progress surface, current and total time labels when available, keyboard-accessible seeking, play/pause, mute, and a persistent active-playback event. The visual waveform is decorative progress UI, not invented audio analysis or engagement data.

## Release actions

Actions will be data-backed and permission-aware: like toggles the existing beat_likes row, save uses the existing favorites flow, share uses the Web Share API with a copy-link fallback, follow links to the producer profile or existing follow behavior, and download continues through the secure-download function. Paid releases will show license and payment/contact actions without fake purchase success states.

## Context and discovery

The page will show truthful play, view, like, comment, and save counts; real producer context; genre, BPM, key, and mood chips when present; related published beats derived from the existing catalog; and creator-oriented shelves that remain empty or descriptive when no real records are available. It will not fabricate followers, rankings, comments, playlists, or support activity.

## Comments and moderation

The existing beat comment flow will be retained and visually elevated with readable author rows, timestamps, empty states, signed-in composer behavior, and the existing report form. RLS and moderation boundaries remain unchanged.

## Responsive behavior

On mobile, the player and artwork stack vertically, primary actions remain horizontally scrollable without clipping, the license panel follows the listening context, and comments remain reachable below the release context. On desktop, artwork, player/context, and entitlement controls form a balanced three-column-to-two-column composition without duplicating navigation or playback state.

## Validation

Regression tests will assert the real stream resolver, public guest playback contract, secure download boundary, truthful action wiring, comment flow, and absence of Audiomack-specific branding or copied content. Visual checks will cover narrow mobile and desktop widths.
