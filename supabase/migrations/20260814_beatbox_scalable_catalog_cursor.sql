-- Supports deterministic keyset pagination for the public published-beat catalog.
-- The compound order prevents rows with identical timestamps from being skipped.
create index if not exists beats_published_created_id_cursor_idx
  on public.beats (status, created_at desc, id desc);
