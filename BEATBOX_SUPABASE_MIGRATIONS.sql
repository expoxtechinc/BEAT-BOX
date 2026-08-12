-- BeatBox Supabase migration export
-- Generated from committed files in /supabase/migrations.
-- Run in Supabase SQL Editor using a project owner/service-role-capable session.
-- Review each statement and take a database backup before applying in production.
-- This export is intentionally not auto-executed by the application.

-- ===== 20260811_beatbox_foundation.sql =====
create extension if not exists pgcrypto;

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table if not exists public.beat_licenses (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  name text not null check (name in ('Basic', 'Premium', 'Exclusive')),
  price numeric(12,2) not null check (price >= 0),
  terms text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (beat_id, name)
);

alter table public.orders add column if not exists license_id uuid references public.beat_licenses(id) on delete set null;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  beat_id uuid not null references public.beats(id) on delete cascade,
  license_id uuid references public.beat_licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, beat_id, license_id)
);

create index if not exists beats_discovery_idx on public.beats (status, published_at desc);
create index if not exists beats_genre_idx on public.beats (genre, bpm);
create index if not exists beats_seller_idx on public.beats (seller_id, status, created_at desc);
create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, status, created_at desc);
create index if not exists payment_requests_seller_idx on public.payment_requests (seller_id, status, created_at desc);
create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);
create index if not exists follows_following_idx on public.follows (following_id, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and account_status = 'active'
  );
$$;

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('seller', 'admin') and account_status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, role, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    'buyer',
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.promote_self_to_seller(producer_name_input text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  update public.profiles
  set role = 'seller', updated_at = now()
  where id = current_user_id and account_status = 'active';

  if not found then
    raise exception 'An active profile is required to become a seller';
  end if;

  insert into public.seller_profiles (id, producer_name)
  select id, coalesce(nullif(trim(producer_name_input), ''), display_name, username, 'BeatBox producer')
  from public.profiles
  where id = current_user_id
  on conflict (id) do update set
    producer_name = coalesce(nullif(trim(producer_name_input), ''), public.seller_profiles.producer_name),
    updated_at = now();
end;
$$;

grant execute on function public.promote_self_to_seller(text) to authenticated;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    new.id := old.id;
    new.account_status := old.account_status;
    if new.role = 'admin' then
      raise exception 'Only an owner can assign the admin role';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges_trigger on public.profiles;
create trigger protect_profile_privileges_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile_privileges();

create or replace function public.protect_seller_verification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    new.verified := old.verified;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_seller_verification_trigger on public.seller_profiles;
create trigger protect_seller_verification_trigger
  before update on public.seller_profiles
  for each row execute procedure public.protect_seller_verification();

create or replace function public.enforce_order_values()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  beat_record public.beats%rowtype;
  license_price numeric(12,2);
begin
  select * into beat_record from public.beats where id = new.beat_id;
  if not found or beat_record.status <> 'published' then
    raise exception 'This beat is unavailable';
  end if;
  if new.seller_id <> beat_record.seller_id then
    raise exception 'Order seller must match the beat seller';
  end if;
  if new.license_id is not null then
    select price into license_price from public.beat_licenses
    where id = new.license_id and beat_id = new.beat_id and is_available = true;
    if license_price is null then
      raise exception 'Selected license is unavailable';
    end if;
    new.amount := license_price;
  else
    new.amount := coalesce(beat_record.price, 0);
  end if;
  if coalesce(beat_record.is_free, false) then
    new.amount := 0;
  end if;
  new.status := 'pending';
  return new;
end;
$$;

drop trigger if exists enforce_order_values_trigger on public.orders;
create trigger enforce_order_values_trigger
  before insert on public.orders
  for each row execute procedure public.enforce_order_values();

create or replace function public.enforce_payment_request_values()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  order_record public.orders%rowtype;
begin
  select * into order_record from public.orders where id = new.order_id;
  if not found or order_record.buyer_id <> new.buyer_id or order_record.seller_id <> new.seller_id then
    raise exception 'Payment request does not match the order parties';
  end if;
  new.amount := order_record.amount;
  new.status := 'payment_submitted';
  update public.orders set status = 'payment_submitted', payment_method = new.method, payment_reference = new.reference, updated_at = now()
  where id = new.order_id and status in ('pending', 'payment_rejected');
  return new;
end;
$$;

drop trigger if exists enforce_payment_request_values_trigger on public.payment_requests;
create trigger enforce_payment_request_values_trigger
  before insert on public.payment_requests
  for each row execute procedure public.enforce_payment_request_values();

create or replace function public.sync_payment_review()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.status is distinct from old.status and new.status in ('under_review', 'payment_verified', 'payment_rejected', 'delivered') then
    update public.orders
    set status = new.status,
        verified_at = case when new.status = 'payment_verified' then now() else verified_at end,
        delivered_at = case when new.status = 'delivered' then now() else delivered_at end,
        updated_at = now()
    where id = new.order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_payment_review_trigger on public.payment_requests;
create trigger sync_payment_review_trigger
  after update on public.payment_requests
  for each row execute procedure public.sync_payment_review();

create or replace function public.notify_payment_request()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.notifications (user_id, type, title, message, metadata)
  values (new.seller_id, 'payment_request', 'Payment submitted', 'A buyer submitted a payment reference for review.', jsonb_build_object('order_id', new.order_id, 'payment_request_id', new.id));
  insert into public.notifications (user_id, type, title, message, metadata)
  select id, 'platform_order', 'New payment request', 'A buyer submitted a payment request requiring seller review.', jsonb_build_object('order_id', new.order_id, 'payment_request_id', new.id)
  from public.profiles where role = 'admin' and account_status = 'active';
  return new;
end;
$$;

drop trigger if exists notify_payment_request_trigger on public.payment_requests;
create trigger notify_payment_request_trigger
  after insert on public.payment_requests
  for each row execute procedure public.notify_payment_request();

create or replace function public.notify_payment_review()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.status is distinct from old.status and new.status in ('payment_verified', 'payment_rejected', 'delivered') then
    insert into public.notifications (user_id, type, title, message, metadata)
    values (
      new.buyer_id,
      'payment_review',
      case when new.status = 'payment_verified' then 'Payment verified' when new.status = 'delivered' then 'Beat delivered' else 'Payment needs attention' end,
      case when new.status = 'payment_verified' then 'Your payment was verified. Your secure download is now available.' when new.status = 'delivered' then 'Your order has been marked delivered.' else 'Your payment request was rejected. Review the seller instructions and submit a new reference.' end,
      jsonb_build_object('order_id', new.order_id, 'payment_request_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_payment_review_trigger on public.payment_requests;
create trigger notify_payment_review_trigger
  after update on public.payment_requests
  for each row execute procedure public.notify_payment_review();

create or replace function public.get_payment_instructions(order_id_input uuid)
returns table (id uuid, provider text, account_name text, account_number text, phone_number text, instructions text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select pm.id, pm.provider, pm.account_name, pm.account_number, pm.phone_number, pm.instructions
  from public.seller_payment_methods pm
  join public.orders o on o.seller_id = pm.seller_id
  where o.id = order_id_input and o.buyer_id = auth.uid();
$$;

grant execute on function public.get_payment_instructions(uuid) to authenticated;

alter table public.follows enable row level security;
alter table public.beat_licenses enable row level security;
alter table public.cart_items enable row level security;
alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.beats enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.beat_tags enable row level security;
alter table public.favorites enable row level security;
alter table public.orders enable row level security;
alter table public.payment_requests enable row level security;
alter table public.seller_payment_methods enable row level security;
alter table public.downloads enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists seller_profiles_read on public.seller_profiles;
create policy seller_profiles_read on public.seller_profiles for select using (true);
drop policy if exists seller_profiles_manage_own on public.seller_profiles;
create policy seller_profiles_manage_own on public.seller_profiles for all using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists beats_read_published_or_own on public.beats;
create policy beats_read_published_or_own on public.beats for select using (status = 'published' or seller_id = auth.uid() or public.is_admin());
drop policy if exists beats_insert_seller on public.beats;
create policy beats_insert_seller on public.beats for insert with check (seller_id = auth.uid() and public.is_seller());
drop policy if exists beats_update_seller on public.beats;
create policy beats_update_seller on public.beats for update using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());
drop policy if exists beats_delete_seller on public.beats;
create policy beats_delete_seller on public.beats for delete using (seller_id = auth.uid() or public.is_admin());

drop policy if exists beat_licenses_read on public.beat_licenses;
create policy beat_licenses_read on public.beat_licenses for select using (exists (select 1 from public.beats b where b.id = beat_id and (b.status = 'published' or b.seller_id = auth.uid() or public.is_admin())));
drop policy if exists beat_licenses_manage on public.beat_licenses;
create policy beat_licenses_manage on public.beat_licenses for all using (exists (select 1 from public.beats b where b.id = beat_id and (b.seller_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.beats b where b.id = beat_id and (b.seller_id = auth.uid() or public.is_admin())));

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);
drop policy if exists categories_admin_manage on public.categories;
create policy categories_admin_manage on public.categories for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists tags_public_read on public.tags;
create policy tags_public_read on public.tags for select using (true);
drop policy if exists tags_admin_manage on public.tags;
create policy tags_admin_manage on public.tags for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists beat_tags_read on public.beat_tags;
create policy beat_tags_read on public.beat_tags for select using (exists (select 1 from public.beats b where b.id = beat_id and (b.status = 'published' or b.seller_id = auth.uid() or public.is_admin())));
drop policy if exists beat_tags_manage on public.beat_tags;
create policy beat_tags_manage on public.beat_tags for all using (exists (select 1 from public.beats b where b.id = beat_id and (b.seller_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.beats b where b.id = beat_id and (b.seller_id = auth.uid() or public.is_admin())));

drop policy if exists favorites_manage_own on public.favorites;
create policy favorites_manage_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists follows_public_read on public.follows;
create policy follows_public_read on public.follows for select using (true);
drop policy if exists follows_manage_own on public.follows;
create policy follows_manage_own on public.follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

drop policy if exists cart_manage_own on public.cart_items;
create policy cart_manage_own on public.cart_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists orders_read_parties on public.orders;
create policy orders_read_parties on public.orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
drop policy if exists orders_insert_buyer on public.orders;
create policy orders_insert_buyer on public.orders for insert with check (buyer_id = auth.uid());
drop policy if exists orders_update_seller_or_admin on public.orders;
create policy orders_update_seller_or_admin on public.orders for update using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());

drop policy if exists payment_requests_read_parties on public.payment_requests;
create policy payment_requests_read_parties on public.payment_requests for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
drop policy if exists payment_requests_insert_buyer on public.payment_requests;
create policy payment_requests_insert_buyer on public.payment_requests for insert with check (buyer_id = auth.uid());
drop policy if exists payment_requests_update_seller_or_admin on public.payment_requests;
create policy payment_requests_update_seller_or_admin on public.payment_requests for update using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());

drop policy if exists payment_methods_manage_own on public.seller_payment_methods;
create policy payment_methods_manage_own on public.seller_payment_methods for all using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());

drop policy if exists downloads_read_own on public.downloads;
create policy downloads_read_own on public.downloads for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists notifications_manage_own on public.notifications;
create policy notifications_manage_own on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reports_read_own_or_admin on public.reports;
create policy reports_read_own_or_admin on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports for insert with check (reporter_id = auth.uid());
drop policy if exists reports_admin_update on public.reports;
create policy reports_admin_update on public.reports for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs for select using (public.is_admin());
drop policy if exists platform_settings_admin_manage on public.platform_settings;
create policy platform_settings_admin_manage on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('beat-covers', 'beat-covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('beat-previews', 'beat-previews', true, 20971520, array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/flac']),
  ('beat-masters', 'beat-masters', false, 262144000, array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/flac']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists beat_assets_public_read on storage.objects;
create policy beat_assets_public_read on storage.objects for select using (bucket_id in ('beat-covers', 'beat-previews'));
drop policy if exists beat_assets_owner_insert on storage.objects;
create policy beat_assets_owner_insert on storage.objects for insert with check (bucket_id in ('beat-covers', 'beat-previews', 'beat-masters', 'payment-proofs') and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists beat_assets_owner_update on storage.objects;
create policy beat_assets_owner_update on storage.objects for update using (bucket_id in ('beat-covers', 'beat-previews', 'beat-masters', 'payment-proofs') and owner_id = (select auth.uid()::text)) with check (bucket_id in ('beat-covers', 'beat-previews', 'beat-masters', 'payment-proofs') and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists beat_assets_owner_delete on storage.objects;
create policy beat_assets_owner_delete on storage.objects for delete using (bucket_id in ('beat-covers', 'beat-previews', 'beat-masters', 'payment-proofs') and owner_id = (select auth.uid()::text));


-- ===== 20260811_beatbox_security_and_marketplace.sql =====
-- BeatBox Supabase foundation: role-safe marketplace data, private media, and payment-request workflows.

create extension if not exists pgcrypto;

alter table public.seller_profiles
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists soundcloud_url text,
  add column if not exists follower_count integer not null default 0;

create table if not exists public.producer_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  producer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, producer_id),
  constraint producer_follows_no_self_follow check (follower_id <> producer_id)
);

create table if not exists public.beat_licenses (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete cascade,
  license_code text not null check (license_code in ('basic', 'premium', 'exclusive')),
  name text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  terms text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (beat_id, license_code)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  beat_id uuid not null references public.beats(id) on delete cascade,
  license_id uuid references public.beat_licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, beat_id, license_id)
);

