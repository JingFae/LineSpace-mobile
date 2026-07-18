-- Adds Supabase Auth identity linkage to the canonical LineSpace profile schema.
-- The business user id remains text so existing API contracts do not need to change.
-- Apply after 20260715000000_profile_foundation.sql.

alter table public.users
  add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_auth_user_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

create unique index if not exists users_auth_user_id_idx
  on public.users (auth_user_id)
  where auth_user_id is not null;

do $$
begin
  if exists (
    select 1
    from public.users
    where handle is distinct from lower(trim(handle))
  ) then
    raise exception 'existing handles must already be normalized; repair handle values before auth migration';
  end if;

  if exists (
    select 1
    from public.users
    group by lower(trim(handle))
    having count(*) > 1
  ) then
    raise exception 'case-insensitive duplicate handles must be resolved before auth migration';
  end if;

  if exists (
    select 1
    from public.users
    where char_length(trim(handle)) not between 3 and 32
       or lower(trim(handle)) !~ '^[a-z0-9][a-z0-9._-]*$'
  ) then
    raise exception 'existing handles must satisfy the LineSpace username policy before auth migration';
  end if;
end;
$$;

create unique index if not exists users_handle_case_insensitive_idx
  on public.users (lower(handle));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_handle_length_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_handle_length_check
      check (char_length(handle) between 3 and 32);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_handle_normalized_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_handle_normalized_check
      check (handle = lower(handle) and handle ~ '^[a-z0-9][a-z0-9._-]*$');
  end if;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_handle text := lower(trim(new.raw_user_meta_data ->> 'username'));
begin
  if requested_handle is null
     or char_length(requested_handle) not between 3 and 32
     or requested_handle !~ '^[a-z0-9][a-z0-9._-]*$' then
    raise exception using
      errcode = '23514',
      message = 'invalid LineSpace username metadata';
  end if;

  insert into public.users (
    id,
    auth_user_id,
    linespace_id,
    handle,
    display_name
  ) values (
    new.id::text,
    new.id,
    left('ls_' || replace(new.id::text, '-', ''), 32),
    requested_handle,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), requested_handle), 120)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;

drop policy if exists "public profiles are readable" on public.users;
create policy "public profiles are readable"
on public.users for select
to anon, authenticated
using (true);

drop policy if exists "users update their own profile" on public.users;
create policy "users update their own profile"
on public.users for update
to authenticated
using ((select auth.uid()) = auth_user_id)
with check ((select auth.uid()) = auth_user_id);

revoke all privileges on table public.users from anon, authenticated;
grant select (
  id,
  linespace_id,
  handle,
  display_name,
  avatar_url,
  avatar_color,
  bio,
  level,
  created_at,
  updated_at
) on public.users to anon, authenticated;
grant update (display_name, avatar_url, avatar_color, bio) on public.users to authenticated;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

comment on column public.users.auth_user_id is
  'Secure mapping to auth.users.id. Email and password data remain in the Supabase auth schema.';
