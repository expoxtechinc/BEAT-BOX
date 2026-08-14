-- BeatBox WhatsApp contact and off-platform payment-reference workflow.
-- A submitted payment remains unverified until the seller reviews it.

alter table public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists whatsapp_public boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_whatsapp_number_format;
alter table public.profiles
  add constraint profiles_whatsapp_number_format
  check (
    whatsapp_number is null
    or whatsapp_number ~ '^\\+?[1-9][0-9]{6,14}$'
  );

alter table public.payment_requests
  add column if not exists submitted_amount numeric(12,2),
  add column if not exists payment_sent_at timestamptz,
  add column if not exists buyer_note text;

alter table public.payment_requests
  drop constraint if exists payment_requests_submitted_amount_positive;
alter table public.payment_requests
  add constraint payment_requests_submitted_amount_positive
  check (submitted_amount is null or submitted_amount > 0);

alter table public.payment_requests
  drop constraint if exists payment_requests_buyer_note_length;
alter table public.payment_requests
  add constraint payment_requests_buyer_note_length
  check (buyer_note is null or char_length(buyer_note) <= 1000);

-- Preserve existing seller contacts and make their prior public intent explicit.
update public.profiles p
set whatsapp_number = regexp_replace(sp.whatsapp, '[^0-9+]', '', 'g'),
    whatsapp_public = true
from public.seller_profiles sp
where sp.id = p.id
  and nullif(trim(coalesce(sp.whatsapp, '')), '') is not null
  and p.whatsapp_number is null;

create or replace function public.update_self_whatsapp_contact(
  p_whatsapp_number text default null,
  p_public boolean default false
)
returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contact text := nullif(regexp_replace(trim(coalesce(p_whatsapp_number, '')), '[^0-9+]', '', 'g'), '');
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_contact is not null and v_contact !~ '^\\+?[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid WhatsApp number with country code';
  end if;

  update public.profiles
  set whatsapp_number = v_contact,
      whatsapp_public = coalesce(p_public, false) and v_contact is not null,
      updated_at = now()
  where id = auth.uid()
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

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
    case when p.whatsapp_public then p.whatsapp_number else null end,
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

create or replace function public.create_payment_request_v2(
  p_beat_id uuid,
  p_method text,
  p_reference text,
  p_submitted_amount numeric,
  p_payment_sent_at timestamptz,
  p_buyer_note text default null,
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
  v_reference text := nullif(trim(coalesce(p_reference, '')), '');
  v_note text := nullif(trim(coalesce(p_buyer_note, '')), '');
begin
  if v_buyer_id is null then
    raise exception 'Authentication is required';
  end if;

  select seller_id, price
    into v_seller_id, v_amount
  from public.beats
  where id = p_beat_id
    and status = 'published'
    and coalesce(is_free, false) = false;

  if v_seller_id is null then
    raise exception 'This beat is not available for a payment request';
  end if;
  if v_seller_id = v_buyer_id then
    raise exception 'You cannot request payment for your own beat';
  end if;
  if p_method not in ('Mobile Money', 'Orange Money', 'WhatsApp') then
    raise exception 'Unsupported payment method';
  end if;
  if v_reference is null then
    raise exception 'A payment reference is required';
  end if;
  if p_submitted_amount is null or p_submitted_amount <= 0 then
    raise exception 'Enter the amount you sent';
  end if;
  if p_payment_sent_at is null or p_payment_sent_at > now() + interval '15 minutes' or p_payment_sent_at < now() - interval '90 days' then
    raise exception 'Enter a valid payment date and time';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Buyer note is too long';
  end if;

  insert into public.orders (beat_id, buyer_id, seller_id, amount, currency, payment_method, payment_reference, status)
  values (p_beat_id, v_buyer_id, v_seller_id, coalesce(v_amount, 0), 'USD', p_method, v_reference, 'payment_submitted')
  returning id into v_order_id;

  insert into public.payment_requests (
    order_id, buyer_id, seller_id, amount, method, reference, proof_url, status,
    submitted_amount, payment_sent_at, buyer_note
  ) values (
    v_order_id, v_buyer_id, v_seller_id, coalesce(v_amount, 0), p_method, v_reference, p_proof_path, 'payment_submitted',
    p_submitted_amount, p_payment_sent_at, v_note
  );

  insert into public.notifications (user_id, type, title, message, metadata)
  values (
    v_seller_id,
    'payment_request',
    'New payment request',
    'A buyer submitted a payment reference for one of your listings. Review it before delivering anything.',
    jsonb_build_object('order_id', v_order_id, 'beat_id', p_beat_id)
  );

  return v_order_id;
end;
$$;

revoke all on function public.update_self_whatsapp_contact(text, boolean) from public;
grant execute on function public.update_self_whatsapp_contact(text, boolean) to authenticated;
revoke all on function public.create_payment_request_v2(uuid, text, text, numeric, timestamptz, text, text) from public;
grant execute on function public.create_payment_request_v2(uuid, text, text, numeric, timestamptz, text, text) to authenticated;
grant execute on function public.get_public_sellers(uuid) to anon, authenticated;
