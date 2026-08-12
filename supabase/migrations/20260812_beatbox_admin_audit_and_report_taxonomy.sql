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
