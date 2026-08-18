-- BeatBox creator identity and role-aware onboarding.
-- Additive migration: preserves existing buyer/seller/admin roles and professional-mode behavior.

alter table public.profiles
  add column if not exists creator_roles text[] not null default array['listener']::text[],
  add column if not exists primary_creator_role text not null default 'listener',
  add column if not exists creator_genres text[] not null default array[]::text[],
  add column if not exists creator_onboarding_completed boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_primary_creator_role_check;
alter table public.profiles
  add constraint profiles_primary_creator_role_check
  check (primary_creator_role in ('listener', 'artist', 'producer', 'creator'));

alter table public.profiles
  drop constraint if exists profiles_creator_roles_check;
alter table public.profiles
  add constraint profiles_creator_roles_check
  check (creator_roles <@ array['listener', 'artist', 'producer', 'creator']::text[] and cardinality(creator_roles) > 0);

create index if not exists profiles_primary_creator_role_idx
  on public.profiles (primary_creator_role)
  where account_status = 'active';

create index if not exists profiles_creator_roles_gin_idx
  on public.profiles using gin (creator_roles);

create or replace function public.set_creator_identity(
  p_primary_role text,
  p_roles text[] default null,
  p_genres text[] default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_roles text[];
  normalized_genres text[];
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to update creator identity';
  end if;

  if lower(trim(coalesce(p_primary_role, ''))) not in ('listener', 'artist', 'producer', 'creator') then
    raise exception 'Unsupported BeatBox creator role';
  end if;

  select coalesce(array_agg(distinct lower(trim(role_name)) order by lower(trim(role_name))), array[]::text[])
    into normalized_roles
  from unnest(coalesce(p_roles, array[p_primary_role]::text[])) as role_name
  where lower(trim(role_name)) in ('listener', 'artist', 'producer', 'creator');

  if not (lower(trim(p_primary_role)) = any(normalized_roles)) then
    normalized_roles := array_append(normalized_roles, lower(trim(p_primary_role)));
  end if;

  select coalesce(array_agg(distinct lower(trim(genre_name)) order by lower(trim(genre_name))), array[]::text[])
    into normalized_genres
  from unnest(coalesce(p_genres, array[]::text[])) as genre_name
  where length(trim(genre_name)) between 1 and 40;

  update public.profiles
  set creator_roles = normalized_roles,
      primary_creator_role = lower(trim(p_primary_role)),
      creator_genres = normalized_genres[1:12],
      creator_onboarding_completed = true,
      professional_mode = case
        when lower(trim(p_primary_role)) in ('artist', 'producer', 'creator') then true
        else professional_mode
      end
  where id = auth.uid()
    and account_status = 'active'
  returning * into updated_profile;

  if not found then
    raise exception 'An active BeatBox profile is required';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.set_creator_identity(text, text[], text[]) from public;
grant execute on function public.set_creator_identity(text, text[], text[]) to authenticated;

comment on column public.profiles.creator_roles is
  'Self-selected BeatBox creator identities. This is additive to the platform account role and never grants admin privileges.';
comment on column public.profiles.primary_creator_role is
  'Primary public identity used by creator onboarding, discovery, and role-aware studio guidance.';
comment on column public.profiles.creator_onboarding_completed is
  'Whether the account has completed the role-aware BeatBox creator onboarding flow.';
comment on function public.set_creator_identity(text, text[], text[]) is
  'Validates and persists the authenticated user creator identity; publishing RLS remains enforced separately.';

-- Existing creator policies already use is_beatbox_creator(), which includes Professional Mode.
-- The onboarding RPC enables Professional Mode for publishing identities, without granting admin or seller database roles.

select 'creator_roles_onboarding_migration_ready' as status;

-- Apply this file to production Supabase through the project database migration workflow.
-- Do not run this comment as an application query.

