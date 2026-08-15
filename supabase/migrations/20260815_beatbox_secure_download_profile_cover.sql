-- Repair legacy free-beat download classification without weakening paid-beat entitlements.
-- Older publisher flows omitted access_mode and inherited the paid_download default.
alter table public.profiles add column if not exists cover_url text;
alter table public.public_profiles add column if not exists cover_url text;

-- Keep the publicly readable projection intentionally limited to safe profile identity fields.
create or replace function public.sync_public_profile_projection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' or new.account_status <> 'active' then
    delete from public.public_profiles where id = coalesce(old.id, new.id);
    return coalesce(new, old);
  end if;

  insert into public.public_profiles (id, username, display_name, avatar_url, cover_url, bio, country, role, created_at)
  values (new.id, new.username, new.display_name, new.avatar_url, new.cover_url, new.bio, new.country, new.role, new.created_at)
  on conflict (id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    cover_url = excluded.cover_url,
    bio = excluded.bio,
    country = excluded.country,
    role = excluded.role,
    created_at = excluded.created_at;
  return new;
end;
$$;

update public.public_profiles pp
set cover_url = p.cover_url
from public.profiles p
where p.id = pp.id;

drop function if exists public.get_public_sellers(uuid);
create or replace function public.get_public_sellers(p_seller_id uuid default null)
returns table(
  id uuid,
  display_name text,
  username text,
  bio text,
  avatar_url text,
  cover_url text,
  country text,
  producer_name text,
  whatsapp text,
  follower_count integer,
  instagram_url text,
  youtube_url text,
  soundcloud_url text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, p.display_name, p.username, p.bio, p.avatar_url, p.cover_url, p.country,
    sp.producer_name, sp.whatsapp, sp.follower_count, sp.instagram_url, sp.youtube_url, sp.soundcloud_url
  from public.profiles p
  join public.seller_profiles sp on sp.id = p.id
  where p.account_status = 'active'
    and p.role in ('seller', 'admin')
    and (p_seller_id is null or p.id = p_seller_id)
  order by coalesce(sp.producer_name, p.display_name, p.username), p.created_at
  limit case when p_seller_id is null then 50 else 1 end;
$$;

update public.beats
set access_mode = 'free_download'
where is_free is true
  and coalesce(download_enabled, true) is true
  and coalesce(access_mode, 'paid_download') = 'paid_download';

-- Public profile covers are a profile identity asset. Original marketplace masters
-- and payment files remain in private storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-covers',
  'profile-covers',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "BeatBox users manage own profile covers" on storage.objects;
create policy "BeatBox users manage own profile covers"
on storage.objects for all to authenticated
using (
  bucket_id = 'profile-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
notify storage, 'reload config';