create index if not exists beats_discovery_idx on public.beats (status, created_at desc);
create index if not exists beats_seller_idx on public.beats (seller_id, status, updated_at desc);
create index if not exists beats_genre_bpm_idx on public.beats (genre, bpm) where status = 'published';
create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, created_at desc);
create index if not exists payment_requests_seller_idx on public.payment_requests (seller_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists producer_follows_producer_idx on public.producer_follows (producer_id, created_at desc);

create or replace function public.is_beatbox_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and account_status = 'active'
  );
$$;

create or replace function public.is_beatbox_seller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('seller', 'admin') and account_status = 'active'
  );
$$;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if old.role = 'buyer' and new.role = 'seller' and auth.uid() = old.id then
      null;
    elsif public.is_beatbox_admin() then
      null;
    else
      raise exception 'Only a buyer may opt in to seller access; administrator access cannot be self-assigned';
    end if;
  end if;

  if new.account_status is distinct from old.account_status and not public.is_beatbox_admin() then
    raise exception 'Only an administrator may alter account status';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists beatbox_protect_profile_privileges on public.profiles;
create trigger beatbox_protect_profile_privileges
before update on public.profiles
for each row execute function public.protect_profile_privileges();

create or replace function public.protect_seller_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.verified is distinct from old.verified and not public.is_beatbox_admin() then
    raise exception 'Seller verification is administrator-controlled';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists beatbox_protect_seller_verification on public.seller_profiles;
create trigger beatbox_protect_seller_verification
before update on public.seller_profiles
for each row execute function public.protect_seller_verification();

create or replace function public.sync_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.seller_profiles
    set follower_count = follower_count + 1, updated_at = now()
    where id = new.producer_id;
    return new;
  end if;

  update public.seller_profiles
  set follower_count = greatest(follower_count - 1, 0), updated_at = now()
  where id = old.producer_id;
  return old;
end;
$$;

drop trigger if exists beatbox_sync_follower_count on public.producer_follows;
create trigger beatbox_sync_follower_count
after insert or delete on public.producer_follows
for each row execute function public.sync_follower_count();

