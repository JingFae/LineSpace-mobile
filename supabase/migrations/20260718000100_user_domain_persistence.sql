-- Persist the profile and relationship domain behind the existing Auth identity
-- mapping. This migration deliberately does not change posts, poems, comments,
-- reactions, or Feed persistence.

do $$
declare
  required_table text;
begin
  if to_regclass('public.users') is null then
    raise exception 'public.users must exist before the user domain migration';
  end if;
  foreach required_table in array array[
    'public.user_profile_stats',
    'public.user_profile_visibility',
    'public.badges',
    'public.user_badges',
    'public.user_follows',
    'public.inbox_messages'
  ] loop
    if to_regclass(required_table) is null then
      raise exception
        'required user-domain table % is missing; apply the earlier profile/inbox migrations first',
        required_table;
    end if;
  end loop;
end;
$$;

do $$
declare
  required_column text;
begin
  foreach required_column in array array[
    'id',
    'auth_user_id',
    'linespace_id',
    'handle',
    'display_name',
    'avatar_url',
    'avatar_color',
    'bio',
    'level',
    'created_at',
    'updated_at'
  ] loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'users'
        and column_name = required_column
    ) then
      raise exception
        'public.users.% is missing; apply the profile schema before this migration',
        required_column;
    end if;
  end loop;
end;
$$;

insert into public.user_profile_stats (user_id)
select id from public.users
on conflict (user_id) do nothing;

insert into public.user_profile_visibility (user_id)
select id from public.users
on conflict (user_id) do nothing;

do $$
begin
  if exists (
    select 1
    from public.users
    where char_length(handle) not between 3 and 32
       or handle <> lower(handle)
       or handle !~ '^[a-z0-9][a-z0-9._-]*$'
       or char_length(display_name) not between 1 and 120
       or (bio is not null and char_length(bio) > 280)
       or level < 1
  ) then
    raise exception
      'existing public.users rows violate profile constraints; repair handle/display_name/bio/level before applying 202607180001';
  end if;

  if exists (
    select 1
    from public.users
    group by lower(handle)
    having count(*) > 1
  ) then
    raise exception
      'existing public.users rows contain case-insensitive duplicate handles; repair them before applying 202607180001';
  end if;
end;
$$;

create unique index if not exists users_linespace_id_unique_idx
  on public.users (linespace_id);

create unique index if not exists users_auth_user_id_unique_idx
  on public.users (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists users_handle_case_insensitive_idx
  on public.users (lower(handle));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_display_name_length_check'
  ) then
    alter table public.users add constraint users_display_name_length_check
      check (char_length(display_name) between 1 and 120);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_bio_length_check'
  ) then
    alter table public.users add constraint users_bio_length_check
      check (bio is null or char_length(bio) <= 280);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_level_positive_check'
  ) then
    alter table public.users add constraint users_level_positive_check
      check (level >= 1);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_handle_length_check'
  ) then
    alter table public.users add constraint users_handle_length_check
      check (char_length(handle) between 3 and 32);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_handle_normalized_check'
  ) then
    alter table public.users add constraint users_handle_normalized_check
      check (handle = lower(handle) and handle ~ '^[a-z0-9][a-z0-9._-]*$');
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
      and conkey = array[
        (select attnum
         from pg_attribute
         where attrelid = 'public.users'::regclass
           and attname = 'auth_user_id'
           and not attisdropped)
      ]::smallint[]
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

create or replace function public.touch_users_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
before update of display_name, avatar_url, avatar_color, bio on public.users
for each row execute function public.touch_users_updated_at();

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
grant update (display_name, avatar_url, avatar_color, bio)
on public.users to authenticated;

create index if not exists user_follows_follower_created_idx
  on public.user_follows (follower_user_id, created_at desc);

create index if not exists user_follows_following_created_idx
  on public.user_follows (following_user_id, created_at desc);

create index if not exists inbox_messages_sender_created_idx
  on public.inbox_messages (sender_user_id, created_at desc);

create index if not exists inbox_messages_recipient_created_idx
  on public.inbox_messages (recipient_user_id, created_at desc);

create or replace function public.current_linespace_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = (select auth.uid())
  limit 1;
$$;

revoke execute on function public.current_linespace_user_id() from public, anon;
grant execute on function public.current_linespace_user_id() to authenticated;

