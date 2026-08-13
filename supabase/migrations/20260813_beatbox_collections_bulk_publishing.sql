-- BeatBox creator collections and bulk publishing.
-- Additive and idempotent: groups existing beats/content without exposing private originals.

create or replace function public.is_beatbox_creator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_beatbox_seller()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.professional_mode, false) = true
    );
$$;

grant execute on function public.is_beatbox_creator() to authenticated;

create table if not exists public.creator_collections (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  collection_type text not null check (collection_type in ('album', 'podcast')),
  title text not null check (length(trim(title)) between 1 and 140),
  slug text not null unique,
  description text,
  cover_path text,
  genre text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived', 'removed')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_collections_discovery_idx
  on public.creator_collections (collection_type, status, published_at desc);
create index if not exists creator_collections_seller_idx
  on public.creator_collections (seller_id, updated_at desc);

create table if not exists public.creator_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.creator_collections(id) on delete cascade,
  beat_id uuid references public.beats(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete cascade,
  position integer not null check (position > 0),
  title_override text,
  description_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_collection_items_exactly_one_source check (
    (beat_id is not null and content_id is null)
    or (beat_id is null and content_id is not null)
  ),
  unique (collection_id, position),
  unique (collection_id, beat_id),
  unique (collection_id, content_id)
);

create index if not exists creator_collection_items_collection_idx
  on public.creator_collection_items (collection_id, position);

create table if not exists public.creator_upload_batches (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  batch_type text not null check (batch_type in ('beat', 'podcast_episode', 'content')),
  item_count integer not null check (item_count between 1 and 20),
  completed_count integer not null default 0 check (completed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  status text not null default 'queued' check (status in ('queued', 'uploading', 'completed', 'completed_with_errors', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_upload_batches_counts_valid check (completed_count + failed_count <= item_count)
);

create index if not exists creator_upload_batches_seller_idx
  on public.creator_upload_batches (seller_id, created_at desc);

alter table public.creator_collections enable row level security;
alter table public.creator_collection_items enable row level security;
alter table public.creator_upload_batches enable row level security;

drop policy if exists "BeatBox published creator collections are public" on public.creator_collections;
create policy "BeatBox published creator collections are public"
  on public.creator_collections for select
  using (status = 'published' or seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "BeatBox creators create collections" on public.creator_collections;
create policy "BeatBox creators create collections"
  on public.creator_collections for insert to authenticated
  with check (seller_id = auth.uid() and public.is_beatbox_creator());

drop policy if exists "BeatBox creators update collections" on public.creator_collections;
create policy "BeatBox creators update collections"
  on public.creator_collections for update to authenticated
  using (seller_id = auth.uid() or public.is_beatbox_admin())
  with check (seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "BeatBox creators delete collections" on public.creator_collections;
create policy "BeatBox creators delete collections"
  on public.creator_collections for delete to authenticated
  using (seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "BeatBox public collection entries follow collection visibility" on public.creator_collection_items;
create policy "BeatBox public collection entries follow collection visibility"
  on public.creator_collection_items for select
  using (
    exists (
      select 1 from public.creator_collections c
      where c.id = collection_id
        and (c.status = 'published' or c.seller_id = auth.uid() or public.is_beatbox_admin())
    )
  );

drop policy if exists "BeatBox creators manage own collection entries" on public.creator_collection_items;
create policy "BeatBox creators manage own collection entries"
  on public.creator_collection_items for all to authenticated
  using (
    exists (
      select 1 from public.creator_collections c
      where c.id = collection_id
        and (c.seller_id = auth.uid() or public.is_beatbox_admin())
    )
  )
  with check (
    exists (
      select 1 from public.creator_collections c
      where c.id = collection_id
        and (c.seller_id = auth.uid() or public.is_beatbox_admin())
    )
  );

drop policy if exists "BeatBox creators read own upload batches" on public.creator_upload_batches;
create policy "BeatBox creators read own upload batches"
  on public.creator_upload_batches for select to authenticated
  using (seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "BeatBox creators create upload batches" on public.creator_upload_batches;
create policy "BeatBox creators create upload batches"
  on public.creator_upload_batches for insert to authenticated
  with check (seller_id = auth.uid() and public.is_beatbox_creator());

drop policy if exists "BeatBox creators update own upload batches" on public.creator_upload_batches;
create policy "BeatBox creators update own upload batches"
  on public.creator_upload_batches for update to authenticated
  using (seller_id = auth.uid() or public.is_beatbox_admin())
  with check (seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "BeatBox creators delete own upload batches" on public.creator_upload_batches;
create policy "BeatBox creators delete own upload batches"
  on public.creator_upload_batches for delete to authenticated
  using (seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "BeatBox sellers create content" on public.content_items;
create policy "BeatBox creators create content" on public.content_items for insert to authenticated
  with check (seller_id = auth.uid() and public.is_beatbox_creator());

drop policy if exists "BeatBox sellers manage content covers" on storage.objects;
create policy "BeatBox creators manage content covers" on storage.objects for all to authenticated
  using (bucket_id = 'content-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator())
  with check (bucket_id = 'content-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator());

drop policy if exists "BeatBox sellers manage content previews" on storage.objects;
create policy "BeatBox creators manage content previews" on storage.objects for all to authenticated
  using (bucket_id = 'content-previews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator())
  with check (bucket_id = 'content-previews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator());

drop policy if exists "BeatBox sellers manage content masters" on storage.objects;
create policy "BeatBox creators manage content masters" on storage.objects for all to authenticated
  using (bucket_id = 'content-masters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator())
  with check (bucket_id = 'content-masters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_creator());

comment on table public.creator_collections is
  'Creator-owned albums and podcast series. Only published collection metadata is publicly readable.';
comment on table public.creator_collection_items is
  'Ordered entries that reference either one marketplace beat or one protected creator content item.';
comment on table public.creator_upload_batches is
  'Creator-scoped durable status summary for client-managed upload queues of up to 20 items.';
