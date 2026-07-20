-- Durable Inbox activity notifications for comments, engagement, relay activity,
-- new followers, and @mentions created during post/thread compose.

create table if not exists public.inbox_activity_events (
  id text primary key default gen_random_uuid()::text,
  recipient_user_id text not null references public.users(id) on delete cascade,
  actor_user_id text not null references public.users(id) on delete cascade,
  category varchar(16) not null
    check (category in ('comments', 'likes', 'thread', 'social')),
  action varchar(16) not null
    check (action in ('commented', 'liked', 'saved', 'continued', 'followed', 'mentioned')),
  target_kind varchar(16) not null
    check (target_kind in ('post', 'comment', 'thread', 'profile')),
  post_id text references public.posts(id) on delete cascade,
  comment_id text references public.post_comments(id) on delete cascade,
  thread_id text references public.poetry_threads(id) on delete cascade,
  title varchar(180) not null default '',
  excerpt text not null default '',
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_user_id <> actor_user_id)
);

create index if not exists inbox_activity_recipient_created_idx
  on public.inbox_activity_events (recipient_user_id, created_at desc);
create index if not exists inbox_activity_recipient_category_idx
  on public.inbox_activity_events (recipient_user_id, category, created_at desc);
create index if not exists inbox_activity_recipient_unread_idx
  on public.inbox_activity_events (recipient_user_id, category, created_at desc)
  where read_at is null;

