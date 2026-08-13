-- Additive BeatBox Story release: 24-hour statuses, private media, viewers, reactions, and expiry cleanup.

create table if not exists public.beatbox_stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  status_text text,
  media_path text,
  media_type text check (media_type in ('image', 'video', 'audio')),
  audience text not null default 'public' check (audience in ('public', 'friends', 'only_me')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint beatbox_stories_content_required check (nullif(trim(coalesce(status_text, '')), '') is not null or media_path is not null),
  constraint beatbox_stories_media_consistent check ((media_path is null and media_type is null) or (media_path is not null and media_type is not null))
);

create table if not exists public.beatbox_story_views (
  story_id uuid not null references public.beatbox_stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.beatbox_story_reactions (
  story_id uuid not null references public.beatbox_stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('heart', 'fire', 'clap', 'laugh')),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table if not exists public.beatbox_expired_story_media (
  path text primary key,
  queued_at timestamptz not null default now()
);

create index if not exists beatbox_stories_active_idx on public.beatbox_stories (expires_at asc, created_at desc);
create index if not exists beatbox_stories_author_idx on public.beatbox_stories (author_id, created_at desc);
create index if not exists beatbox_story_views_story_idx on public.beatbox_story_views (story_id, viewed_at desc);

alter table public.beatbox_stories enable row level security;
alter table public.beatbox_story_views enable row level security;
alter table public.beatbox_story_reactions enable row level security;
alter table public.beatbox_expired_story_media enable row level security;

drop policy if exists beatbox_stories_visible_select on public.beatbox_stories;
create policy beatbox_stories_visible_select on public.beatbox_stories
  for select using (
    author_id = auth.uid()
    or (
      expires_at > now()
      and public.social_post_visible_to(auth.uid(), author_id, audience)
    )
    or public.is_beatbox_admin()
  );

drop policy if exists beatbox_stories_owner_insert on public.beatbox_stories;
create policy beatbox_stories_owner_insert on public.beatbox_stories
  for insert to authenticated with check (
    author_id = auth.uid()
    and expires_at > now()
    and expires_at <= now() + interval '24 hours 5 minutes'
  );

drop policy if exists beatbox_stories_owner_update on public.beatbox_stories;
create policy beatbox_stories_owner_update on public.beatbox_stories
  for update to authenticated using (author_id = auth.uid() or public.is_beatbox_admin())
  with check (author_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists beatbox_stories_owner_delete on public.beatbox_stories;
create policy beatbox_stories_owner_delete on public.beatbox_stories
  for delete to authenticated using (author_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists beatbox_story_views_creator_or_self_select on public.beatbox_story_views;
create policy beatbox_story_views_creator_or_self_select on public.beatbox_story_views
  for select to authenticated using (
    viewer_id = auth.uid()
    or exists (select 1 from public.beatbox_stories s where s.id = story_id and s.author_id = auth.uid())
  );

drop policy if exists beatbox_story_views_viewer_insert on public.beatbox_story_views;
create policy beatbox_story_views_viewer_insert on public.beatbox_story_views
  for insert to authenticated with check (
    viewer_id = auth.uid()
    and exists (
      select 1 from public.beatbox_stories s
      where s.id = story_id
        and s.expires_at > now()
        and public.social_post_visible_to(auth.uid(), s.author_id, s.audience)
    )
  );

drop policy if exists beatbox_story_reactions_visible_select on public.beatbox_story_reactions;
create policy beatbox_story_reactions_visible_select on public.beatbox_story_reactions
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.beatbox_stories s where s.id = story_id and s.author_id = auth.uid())
  );

drop policy if exists beatbox_story_reactions_owner_write on public.beatbox_story_reactions;
create policy beatbox_story_reactions_owner_write on public.beatbox_story_reactions
  for all to authenticated using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.beatbox_stories s
      where s.id = story_id
        and s.expires_at > now()
        and public.social_post_visible_to(auth.uid(), s.author_id, s.audience)
    )
  );

-- Queue access is intentionally limited to expired paths. It lets the authenticated nightly handler
-- remove object references after storage deletion without exposing active Story data.
drop policy if exists beatbox_expired_story_media_cleanup_select on public.beatbox_expired_story_media;
create policy beatbox_expired_story_media_cleanup_select on public.beatbox_expired_story_media
  for select using (true);
drop policy if exists beatbox_expired_story_media_cleanup_delete on public.beatbox_expired_story_media;
create policy beatbox_expired_story_media_cleanup_delete on public.beatbox_expired_story_media
  for delete using (true);

insert into storage.buckets (id, name, public) values ('story-media', 'story-media', false)
  on conflict (id) do nothing;

drop policy if exists beatbox_story_media_insert on storage.objects;
create policy beatbox_story_media_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'story-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists beatbox_story_media_visible_read on storage.objects;
create policy beatbox_story_media_visible_read on storage.objects
  for select to authenticated using (
    bucket_id = 'story-media'
    and exists (
      select 1 from public.beatbox_stories s
      where s.media_path = name
        and (s.author_id = auth.uid() or (s.expires_at > now() and public.social_post_visible_to(auth.uid(), s.author_id, s.audience)))
    )
  );

drop policy if exists beatbox_story_media_expired_delete on storage.objects;
create policy beatbox_story_media_expired_delete on storage.objects
  for delete using (
    bucket_id = 'story-media'
    and exists (select 1 from public.beatbox_expired_story_media e where e.path = name)
  );

create or replace function public.expire_beatbox_stories()
returns table(path text)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  return query
  with removed as (
    delete from public.beatbox_stories
    where expires_at <= now()
    returning media_path
  ), queued as (
    insert into public.beatbox_expired_story_media(path)
    select distinct media_path from removed where media_path is not null
    on conflict (path) do update set queued_at = excluded.queued_at
    returning path
  )
  select queued.path from queued;
end;
$$;

grant execute on function public.expire_beatbox_stories() to anon, authenticated;