create or replace function public.update_my_profile(
  p_display_name text default null,
  p_avatar_url text default null,
  p_avatar_color text default null,
  p_bio text default null,
  p_visibility jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated LineSpace profile is required';
  end if;

  if p_visibility is not null and jsonb_typeof(p_visibility) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'profile visibility must be an object';
  end if;

  if p_visibility is not null and exists (
    select 1
    from jsonb_object_keys(p_visibility) as key
    where key not in ('posts', 'threads', 'comments', 'saves')
  ) then
    raise exception using
      errcode = '22023',
      message = 'profile visibility contains an unknown field';
  end if;

  if p_visibility is not null and exists (
    select 1
    from jsonb_each(p_visibility) as item(key, value)
    where jsonb_typeof(item.value) <> 'boolean'
  ) then
    raise exception using
      errcode = '22023',
      message = 'profile visibility values must be boolean';
  end if;

  update public.users
  set display_name = coalesce(p_display_name, display_name),
      avatar_url = coalesce(p_avatar_url, avatar_url),
      avatar_color = coalesce(p_avatar_color, avatar_color),
      bio = coalesce(p_bio, bio)
  where id = actor_id;

  if p_visibility is not null then
    insert into public.user_profile_visibility (
      user_id,
      posts_public,
      threads_public,
      comments_public,
      saves_public
    )
    values (
      actor_id,
      coalesce((p_visibility ->> 'posts')::boolean, true),
      coalesce((p_visibility ->> 'threads')::boolean, true),
      coalesce((p_visibility ->> 'comments')::boolean, true),
      coalesce((p_visibility ->> 'saves')::boolean, true)
    )
    on conflict (user_id) do update
    set posts_public = case
          when p_visibility ? 'posts' then excluded.posts_public
          else user_profile_visibility.posts_public
        end,
        threads_public = case
          when p_visibility ? 'threads' then excluded.threads_public
          else user_profile_visibility.threads_public
        end,
        comments_public = case
          when p_visibility ? 'comments' then excluded.comments_public
          else user_profile_visibility.comments_public
        end,
        saves_public = case
          when p_visibility ? 'saves' then excluded.saves_public
          else user_profile_visibility.saves_public
        end,
        updated_at = now();
  end if;
end;
$$;

revoke execute on function public.update_my_profile(text, text, text, text, jsonb)
from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, jsonb)
to authenticated;