create or replace function public.insert_inbox_activity_event(
  p_recipient_user_id text,
  p_actor_user_id text,
  p_category text,
  p_action text,
  p_target_kind text,
  p_post_id text,
  p_comment_id text,
  p_thread_id text,
  p_title text,
  p_excerpt text,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_user_id is null
     or p_actor_user_id is null
     or p_recipient_user_id = p_actor_user_id then
    return;
  end if;
  insert into public.inbox_activity_events (
    recipient_user_id, actor_user_id, category, action, target_kind,
    post_id, comment_id, thread_id, title, excerpt, dedupe_key
  ) values (
    p_recipient_user_id, p_actor_user_id, p_category, p_action, p_target_kind,
    p_post_id, p_comment_id, p_thread_id, coalesce(p_title, ''),
    coalesce(p_excerpt, ''), p_dedupe_key
  ) on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.notify_post_engagement()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_post public.posts%rowtype;
begin
  select * into target_post from public.posts where id = new.post_id;
  perform public.insert_inbox_activity_event(
    target_post.author_user_id, new.user_id, 'likes',
    case when tg_table_name = 'post_likes' then 'liked' else 'saved' end,
    'post', target_post.id, null, null, target_post.title,
    left(target_post.body, 220), tg_table_name || ':' || new.post_id || ':' || new.user_id
  );
  return new;
end;
$$;

drop trigger if exists post_likes_notify_inbox on public.post_likes;
create trigger post_likes_notify_inbox after insert on public.post_likes
for each row execute function public.notify_post_engagement();
drop trigger if exists post_saves_notify_inbox on public.post_saves;
create trigger post_saves_notify_inbox after insert on public.post_saves
for each row execute function public.notify_post_engagement();

create or replace function public.notify_comment_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_post public.posts%rowtype;
declare parent_comment public.post_comments%rowtype;
begin
  select * into target_post from public.posts where id = new.post_id;
  perform public.insert_inbox_activity_event(
    target_post.author_user_id, new.author_user_id, 'comments', 'commented',
    'post', target_post.id, new.id, null, target_post.title,
    left(new.body, 220), 'commented:post:' || new.id
  );
  if new.parent_comment_id is not null then
    select * into parent_comment
    from public.post_comments
    where id = new.parent_comment_id;
    if parent_comment.author_user_id is distinct from target_post.author_user_id then
      perform public.insert_inbox_activity_event(
        parent_comment.author_user_id, new.author_user_id, 'comments', 'commented',
        'comment', target_post.id, new.id, null, target_post.title,
        left(new.body, 220), 'commented:reply:' || new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists post_comments_notify_inbox on public.post_comments;
create trigger post_comments_notify_inbox after insert on public.post_comments
for each row execute function public.notify_comment_activity();

create or replace function public.notify_comment_engagement()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_comment public.post_comments%rowtype;
declare target_post public.posts%rowtype;
begin
  select * into target_comment from public.post_comments where id = new.comment_id;
  select * into target_post from public.posts where id = target_comment.post_id;
  perform public.insert_inbox_activity_event(
    target_comment.author_user_id, new.user_id, 'likes', new.kind,
    'comment', target_post.id, target_comment.id, null, target_post.title,
    left(target_comment.body, 220), 'comment-' || new.kind || ':' || new.comment_id || ':' || new.user_id
  );
  return new;
end;
$$;

drop trigger if exists post_comment_engagements_notify_inbox on public.post_comment_engagements;
create trigger post_comment_engagements_notify_inbox after insert on public.post_comment_engagements
for each row execute function public.notify_comment_engagement();

create or replace function public.notify_thread_engagement()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_thread public.poetry_threads%rowtype;
begin
  select * into target_thread from public.poetry_threads where id = new.thread_id;
  perform public.insert_inbox_activity_event(
    target_thread.author_user_id, new.user_id, 'likes',
    case when tg_table_name = 'thread_likes' then 'liked' else 'saved' end,
    'thread', null, null, target_thread.id,
    coalesce(target_thread.title, 'Untitled poem relay'), left(target_thread.starting_content, 220),
    tg_table_name || ':' || new.thread_id || ':' || new.user_id
  );
  return new;
end;
$$;

drop trigger if exists thread_likes_notify_inbox on public.thread_likes;
create trigger thread_likes_notify_inbox after insert on public.thread_likes
for each row execute function public.notify_thread_engagement();
drop trigger if exists thread_saves_notify_inbox on public.thread_saves;
create trigger thread_saves_notify_inbox after insert on public.thread_saves
for each row execute function public.notify_thread_engagement();

create or replace function public.notify_thread_continuation_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_continuation public.thread_continuations%rowtype;
declare target_thread public.poetry_threads%rowtype;
begin
  select * into target_continuation
  from public.thread_continuations
  where id = new.continuation_id;
  select * into target_thread
  from public.poetry_threads
  where id = target_continuation.thread_id;
  perform public.insert_inbox_activity_event(
    target_continuation.author_user_id, new.user_id, 'likes', 'liked',
    'thread', null, null, target_thread.id,
    coalesce(target_thread.title, 'Untitled poem relay'), left(target_continuation.content, 220),
    'thread_continuation_likes:' || new.continuation_id || ':' || new.user_id
  );
  return new;
end;
$$;

drop trigger if exists thread_continuation_likes_notify_inbox on public.thread_continuation_likes;
create trigger thread_continuation_likes_notify_inbox after insert on public.thread_continuation_likes
for each row execute function public.notify_thread_continuation_like();

create or replace function public.notify_thread_continuation()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_thread public.poetry_threads%rowtype;
begin
  select * into target_thread from public.poetry_threads where id = new.thread_id;
  perform public.insert_inbox_activity_event(
    target_thread.author_user_id, new.author_user_id, 'thread', 'continued',
    'thread', null, null, target_thread.id,
    coalesce(target_thread.title, 'Untitled poem relay'), left(new.content, 220),
    'continued:' || new.id
  );
  return new;
end;
$$;

drop trigger if exists thread_continuations_notify_inbox on public.thread_continuations;
create trigger thread_continuations_notify_inbox after insert on public.thread_continuations
for each row execute function public.notify_thread_continuation();

create or replace function public.notify_new_follower()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.insert_inbox_activity_event(
    new.following_user_id, new.follower_user_id, 'social', 'followed',
    'profile', null, null, null, 'New follower', 'started following you',
    'followed:' || new.following_user_id || ':' || new.follower_user_id
  );
  return new;
end;
$$;

drop trigger if exists user_follows_notify_inbox on public.user_follows;
create trigger user_follows_notify_inbox after insert on public.user_follows
for each row execute function public.notify_new_follower();

create or replace function public.notify_post_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare mentioned_handle text;
declare mentioned_user_id text;
begin
  foreach mentioned_handle in array coalesce(new.mentions, '{}') loop
    select id into mentioned_user_id
    from public.users
    where lower(handle) = lower(trim(leading '@' from mentioned_handle))
    limit 1;
    if mentioned_user_id is not null then
      perform public.insert_inbox_activity_event(
        mentioned_user_id, new.author_user_id, 'social', 'mentioned', 'post',
        new.id, null, null,
        coalesce(new.title, 'Untitled post'), left(new.body, 220),
        'mention:post:' || new.id || ':' || mentioned_user_id
      );
    end if;
    mentioned_user_id := null;
  end loop;
  return new;
end;
$$;

create or replace function public.notify_thread_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare mentioned_handle text;
declare mentioned_user_id text;
begin
  foreach mentioned_handle in array coalesce(new.mentions, '{}') loop
    select id into mentioned_user_id
    from public.users
    where lower(handle) = lower(trim(leading '@' from mentioned_handle))
    limit 1;
    if mentioned_user_id is not null then
      perform public.insert_inbox_activity_event(
        mentioned_user_id, new.author_user_id, 'social', 'mentioned', 'thread',
        null, null, new.id,
        coalesce(new.title, 'Untitled poem relay'), left(new.starting_content, 220),
        'mention:thread:' || new.id || ':' || mentioned_user_id
      );
    end if;
    mentioned_user_id := null;
  end loop;
  return new;
end;
$$;

drop trigger if exists posts_mentions_notify_inbox on public.posts;
create trigger posts_mentions_notify_inbox
after insert or update of mentions, status on public.posts
for each row when (new.status = 'published') execute function public.notify_post_mentions();
drop trigger if exists poetry_threads_mentions_notify_inbox on public.poetry_threads;
create trigger poetry_threads_mentions_notify_inbox
after insert or update of mentions on public.poetry_threads
for each row execute function public.notify_thread_mentions();

-- All notification creation is internal to trusted table triggers. In
-- particular, authenticated clients must not be able to call the definer
-- helper with forged recipient or actor IDs through PostgREST RPC.
revoke execute on function public.insert_inbox_activity_event(
  text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke execute on function public.notify_post_engagement()
  from public, anon, authenticated;
revoke execute on function public.notify_comment_activity()
  from public, anon, authenticated;
revoke execute on function public.notify_comment_engagement()
  from public, anon, authenticated;
revoke execute on function public.notify_thread_engagement()
  from public, anon, authenticated;
revoke execute on function public.notify_thread_continuation_like()
  from public, anon, authenticated;
revoke execute on function public.notify_thread_continuation()
  from public, anon, authenticated;
revoke execute on function public.notify_new_follower()
  from public, anon, authenticated;
revoke execute on function public.notify_post_mentions()
  from public, anon, authenticated;
revoke execute on function public.notify_thread_mentions()
  from public, anon, authenticated;

alter table public.inbox_activity_events enable row level security;
drop policy if exists "users read own inbox activity" on public.inbox_activity_events;
create policy "users read own inbox activity"
on public.inbox_activity_events for select to authenticated
using (recipient_user_id = public.current_linespace_user_id());
drop policy if exists "users mark own inbox activity" on public.inbox_activity_events;
create policy "users mark own inbox activity"
on public.inbox_activity_events for update to authenticated
using (recipient_user_id = public.current_linespace_user_id())
with check (recipient_user_id = public.current_linespace_user_id());

revoke insert, update, delete on public.inbox_activity_events from anon, authenticated;
grant select on public.inbox_activity_events to authenticated;
grant update (read_at) on public.inbox_activity_events to authenticated;
