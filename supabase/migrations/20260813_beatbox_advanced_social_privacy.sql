-- BeatBox advanced social privacy and relationships.
-- Additive migration: public, friends, only_me audience controls; generic follows;
-- durable not-interested preferences; professional mode; and ownership-safe RLS.

alter table public.profiles
  add column if not exists professional_mode boolean not null default false;

alter table public.social_posts
  add column if not exists audience text not null default 'public'
    check (audience in ('public','friends','only_me'));

create table if not exists public.social_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.social_post_not_interested (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.social_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists social_posts_audience_feed_idx
  on public.social_posts (audience, status, created_at desc);
create index if not exists social_follows_following_idx
  on public.social_follows (following_id, created_at desc);
create index if not exists social_post_not_interested_user_idx
  on public.social_post_not_interested (user_id, created_at desc);

create or replace function public.social_post_visible_to(viewer uuid, target_author uuid, target_audience text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_audience = 'public'
    or viewer = target_author
    or (
      target_audience = 'friends'
      and viewer is not null
      and exists (
        select 1
        from public.social_friend_requests outgoing
        join public.social_friend_requests incoming
          on incoming.sender_id = outgoing.receiver_id
         and incoming.receiver_id = outgoing.sender_id
        where outgoing.sender_id = target_author
          and outgoing.receiver_id = viewer
          and outgoing.status = 'accepted'
          and incoming.status = 'accepted'
      )
    );
$$;

grant execute on function public.social_post_visible_to(uuid, uuid, text) to anon, authenticated;

alter table public.social_follows enable row level security;
alter table public.social_post_not_interested enable row level security;

create policy social_follows_select_public on public.social_follows
  for select using (true);
create policy social_follows_insert_self on public.social_follows
  for insert to authenticated
  with check (follower_id = auth.uid() and follower_id <> following_id);
create policy social_follows_delete_self on public.social_follows
  for delete to authenticated
  using (follower_id = auth.uid());

create policy social_post_not_interested_select_self on public.social_post_not_interested
  for select to authenticated using (user_id = auth.uid());
create policy social_post_not_interested_insert_self on public.social_post_not_interested
  for insert to authenticated with check (user_id = auth.uid());
create policy social_post_not_interested_delete_self on public.social_post_not_interested
  for delete to authenticated using (user_id = auth.uid());

-- Replace the earlier public-only post visibility rule with audience-aware access.
drop policy if exists "BeatBox published posts are public" on public.social_posts;
drop policy if exists social_posts_visibility_select_v2 on public.social_posts;
create policy social_posts_visibility_select_v2 on public.social_posts
  for select using (
    (status = 'published' and public.social_post_visible_to(auth.uid(), author_id, audience))
    or author_id = auth.uid()
    or public.is_beatbox_admin()
  );

-- Authors and admins retain the existing update/delete authority.
drop policy if exists social_posts_owner_update_v2 on public.social_posts;
create policy social_posts_owner_update_v2 on public.social_posts
  for update using (author_id = auth.uid() or public.is_beatbox_admin())
  with check (author_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists social_posts_owner_delete_v2 on public.social_posts;
create policy social_posts_owner_delete_v2 on public.social_posts
  for delete using (author_id = auth.uid() or public.is_beatbox_admin());

-- Engagement rows follow the visibility of their parent post.
drop policy if exists "BeatBox users read post comments" on public.social_post_comments;
create policy social_post_comments_visible_select_v2 on public.social_post_comments
  for select using (
    exists (
      select 1 from public.social_posts p
      where p.id = post_id
        and public.social_post_visible_to(auth.uid(), p.author_id, p.audience)
    )
  );

drop policy if exists "BeatBox users read post likes" on public.social_post_likes;
create policy social_post_likes_visible_select_v2 on public.social_post_likes
  for select using (
    exists (
      select 1 from public.social_posts p
      where p.id = post_id
        and public.social_post_visible_to(auth.uid(), p.author_id, p.audience)
    )
  );

-- Receiver acceptance is allowed while preserving sender/receiver ownership boundaries.
drop policy if exists "BeatBox users manage own friend requests" on public.social_friend_requests;
create policy social_friend_requests_select_v2 on public.social_friend_requests
  for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy social_friend_requests_insert_v2 on public.social_friend_requests
  for insert to authenticated with check (sender_id = auth.uid() and sender_id <> receiver_id);
create policy social_friend_requests_update_v2 on public.social_friend_requests
  for update to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid())
  with check ((sender_id = auth.uid() or receiver_id = auth.uid()) and status in ('pending','accepted','declined','cancelled'));
create policy social_friend_requests_delete_v2 on public.social_friend_requests
  for delete to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());

comment on column public.social_posts.audience is
  'Visibility: public, friends (mutual accepted friendship), or only_me. Marketplace masters remain private in their own storage policies.';
comment on column public.profiles.professional_mode is
  'Creator profile mode that enables professional insights and public creator presentation.';
comment on table public.social_post_not_interested is
  'Per-user feed preference used to suppress similar posts without deleting creator content.';
