-- Canonical Supabase foundation for the Auth, public profile, relationship,
-- and recent-contact domains.
-- Feed, Post, Poem, Comment, Compose, and content-engagement persistence are
-- deliberately excluded from this cloud migration chain.

create table if not exists users (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  linespace_id varchar(32) not null unique,
  handle varchar(32) not null unique,
  display_name varchar(120) not null,
  avatar_url text,
  avatar_color varchar(16) not null default '#DCD8D3',
  bio varchar(280),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(handle) between 3 and 32),
  check (handle = lower(handle)),
  check (handle ~ '^[a-z0-9][a-z0-9._-]*$')
);

create unique index if not exists users_handle_case_insensitive_idx
  on users (lower(handle));

create or replace function touch_users_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on users;
create trigger users_touch_updated_at
before update of display_name, avatar_url, avatar_color, bio, level on users
for each row execute function touch_users_updated_at();

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
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table if not exists badges (
  id text primary key,
  label varchar(80) not null,
  symbol varchar(16),
  tone varchar(16) not null check (tone in ('neutral', 'warm'))
);

create table if not exists user_badges (
  user_id text not null references users(id) on delete cascade,
  badge_id text not null references badges(id) on delete cascade,
  display_order integer not null default 0,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists user_profile_stats (
  user_id text primary key references users(id) on delete cascade,
  followers_count bigint not null default 0 check (followers_count >= 0),
  following_count bigint not null default 0 check (following_count >= 0),
  likes_received_count bigint not null default 0 check (likes_received_count >= 0),
  saves_received_count bigint not null default 0 check (saves_received_count >= 0),
  posts_count bigint not null default 0 check (posts_count >= 0),
  comments_count bigint not null default 0 check (comments_count >= 0),
  threads_count bigint not null default 0 check (threads_count >= 0),
  saves_count bigint not null default 0 check (saves_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists user_follows (
  follower_user_id text not null references users(id) on delete cascade,
  following_user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, following_user_id),
  check (follower_user_id <> following_user_id)
);

create index if not exists user_follows_follower_created_idx
  on user_follows (follower_user_id, created_at desc);
create index if not exists user_follows_following_created_idx
  on user_follows (following_user_id, created_at desc);

-- The user-domain repository only needs participants and timestamps to derive
-- recent contacts. post_id stays an opaque reference until Post persistence is
-- promoted through a separately reviewed migration.
create table if not exists inbox_messages (
  id text primary key,
  sender_user_id text not null references users(id) on delete cascade,
  recipient_user_id text not null references users(id) on delete cascade,
  kind varchar(24) not null check (kind in ('text', 'shared-post')),
  text_body text,
  post_id text,
  created_at timestamptz not null default now()
);

create index if not exists inbox_messages_sender_created_idx
  on inbox_messages (sender_user_id, created_at desc);
create index if not exists inbox_messages_recipient_created_idx
  on inbox_messages (recipient_user_id, created_at desc);

create table if not exists user_profile_visibility (
  user_id text primary key references users(id) on delete cascade,
  posts_public boolean not null default true,
  threads_public boolean not null default true,
  comments_public boolean not null default true,
  saves_public boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function ensure_user_profile_stats()
returns trigger language plpgsql as $$
begin
  insert into user_profile_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists users_create_profile_stats on users;
create trigger users_create_profile_stats
after insert on users
for each row execute function ensure_user_profile_stats();

create or replace function ensure_user_profile_visibility()
returns trigger language plpgsql as $$
begin
  insert into user_profile_visibility (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists users_create_profile_visibility on users;
create trigger users_create_profile_visibility
after insert on users
for each row execute function ensure_user_profile_visibility();

create or replace function sync_follow_counters()
returns trigger language plpgsql as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  follower_id text := case when tg_op = 'INSERT' then new.follower_user_id else old.follower_user_id end;
  following_id text := case when tg_op = 'INSERT' then new.following_user_id else old.following_user_id end;
begin
  update user_profile_stats
    set following_count = greatest(0, following_count + delta), updated_at = now()
    where user_id = follower_id;
  update user_profile_stats
    set followers_count = greatest(0, followers_count + delta), updated_at = now()
    where user_id = following_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists user_follows_sync_counters on user_follows;
create trigger user_follows_sync_counters
after insert or delete on user_follows
for each row execute function sync_follow_counters();

-- API mapping:
-- followers          = user_profile_stats.followers_count
-- following          = user_profile_stats.following_count
-- likesAndSaves      = likes_received_count + saves_received_count
-- Content counters remain zero until their separately reviewed persistence
-- migrations and atomic counter triggers are promoted.