create or replace function public.create_payment_request(
  p_beat_id uuid,
  p_method text,
  p_reference text default null,
  p_proof_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_seller_id uuid;
  v_amount numeric(12,2);
  v_order_id uuid;
begin
  if v_buyer_id is null then
    raise exception 'Authentication is required';
  end if;

  select seller_id, price
  into v_seller_id, v_amount
  from public.beats
  where id = p_beat_id and status = 'published' and coalesce(is_free, false) = false;

  if v_seller_id is null then
    raise exception 'This beat is not available for a payment request';
  end if;

  if v_seller_id = v_buyer_id then
    raise exception 'You cannot request payment for your own beat';
  end if;

  if p_method not in ('Mobile Money', 'Orange Money', 'WhatsApp') then
    raise exception 'Unsupported payment method';
  end if;

  insert into public.orders (beat_id, buyer_id, seller_id, amount, currency, payment_method, payment_reference, status)
  values (p_beat_id, v_buyer_id, v_seller_id, coalesce(v_amount, 0), 'USD', p_method, nullif(trim(coalesce(p_reference, '')), ''), 'payment_submitted')
  returning id into v_order_id;

  insert into public.payment_requests (order_id, buyer_id, seller_id, amount, method, reference, proof_url, status)
  values (v_order_id, v_buyer_id, v_seller_id, coalesce(v_amount, 0), p_method, nullif(trim(coalesce(p_reference, '')), ''), p_proof_path, 'payment_submitted');

  insert into public.notifications (user_id, type, title, message, metadata)
  values (
    v_seller_id,
    'payment_request',
    'New payment request',
    'A buyer submitted a payment request for one of your beats.',
    jsonb_build_object('order_id', v_order_id, 'beat_id', p_beat_id)
  );

  return v_order_id;
end;
$$;

create or replace function public.review_payment_request(
  p_payment_request_id uuid,
  p_status public.order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_order_id uuid;
begin
  if p_status not in ('under_review', 'payment_verified', 'payment_rejected') then
    raise exception 'Unsupported payment review status';
  end if;

  select buyer_id, seller_id, order_id into v_buyer_id, v_seller_id, v_order_id
  from public.payment_requests
  where id = p_payment_request_id;

  if v_seller_id is null then
    raise exception 'Payment request not found';
  end if;

  if auth.uid() <> v_seller_id and not public.is_beatbox_admin() then
    raise exception 'Only the seller or an administrator may review this payment request';
  end if;

  update public.payment_requests
  set status = p_status, reviewed_at = now()
  where id = p_payment_request_id;

  update public.orders
  set status = p_status,
      verified_at = case when p_status = 'payment_verified' then now() else verified_at end,
      updated_at = now()
  where id = v_order_id;

  insert into public.notifications (user_id, type, title, message, metadata)
  values (
    v_buyer_id,
    'payment_status',
    'Payment request updated',
    case p_status
      when 'payment_verified' then 'Your payment was verified. Your secure download is now available.'
      when 'payment_rejected' then 'Your payment request was rejected. Review the seller instructions and submit a new request if needed.'
      else 'Your payment request is under review.'
    end,
    jsonb_build_object('order_id', v_order_id, 'payment_request_id', p_payment_request_id, 'status', p_status)
  );
end;
$$;

grant execute on function public.create_payment_request(uuid, text, text, text) to authenticated;
grant execute on function public.review_payment_request(uuid, public.order_status) to authenticated;

create or replace view public.public_profiles
with (security_invoker = false)
as
select id, username, display_name, avatar_url, bio, country, role, created_at
from public.profiles
where account_status = 'active';

grant select on public.public_profiles to anon, authenticated;

-- Replace broad policies with role-aware policies.
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "BeatBox profiles are private by default" on public.profiles
  for select using (id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox users can insert their own profile" on public.profiles
  for insert with check (id = auth.uid());
create policy "BeatBox users can update their own profile" on public.profiles
  for update using (id = auth.uid() or public.is_beatbox_admin())
  with check (id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "Seller profiles are viewable by everyone" on public.seller_profiles;
drop policy if exists "Sellers can manage own seller profile" on public.seller_profiles;
create policy "BeatBox seller profiles are public" on public.seller_profiles for select using (true);
create policy "BeatBox sellers create own profile" on public.seller_profiles
  for insert with check (id = auth.uid() and public.is_beatbox_seller());
create policy "BeatBox sellers update own profile" on public.seller_profiles
  for update using (id = auth.uid() or public.is_beatbox_admin())
  with check (id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox sellers delete own profile" on public.seller_profiles
  for delete using (id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "Published beats are viewable by everyone" on public.beats;
drop policy if exists "Sellers can insert own beats" on public.beats;
drop policy if exists "Sellers can update own beats" on public.beats;
drop policy if exists "Sellers can delete own beats" on public.beats;
create policy "BeatBox published beats are public" on public.beats
  for select using (status = 'published' or seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox sellers create own beats" on public.beats
  for insert with check (seller_id = auth.uid() and public.is_beatbox_seller());
create policy "BeatBox sellers update own beats" on public.beats
  for update using (seller_id = auth.uid() or public.is_beatbox_admin())
  with check (seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox sellers delete own beats" on public.beats
  for delete using (seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "Beat tags are public" on public.beat_tags;
create policy "BeatBox beat tags are public" on public.beat_tags for select using (true);
create policy "BeatBox sellers manage own beat tags" on public.beat_tags for all
  using (exists (select 1 from public.beats b where b.id = beat_id and (b.seller_id = auth.uid() or public.is_beatbox_admin())))
  with check (exists (select 1 from public.beats b where b.id = beat_id and (b.seller_id = auth.uid() or public.is_beatbox_admin())));

drop policy if exists "Categories are public" on public.categories;
create policy "BeatBox categories are public" on public.categories for select using (true);
drop policy if exists "Tags are public" on public.tags;
create policy "BeatBox tags are public" on public.tags for select using (true);

drop policy if exists "Users can view own favorites" on public.favorites;
drop policy if exists "Users can insert own favorites" on public.favorites;
drop policy if exists "Users can delete own favorites" on public.favorites;
create policy "BeatBox users view own favorites" on public.favorites for select using (user_id = auth.uid());
create policy "BeatBox users create own favorites" on public.favorites for insert with check (user_id = auth.uid());
create policy "BeatBox users delete own favorites" on public.favorites for delete using (user_id = auth.uid());

alter table public.producer_follows enable row level security;
create policy "BeatBox follows are readable" on public.producer_follows for select using (true);
create policy "BeatBox users create own follows" on public.producer_follows for insert with check (follower_id = auth.uid());
create policy "BeatBox users delete own follows" on public.producer_follows for delete using (follower_id = auth.uid());

alter table public.beat_licenses enable row level security;
create policy "BeatBox licenses are public for visible beats" on public.beat_licenses for select
  using (exists (select 1 from public.beats b where b.id = beat_id and (b.status = 'published' or b.seller_id = auth.uid() or public.is_beatbox_admin())));
create policy "BeatBox sellers manage own licenses" on public.beat_licenses for all
  using (exists (select 1 from public.beats b where b.id = beat_id and (b.seller_id = auth.uid() or public.is_beatbox_admin())))
  with check (exists (select 1 from public.beats b where b.id = beat_id and (b.seller_id = auth.uid() or public.is_beatbox_admin())));

alter table public.cart_items enable row level security;
create policy "BeatBox users view own cart" on public.cart_items for select using (user_id = auth.uid());
create policy "BeatBox users update own cart" on public.cart_items for insert with check (user_id = auth.uid());
create policy "BeatBox users remove own cart items" on public.cart_items for delete using (user_id = auth.uid());

drop policy if exists "Users can view own orders" on public.orders;
drop policy if exists "Users can create orders" on public.orders;
drop policy if exists "Sellers can update order status" on public.orders;
create policy "BeatBox buyers and sellers view orders" on public.orders for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox buyers create pending orders" on public.orders for insert
  with check (buyer_id = auth.uid() and status = 'pending');
create policy "BeatBox sellers review own orders" on public.orders for update
  using (seller_id = auth.uid() or public.is_beatbox_admin())
  with check (seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "Users can view own payment requests" on public.payment_requests;
drop policy if exists "Buyers can create payment requests" on public.payment_requests;
drop policy if exists "Sellers can update payment requests" on public.payment_requests;
create policy "BeatBox parties view payment requests" on public.payment_requests for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "Payment methods viewable by buyers on purchase" on public.seller_payment_methods;
drop policy if exists "Sellers manage own payment methods" on public.seller_payment_methods;
create policy "BeatBox sellers manage payment instructions" on public.seller_payment_methods for all
  using (seller_id = auth.uid() or public.is_beatbox_admin())
  with check (seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox buyers view payment instructions on orders" on public.seller_payment_methods for select
  using (
    public.is_beatbox_admin()
    or exists (
      select 1 from public.orders o
      where o.seller_id = seller_payment_methods.seller_id
        and o.buyer_id = auth.uid()
        and o.status in ('pending', 'payment_submitted', 'under_review', 'payment_verified', 'delivered')
    )
  );

drop policy if exists "Users can view own downloads" on public.downloads;
drop policy if exists "System can insert downloads" on public.downloads;
create policy "BeatBox users view own downloads" on public.downloads for select
  using (user_id = auth.uid() or public.is_beatbox_admin());

drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "BeatBox users view own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "BeatBox users update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can create reports" on public.reports;
drop policy if exists "Users can view own reports" on public.reports;
create policy "BeatBox users view own reports" on public.reports for select
  using (reporter_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox users create own reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "BeatBox administrators moderate reports" on public.reports for update
  using (public.is_beatbox_admin()) with check (public.is_beatbox_admin());

drop policy if exists "Audit logs viewable by admins" on public.audit_logs;
drop policy if exists "System can insert audit logs" on public.audit_logs;
create policy "BeatBox administrators view audit logs" on public.audit_logs for select using (public.is_beatbox_admin());

drop policy if exists "Platform settings are public" on public.platform_settings;
create policy "BeatBox public platform settings are readable" on public.platform_settings for select using (true);
create policy "BeatBox administrators manage platform settings" on public.platform_settings for all
  using (public.is_beatbox_admin()) with check (public.is_beatbox_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('beat-covers', 'beat-covers', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('beat-previews', 'beat-previews', false, 52428800, array['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac']),
  ('beat-masters', 'beat-masters', false, 524288000, array['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/aac']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf']),
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "BeatBox public cover reads" on storage.objects;
drop policy if exists "BeatBox public preview reads" on storage.objects;
drop policy if exists "BeatBox seller cover uploads" on storage.objects;
drop policy if exists "BeatBox seller preview uploads" on storage.objects;
drop policy if exists "BeatBox seller master access" on storage.objects;
drop policy if exists "BeatBox buyer proof uploads" on storage.objects;
drop policy if exists "BeatBox seller proof review" on storage.objects;
drop policy if exists "BeatBox user avatar access" on storage.objects;

create policy "BeatBox public cover reads" on storage.objects for select
  using (bucket_id = 'beat-covers');
create policy "BeatBox public preview reads" on storage.objects for select
  using (bucket_id = 'beat-previews');
create policy "BeatBox seller cover uploads" on storage.objects for all to authenticated
  using (bucket_id = 'beat-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller())
  with check (bucket_id = 'beat-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller());
create policy "BeatBox seller preview uploads" on storage.objects for all to authenticated
  using (bucket_id = 'beat-previews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller())
  with check (bucket_id = 'beat-previews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller());
create policy "BeatBox seller master access" on storage.objects for all to authenticated
  using (bucket_id = 'beat-masters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller())
  with check (bucket_id = 'beat-masters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller());
create policy "BeatBox buyer proof uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "BeatBox buyer proof reads" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "BeatBox seller proof review" on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.payment_requests pr
      where pr.proof_url = storage.objects.name and pr.seller_id = auth.uid()
    )
  );
create policy "BeatBox user avatar access" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ===== 20260811_beatbox_seller_role_enum_repair.sql =====
-- Targeted production repair: profiles.role is a user_role enum, so the
-- seller-promotion CASE expression must return enum values rather than text.

create or replace function public.register_as_seller(producer_name_input text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  requested_name text := nullif(trim(producer_name_input), '');
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  perform public.ensure_self_profile();

  if requested_name is not null and char_length(requested_name) > 100 then
    raise exception 'Producer name must be 100 characters or fewer';
  end if;

  perform set_config('beatbox.allow_seller_registration', 'on', true);

  update public.profiles
  set role = case
        when role = 'admin'::public.user_role then 'admin'::public.user_role
        else 'seller'::public.user_role
      end,
      updated_at = now()
  where id = current_user_id
    and account_status = 'active';

  if not found then
    raise exception 'An active profile is required to become a seller';
  end if;

  insert into public.seller_profiles (id, producer_name)
  select
    id,
    coalesce(requested_name, nullif(display_name, ''), nullif(username, ''), 'BeatBox producer')
  from public.profiles
  where id = current_user_id
  on conflict (id) do update set
    producer_name = coalesce(requested_name, public.seller_profiles.producer_name),
    updated_at = now();
end;
$$;

revoke all on function public.register_as_seller(text) from public;
grant execute on function public.register_as_seller(text) to authenticated;


-- ===== 20260811_beatbox_profile_and_seller_repair.sql =====
-- BeatBox profile persistence and self-service seller-registration repair.
-- This migration preserves auth-provider behavior and limits elevated database work
-- to narrowly scoped functions that always verify auth.uid().

create or replace function public.ensure_self_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  auth_email text;
  auth_metadata jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select email, raw_user_meta_data
  into auth_email, auth_metadata
  from auth.users
  where id = current_user_id;

  if not found then
    raise exception 'Authenticated account was not found';
  end if;

  insert into public.profiles (id, email, display_name, avatar_url, role, account_status)
  values (
    current_user_id,
    auth_email,
    coalesce(
      nullif(trim(auth_metadata ->> 'full_name'), ''),
      nullif(trim(auth_metadata ->> 'name'), ''),
      nullif(split_part(coalesce(auth_email, ''), '@', 1), ''),
      'BeatBox listener'
    ),
    nullif(trim(auth_metadata ->> 'avatar_url'), ''),
    'buyer',
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(nullif(public.profiles.avatar_url, ''), excluded.avatar_url),
    updated_at = now();
end;
$$;

create or replace function public.update_self_profile(
  p_display_name text,
  p_username text,
  p_bio text,
  p_country text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_display_name text := nullif(trim(coalesce(p_display_name, '')), '');
  normalized_username text := nullif(lower(trim(coalesce(p_username, ''))), '');
  normalized_bio text := nullif(trim(coalesce(p_bio, '')), '');
  normalized_country text := nullif(trim(coalesce(p_country, '')), '');
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  perform public.ensure_self_profile();

  if normalized_display_name is null or char_length(normalized_display_name) > 80 then
    raise exception 'Display name is required and must be 80 characters or fewer';
  end if;

  if normalized_username is not null and normalized_username !~ '^[a-z0-9][a-z0-9-]{1,29}$' then
    raise exception 'Username must use 2–30 lowercase letters, numbers, or hyphens';
  end if;

  if normalized_bio is not null and char_length(normalized_bio) > 1000 then
    raise exception 'Bio must be 1000 characters or fewer';
  end if;

  if normalized_country is not null and char_length(normalized_country) > 80 then
    raise exception 'Country must be 80 characters or fewer';
  end if;

  update public.profiles
  set display_name = normalized_display_name,
      username = normalized_username,
      bio = normalized_bio,
      country = normalized_country,
      updated_at = now()
  where id = current_user_id;
end;
$$;

create or replace function public.register_as_seller(producer_name_input text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  requested_name text := nullif(trim(producer_name_input), '');
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  perform public.ensure_self_profile();

  if requested_name is not null and char_length(requested_name) > 100 then
    raise exception 'Producer name must be 100 characters or fewer';
  end if;

  perform set_config('beatbox.allow_seller_registration', 'on', true);

  update public.profiles
  set role = case
        when role = 'admin'::public.user_role then 'admin'::public.user_role
        else 'seller'::public.user_role
      end,
      updated_at = now()
  where id = current_user_id
    and account_status = 'active';

  if not found then
    raise exception 'An active profile is required to become a seller';
  end if;

  insert into public.seller_profiles (id, producer_name)
  select
    id,
    coalesce(requested_name, nullif(display_name, ''), nullif(username, ''), 'BeatBox producer')
  from public.profiles
  where id = current_user_id
  on conflict (id) do update set
    producer_name = coalesce(requested_name, public.seller_profiles.producer_name),
    updated_at = now();
end;
$$;

-- Preserve the earlier public routine name for any already-open BeatBox client.
create or replace function public.promote_self_to_seller(producer_name_input text default null)
returns void
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  perform public.register_as_seller(producer_name_input);
end;
$$;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() = old.id and not public.is_beatbox_admin() then
    new.id := old.id;
    new.account_status := old.account_status;
    if current_setting('beatbox.allow_seller_registration', true) = 'on'
       and old.role = 'buyer'
       and new.role = 'seller' then
      null;
    else
      new.role := old.role;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Private profile data is available only to the account owner or an authenticated owner/admin.
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_beatbox_admin());

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_beatbox_admin())
  with check (id = auth.uid() or public.is_beatbox_admin());

drop policy if exists seller_profiles_read on public.seller_profiles;
drop policy if exists seller_profiles_read_own_or_admin on public.seller_profiles;
create policy seller_profiles_read_own_or_admin on public.seller_profiles
  for select using (id = auth.uid() or public.is_beatbox_admin());

drop policy if exists seller_profiles_manage_own on public.seller_profiles;
drop policy if exists seller_profiles_insert_own on public.seller_profiles;
drop policy if exists seller_profiles_update_own on public.seller_profiles;
create policy seller_profiles_insert_own on public.seller_profiles
  for insert with check (id = auth.uid() and public.is_beatbox_seller());
create policy seller_profiles_update_own on public.seller_profiles
  for update using (id = auth.uid() or public.is_beatbox_admin())
  with check (id = auth.uid() or public.is_beatbox_admin());

-- Public producer data is exposed only through this constrained projection.
create or replace function public.get_public_sellers(p_seller_id uuid default null)
returns table (
  id uuid,
  display_name text,
  username text,
  bio text,
  avatar_url text,
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
  select
    p.id,
    p.display_name,
    p.username,
    p.bio,
    p.avatar_url,
    p.country,
    sp.producer_name,
    sp.whatsapp,
    sp.follower_count,
    sp.instagram_url,
    sp.youtube_url,
    sp.soundcloud_url
  from public.profiles p
  join public.seller_profiles sp on sp.id = p.id
  where p.account_status = 'active'
    and p.role in ('seller', 'admin')
    and (p_seller_id is null or p.id = p_seller_id)
  order by coalesce(sp.producer_name, p.display_name, p.username), p.created_at
  limit case when p_seller_id is null then 50 else 1 end;
$$;

grant execute on function public.ensure_self_profile() to authenticated;
grant execute on function public.update_self_profile(text, text, text, text) to authenticated;
grant execute on function public.register_as_seller(text) to authenticated;
grant execute on function public.promote_self_to_seller(text) to authenticated;
grant execute on function public.get_public_sellers(uuid) to anon, authenticated;


-- ===== 20260811_beatbox_profile_save_rpc_repair.sql =====
-- Targeted production repair: the prior migration applied the seller routine but
-- the profile-save RPC was not present in the live schema. This migration is
-- intentionally narrow and can be safely applied after the original repair.

create or replace function public.update_self_profile(
  p_display_name text,
  p_username text,
  p_bio text,
  p_country text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_display_name text := nullif(trim(coalesce(p_display_name, '')), '');
  normalized_username text := nullif(lower(trim(coalesce(p_username, ''))), '');
  normalized_bio text := nullif(trim(coalesce(p_bio, '')), '');
  normalized_country text := nullif(trim(coalesce(p_country, '')), '');
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  perform public.ensure_self_profile();

  if normalized_display_name is null or char_length(normalized_display_name) > 80 then
    raise exception 'Display name is required and must be 80 characters or fewer';
  end if;

  if normalized_username is not null and normalized_username !~ '^[a-z0-9][a-z0-9-]{1,29}$' then
    raise exception 'Username must use 2–30 lowercase letters, numbers, or hyphens';
  end if;

  if normalized_bio is not null and char_length(normalized_bio) > 1000 then
    raise exception 'Bio must be 1000 characters or fewer';
  end if;

  if normalized_country is not null and char_length(normalized_country) > 80 then
    raise exception 'Country must be 80 characters or fewer';
  end if;

  update public.profiles
  set display_name = normalized_display_name,
      username = normalized_username,
      bio = normalized_bio,
      country = normalized_country,
      updated_at = now()
  where id = current_user_id;
end;
$$;

revoke all on function public.update_self_profile(text, text, text, text) from public;
grant execute on function public.update_self_profile(text, text, text, text) to authenticated;


-- ===== 20260811_beatbox_rpc_hardening.sql =====
-- BeatBox security hardening: public profile projection and least-privilege RPC execution.

-- Replace the SECURITY DEFINER public profile view with a deliberately public, RLS-protected projection table.
drop view if exists public.public_profiles;

create table if not exists public.public_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  country text,
  role public.user_role not null,
  created_at timestamptz not null
);

alter table public.public_profiles enable row level security;
drop policy if exists "BeatBox public profile projection is readable" on public.public_profiles;
create policy "BeatBox public profile projection is readable" on public.public_profiles
  for select using (true);

insert into public.public_profiles (id, username, display_name, avatar_url, bio, country, role, created_at)
select id, username, display_name, avatar_url, bio, country, role, created_at
from public.profiles
where account_status = 'active'
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  bio = excluded.bio,
  country = excluded.country,
  role = excluded.role,
  created_at = excluded.created_at;

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

  insert into public.public_profiles (id, username, display_name, avatar_url, bio, country, role, created_at)
  values (new.id, new.username, new.display_name, new.avatar_url, new.bio, new.country, new.role, new.created_at)
  on conflict (id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    bio = excluded.bio,
    country = excluded.country,
    role = excluded.role,
    created_at = excluded.created_at;
  return new;
end;
$$;

drop trigger if exists beatbox_sync_public_profile_projection on public.profiles;
create trigger beatbox_sync_public_profile_projection
after insert or update or delete on public.profiles
for each row execute function public.sync_public_profile_projection();

-- PostgreSQL grants EXECUTE to PUBLIC by default. Trigger helpers must never be directly callable.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_privileges() from public, anon, authenticated;
revoke execute on function public.protect_seller_verification() from public, anon, authenticated;
revoke execute on function public.sync_follower_count() from public, anon, authenticated;
revoke execute on function public.notify_download_activity() from public, anon, authenticated;
revoke execute on function public.notify_moderation_activity() from public, anon, authenticated;
revoke execute on function public.notify_report_activity() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.sync_public_profile_projection() from public, anon, authenticated;

-- The following authenticated workflow RPCs are intentionally callable from BeatBox’s browser client.
revoke execute on function public.attach_tags_to_beat(uuid, text[]) from public, anon;
revoke execute on function public.create_payment_request(uuid, text, text, text) from public, anon;
revoke execute on function public.review_payment_request(uuid, public.order_status) from public, anon;
grant execute on function public.attach_tags_to_beat(uuid, text[]) to authenticated;
grant execute on function public.create_payment_request(uuid, text, text, text) to authenticated;
grant execute on function public.review_payment_request(uuid, public.order_status) to authenticated;

-- RLS helper functions remain callable by query roles because BeatBox policies use them.
-- Each is no-argument, pinned to the public search path, and derives the caller from auth.uid().
revoke execute on function public.is_beatbox_admin() from public;
revoke execute on function public.is_beatbox_seller() from public;
grant execute on function public.is_beatbox_admin() to anon, authenticated;
grant execute on function public.is_beatbox_seller() to anon, authenticated;


-- ===== 20260811_beatbox_trigger_search_path.sql =====
-- BeatBox final trigger hardening: all referenced app objects are schema-qualified.
alter function public.handle_new_user() set search_path = '';


-- ===== 20260811_beatbox_completeness.sql =====
-- BeatBox completion migration: secure tag attachment and non-payment activity notifications.

create or replace function public.attach_tags_to_beat(p_beat_id uuid, p_tags text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tag_name text;
  tag_slug text;
  tag_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.beats
    where id = p_beat_id and seller_id = auth.uid()
  ) then
    raise exception 'Only the seller may tag this beat';
  end if;

  foreach tag_name in array coalesce(p_tags, array[]::text[]) loop
    tag_name := left(trim(regexp_replace(tag_name, '\s+', ' ', 'g')), 48);
    if tag_name = '' then
      continue;
    end if;

    tag_slug := lower(regexp_replace(tag_name, '[^a-zA-Z0-9]+', '-', 'g'));
    tag_slug := trim(both '-' from tag_slug);
    if tag_slug = '' then
      continue;
    end if;

    insert into public.tags (name, slug)
    values (tag_name, tag_slug)
    on conflict (slug) do update set name = excluded.name
    returning id into tag_id;

    insert into public.beat_tags (beat_id, tag_id)
    values (p_beat_id, tag_id)
    on conflict do nothing;
  end loop;
end;
$$;

grant execute on function public.attach_tags_to_beat(uuid, text[]) to authenticated;

create or replace function public.notify_report_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, message, metadata)
    select id, 'report_received', 'New content report', 'A BeatBox member submitted content for review.', jsonb_build_object('report_id', new.id)
    from public.profiles
    where role = 'admin' and account_status = 'active';
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message, metadata)
    values (new.reporter_id, 'report_update', 'Report updated', 'Your content report has been ' || replace(new.status::text, '_', ' ') || '.', jsonb_build_object('report_id', new.id, 'status', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists beatbox_notify_report_activity on public.reports;
create trigger beatbox_notify_report_activity
after insert or update of status on public.reports
for each row execute function public.notify_report_activity();

create or replace function public.notify_moderation_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status = 'removed' then
    insert into public.notifications (user_id, type, title, message, metadata)
    values (new.seller_id, 'listing_moderated', 'Listing removed', 'One of your BeatBox listings was removed by moderation.', jsonb_build_object('beat_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists beatbox_notify_moderation_activity on public.beats;
create trigger beatbox_notify_moderation_activity
after update of status on public.beats
for each row execute function public.notify_moderation_activity();

create or replace function public.notify_download_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, message, metadata)
  values (new.user_id, 'download_ready', 'Secure download issued', 'Your private BeatBox download link was issued and will expire automatically.', jsonb_build_object('download_id', new.id, 'beat_id', new.beat_id));
  return new;
end;
$$;

drop trigger if exists beatbox_notify_download_activity on public.downloads;
create trigger beatbox_notify_download_activity
after insert on public.downloads
for each row execute function public.notify_download_activity();


-- ===== 20260812_beatbox_content_type_expansion.sql =====
-- BeatBox additive content-type expansion.
-- Existing rows remain valid; private original paths and access-mode checks are unchanged.

alter table public.beats
  drop constraint if exists beats_content_type_check;

alter table public.beats
  add constraint beats_content_type_check
  check (content_type in ('audio','video','movie','software','app','digital_product'));

alter table public.content_items
  drop constraint if exists content_items_content_type_check;

alter table public.content_items
  add constraint content_items_content_type_check
  check (content_type in ('audio','video','movie','software','app','digital_product'));

comment on column public.beats.content_type is 'Published media type: audio, video, movie, software, app, or digital_product.';
comment on column public.content_items.content_type is 'Protected creator content type: audio, video, movie, software, app, or digital_product.';


-- ===== 20260812_beatbox_content_engagement.sql =====
-- BeatBox durable engagement counters for creator content and community posts.
-- Additive and idempotent; counters are maintained by database triggers.

create or replace function public.sync_content_engagement_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'content_likes' then
    update public.content_items set like_count = greatest(0, like_count + case when tg_op = 'INSERT' then 1 else -1 end), updated_at = now() where id = coalesce(new.content_id, old.content_id);
  elsif tg_table_name = 'content_comments' then
    update public.content_items set comment_count = greatest(0, comment_count + case when tg_op = 'INSERT' then 1 else -1 end), updated_at = now() where id = coalesce(new.content_id, old.content_id);
  elsif tg_table_name = 'content_shares' then
    update public.content_items set share_count = share_count + 1, updated_at = now() where id = new.content_id;
  elsif tg_table_name = 'social_post_likes' then
    update public.social_posts set like_count = greatest(0, like_count + case when tg_op = 'INSERT' then 1 else -1 end), updated_at = now() where id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'social_post_comments' then
    update public.social_posts set comment_count = greatest(0, comment_count + case when tg_op = 'INSERT' then 1 else -1 end), updated_at = now() where id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'social_reposts' then
    update public.social_posts set share_count = share_count + 1, updated_at = now() where id = new.post_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists content_like_count on public.content_likes;
create trigger content_like_count after insert or delete on public.content_likes for each row execute function public.sync_content_engagement_count();
drop trigger if exists content_comment_count on public.content_comments;
create trigger content_comment_count after insert or delete on public.content_comments for each row execute function public.sync_content_engagement_count();
drop trigger if exists content_share_count on public.content_shares;
create trigger content_share_count after insert on public.content_shares for each row execute function public.sync_content_engagement_count();
drop trigger if exists social_post_like_count on public.social_post_likes;
create trigger social_post_like_count after insert or delete on public.social_post_likes for each row execute function public.sync_content_engagement_count();
drop trigger if exists social_post_comment_count on public.social_post_comments;
create trigger social_post_comment_count after insert or delete on public.social_post_comments for each row execute function public.sync_content_engagement_count();
drop trigger if exists social_repost_count on public.social_reposts;
create trigger social_repost_count after insert on public.social_reposts for each row execute function public.sync_content_engagement_count();

grant execute on function public.sync_content_engagement_count() to authenticated;


-- ===== 20260812_beatbox_content_order_entitlements.sql =====
-- Generic content purchase entitlements for paid content items.
alter table public.payment_requests
  add column if not exists content_order_id uuid;

create table if not exists public.content_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  content_id uuid not null references public.content_items(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  payment_method text,
  payment_reference text,
  status text not null default 'pending' check (status in ('pending','payment_submitted','under_review','payment_verified','delivered','payment_rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (buyer_id, content_id, id)
);
alter table public.payment_requests
  drop constraint if exists payment_requests_content_order_fk;
alter table public.payment_requests
  add constraint payment_requests_content_order_fk foreign key (content_order_id) references public.content_orders(id) on delete set null;
create index if not exists content_orders_entitlement_idx on public.content_orders (buyer_id, content_id, status);

alter table public.content_orders enable row level security;
create policy "BeatBox content orders visible to parties" on public.content_orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox buyers create content orders" on public.content_orders for insert to authenticated with check (buyer_id = auth.uid());
create policy "BeatBox sellers review content orders" on public.content_orders for update using (seller_id = auth.uid() or public.is_beatbox_admin()) with check (seller_id = auth.uid() or public.is_beatbox_admin());


-- ===== 20260812_beatbox_creator_social_commerce_extension.sql =====
-- BeatBox creator, social, commerce, advertising, and earnings extension.
-- Additive only: no production data reset and no existing table replacement.

alter table public.seller_payment_methods
  add column if not exists country text,
  add column if not exists currency text not null default 'USD',
  add column if not exists account_holder_name text,
  add column if not exists contact_value text;

alter table public.beats
  add column if not exists content_type text not null default 'audio',
  add column if not exists access_mode text not null default 'paid_download',
  add column if not exists currency text not null default 'USD',
  add column if not exists download_enabled boolean not null default true;

alter table public.beats
  drop constraint if exists beats_content_type_check,
  drop constraint if exists beats_access_mode_check;
alter table public.beats
  add constraint beats_content_type_check check (content_type in ('audio','video','software')),
  add constraint beats_access_mode_check check (access_mode in ('free_download','paid_download','stream_only'));

alter table public.orders
  add column if not exists platform_fee_amount numeric(12,2) not null default 0,
  add column if not exists seller_amount numeric(12,2) not null default 0;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  content_type text not null check (content_type in ('audio','video','software')),
  cover_path text,
  preview_path text,
  original_path text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'USD',
  access_mode text not null check (access_mode in ('free_download','paid_download','stream_only')),
  download_enabled boolean not null default true,
  genre text,
  tags text[] not null default '{}',
  status text not null default 'published' check (status in ('draft','published','archived','removed')),
  view_count integer not null default 0 check (view_count >= 0),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  share_count integer not null default 0 check (share_count >= 0),
  download_count integer not null default 0 check (download_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists content_items_discovery_idx on public.content_items (status, created_at desc);
create index if not exists content_items_seller_idx on public.content_items (seller_id, updated_at desc);

create table if not exists public.content_likes (
  content_id uuid not null references public.content_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, user_id)
);
create table if not exists public.content_bookmarks (
  content_id uuid not null references public.content_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, user_id)
);
create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.content_comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.content_shares (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  channel text not null default 'copy_link',
  created_at timestamptz not null default now()
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  content_id uuid references public.content_items(id) on delete set null,
  media_path text,
  media_type text check (media_type in ('image','audio','video')),
  link_url text,
  status text not null default 'published' check (status in ('draft','published','removed')),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_posts_has_content check (coalesce(length(trim(body)),0) > 0 or media_path is not null or link_url is not null or content_id is not null)
);
create index if not exists social_posts_feed_idx on public.social_posts (status, created_at desc);
create table if not exists public.social_post_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.social_post_bookmarks (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.social_post_comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.social_reposts (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.social_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);
create table if not exists public.social_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table if not exists public.social_mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

alter table public.reports
  add column if not exists reported_content_id uuid references public.content_items(id) on delete set null,
  add column if not exists reported_post_id uuid references public.social_posts(id) on delete set null;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  product_type text not null check (product_type in ('physical','digital','service')),
  title text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'USD',
  stock integer check (stock is null or stock >= 0),
  location text,
  delivery_information text,
  file_path text,
  status text not null default 'published' check (status in ('draft','published','archived','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.product_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','payment_submitted','payment_verified','fulfilled','cancelled','rejected')),
  payment_method text,
  payment_reference text,
  delivery_status text not null default 'not_started' check (delivery_status in ('not_started','processing','shipped','delivered','digital_ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  objective text not null default 'profile',
  budget numeric(12,2) not null default 0 check (budget >= 0),
  currency text not null default 'USD',
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','rejected','paused','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  headline text not null,
  body text,
  image_path text,
  target_url text,
  promoted_product_id uuid references public.products(id) on delete set null,
  promoted_content_id uuid references public.content_items(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid not null references public.ad_creatives(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('impression','click')),
  created_at timestamptz not null default now()
);

create or replace view public.seller_earnings as
select
  o.seller_id,
  o.id as order_id,
  o.beat_id,
  o.amount,
  coalesce(o.platform_fee_amount, 0) as platform_fee_amount,
  greatest(o.amount - coalesce(o.platform_fee_amount, 0), 0) as seller_amount,
  o.currency,
  o.status,
  o.verified_at,
  o.created_at
from public.orders o
where o.status in ('payment_verified','delivered');

-- Ownership and visibility policies.
alter table public.content_items enable row level security;
alter table public.content_likes enable row level security;
alter table public.content_bookmarks enable row level security;
alter table public.content_comments enable row level security;
alter table public.content_shares enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_likes enable row level security;
alter table public.social_post_bookmarks enable row level security;
alter table public.social_post_comments enable row level security;
alter table public.social_reposts enable row level security;
alter table public.social_friend_requests enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_mutes enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_orders enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_events enable row level security;

create policy "BeatBox published content is public" on public.content_items for select using (status = 'published' or seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox sellers create content" on public.content_items for insert to authenticated with check (seller_id = auth.uid() and public.is_beatbox_seller());
create policy "BeatBox sellers update content" on public.content_items for update using (seller_id = auth.uid() or public.is_beatbox_admin()) with check (seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox sellers delete content" on public.content_items for delete using (seller_id = auth.uid() or public.is_beatbox_admin());

create policy "BeatBox users read content likes" on public.content_likes for select using (true);
create policy "BeatBox users create own content likes" on public.content_likes for insert to authenticated with check (user_id = auth.uid());
create policy "BeatBox users delete own content likes" on public.content_likes for delete using (user_id = auth.uid());
create policy "BeatBox users read content bookmarks" on public.content_bookmarks for select using (user_id = auth.uid());
create policy "BeatBox users create own content bookmarks" on public.content_bookmarks for insert to authenticated with check (user_id = auth.uid());
create policy "BeatBox users delete own content bookmarks" on public.content_bookmarks for delete using (user_id = auth.uid());
create policy "BeatBox users read content comments" on public.content_comments for select using (true);
create policy "BeatBox users create own content comments" on public.content_comments for insert to authenticated with check (user_id = auth.uid());
create policy "BeatBox users update own content comments" on public.content_comments for update using (user_id = auth.uid() or public.is_beatbox_admin()) with check (user_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox users delete own content comments" on public.content_comments for delete using (user_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox users create content shares" on public.content_shares for insert to authenticated with check (user_id = auth.uid() or user_id is null);
create policy "BeatBox users read content shares" on public.content_shares for select using (true);

create policy "BeatBox published posts are public" on public.social_posts for select using (status = 'published' or author_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox users create own posts" on public.social_posts for insert to authenticated with check (author_id = auth.uid());
create policy "BeatBox users update own posts" on public.social_posts for update using (author_id = auth.uid() or public.is_beatbox_admin()) with check (author_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox users delete own posts" on public.social_posts for delete using (author_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox users read post likes" on public.social_post_likes for select using (true);
create policy "BeatBox users create own post likes" on public.social_post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "BeatBox users delete own post likes" on public.social_post_likes for delete using (user_id = auth.uid());
create policy "BeatBox users read post bookmarks" on public.social_post_bookmarks for select using (user_id = auth.uid());
create policy "BeatBox users create own post bookmarks" on public.social_post_bookmarks for insert to authenticated with check (user_id = auth.uid());
create policy "BeatBox users delete own post bookmarks" on public.social_post_bookmarks for delete using (user_id = auth.uid());
create policy "BeatBox users read post comments" on public.social_post_comments for select using (true);
create policy "BeatBox users create own post comments" on public.social_post_comments for insert to authenticated with check (user_id = auth.uid());
create policy "BeatBox users delete own post comments" on public.social_post_comments for delete using (user_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox users read reposts" on public.social_reposts for select using (true);
create policy "BeatBox users create own reposts" on public.social_reposts for insert to authenticated with check (user_id = auth.uid());
create policy "BeatBox users delete own reposts" on public.social_reposts for delete using (user_id = auth.uid());
create policy "BeatBox users manage own friend requests" on public.social_friend_requests for all to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid()) with check (sender_id = auth.uid());
create policy "BeatBox users manage own blocks" on public.social_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid() and blocked_id <> auth.uid());
create policy "BeatBox users manage own mutes" on public.social_mutes for all to authenticated using (muter_id = auth.uid()) with check (muter_id = auth.uid() and muted_id <> auth.uid());

create policy "BeatBox published products are public" on public.products for select using (status = 'published' or seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox sellers create products" on public.products for insert to authenticated with check (seller_id = auth.uid() and public.is_beatbox_seller());
create policy "BeatBox sellers update products" on public.products for update using (seller_id = auth.uid() or public.is_beatbox_admin()) with check (seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox sellers delete products" on public.products for delete using (seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox product images are public for published products" on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'published' or p.seller_id = auth.uid() or public.is_beatbox_admin())));
create policy "BeatBox sellers manage product images" on public.product_images for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and (p.seller_id = auth.uid() or public.is_beatbox_admin()))) with check (exists (select 1 from public.products p where p.id = product_id and (p.seller_id = auth.uid() or public.is_beatbox_admin())));
create policy "BeatBox parties view product orders" on public.product_orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox buyers create product orders" on public.product_orders for insert to authenticated with check (buyer_id = auth.uid());
create policy "BeatBox sellers review product orders" on public.product_orders for update using (seller_id = auth.uid() or public.is_beatbox_admin()) with check (seller_id = auth.uid() or public.is_beatbox_admin());

create policy "BeatBox advertisers manage campaigns" on public.ad_campaigns for all to authenticated using (advertiser_id = auth.uid() or public.is_beatbox_admin()) with check (advertiser_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox advertisers manage creatives" on public.ad_creatives for all to authenticated using (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and (c.advertiser_id = auth.uid() or public.is_beatbox_admin()))) with check (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and (c.advertiser_id = auth.uid() or public.is_beatbox_admin())));
create policy "BeatBox approved creatives are public" on public.ad_creatives for select using (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and (c.status = 'approved' or c.advertiser_id = auth.uid() or public.is_beatbox_admin())));
create policy "BeatBox admins manage ad events" on public.ad_events for select using (public.is_beatbox_admin());
create policy "BeatBox users record ad events" on public.ad_events for insert to authenticated with check (viewer_id = auth.uid() or viewer_id is null);

-- Extend seller-owned buyer-visible payment metadata without changing existing rows.
drop policy if exists "BeatBox buyers view payment instructions on orders" on public.seller_payment_methods;
create policy "BeatBox buyers view seller payment instructions on orders" on public.seller_payment_methods for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.seller_id = seller_payment_methods.seller_id
      and (o.buyer_id = auth.uid() or public.is_beatbox_admin())
      and o.status in ('pending','payment_submitted','under_review','payment_verified','delivered')
  )
);

-- Private generic content buckets; public previews remain controlled by the application via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('content-covers', 'content-covers', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('content-previews', 'content-previews', false, 524288000, array['audio/mpeg','audio/wav','audio/mp4','audio/aac','video/mp4','video/webm']),
  ('content-masters', 'content-masters', false, 2147483648, array['audio/mpeg','audio/wav','audio/flac','audio/mp4','video/mp4','video/webm','application/zip','application/vnd.android.package-archive','application/octet-stream'])
on conflict (id) do nothing;

create policy "BeatBox sellers manage content covers" on storage.objects for all to authenticated using (bucket_id = 'content-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller()) with check (bucket_id = 'content-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller());
create policy "BeatBox sellers manage content previews" on storage.objects for all to authenticated using (bucket_id = 'content-previews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller()) with check (bucket_id = 'content-previews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller());
create policy "BeatBox sellers manage content masters" on storage.objects for all to authenticated using (bucket_id = 'content-masters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller()) with check (bucket_id = 'content-masters' and (storage.foldername(name))[1] = auth.uid()::text and public.is_beatbox_seller());

revoke all on public.seller_earnings from anon;
grant select on public.seller_earnings to authenticated;


-- ===== 20260812_beatbox_feed_gallery.sql =====
alter table public.social_posts add column if not exists media_gallery jsonb not null default '[]'::jsonb;
create index if not exists social_posts_media_gallery_gin on public.social_posts using gin (media_gallery);
comment on column public.social_posts.media_gallery is 'Public Feed attachment metadata only; never contains private marketplace masters.';


-- ===== 20260812_beatbox_media_social_upgrade.sql =====
-- BeatBox media-first social upgrade: additive tables only.
-- Public social media remains separate from private marketplace masters and proofs.

create table if not exists public.social_post_comment_likes (
  comment_id uuid not null references public.social_post_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.social_post_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  mentioned_by uuid not null references auth.users(id) on delete cascade,
  comment_id uuid references public.social_post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, mentioned_user_id, comment_id)
);

create table if not exists public.social_hashtags (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.social_post_hashtags (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  hashtag_id uuid not null references public.social_hashtags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, hashtag_id)
);

create table if not exists public.social_reels (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.social_posts(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  caption text,
  duration_seconds numeric(8,2),
  status text not null default 'published' check (status in ('draft','published','removed')),
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists social_post_mentions_user_idx on public.social_post_mentions(mentioned_user_id, created_at desc);
create index if not exists social_post_hashtags_tag_idx on public.social_post_hashtags(hashtag_id, created_at desc);
create index if not exists social_reels_creator_idx on public.social_reels(creator_id, created_at desc);
create index if not exists social_reels_published_idx on public.social_reels(status, created_at desc);

alter table public.social_post_comment_likes enable row level security;
alter table public.social_post_mentions enable row level security;
alter table public.social_hashtags enable row level security;
alter table public.social_post_hashtags enable row level security;
alter table public.social_reels enable row level security;

drop policy if exists "BeatBox users view comment likes" on public.social_post_comment_likes;
create policy "BeatBox users view comment likes" on public.social_post_comment_likes for select using (true);
drop policy if exists "BeatBox users manage own comment likes" on public.social_post_comment_likes;
create policy "BeatBox users manage own comment likes" on public.social_post_comment_likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "BeatBox users view public mentions" on public.social_post_mentions;
create policy "BeatBox users view public mentions" on public.social_post_mentions for select using (exists (select 1 from public.social_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "BeatBox users create own mentions" on public.social_post_mentions;
create policy "BeatBox users create own mentions" on public.social_post_mentions for insert to authenticated with check (mentioned_by = auth.uid());

drop policy if exists "BeatBox public hashtags" on public.social_hashtags;
create policy "BeatBox public hashtags" on public.social_hashtags for select using (true);
drop policy if exists "BeatBox authenticated hashtags" on public.social_hashtags;
create policy "BeatBox authenticated hashtags" on public.social_hashtags for insert to authenticated with check (length(trim(tag)) between 1 and 64);

drop policy if exists "BeatBox public post hashtags" on public.social_post_hashtags;
create policy "BeatBox public post hashtags" on public.social_post_hashtags for select using (exists (select 1 from public.social_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "BeatBox users manage post hashtags" on public.social_post_hashtags;
create policy "BeatBox users manage post hashtags" on public.social_post_hashtags for all to authenticated using (exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid())) with check (exists (select 1 from public.social_posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "BeatBox public reels" on public.social_reels;
create policy "BeatBox public reels" on public.social_reels for select using (status = 'published');
drop policy if exists "BeatBox creators manage own reels" on public.social_reels;
create policy "BeatBox creators manage own reels" on public.social_reels for all to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());

-- Reels are always public social media posts; this does not grant access to content_items.original_path.
comment on table public.social_reels is 'Short-form public social posts. Never store or expose paid marketplace masters here.';


-- ===== 20260812_beatbox_platform_expansion.sql =====
-- BeatBox platform expansion: additive only; preserves existing marketplace/social tables and RLS.

alter table public.profiles
  add column if not exists cover_url text,
  add column if not exists website_url text,
  add column if not exists location text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists profession text,
  add column if not exists education text,
  add column if not exists interests text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists privacy_settings jsonb not null default '{}'::jsonb,
  add column if not exists contact_preferences jsonb not null default '{}'::jsonb,
  add column if not exists date_of_birth date,
  add column if not exists gender text;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  attachment_path text,
  attachment_type text,
  reply_to_id uuid references public.messages(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_body_or_attachment check (nullif(trim(body), '') is not null or attachment_path is not null)
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','haha','wow','sad','angry')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.creator_analytics_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('profile_view','beat_play','content_play','product_view')),
  content_id uuid,
  viewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_username_search_idx on public.profiles (lower(username));
create index if not exists conversations_updated_idx on public.conversations (updated_at desc);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id, joined_at desc);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists analytics_creator_event_idx on public.creator_analytics_events (creator_id, event_type, created_at desc);
create index if not exists moderation_audit_created_idx on public.moderation_audit_logs (created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.creator_analytics_events enable row level security;
alter table public.moderation_audit_logs enable row level security;

create policy conversations_member_select on public.conversations for select using (exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid()));
create policy conversations_member_insert on public.conversations for insert with check (auth.uid() is not null);
create policy conversation_members_self_select on public.conversation_members for select using (user_id = auth.uid() or exists (select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy conversation_members_self_insert on public.conversation_members for insert with check (user_id = auth.uid() or exists (select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy messages_member_select on public.messages for select using (exists (select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy messages_member_insert on public.messages for insert with check (sender_id = auth.uid() and exists (select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy messages_sender_update on public.messages for update using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy message_reactions_member_all on public.message_reactions for all using (user_id = auth.uid() and exists (select 1 from public.messages msg join public.conversation_members m on m.conversation_id = msg.conversation_id where msg.id = message_id and m.user_id = auth.uid())) with check (user_id = auth.uid());
create policy analytics_public_insert on public.creator_analytics_events for insert with check (auth.uid() is not null or viewer_id is null);
create policy analytics_creator_select on public.creator_analytics_events for select using (creator_id = auth.uid());
create policy moderation_admin_select on public.moderation_audit_logs for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy moderation_admin_insert on public.moderation_audit_logs for insert with check (admin_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Private message objects must be stored in a private bucket named message-media.
insert into storage.buckets (id, name, public) values ('message-media', 'message-media', false) on conflict (id) do nothing;
create policy message_media_authenticated_read on storage.objects for select using (bucket_id = 'message-media' and auth.uid() is not null);
create policy message_media_authenticated_insert on storage.objects for insert with check (bucket_id = 'message-media' and auth.uid() is not null);


-- ===== 20260812_beatbox_post_reactions.sql =====
create table if not exists public.social_post_reactions (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','haha','wow','sad','angry')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.social_post_reactions enable row level security;
create policy social_post_reactions_select on public.social_post_reactions for select using (true);
create policy social_post_reactions_insert on public.social_post_reactions for insert with check (user_id = auth.uid());
create policy social_post_reactions_update on public.social_post_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy social_post_reactions_delete on public.social_post_reactions for delete using (user_id = auth.uid());
create index if not exists social_post_reactions_post_idx on public.social_post_reactions(post_id, reaction);


-- ===== 20260812_beatbox_product_orders.sql =====
create table if not exists public.product_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','payment_submitted','under_review','payment_verified','fulfilled','cancelled')),
  buyer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_orders_buyer_idx on public.product_orders (buyer_id, created_at desc);
create index if not exists product_orders_seller_idx on public.product_orders (seller_id, created_at desc);
alter table public.product_orders enable row level security;
create policy "BeatBox product orders visible to parties" on public.product_orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_beatbox_admin());
create policy "BeatBox buyers create product orders" on public.product_orders for insert to authenticated with check (buyer_id = auth.uid());
create policy "BeatBox sellers update product orders" on public.product_orders for update using (seller_id = auth.uid() or public.is_beatbox_admin()) with check (seller_id = auth.uid() or public.is_beatbox_admin());


-- ===== 20260812_beatbox_profile_update_rpc.sql =====
-- Secure self-profile metadata update. The caller can only modify their own row.
create or replace function public.update_self_profile_metadata(
  p_display_name text default null,
  p_username text default null,
  p_bio text default null,
  p_country text default null,
  p_city text default null,
  p_location text default null,
  p_website_url text default null,
  p_profession text default null,
  p_education text default null,
  p_interests text default null,
  p_social_links jsonb default '{}'::jsonb,
  p_privacy_settings jsonb default '{}'::jsonb,
  p_contact_preferences jsonb default '{}'::jsonb
) returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.profiles
  set display_name = coalesce(p_display_name, display_name),
      username = coalesce(nullif(lower(trim(p_username)), ''), username),
      bio = coalesce(p_bio, bio),
      country = coalesce(p_country, country),
      city = coalesce(p_city, city),
      location = coalesce(p_location, location),
      website_url = coalesce(p_website_url, website_url),
      profession = coalesce(p_profession, profession),
      education = coalesce(p_education, education),
      interests = coalesce(p_interests, interests),
      social_links = coalesce(p_social_links, social_links),
      privacy_settings = coalesce(p_privacy_settings, privacy_settings),
      contact_preferences = coalesce(p_contact_preferences, contact_preferences),
      updated_at = now()
  where id = auth.uid()
  returning * into result;
  if result.id is null then raise exception 'Profile not found'; end if;
  return result;
end;
$$;
revoke all on function public.update_self_profile_metadata(text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.update_self_profile_metadata(text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb) to authenticated;


-- ===== 20260812_beatbox_public_community_media.sql =====
-- BeatBox public community media.
-- Only the social-media bucket becomes public; marketplace masters, payment proofs,
-- seller files, and administrative assets remain in their existing protected buckets.

update storage.buckets
set public = true
where id = 'social-media';

-- Keep uploads, updates, and deletes restricted to the owner's folder.
-- Public reads are served by the bucket's public URL and do not broaden write access.
drop policy if exists "BeatBox users manage own social media" on storage.objects;
create policy "BeatBox users manage own social media" on storage.objects
for all to authenticated
using (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table storage.buckets is 'BeatBox social-media is public for normal published community posts; protected marketplace buckets remain private.';

alter table public.social_posts
  alter column status set default 'published';

comment on column public.social_posts.status is 'Normal community posts publish publicly by default; draft/removed remain non-public.';

create index if not exists social_posts_public_feed_idx
  on public.social_posts (created_at desc)
  where status = 'published';

notify pgrst, 'reload schema';
notify storage, 'reload config';

-- Verification queries for operators:
-- select id, public from storage.buckets where id in ('social-media','content-masters','payment-proofs');
-- select column_default from information_schema.columns where table_schema='public' and table_name='social_posts' and column_name='status';



-- ===== 20260812_beatbox_seller_download_summary.sql =====
-- BeatBox seller download summary without exposing other buyers' download rows.

create or replace function public.get_seller_download_summary(seller_id_input uuid default auth.uid())
returns table (download_count bigint, beat_count bigint)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
begin
  if seller_id_input is distinct from auth.uid() and not public.is_beatbox_admin() then
    raise exception 'Seller download summary is owner-scoped';
  end if;
  return query
    select count(*)::bigint, count(distinct d.beat_id)::bigint
    from public.downloads d
    join public.beats b on b.id = d.beat_id
    where b.seller_id = seller_id_input;
end;
$$;

revoke all on function public.get_seller_download_summary(uuid) from public;
grant execute on function public.get_seller_download_summary(uuid) to authenticated;


-- ===== 20260812_beatbox_social_media_notifications.sql =====
-- BeatBox social media storage and activity notifications.
-- Additive and idempotent; no payment or authentication behavior is changed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media', 'social-media', false, 52428800, array['image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm'])
on conflict (id) do nothing;

drop policy if exists "BeatBox users manage own social media" on storage.objects;
create policy "BeatBox users manage own social media" on storage.objects
for all to authenticated
using (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.notify_social_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  actor_name text;
  activity_type text;
  activity_title text;
  activity_message text;
  activity_metadata jsonb;
begin
  if tg_table_name = 'social_friend_requests' then
    recipient := new.receiver_id;
    activity_type := 'friend_request';
    activity_title := 'New friend request';
    activity_message := 'A BeatBox member sent you a friend request.';
    activity_metadata := jsonb_build_object('friend_request_id', new.id, 'sender_id', new.sender_id);
  elsif tg_table_name = 'producer_follows' then
    recipient := new.producer_id;
    activity_type := 'new_follower';
    activity_title := 'New follower';
    activity_message := 'Someone followed your BeatBox creator profile.';
    activity_metadata := jsonb_build_object('follower_id', new.follower_id, 'producer_id', new.producer_id);
  elsif tg_table_name = 'social_post_likes' then
    select author_id into recipient from public.social_posts where id = new.post_id;
    activity_type := 'post_like';
    activity_title := 'Your post received a like';
    activity_message := 'Someone liked your BeatBox community post.';
    activity_metadata := jsonb_build_object('post_id', new.post_id, 'user_id', new.user_id);
  elsif tg_table_name = 'social_post_comments' then
    select author_id into recipient from public.social_posts where id = new.post_id;
    activity_type := 'post_comment';
    activity_title := 'New comment on your post';
    activity_message := 'Someone commented on your BeatBox community post.';
    activity_metadata := jsonb_build_object('post_id', new.post_id, 'comment_id', new.id);
  elsif tg_table_name = 'social_reposts' then
    select author_id into recipient from public.social_posts where id = new.post_id;
    activity_type := 'post_repost';
    activity_title := 'Your post was reposted';
    activity_message := 'Someone reposted your BeatBox community post.';
    activity_metadata := jsonb_build_object('post_id', new.post_id, 'user_id', new.user_id);
  end if;
  if recipient is not null and recipient <> auth.uid() then
    insert into public.notifications (user_id, type, title, message, metadata)
    values (recipient, activity_type, activity_title, activity_message, activity_metadata);
  end if;
  return new;
end;
$$;

drop trigger if exists social_friend_request_notification on public.social_friend_requests;
create trigger social_friend_request_notification after insert on public.social_friend_requests
for each row execute function public.notify_social_activity();
drop trigger if exists producer_follow_notification on public.producer_follows;
create trigger producer_follow_notification after insert on public.producer_follows
for each row execute function public.notify_social_activity();
drop trigger if exists social_post_like_notification on public.social_post_likes;
create trigger social_post_like_notification after insert on public.social_post_likes
for each row execute function public.notify_social_activity();
drop trigger if exists social_post_comment_notification on public.social_post_comments;
create trigger social_post_comment_notification after insert on public.social_post_comments
for each row execute function public.notify_social_activity();
drop trigger if exists social_repost_notification on public.social_reposts;
create trigger social_repost_notification after insert on public.social_reposts
for each row execute function public.notify_social_activity();

grant execute on function public.notify_social_activity() to authenticated;


-- ===== 20260812_beatbox_social_post_shares_fix.sql =====
create table if not exists public.social_post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'copy',
  created_at timestamptz not null default now()
);
create index if not exists social_post_shares_post_idx on public.social_post_shares(post_id, created_at desc);
alter table public.social_post_shares enable row level security;
drop policy if exists "BeatBox public post share counts" on public.social_post_shares;
create policy "BeatBox public post share counts" on public.social_post_shares for select using (true);
drop policy if exists "BeatBox users create own post shares" on public.social_post_shares;
create policy "BeatBox users create own post shares" on public.social_post_shares for insert to authenticated with check (user_id = auth.uid());


-- ===== 20260812_beatbox_advertiser_analytics.sql =====
-- BeatBox advertiser creatives and analytics visibility.
-- Creative media remains private; ad events remain real records written by the delivery surface.

insert into storage.buckets (id, name, public)
values ('ad-creatives', 'ad-creatives', false)
on conflict (id) do nothing;

-- Supabase-managed storage.objects already has RLS enabled; project migrations may add policies without altering ownership.
drop policy if exists "BeatBox advertisers upload ad creatives" on storage.objects;
create policy "BeatBox advertisers upload ad creatives" on storage.objects for insert to authenticated with check (
  bucket_id = 'ad-creatives' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "BeatBox advertisers read ad creatives" on storage.objects;
create policy "BeatBox advertisers read ad creatives" on storage.objects for select to authenticated using (
  bucket_id = 'ad-creatives' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_beatbox_admin())
);
drop policy if exists "BeatBox advertisers update ad creatives" on storage.objects;
create policy "BeatBox advertisers update ad creatives" on storage.objects for update to authenticated using (
  bucket_id = 'ad-creatives' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_beatbox_admin())
) with check (
  bucket_id = 'ad-creatives' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_beatbox_admin())
);
drop policy if exists "BeatBox advertisers delete ad creatives" on storage.objects;
create policy "BeatBox advertisers delete ad creatives" on storage.objects for delete to authenticated using (
  bucket_id = 'ad-creatives' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_beatbox_admin())
);

-- Advertisers may inspect only events belonging to their own campaigns; admins retain full visibility.
drop policy if exists "BeatBox admins manage ad events" on public.ad_events;
create policy "BeatBox advertisers view own ad events" on public.ad_events for select to authenticated using (
  viewer_id = auth.uid() or public.is_beatbox_admin() or exists (
    select 1 from public.ad_creatives creative
    join public.ad_campaigns campaign on campaign.id = creative.campaign_id
    where creative.id = ad_events.creative_id and campaign.advertiser_id = auth.uid()
  )
);
drop policy if exists "BeatBox users record ad events" on public.ad_events;
create policy "BeatBox users record ad events" on public.ad_events for insert to authenticated with check (viewer_id = auth.uid() or viewer_id is null);


-- ===== 20260812_beatbox_admin_audit_and_report_taxonomy.sql =====
-- BeatBox additive admin audit and report taxonomy migration.
-- Apply through the owner-controlled Supabase migration path.

create table if not exists public.beatbox_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.beatbox_audit_log enable row level security;
drop policy if exists beatbox_audit_admin_read on public.beatbox_audit_log;
create policy beatbox_audit_admin_read on public.beatbox_audit_log
  for select using (public.is_beatbox_admin());

create or replace function public.log_profile_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.role is distinct from new.role) or (old.account_status is distinct from new.account_status) then
    insert into public.beatbox_audit_log(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'profile_admin_change', 'profile', new.id,
      jsonb_build_object('old_role', old.role, 'new_role', new.role,
        'old_account_status', old.account_status, 'new_account_status', new.account_status));
  end if;
  return new;
end;
$$;

drop trigger if exists beatbox_profile_admin_change_audit on public.profiles;
create trigger beatbox_profile_admin_change_audit
after update of role, account_status on public.profiles
for each row execute function public.log_profile_admin_change();

alter table public.reports
  add column if not exists subject_type text not null default 'post',
  add column if not exists subject_id uuid,
  add column if not exists moderation_note text,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz;

create index if not exists reports_subject_idx on public.reports(subject_type, subject_id);
create index if not exists beatbox_audit_log_entity_idx on public.beatbox_audit_log(entity_type, entity_id, created_at desc);

