-- Seller-controlled delivery marker for off-platform WhatsApp handoffs.
-- This never verifies a payment or transmits a private master file.

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
  v_current_order_status public.order_status;
begin
  if p_status not in ('under_review', 'payment_verified', 'payment_rejected', 'delivered') then
    raise exception 'Unsupported payment review status';
  end if;

  select pr.buyer_id, pr.seller_id, pr.order_id, o.status
    into v_buyer_id, v_seller_id, v_order_id, v_current_order_status
  from public.payment_requests pr
  join public.orders o on o.id = pr.order_id
  where pr.id = p_payment_request_id;

  if v_seller_id is null then
    raise exception 'Payment request not found';
  end if;

  if auth.uid() <> v_seller_id and not public.is_beatbox_admin() then
    raise exception 'Only the seller or an administrator may review this payment request';
  end if;

  if p_status = 'delivered' and v_current_order_status <> 'payment_verified' then
    raise exception 'Only a payment-verified order can be marked delivered';
  end if;

  update public.payment_requests
  set status = p_status,
      reviewed_at = now()
  where id = p_payment_request_id;

  update public.orders
  set status = p_status,
      verified_at = case when p_status = 'payment_verified' then now() else verified_at end,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      updated_at = now()
  where id = v_order_id;

  insert into public.notifications (user_id, type, title, message, metadata)
  values (
    v_buyer_id,
    'payment_status',
    case when p_status = 'delivered' then 'Order marked delivered' else 'Payment request updated' end,
    case p_status
      when 'payment_verified' then 'Your payment was verified. Your secure download is now available.'
      when 'payment_rejected' then 'Your payment request was rejected. Review the seller instructions and submit a new request if needed.'
      when 'delivered' then 'The seller marked this order delivered after their WhatsApp handoff.'
      else 'Your payment request is under review.'
    end,
    jsonb_build_object('order_id', v_order_id, 'payment_request_id', p_payment_request_id, 'status', p_status)
  );
end;
$$;

revoke execute on function public.review_payment_request(uuid, public.order_status) from public, anon;
grant execute on function public.review_payment_request(uuid, public.order_status) to authenticated;