-- Counter triggers must be able to maintain protected aggregate rows while
-- normal clients have no direct write privilege on those rows.
create or replace function public.ensure_user_profile_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.ensure_user_profile_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile_visibility (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_follow_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  follower_id text := case when tg_op = 'INSERT' then new.follower_user_id else old.follower_user_id end;
  following_id text := case when tg_op = 'INSERT' then new.following_user_id else old.following_user_id end;
begin
  update public.user_profile_stats
  set following_count = greatest(0, following_count + delta), updated_at = now()
  where user_id = follower_id;

  update public.user_profile_stats
  set followers_count = greatest(0, followers_count + delta), updated_at = now()
  where user_id = following_id;

  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

alter table public.user_profile_stats enable row level security;
drop policy if exists "public profile stats are readable" on public.user_profile_stats;
create policy "public profile stats are readable"
on public.user_profile_stats for select
to anon, authenticated
using (true);

revoke all privileges on table public.user_profile_stats from anon, authenticated;
grant select (
  user_id,
  followers_count,
  following_count,
  likes_received_count,
  saves_received_count,
  posts_count,
  comments_count,
  threads_count,
  saves_count,
  updated_at
) on public.user_profile_stats to anon, authenticated;

alter table public.user_profile_visibility enable row level security;
drop policy if exists "public profile visibility is readable" on public.user_profile_visibility;
create policy "public profile visibility is readable"
on public.user_profile_visibility for select
to anon, authenticated
using (true);

drop policy if exists "users create their own profile visibility" on public.user_profile_visibility;
create policy "users create their own profile visibility"
on public.user_profile_visibility for insert
to authenticated
with check (public.current_linespace_user_id() = user_id);

drop policy if exists "users update their own profile visibility" on public.user_profile_visibility;
create policy "users update their own profile visibility"
on public.user_profile_visibility for update
to authenticated
using (public.current_linespace_user_id() = user_id)
with check (public.current_linespace_user_id() = user_id);

revoke all privileges on table public.user_profile_visibility from anon, authenticated;
grant select (
  user_id,
  posts_public,
  threads_public,
  comments_public,
  saves_public,
  updated_at
) on public.user_profile_visibility to anon, authenticated;
grant insert (
  user_id,
  posts_public,
  threads_public,
  comments_public,
  saves_public
) on public.user_profile_visibility to authenticated;
grant update (
  posts_public,
  threads_public,
  comments_public,
  saves_public
) on public.user_profile_visibility to authenticated;

alter table public.badges enable row level security;
drop policy if exists "public badges are readable" on public.badges;
create policy "public badges are readable"
on public.badges for select
to anon, authenticated
using (true);

revoke all privileges on table public.badges from anon, authenticated;
grant select (id, label, symbol, tone) on public.badges to anon, authenticated;

alter table public.user_badges enable row level security;
drop policy if exists "public user badges are readable" on public.user_badges;
create policy "public user badges are readable"
on public.user_badges for select
to anon, authenticated
using (true);

revoke all privileges on table public.user_badges from anon, authenticated;
grant select (user_id, badge_id, display_order, awarded_at)
on public.user_badges to anon, authenticated;

alter table public.user_follows enable row level security;
drop policy if exists "public follows are readable" on public.user_follows;
create policy "public follows are readable"
on public.user_follows for select
to authenticated
using (true);

drop policy if exists "users follow as themselves" on public.user_follows;
create policy "users follow as themselves"
on public.user_follows for insert
to authenticated
with check (public.current_linespace_user_id() = follower_user_id);

drop policy if exists "users unfollow as themselves" on public.user_follows;
create policy "users unfollow as themselves"
on public.user_follows for delete
to authenticated
using (public.current_linespace_user_id() = follower_user_id);

revoke all privileges on table public.user_follows from anon, authenticated;
grant select (follower_user_id, following_user_id, created_at)
on public.user_follows to authenticated;
grant insert (follower_user_id, following_user_id)
on public.user_follows to authenticated;
grant delete on public.user_follows to authenticated;

alter table public.inbox_messages enable row level security;
drop policy if exists "users read their own inbox messages" on public.inbox_messages;
create policy "users read their own inbox messages"
on public.inbox_messages for select
to authenticated
using (
  public.current_linespace_user_id() = sender_user_id
  or public.current_linespace_user_id() = recipient_user_id
);

revoke all privileges on table public.inbox_messages from anon, authenticated;
grant select (
  id,
  sender_user_id,
  recipient_user_id,
  kind,
  text_body,
  post_id,
  created_at
) on public.inbox_messages to authenticated;

create or replace function public.search_public_users(
  p_query text,
  p_limit integer default 20,
  p_after_rank integer default null,
  p_after_handle text default null,
  p_after_id text default null
)
returns table (
  id text,
  linespace_id text,
  handle text,
  display_name text,
  avatar_url text,
  avatar_color text,
  bio text,
  sort_rank integer,
  sort_handle text,
  is_friend boolean,
  has_recent_chat boolean,
  has_more boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with actor as (
    select public.current_linespace_user_id() as id
  ),
  query_input as (
    select
      lower(trim(coalesce(p_query, ''))) as raw_query,
      replace(
        replace(
          replace(lower(trim(coalesce(p_query, ''))), '\', '\\'),
          '%',
          '\%'
        ),
        '_',
        '\_'
      ) as escaped_query
  ),
  scored as (
    select
      u.id,
      u.linespace_id,
      u.handle,
      u.display_name,
      u.avatar_url,
      u.avatar_color,
      u.bio,
      case
        when lower(u.handle) = q.raw_query then 0
        when lower(u.handle) like q.escaped_query || '%' escape '\' then 1
        when lower(u.display_name) like q.escaped_query || '%' escape '\' then 2
        else 3
      end as rank_value,
      lower(u.handle) as handle_value,
      exists (
        select 1
        from public.user_follows f1
        join public.user_follows f2
          on f2.follower_user_id = f1.following_user_id
         and f2.following_user_id = f1.follower_user_id
        where f1.follower_user_id = a.id
          and f1.following_user_id = u.id
      ) as friend_value,
      exists (
        select 1
        from public.inbox_messages m
        where (
          m.sender_user_id = a.id
          and m.recipient_user_id = u.id
        ) or (
          m.sender_user_id = u.id
          and m.recipient_user_id = a.id
        )
      ) as recent_value
    from public.users u
    cross join actor a
    cross join query_input q
    where a.id is not null
      and u.id <> a.id
      and (
        q.raw_query = ''
        or lower(u.handle) like '%' || q.escaped_query || '%' escape '\'
        or lower(u.display_name) like '%' || q.escaped_query || '%' escape '\'
      )
  ),
  filtered as (
    select *
    from scored
    where p_after_rank is null
       or rank_value > p_after_rank
       or (
         rank_value = p_after_rank
         and handle_value > coalesce(p_after_handle, '')
       )
       or (
         rank_value = p_after_rank
         and handle_value = coalesce(p_after_handle, '')
         and id > coalesce(p_after_id, '')
       )
  )
  select
    f.id,
    f.linespace_id,
    f.handle,
    f.display_name,
    f.avatar_url,
    f.avatar_color,
    f.bio,
    f.rank_value,
    f.handle_value,
    f.friend_value,
    f.recent_value,
    count(*) over () > greatest(1, least(coalesce(p_limit, 20), 50)) as has_more
  from filtered f
  order by f.rank_value, f.handle_value, f.id
  limit greatest(1, least(coalesce(p_limit, 20), 50)) + 1;
$$;

revoke execute on function public.search_public_users(text, integer, integer, text, text)
from public, anon;
grant execute on function public.search_public_users(text, integer, integer, text, text)
to authenticated;

create or replace function public.list_public_connections(
  p_target_user_id text,
  p_kind text,
  p_limit integer default 20,
  p_after_created_at timestamptz default null,
  p_after_user_id text default null
)
returns table (
  id text,
  linespace_id text,
  handle text,
  display_name text,
  avatar_url text,
  avatar_color text,
  bio text,
  is_following boolean,
  follows_you boolean,
  is_friend boolean,
  sort_created_at timestamptz,
  total_count bigint,
  has_more boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with actor as (
    select public.current_linespace_user_id() as id
  ),
  edges as (
    select
      case
        when p_kind = 'followers' then f.follower_user_id
        else f.following_user_id
      end as user_id,
      f.created_at
    from public.user_follows f
    where (
      p_kind = 'followers'
      and f.following_user_id = p_target_user_id
    ) or (
      p_kind = 'following'
      and f.follower_user_id = p_target_user_id
    )
  ),
  filtered as (
    select e.user_id, e.created_at
    from edges e
    where p_after_created_at is null
       or e.created_at < p_after_created_at
       or (
         e.created_at = p_after_created_at
         and e.user_id < coalesce(p_after_user_id, '')
       )
  )
  select
    u.id,
    u.linespace_id,
    u.handle,
    u.display_name,
    u.avatar_url,
    u.avatar_color,
    u.bio,
    exists (
      select 1
      from public.user_follows f
      cross join actor a
      where f.follower_user_id = a.id
        and f.following_user_id = u.id
    ) as is_following,
    exists (
      select 1
      from public.user_follows f
      cross join actor a
      where f.follower_user_id = u.id
        and f.following_user_id = a.id
    ) as follows_you,
    exists (
      select 1
      from public.user_follows f1
      join public.user_follows f2
        on f2.follower_user_id = f1.following_user_id
       and f2.following_user_id = f1.follower_user_id
      cross join actor a
      where f1.follower_user_id = a.id
        and f1.following_user_id = u.id
    ) as is_friend,
    f.created_at,
    count(*) over () as total_count,
    count(*) over () > greatest(1, least(coalesce(p_limit, 20), 50)) as has_more
  from filtered f
  join public.users u on u.id = f.user_id
  order by f.created_at desc, f.user_id desc
  limit greatest(1, least(coalesce(p_limit, 20), 50)) + 1;
$$;

revoke execute on function public.list_public_connections(text, text, integer, timestamptz, text)
from public, anon;
grant execute on function public.list_public_connections(text, text, integer, timestamptz, text)
to authenticated;

comment on function public.search_public_users(text, integer, integer, text, text) is
  'JWT-scoped public user search. Returns only profile fields and relationship flags.';

comment on function public.list_public_connections(text, text, integer, timestamptz, text) is
  'JWT-scoped keyset-paginated public connections.';
