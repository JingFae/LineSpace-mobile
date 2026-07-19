-- Promote durable Post/Comment/Draft/Inbox persistence.
-- This migration is intentionally additive: previously applied migrations are
-- not rewritten, and binary media remains in Supabase Storage.

create table if not exists public.posts (
  id text primary key,
  author_user_id text not null references public.users(id) on delete cascade,
  title varchar(180) not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  mentions text[] not null default '{}',
  artwork_url text,
  media jsonb,
  layout jsonb,
  visibility varchar(16) not null default 'public'
    check (visibility in ('public', 'include', 'exclude')),
  audience_user_ids text[] not null default '{}',
  status varchar(16) not null default 'published'
    check (status in ('draft', 'published')),
  declare_original boolean not null default false,
  allow_comments boolean not null default true,
  allow_sharing boolean not null default true,
  allow_save boolean not null default true,
  started_at timestamptz not null default now(),
  edited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  comments_count bigint not null default 0 check (comments_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  shares_count bigint not null default 0 check (shares_count >= 0),
  saves_count bigint not null default 0 check (saves_count >= 0),
  check (char_length(body) <= 100000),
  check (visibility <> 'include' or cardinality(audience_user_ids) > 0)
);

create index if not exists posts_feed_created_idx
  on public.posts (status, visibility, started_at desc, id desc);
create index if not exists posts_author_created_idx
  on public.posts (author_user_id, started_at desc, id desc);
create index if not exists posts_tags_gin_idx
  on public.posts using gin (tags);

create table if not exists public.post_likes (
  post_id text not null references public.posts(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_saves (
  post_id text not null references public.posts(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_created_idx
  on public.post_likes (user_id, created_at desc);
create index if not exists post_saves_user_created_idx
  on public.post_saves (user_id, created_at desc);

create table if not exists public.post_comments (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  author_user_id text not null references public.users(id) on delete cascade,
  parent_comment_id text references public.post_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  likes_count bigint not null default 0 check (likes_count >= 0),
  saves_count bigint not null default 0 check (saves_count >= 0)
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at asc, id asc);
create index if not exists post_comments_parent_created_idx
  on public.post_comments (parent_comment_id, created_at asc);

create table if not exists public.post_comment_engagements (
  user_id text not null references public.users(id) on delete cascade,
  comment_id text not null references public.post_comments(id) on delete cascade,
  kind varchar(16) not null check (kind in ('liked', 'saved')),
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id, kind)
);

create table if not exists public.post_shares (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.posts(id) on delete cascade,
  sender_user_id text not null references public.users(id) on delete cascade,
  recipient_user_id text not null references public.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  check (sender_user_id <> recipient_user_id)
);

create index if not exists post_shares_recipient_created_idx
  on public.post_shares (recipient_user_id, created_at desc);
create index if not exists post_shares_post_created_idx
  on public.post_shares (post_id, created_at desc);

create or replace function public.current_user_can_view_post(p_post_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.status = 'published'
      and (
        p.visibility = 'public'
        or p.author_user_id = public.current_linespace_user_id()
        or (
          public.current_linespace_user_id() is not null
          and p.visibility = 'include'
          and public.current_linespace_user_id() = any(p.audience_user_ids)
        )
        or (
          public.current_linespace_user_id() is not null
          and p.visibility = 'exclude'
          and not (public.current_linespace_user_id() = any(p.audience_user_ids))
        )
      )
  );
$$;

create or replace function public.validate_post_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_post_id text;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select post_id
  into parent_post_id
  from public.post_comments
  where id = new.parent_comment_id;

  if parent_post_id is null or parent_post_id <> new.post_id then
    raise exception using
      errcode = '23514',
      message = 'Comment reply must belong to the same post.';
  end if;
  return new;
end;
$$;

drop trigger if exists post_comments_validate_parent on public.post_comments;
create trigger post_comments_validate_parent
before insert or update of post_id, parent_comment_id
on public.post_comments
for each row execute function public.validate_post_comment_parent();

create or replace function public.touch_post_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.edited_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
before update on public.posts
for each row execute function public.touch_post_updated_at();

create or replace function public.sync_post_profile_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer := 0;
  target_user text;
begin
  if tg_op = 'INSERT' and new.status = 'published' then
    delta := 1;
    target_user := new.author_user_id;
  elsif tg_op = 'DELETE' and old.status = 'published' then
    delta := -1;
    target_user := old.author_user_id;
  elsif tg_op = 'UPDATE' then
    target_user := new.author_user_id;
    if old.status <> 'published' and new.status = 'published' then
      delta := 1;
    elsif old.status = 'published' and new.status <> 'published' then
      delta := -1;
    end if;
  end if;
  if delta <> 0 then
    update public.user_profile_stats
    set posts_count = greatest(0, posts_count + delta),
        updated_at = now()
    where user_id = target_user;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists posts_sync_profile_stats on public.posts;
create trigger posts_sync_profile_stats
after insert or update of status or delete on public.posts
for each row execute function public.sync_post_profile_stats();

create or replace function public.sync_post_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target_post text;
  target_user text;
begin
  if tg_table_name = 'post_comments' then
    target_post := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
    update public.posts
    set comments_count = greatest(0, comments_count + delta), edited_at = now()
    where id = target_post;
    update public.user_profile_stats
    set comments_count = greatest(0, comments_count + delta), updated_at = now()
    where user_id = case when tg_op = 'INSERT' then new.author_user_id else old.author_user_id end;
  elsif tg_table_name = 'post_likes' then
    target_post := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
    update public.posts
    set likes_count = greatest(0, likes_count + delta), edited_at = now()
    where id = target_post;
    select author_user_id into target_user from public.posts where id = target_post;
    update public.user_profile_stats
    set likes_received_count = greatest(0, likes_received_count + delta), updated_at = now()
    where user_id = target_user;
  elsif tg_table_name = 'post_saves' then
    target_post := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
    update public.posts
    set saves_count = greatest(0, saves_count + delta), edited_at = now()
    where id = target_post;
    update public.user_profile_stats
    set saves_count = greatest(0, saves_count + delta), updated_at = now()
    where user_id = case when tg_op = 'INSERT' then new.user_id else old.user_id end;
    select author_user_id into target_user from public.posts where id = target_post;
    update public.user_profile_stats
    set saves_received_count = greatest(0, saves_received_count + delta), updated_at = now()
    where user_id = target_user;
  elsif tg_table_name = 'post_shares' then
    target_post := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
    update public.posts
    set shares_count = greatest(0, shares_count + delta), edited_at = now()
    where id = target_post;
  end if;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists post_comments_sync_counters on public.post_comments;
create trigger post_comments_sync_counters
after insert or delete on public.post_comments
for each row execute function public.sync_post_counters();

drop trigger if exists post_likes_sync_counters on public.post_likes;
create trigger post_likes_sync_counters
after insert or delete on public.post_likes
for each row execute function public.sync_post_counters();

drop trigger if exists post_saves_sync_counters on public.post_saves;
create trigger post_saves_sync_counters
after insert or delete on public.post_saves
for each row execute function public.sync_post_counters();

drop trigger if exists post_shares_sync_counters on public.post_shares;
create trigger post_shares_sync_counters
after insert or delete on public.post_shares
for each row execute function public.sync_post_counters();

-- Drafts keep structured JSON for editor settings/version lines while media
-- bytes are stored in Storage.
create table if not exists public.poem_design_templates (
  id text primary key,
  label varchar(80) not null,
  description varchar(240) not null default '',
  layout_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.poem_drafts (
  id text primary key,
  owner_user_id text not null references public.users(id) on delete cascade,
  mode varchar(16) not null check (mode in ('draft', 'relay')),
  status varchar(16) not null default 'editing'
    check (status in ('editing', 'ready', 'published')),
  title varchar(180) not null default '',
  body text not null default '',
  byline varchar(120) not null default '',
  tags text[] not null default '{}',
  mentions text[] not null default '{}',
  version_lines jsonb not null default '[]'::jsonb,
  media jsonb,
  settings jsonb not null default
    '{"declareOriginal":false,"isPublic":true,"visibility":"public","audienceUserIds":[],"allowComments":true,"allowQuotes":true,"allowSharing":true,"allowSave":true}'::jsonb,
  layout jsonb not null default
    '{"templateId":"quiet-letter","typographyId":"literary-serif","backgroundId":"letter-paper","stickerIds":[]}'::jsonb,
  version bigint not null default 1,
  published_post_id text references public.posts(id) on delete set null,
  published_thread_id text references public.poetry_threads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(body) <= 100000)
);

create index if not exists poem_drafts_owner_updated_idx
  on public.poem_drafts (owner_user_id, updated_at desc, id desc);

create table if not exists public.draft_collaborators (
  draft_id text not null references public.poem_drafts(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  role varchar(16) not null check (role in ('owner', 'editor')),
  status varchar(16) not null check (status in ('invited', 'active')),
  cursor_line integer,
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (draft_id, user_id)
);

create index if not exists draft_collaborators_user_idx
  on public.draft_collaborators (user_id, last_seen_at desc);

create table if not exists public.draft_invitations (
  id text primary key default gen_random_uuid()::text,
  draft_id text not null references public.poem_drafts(id) on delete cascade,
  inviter_user_id text not null references public.users(id) on delete cascade,
  invitee_user_id text not null references public.users(id) on delete cascade,
  status varchar(16) not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (draft_id, invitee_user_id)
);

create table if not exists public.draft_operations (
  id bigint generated by default as identity primary key,
  draft_id text not null references public.poem_drafts(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  base_version bigint not null,
  result_version bigint not null,
  operation jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists draft_operations_draft_version_idx
  on public.draft_operations (draft_id, result_version);

create or replace function public.touch_poem_draft()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists poem_drafts_touch_version on public.poem_drafts;
create trigger poem_drafts_touch_version
before update on public.poem_drafts
for each row execute function public.touch_poem_draft();

-- Storage buckets are public for published media and private for draft media.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('linespace-media', 'linespace-media', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']),
  ('linespace-drafts', 'linespace-drafts', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Fix the existing actor-override helper without rewriting its historical
-- migration. Both overloads delegate to this actor-derived implementation.
create or replace function public.current_user_is_active_inbox_group_member(
  p_group_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inbox_group_members
    where group_id = p_group_id
      and user_id = public.current_linespace_user_id()
      and status = 'active'
  );
$$;

create or replace function public.is_active_inbox_group_member(p_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_active_inbox_group_member(p_group_id);
$$;

-- Policies created by the earlier inbox migration are bound to the historical
-- two-argument function OID. Keep that signature as a safe compatibility
-- wrapper, but deliberately ignore the caller-supplied user ID.
create or replace function public.is_active_inbox_group_member(
  p_group_id text,
  p_user_id text default public.current_linespace_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_active_inbox_group_member(p_group_id);
$$;

revoke execute on function public.is_active_inbox_group_member(text, text)
from public, anon;
grant execute on function public.is_active_inbox_group_member(text, text)
to authenticated;
revoke execute on function public.is_active_inbox_group_member(text)
from public, anon;
grant execute on function public.is_active_inbox_group_member(text)
to authenticated;

-- All writes to direct/group inbox messages and share records go through
-- actor-derived RPCs below. This prevents client-supplied sender IDs.
create or replace function public.send_inbox_message(
  p_recipient_user_id text,
  p_text text default null,
  p_kind text default 'text',
  p_post_id text default null,
  p_thread_id text default null,
  p_continuation_id text default null,
  p_excerpt text default null
)
returns public.inbox_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  created public.inbox_messages;
begin
  if actor_id is null or p_recipient_user_id is null
     or actor_id = p_recipient_user_id then
    raise exception using errcode = '42501', message = 'Invalid message participants';
  end if;
  if not exists (select 1 from public.users where id = p_recipient_user_id) then
    raise exception using errcode = '23503', message = 'Recipient profile not found';
  end if;
  if p_kind = 'text' then
    if p_text is null or char_length(trim(p_text)) = 0 then
      raise exception using errcode = '22023', message = 'Message text is required';
    end if;
  elsif p_kind = 'shared-post' then
    if p_post_id is null or not public.current_user_can_view_post(p_post_id) then
      raise exception using errcode = '42501', message = 'Post cannot be shared';
    end if;
  elsif p_kind in ('shared-thread', 'shared-continuation') then
    if p_thread_id is null or not exists (
      select 1 from public.poetry_threads
      where id = p_thread_id
        and (visibility = 'public' or author_user_id = actor_id)
    ) then
      raise exception using errcode = '42501', message = 'Thread cannot be shared';
    end if;
    if p_kind = 'shared-continuation' and not exists (
      select 1 from public.thread_continuations
      where id = p_continuation_id and thread_id = p_thread_id
    ) then
      raise exception using errcode = '23503', message = 'Continuation not found';
    end if;
  else
    raise exception using errcode = '22023', message = 'Unsupported message kind';
  end if;

  insert into public.inbox_messages (
    id, sender_user_id, recipient_user_id, kind, text_body, post_id,
    thread_id, continuation_id, excerpt
  )
  values (
    gen_random_uuid()::text, actor_id, p_recipient_user_id, p_kind,
    nullif(trim(p_text), ''), p_post_id, p_thread_id, p_continuation_id,
    nullif(trim(p_excerpt), '')
  )
  returning * into created;
  return created;
end;
$$;

create or replace function public.share_post_to_inbox(
  p_post_id text,
  p_recipient_user_ids text[],
  p_note text default null
)
returns setof public.inbox_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  recipient_id text;
  created public.inbox_messages;
begin
  if actor_id is null or p_post_id is null
     or not public.current_user_can_view_post(p_post_id) then
    raise exception using errcode = '42501', message = 'Post cannot be shared';
  end if;
  foreach recipient_id in array coalesce(p_recipient_user_ids, '{}') loop
    if recipient_id is null or recipient_id = actor_id then
      raise exception using errcode = '42501', message = 'Invalid share recipient';
    end if;
    created := public.send_inbox_message(
      recipient_id, p_note, 'shared-post', p_post_id, null, null, p_note
    );
    insert into public.post_shares (
      post_id, sender_user_id, recipient_user_id, note
    )
    values (p_post_id, actor_id, recipient_id, p_note);
    return next created;
  end loop;
  return;
end;
$$;

create or replace function public.share_thread_to_inbox(
  p_thread_id text,
  p_continuation_id text,
  p_recipient_user_ids text[],
  p_note text default null
)
returns setof public.inbox_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  recipient_id text;
  created public.inbox_messages;
begin
  if actor_id is null or p_thread_id is null
     or not exists (
       select 1 from public.poetry_threads
       where id = p_thread_id
         and (visibility = 'public' or author_user_id = actor_id)
     ) then
    raise exception using errcode = '42501', message = 'Thread cannot be shared';
  end if;
  if p_continuation_id is not null and not exists (
    select 1 from public.thread_continuations
    where id = p_continuation_id and thread_id = p_thread_id
  ) then
    raise exception using errcode = '23503', message = 'Continuation not found';
  end if;
  foreach recipient_id in array coalesce(p_recipient_user_ids, '{}') loop
    if recipient_id is null or recipient_id = actor_id then
      raise exception using errcode = '42501', message = 'Invalid share recipient';
    end if;
    created := public.send_inbox_message(
      recipient_id,
      p_note,
      case when p_continuation_id is null then 'shared-thread'
           else 'shared-continuation' end,
      null,
      p_thread_id,
      p_continuation_id,
      p_note
    );
    insert into public.thread_shares (
      id, thread_id, continuation_id, sender_user_id, recipient_user_id, note
    )
    values (
      gen_random_uuid()::text, p_thread_id, p_continuation_id,
      actor_id, recipient_id, p_note
    );
    return next created;
  end loop;
  return;
end;
$$;

create or replace function public.send_inbox_group_message(
  p_group_id text,
  p_text text
)
returns public.inbox_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  created public.inbox_group_messages;
begin
  if actor_id is null or p_text is null or char_length(trim(p_text)) = 0
     or not exists (
       select 1 from public.inbox_group_members
       where group_id = p_group_id and user_id = actor_id and status = 'active'
     ) then
    raise exception using errcode = '42501', message = 'Group membership required';
  end if;
  insert into public.inbox_group_messages (
    id, group_id, sender_user_id, kind, text_body
  )
  values (gen_random_uuid()::text, p_group_id, actor_id, 'text', trim(p_text))
  returning * into created;
  return created;
end;
$$;

create or replace function public.create_inbox_group(
  p_name text,
  p_invitee_user_ids text[] default '{}'
)
returns public.inbox_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  group_row public.inbox_groups;
  invitee_id text;
begin
  if actor_id is null or p_name is null
     or char_length(trim(p_name)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Invalid group name';
  end if;
  insert into public.inbox_groups (id, name, owner_user_id)
  values (gen_random_uuid()::text, trim(p_name), actor_id)
  returning * into group_row;
  insert into public.inbox_group_members (
    group_id, user_id, role, status, invited_by_user_id, joined_at, responded_at
  )
  values (group_row.id, actor_id, 'owner', 'active', actor_id, now(), now());
  foreach invitee_id in array coalesce(p_invitee_user_ids, '{}') loop
    if invitee_id is not null and invitee_id <> actor_id then
      insert into public.inbox_group_members (
        group_id, user_id, role, status, invited_by_user_id
      )
      values (group_row.id, invitee_id, 'member', 'invited', actor_id)
      on conflict (group_id, user_id) do nothing;
    end if;
  end loop;
  return group_row;
end;
$$;

create or replace function public.invite_inbox_group_members(
  p_group_id text,
  p_invitee_user_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  invitee_id text;
begin
  if actor_id is null or not exists (
    select 1 from public.inbox_group_members
    where group_id = p_group_id and user_id = actor_id and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Group membership required';
  end if;
  foreach invitee_id in array coalesce(p_invitee_user_ids, '{}') loop
    if invitee_id is not null and invitee_id <> actor_id then
      insert into public.inbox_group_members (
        group_id, user_id, role, status, invited_by_user_id
      )
      values (p_group_id, invitee_id, 'member', 'invited', actor_id)
      on conflict (group_id, user_id) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.respond_inbox_group_invite(
  p_group_id text,
  p_accept boolean
)
returns public.inbox_group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  member_row public.inbox_group_members;
begin
  update public.inbox_group_members
  set status = case when p_accept then 'active' else 'declined' end,
      responded_at = now(),
      joined_at = case when p_accept then now() else joined_at end
  where group_id = p_group_id
    and user_id = actor_id
    and status = 'invited'
  returning * into member_row;
  if member_row.group_id is null then
    raise exception using errcode = '42501', message = 'Invitation not found';
  end if;
  return member_row;
end;
$$;

create or replace function public.apply_draft_operation(
  p_draft_id text,
  p_title text,
  p_body text,
  p_base_version bigint
)
returns public.poem_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  draft_row public.poem_drafts;
begin
  update public.poem_drafts d
  set title = coalesce(p_title, d.title),
      body = coalesce(p_body, d.body)
  where d.id = p_draft_id
    and d.version = p_base_version
    and (
      d.owner_user_id = actor_id
      or exists (
        select 1 from public.draft_collaborators c
        where c.draft_id = d.id and c.user_id = actor_id and c.status = 'active'
      )
    )
  returning d.* into draft_row;
  if draft_row.id is null then
    raise exception using errcode = '40001', message = 'Draft version conflict or access denied';
  end if;
  insert into public.draft_operations (
    draft_id, user_id, base_version, result_version, operation
  )
  values (
    p_draft_id, actor_id, p_base_version, draft_row.version,
    jsonb_build_object('title', p_title, 'body', p_body)
  );
  return draft_row;
end;
$$;

create or replace function public.publish_draft_as_post(p_draft_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  draft_row public.poem_drafts;
  post_id text := gen_random_uuid()::text;
begin
  select * into draft_row
  from public.poem_drafts
  where id = p_draft_id and owner_user_id = actor_id
    and status <> 'published'
  for update;
  if draft_row.id is null then
    raise exception using errcode = '42501', message = 'Draft access denied';
  end if;
  insert into public.posts (
    id, author_user_id, title, body, tags, mentions, media, layout,
    visibility, audience_user_ids, status, declare_original,
    allow_comments, allow_sharing, allow_save
  )
  values (
    post_id, actor_id, draft_row.title, draft_row.body, draft_row.tags,
    draft_row.mentions, draft_row.media, draft_row.layout,
    coalesce(draft_row.settings ->> 'visibility', 'public'),
    coalesce(
      array(select jsonb_array_elements_text(draft_row.settings -> 'audienceUserIds')),
      '{}'
    ),
    'published',
    coalesce((draft_row.settings ->> 'declareOriginal')::boolean, false),
    coalesce((draft_row.settings ->> 'allowComments')::boolean, true),
    coalesce((draft_row.settings ->> 'allowSharing')::boolean, true),
    coalesce((draft_row.settings ->> 'allowSave')::boolean, true)
  );
  update public.poem_drafts
  set status = 'published', published_post_id = post_id
  where id = p_draft_id;
  return post_id;
end;
$$;

create or replace function public.publish_draft_as_thread(p_draft_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  draft_row public.poem_drafts;
  thread_id text := gen_random_uuid()::text;
  line_row jsonb;
  line_index integer := 0;
  parent_id text := null;
  continuation_id text;
begin
  select * into draft_row
  from public.poem_drafts
  where id = p_draft_id and owner_user_id = actor_id
    and status <> 'published'
  for update;
  if draft_row.id is null then
    raise exception using errcode = '42501', message = 'Draft access denied';
  end if;
  insert into public.poetry_threads (
    id, author_user_id, title, prompt, starting_content, rules, tags, mentions,
    media, visibility, status
  )
  values (
    thread_id, actor_id, nullif(draft_row.title, ''), draft_row.title,
    coalesce(nullif(draft_row.body, ''), 'Untitled thread'),
    null, draft_row.tags, draft_row.mentions, draft_row.media,
    coalesce(draft_row.settings ->> 'visibility', 'public'), 'open'
  );
  for line_row in
    select value from jsonb_array_elements(coalesce(draft_row.version_lines, '[]'::jsonb))
  loop
    line_index := line_index + 1;
    continuation_id := gen_random_uuid()::text;
    insert into public.thread_continuations (
      id, thread_id, parent_continuation_id, line_number, content, author_user_id
    )
    values (
      continuation_id, thread_id, parent_id, line_index + 1,
      coalesce(line_row ->> 'text', ''), actor_id
    );
    parent_id := continuation_id;
  end loop;
  update public.poem_drafts
  set status = 'published', published_thread_id = thread_id
  where id = p_draft_id;
  return thread_id;
end;
$$;

-- RLS for posts/comments/engagements/shares.
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_comment_engagements enable row level security;
alter table public.post_shares enable row level security;

drop policy if exists "public posts are readable" on public.posts;
create policy "public posts are readable"
on public.posts for select to anon, authenticated
using (public.current_user_can_view_post(id));
drop policy if exists "users create their own posts" on public.posts;
create policy "users create their own posts"
on public.posts for insert to authenticated
with check (author_user_id = public.current_linespace_user_id());
drop policy if exists "authors update their posts" on public.posts;
create policy "authors update their posts"
on public.posts for update to authenticated
using (author_user_id = public.current_linespace_user_id())
with check (author_user_id = public.current_linespace_user_id());
drop policy if exists "authors delete their posts" on public.posts;
create policy "authors delete their posts"
on public.posts for delete to authenticated
using (author_user_id = public.current_linespace_user_id());

drop policy if exists "read visible post comments" on public.post_comments;
create policy "read visible post comments"
on public.post_comments for select to anon, authenticated
using (public.current_user_can_view_post(post_id));
drop policy if exists "users create post comments" on public.post_comments;
create policy "users create post comments"
on public.post_comments for insert to authenticated
with check (
  author_user_id = public.current_linespace_user_id()
  and public.current_user_can_view_post(post_id)
);
drop policy if exists "authors update comments" on public.post_comments;
create policy "authors update comments"
on public.post_comments for update to authenticated
using (author_user_id = public.current_linespace_user_id())
with check (author_user_id = public.current_linespace_user_id());
drop policy if exists "authors delete comments" on public.post_comments;
create policy "authors delete comments"
on public.post_comments for delete to authenticated
using (author_user_id = public.current_linespace_user_id());

drop policy if exists "read post likes" on public.post_likes;
create policy "read post likes"
on public.post_likes for select to authenticated using (true);
drop policy if exists "users manage post likes" on public.post_likes;
create policy "users manage post likes"
on public.post_likes for all to authenticated
using (user_id = public.current_linespace_user_id())
with check (user_id = public.current_linespace_user_id());

drop policy if exists "read post saves" on public.post_saves;
create policy "read post saves"
on public.post_saves for select to authenticated using (true);
drop policy if exists "users manage post saves" on public.post_saves;
create policy "users manage post saves"
on public.post_saves for all to authenticated
using (user_id = public.current_linespace_user_id())
with check (user_id = public.current_linespace_user_id());

drop policy if exists "read comment engagement" on public.post_comment_engagements;
create policy "read comment engagement"
on public.post_comment_engagements for select to authenticated using (true);
drop policy if exists "users manage comment engagement" on public.post_comment_engagements;
create policy "users manage comment engagement"
on public.post_comment_engagements for all to authenticated
using (user_id = public.current_linespace_user_id())
with check (user_id = public.current_linespace_user_id());

drop policy if exists "participants read post shares" on public.post_shares;
create policy "participants read post shares"
on public.post_shares for select to authenticated
using (
  sender_user_id = public.current_linespace_user_id()
  or recipient_user_id = public.current_linespace_user_id()
);

-- Draft RLS.
alter table public.poem_design_templates enable row level security;
alter table public.poem_drafts enable row level security;
alter table public.draft_collaborators enable row level security;
alter table public.draft_invitations enable row level security;
alter table public.draft_operations enable row level security;

-- Cross-table draft policies must not recurse through each other. These
-- read-only helpers run with the schema owner privileges and return only a
-- boolean; they never expose draft rows or bypass the API contract.
create or replace function public.current_user_owns_draft(p_draft_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.poem_drafts d
    where d.id = p_draft_id
      and d.owner_user_id = public.current_linespace_user_id()
  );
$$;

create or replace function public.current_user_can_view_draft(p_draft_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_owns_draft(p_draft_id)
    or exists (
      select 1
      from public.draft_collaborators c
      where c.draft_id = p_draft_id
        and c.user_id = public.current_linespace_user_id()
        and c.status = 'active'
    );
$$;

revoke all on function public.current_user_owns_draft(text)
from public, anon;
grant execute on function public.current_user_owns_draft(text)
to authenticated;
revoke all on function public.current_user_can_view_draft(text)
from public, anon;
grant execute on function public.current_user_can_view_draft(text)
to authenticated;

drop policy if exists "active users read design templates" on public.poem_design_templates;
create policy "active users read design templates"
on public.poem_design_templates for select to anon, authenticated
using (is_active = true);
drop policy if exists "owners and collaborators read drafts" on public.poem_drafts;
create policy "owners and collaborators read drafts"
on public.poem_drafts for select to authenticated
using (
  owner_user_id = public.current_linespace_user_id()
  or public.current_user_can_view_draft(id)
);
drop policy if exists "users create their drafts" on public.poem_drafts;
create policy "users create their drafts"
on public.poem_drafts for insert to authenticated
with check (owner_user_id = public.current_linespace_user_id());
drop policy if exists "owners update drafts" on public.poem_drafts;
create policy "owners update drafts"
on public.poem_drafts for update to authenticated
using (owner_user_id = public.current_linespace_user_id())
with check (owner_user_id = public.current_linespace_user_id());
drop policy if exists "owners delete drafts" on public.poem_drafts;
create policy "owners delete drafts"
on public.poem_drafts for delete to authenticated
using (owner_user_id = public.current_linespace_user_id());

drop policy if exists "participants read draft collaborators" on public.draft_collaborators;
create policy "participants read draft collaborators"
on public.draft_collaborators for select to authenticated
using (
  user_id = public.current_linespace_user_id()
  or public.current_user_owns_draft(draft_id)
);
drop policy if exists "owners manage draft collaborators" on public.draft_collaborators;
create policy "owners manage draft collaborators"
on public.draft_collaborators for all to authenticated
using (public.current_user_owns_draft(draft_id))
with check (public.current_user_owns_draft(draft_id));

drop policy if exists "participants read draft invitations" on public.draft_invitations;
create policy "participants read draft invitations"
on public.draft_invitations for select to authenticated
using (
  inviter_user_id = public.current_linespace_user_id()
  or invitee_user_id = public.current_linespace_user_id()
);
drop policy if exists "owners create draft invitations" on public.draft_invitations;
create policy "owners create draft invitations"
on public.draft_invitations for insert to authenticated
with check (
  inviter_user_id = public.current_linespace_user_id()
  and public.current_user_owns_draft(draft_id)
);
drop policy if exists "invitees respond to draft invitations" on public.draft_invitations;
create policy "invitees respond to draft invitations"
on public.draft_invitations for update to authenticated
using (invitee_user_id = public.current_linespace_user_id())
with check (invitee_user_id = public.current_linespace_user_id());

drop policy if exists "participants read draft operations" on public.draft_operations;
create policy "participants read draft operations"
on public.draft_operations for select to authenticated
using (
  user_id = public.current_linespace_user_id()
  or public.current_user_can_view_draft(draft_id)
);

-- Direct client inserts on sensitive share/message tables are intentionally
-- denied; the actor-derived RPCs own these writes.
revoke insert, update, delete on public.inbox_messages from authenticated;
revoke insert, update, delete on public.inbox_group_messages from authenticated;
revoke insert, update, delete on public.post_shares from authenticated;
revoke insert, update, delete on public.thread_shares from authenticated;

grant select on public.posts, public.post_comments to anon, authenticated;
revoke insert, update, delete on public.posts from authenticated;
revoke insert, update, delete on public.post_comments from authenticated;
grant insert (
  id, post_id, author_user_id, parent_comment_id, body
) on public.post_comments to authenticated;
grant update (body) on public.post_comments to authenticated;
grant delete on public.post_comments to authenticated;
grant select, insert, delete on public.post_likes, public.post_saves,
  public.post_comment_engagements to authenticated;
grant select on public.post_shares to authenticated;
grant select on public.poem_design_templates to anon, authenticated;
revoke insert, update, delete on public.poem_drafts from authenticated;
grant select on public.poem_drafts to authenticated;
grant insert (
  id, owner_user_id, mode, status, title, body, byline, tags, mentions,
  version_lines, media, settings, layout
) on public.poem_drafts to authenticated;
grant update (
  status, title, body, byline, tags, mentions, version_lines, media, settings,
  layout
) on public.poem_drafts to authenticated;
grant delete on public.poem_drafts to authenticated;
grant select, insert, update, delete on public.draft_collaborators,
  public.draft_invitations, public.draft_operations to authenticated;
grant all on public.posts, public.post_likes, public.post_saves,
  public.post_comments, public.post_comment_engagements, public.post_shares,
  public.poem_drafts, public.draft_collaborators, public.draft_invitations,
  public.draft_operations to service_role;

revoke execute on function public.current_user_can_view_post(text)
from public, anon, authenticated;
grant execute on function public.current_user_can_view_post(text)
to anon, authenticated;
revoke execute on function public.send_inbox_message(text, text, text, text, text, text, text)
from public, anon;
grant execute on function public.send_inbox_message(text, text, text, text, text, text, text)
to authenticated;
revoke execute on function public.share_post_to_inbox(text, text[], text)
from public, anon;
grant execute on function public.share_post_to_inbox(text, text[], text)
to authenticated;
revoke execute on function public.share_thread_to_inbox(text, text, text[], text)
from public, anon;
grant execute on function public.share_thread_to_inbox(text, text, text[], text)
to authenticated;
revoke execute on function public.send_inbox_group_message(text, text)
from public, anon;
grant execute on function public.send_inbox_group_message(text, text)
to authenticated;
revoke execute on function public.create_inbox_group(text, text[])
from public, anon;
grant execute on function public.create_inbox_group(text, text[])
to authenticated;
revoke execute on function public.invite_inbox_group_members(text, text[])
from public, anon;
grant execute on function public.invite_inbox_group_members(text, text[])
to authenticated;
revoke execute on function public.respond_inbox_group_invite(text, boolean)
from public, anon;
grant execute on function public.respond_inbox_group_invite(text, boolean)
to authenticated;
revoke execute on function public.apply_draft_operation(text, text, text, bigint)
from public, anon;
grant execute on function public.apply_draft_operation(text, text, text, bigint)
to authenticated;
revoke execute on function public.publish_draft_as_post(text)
from public, anon;
grant execute on function public.publish_draft_as_post(text)
to authenticated;
revoke execute on function public.publish_draft_as_thread(text)
from public, anon;
grant execute on function public.publish_draft_as_thread(text)
to authenticated;
grant execute on function public.current_user_owns_draft(text)
to authenticated;
grant execute on function public.current_user_can_view_draft(text)
to authenticated;

-- The historical RPC accepted caller-provided experience recipients and
-- points. Do not expose it to regular users until real content-event triggers
-- are in place.
revoke execute on function public.award_profile_experience(text, text, text, integer, text, text)
from public, anon, authenticated;
grant execute on function public.award_profile_experience(text, text, text, integer, text, text)
to service_role;

-- Keep the public user level invariant consistent with experience totals.
create or replace function public.recalculate_user_experience()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  creator_total integer;
  reviewer_total integer;
  combined_total integer;
  calculated_level integer;
begin
  select
    coalesce(sum(points) filter (where category = 'creator'), 0),
    coalesce(sum(points) filter (where category = 'reviewer'), 0)
  into creator_total, reviewer_total
  from public.experience_events
  where user_id = new.user_id;

  combined_total := creator_total + reviewer_total;
  calculated_level := greatest(1, least(10, floor(combined_total / 10.0)::integer + 1));

  insert into public.user_experience (
    user_id, creator_experience, reviewer_experience, total_experience, level, updated_at
  )
  values (new.user_id, creator_total, reviewer_total, combined_total, calculated_level, now())
  on conflict (user_id) do update set
    creator_experience = excluded.creator_experience,
    reviewer_experience = excluded.reviewer_experience,
    total_experience = excluded.total_experience,
    level = excluded.level,
    updated_at = now();

  update public.users
  set level = calculated_level, updated_at = now()
  where id = new.user_id;

  if creator_total >= 20 then
    insert into public.user_badges (user_id, badge_id, display_order)
    values (new.user_id, 'badge-ink-weaver', 10)
    on conflict (user_id, badge_id) do nothing;
  end if;
  if reviewer_total >= 20 then
    insert into public.user_badges (user_id, badge_id, display_order)
    values (new.user_id, 'badge-soul-echo', 20)
    on conflict (user_id, badge_id) do nothing;
  end if;
  return new;
end;
$$;

-- Storage object ownership is derived from the first path segment, which the
-- API will set to the authenticated LineSpace user id.
drop policy if exists "users upload their media" on storage.objects;
create policy "users upload their media"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('linespace-media', 'linespace-drafts')
  and (storage.foldername(name))[1] = public.current_linespace_user_id()
);
drop policy if exists "users update their media" on storage.objects;
create policy "users update their media"
on storage.objects for update to authenticated
using (
  bucket_id in ('linespace-media', 'linespace-drafts')
  and (storage.foldername(name))[1] = public.current_linespace_user_id()
)
with check (
  bucket_id in ('linespace-media', 'linespace-drafts')
  and (storage.foldername(name))[1] = public.current_linespace_user_id()
);
drop policy if exists "users delete their media" on storage.objects;
create policy "users delete their media"
on storage.objects for delete to authenticated
using (
  bucket_id in ('linespace-media', 'linespace-drafts')
  and (storage.foldername(name))[1] = public.current_linespace_user_id()
);
drop policy if exists "users read their draft media" on storage.objects;
create policy "users read their draft media"
on storage.objects for select to authenticated
using (
  bucket_id = 'linespace-drafts'
  and (storage.foldername(name))[1] = public.current_linespace_user_id()
);
