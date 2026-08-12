-- Additive Reel thumbnail metadata. Thumbnails are public social media assets only.
alter table if exists public.social_posts
  add column if not exists thumbnail_path text;

comment on column public.social_posts.thumbnail_path is 'Optional public social-media thumbnail. Never reference private marketplace masters here.';

notify pgrst, 'reload schema';
