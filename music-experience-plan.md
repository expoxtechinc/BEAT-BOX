# BeatBox Music Experience Plan

## Design Direction

BeatBox will retain its own dark-and-gold visual identity while adopting a mobile music-app information hierarchy: a concise discovery header, horizontally scrollable artwork shelves, compact listening rows, a clear tab bar, and an always-visible but non-intrusive playback context. This is an interaction reference only; no third-party brand assets, artists, titles, rankings, marketing copy, ratings, or fictional usage data will be used.

| Destination | Purpose | Data source | Main interaction |
|---|---|---|---|
| Discover | Latest, popular, free, and genre-filtered beats | Published BeatBox beats and existing engagement fields | Opens existing beat details or the catalog with a truthful filter |
| Charts | Transparent, engagement-ordered public beats | `play_count`, `favorite_count`, `download_count`, and release time | Selects a real genre and plays an available stream |
| Search | Quick entry into creator and catalog discovery | Existing public catalog search and producer routes | Sends an entered query to existing search behavior |
| Feed | Community and creator support | Existing Community page | Preserves the existing media, reactions, and comments |
| Library | Saved content and account area | Existing signed-in Saved Items and Account routes | Never exposes private bookmarks to guests |

## Shared Behavior

The mobile navigation will expose five stable destinations: Discover, Charts, Search, Feed, and Library. The existing full menu remains available for creator studio, reels, messages, upload, and administrative functions. The compact player will be a contextual listening shortcut whose play button delegates to the nearest real stream rather than inventing playback state or background audio.

