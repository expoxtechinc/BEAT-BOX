-- Truthful BeatBox engagement analytics.
-- A signed-in user contributes at most one event per subject, event kind, and UTC day.
-- Counts represent persisted engagement events only; they are never seeded or estimated.

alter table public.beats
  add column if not exists view_count integer not null default 0 check (view_count >= 0),
  add column if not exists like_count integer not null default 0 check (like_count >= 0),
  add column if not exists comment_count integer not null default 0 check (comment_count >= 0);

alter table public.social_posts
  add column if not exists view_count integer not null default 0 check (view_count >= 0);

create table if not exists public.beat_likes (
  beat_id uuid not null references public.beats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (beat_id, user_id)
);

create table if not exists public.beat_comments (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.beat_comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('beat', 'content', 'post', 'reel')),
  subject_id uuid not null,
  event_type text not null check (event_type in ('view', 'play')),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  event_day date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  unique (subject_type, subject_id, event_type, actor_id, event_day)
);

create index if not exists beat_likes_beat_idx on public.beat_likes (beat_id, created_at desc);
create index if not exists beat_comments_beat_idx on public.beat_comments (beat_id, created_at asc);
create index if not exists engagement_events_subject_idx on public.engagement_events (subject_type, subject_id, event_type, created_at desc);
create index if not exists engagement_events_actor_idx on public.engagement_events (actor_id, created_at desc);

create or replace function public.sync_beat_social_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'beat_likes' then
    update public.beats
       set like_count = greatest(0, like_count + case when tg_op = 'INSERT' then 1 else -1 end),
           updated_at = now()
     where id = coalesce(new.beat_id, old.beat_id);
  elsif tg_table_name = 'beat_comments' then
    update public.beats
       set comment_count = greatest(0, comment_count + case when tg_op = 'INSERT' then 1 else -1 end),
           updated_at = now()
     where id = coalesce(new.beat_id, old.beat_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists beat_like_count on public.beat_likes;
create trigger beat_like_count after insert or delete on public.beat_likes
for each row execute function public.sync_beat_social_count();

drop trigger if exists beat_comment_count on public.beat_comments;
create trigger beat_comment_count after insert or delete on public.beat_comments
for each row execute function public.sync_beat_social_count();

create or replace function public.record_engagement_event(
  p_subject_type text,
  p_subject_id uuid,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_creator_id uuid;
  v_visible boolean := false;
  v_inserted boolean := false;
  v_insert_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required to record engagement';
  end if;
  if p_subject_type not in ('beat', 'content', 'post', 'reel') or p_event_type not in ('view', 'play') then
    raise exception 'Unsupported engagement event';
  end if;

  if p_subject_type = 'beat' then
    select seller_id, (status = 'published' or seller_id = v_actor_id)
      into v_creator_id, v_visible
      from public.beats where id = p_subject_id;
  elsif p_subject_type = 'content' then
    select seller_id, (status = 'published' or seller_id = v_actor_id)
      into v_creator_id, v_visible
      from public.content_items where id = p_subject_id;
  elsif p_subject_type = 'post' then
    select author_id, (status = 'published' and public.social_post_visible_to(v_actor_id, author_id, audience))
      into v_creator_id, v_visible
      from public.social_posts where id = p_subject_id;
  else
    select r.creator_id, (r.status = 'published' and p.status = 'published' and public.social_post_visible_to(v_actor_id, p.author_id, p.audience))
      into v_creator_id, v_visible
      from public.social_reels r
      join public.social_posts p on p.id = r.post_id
     where r.id = p_subject_id;
  end if;

  if v_creator_id is null or not coalesce(v_visible, false) then
    raise exception 'This content is unavailable';
  end if;

  insert into public.engagement_events (subject_type, subject_id, event_type, actor_id)
  values (p_subject_type, p_subject_id, p_event_type, v_actor_id)
  on conflict (subject_type, subject_id, event_type, actor_id, event_day) do nothing;
  get diagnostics v_insert_count = row_count;
  v_inserted := v_insert_count = 1;

  if not v_inserted then
    return false;
  end if;

  if p_subject_type = 'beat' then
    update public.beats
       set view_count = view_count + case when p_event_type = 'view' then 1 else 0 end,
           play_count = play_count + case when p_event_type = 'play' then 1 else 0 end,
           updated_at = now()
     where id = p_subject_id;
  elsif p_subject_type = 'content' then
    update public.content_items
       set view_count = view_count + 1,
           updated_at = now()
     where id = p_subject_id;
  elsif p_subject_type = 'post' then
    update public.social_posts
       set view_count = view_count + 1,
           updated_at = now()
     where id = p_subject_id;
  else
    update public.social_reels
       set view_count = view_count + 1
     where id = p_subject_id;
  end if;

  insert into public.creator_analytics_events (creator_id, event_type, content_id, viewer_id)
  values (
    v_creator_id,
    case when p_event_type = 'play' then 'content_play' else 'product_view' end,
    p_subject_id,
    v_actor_id
  );
  return true;
end;
$$;

alter table public.beat_likes enable row level security;
alter table public.beat_comments enable row level security;
alter table public.engagement_events enable row level security;

create policy beat_likes_visible_for_published_beats on public.beat_likes
for select using (exists (select 1 from public.beats b where b.id = beat_id and b.status = 'published'));
create policy beat_likes_insert_own on public.beat_likes
for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.beats b where b.id = beat_id and b.status = 'published'));
create policy beat_likes_delete_own on public.beat_likes
for delete to authenticated using (user_id = auth.uid());

create policy beat_comments_visible_for_published_beats on public.beat_comments
for select using (exists (select 1 from public.beats b where b.id = beat_id and b.status = 'published'));
create policy beat_comments_insert_own on public.beat_comments
for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.beats b where b.id = beat_id and b.status = 'published'));
create policy beat_comments_update_own on public.beat_comments
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy beat_comments_delete_own on public.beat_comments
for delete to authenticated using (user_id = auth.uid());

grant execute on function public.record_engagement_event(text, uuid, text) to authenticated;
comment on table public.engagement_events is 'Persisted authenticated engagement only. One event per account, subject, event kind, and UTC day prevents counter inflation from reloads.';
comment on function public.record_engagement_event(text, uuid, text) is 'Records a visibility-checked view or actual playback event. Returns true only if it created a new daily event.';
