# 24-Hour Stories, Audio, AI, and Messaging Release Notes

## Story lifecycle

BeatBox Stories now support text statuses and private image, video, or audio media. Every Story is created with a hard 24-hour expiry boundary. Expired Stories are excluded from the viewer rail immediately by both database access policy and client-side active-time filtering.

Viewer records and one-per-user quick reactions are stored with Story ownership and audience checks. Story media uses the private `story-media` bucket and signed read URLs, so a file is accessible only while its associated Story is active and visible to the current user.

Audio never begins unexpectedly. After a user opens an audio or video Story, BeatBox attempts sound-on playback and provides a visible **Tap for sound** control when the browser requires an additional interaction. This avoids a permanently muted Story experience while respecting browser autoplay restrictions.

## Scheduled cleanup and AI

The deployed server now exposes an idempotent cron-only callback at `/api/scheduled/expire-stories`. It calls the applied database expiry function, removes the resulting private storage objects, and clears the durable cleanup queue only after storage deletion succeeds. A project-level nightly Heartbeat can run this callback after the release checkpoint is published.

The owner-managed production Heartbeat is enabled as `beatbox-story-expiry-nightly` with task UID `TaLZRYbSwmW9dM4oxS7KVN`. It calls the expiry endpoint at **03:00 UTC** each day using the six-field schedule `0 0 3 * * *`. The job can be inspected, paused, resumed, or deleted from the project schedule controls or with `manus-heartbeat` in a future maintenance session.

AI responses remain server-only. The AI router reads `GEMINI_API_KEY`, never `VITE_GEMINI_API_KEY`; this prevents a browser client from receiving the credential. The existing private-message AI quick-reply flow continues to call the secured server router.

## Responsive verification

The Community screen was checked at desktop (1280×720) and phone (375×812) viewports. The Story rail and existing Feed hierarchy render within the established application shell, with the mobile bottom navigation and safe-area spacing retained. The unauthenticated state correctly presents the existing sign-in prompt rather than exposing a publish control.
