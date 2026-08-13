-- BeatBox engineering asset content types.
-- Additive and idempotent: expands the existing content-type allowlists only.
-- Private originals remain governed by the existing content_items RLS and signed-download flows.

alter table public.content_items
  drop constraint if exists content_items_content_type_check;

alter table public.content_items
  add constraint content_items_content_type_check
  check (content_type in (
    'audio', 'video', 'movie', 'software', 'app', 'digital_product',
    'plugin', 'soundboard', 'soundtrack', 'loop', 'sample_pack', 'engineering_file'
  ));

alter table public.beats
  drop constraint if exists beats_content_type_check;

alter table public.beats
  add constraint beats_content_type_check
  check (content_type in (
    'audio', 'video', 'movie', 'software', 'app', 'digital_product',
    'plugin', 'soundboard', 'soundtrack', 'loop', 'sample_pack', 'engineering_file'
  ));

comment on column public.content_items.content_type is
  'Protected creator content type: audio, video, movie, software, app, digital_product, plugin, soundboard, soundtrack, loop, sample_pack, or engineering_file.';

comment on column public.beats.content_type is
  'Marketplace media type: audio, video, movie, software, app, digital_product, plugin, soundboard, soundtrack, loop, sample_pack, or engineering_file.';
