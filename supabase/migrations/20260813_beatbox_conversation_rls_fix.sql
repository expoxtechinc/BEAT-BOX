-- BeatBox conversation RLS repair
-- Fixes infinite recursion caused by conversation_members policies querying
-- conversation_members directly under row-level security.

create or replace function public.is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

drop policy if exists conversations_member_select on public.conversations;
drop policy if exists conversations_member_insert on public.conversations;
drop policy if exists conversation_members_self_select on public.conversation_members;
drop policy if exists conversation_members_self_insert on public.conversation_members;
drop policy if exists messages_member_select on public.messages;
drop policy if exists messages_member_insert on public.messages;
drop policy if exists messages_sender_update on public.messages;

create policy conversations_member_select
on public.conversations
for select
to authenticated
using (public.is_conversation_member(id, auth.uid()));

create policy conversations_member_insert
on public.conversations
for insert
to authenticated
with check (auth.uid() is not null);

create policy conversation_members_self_select
on public.conversation_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_conversation_member(conversation_id, auth.uid())
);

create policy conversation_members_self_insert
on public.conversation_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_conversation_member(conversation_id, auth.uid())
);

create policy messages_member_select
on public.messages
for select
to authenticated
using (public.is_conversation_member(conversation_id, auth.uid()));

create policy messages_member_insert
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id, auth.uid())
);

create policy messages_sender_update
on public.messages
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());
