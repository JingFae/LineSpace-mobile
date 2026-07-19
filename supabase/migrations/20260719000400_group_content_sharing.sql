-- Complete Inbox content sharing for groups without weakening the direct-message
-- or group-membership boundaries established by earlier migrations.

do $$
begin
  if exists (
    select 1
    from public.inbox_group_messages message
    left join public.posts post on post.id = message.post_id
    where message.post_id is not null and post.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'Cannot add the group-message Post foreign key: orphan post_id values exist.',
      hint = 'Create the referenced posts or explicitly clear the orphan references before retrying this migration.';
  end if;
  if exists (
    select 1
    from public.inbox_messages message
    left join public.posts post on post.id = message.post_id
    where message.post_id is not null and post.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'Cannot add the direct-message Post foreign key: orphan post_id values exist.',
      hint = 'Create the referenced posts or explicitly clear the orphan references before retrying this migration.';
  end if;
end;
$$;

alter table public.inbox_group_messages
  add column if not exists thread_id text,
  add column if not exists continuation_id text,
  add column if not exists excerpt text,
  add column if not exists line_number integer;

do $$
begin
  if exists (
    select 1 from public.inbox_messages
    where char_length(coalesce(text_body, '')) > 5000
       or char_length(coalesce(excerpt, '')) > 1000
  ) or exists (
    select 1 from public.inbox_group_messages
    where char_length(coalesce(text_body, '')) > 5000
       or char_length(coalesce(excerpt, '')) > 1000
  ) then
    raise exception using
      errcode = '22001',
      message = 'Existing Inbox text exceeds the supported message or excerpt length.',
      hint = 'Review and explicitly shorten affected rows before retrying; this migration will not truncate message history.';
  end if;
end;
$$;

alter table public.inbox_messages
  drop constraint if exists inbox_messages_text_length_check;
alter table public.inbox_messages
  drop constraint if exists inbox_messages_excerpt_length_check;
alter table public.inbox_messages
  add constraint inbox_messages_text_length_check
    check (text_body is null or char_length(text_body) <= 5000),
  add constraint inbox_messages_excerpt_length_check
    check (excerpt is null or char_length(excerpt) <= 1000);
alter table public.inbox_group_messages
  drop constraint if exists inbox_group_messages_text_length_check;
alter table public.inbox_group_messages
  drop constraint if exists inbox_group_messages_excerpt_length_check;
alter table public.inbox_group_messages
  add constraint inbox_group_messages_text_length_check
    check (text_body is null or char_length(text_body) <= 5000),
  add constraint inbox_group_messages_excerpt_length_check
    check (excerpt is null or char_length(excerpt) <= 1000);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inbox_messages_post_id_fkey'
      and conrelid = 'public.inbox_messages'::regclass
  ) then
    alter table public.inbox_messages
      add constraint inbox_messages_post_id_fkey
      foreign key (post_id) references public.posts(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'inbox_group_messages_post_id_fkey'
      and conrelid = 'public.inbox_group_messages'::regclass
  ) then
    alter table public.inbox_group_messages
      add constraint inbox_group_messages_post_id_fkey
      foreign key (post_id) references public.posts(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'inbox_group_messages_thread_id_fkey'
      and conrelid = 'public.inbox_group_messages'::regclass
  ) then
    alter table public.inbox_group_messages
      add constraint inbox_group_messages_thread_id_fkey
      foreign key (thread_id) references public.poetry_threads(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'inbox_group_messages_continuation_id_fkey'
      and conrelid = 'public.inbox_group_messages'::regclass
  ) then
    alter table public.inbox_group_messages
      add constraint inbox_group_messages_continuation_id_fkey
      foreign key (continuation_id) references public.thread_continuations(id) on delete cascade;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.inbox_group_messages
    where not (
      (kind = 'text' and nullif(trim(text_body), '') is not null
        and post_id is null and thread_id is null and continuation_id is null)
      or (kind = 'shared-post' and post_id is not null
        and thread_id is null and continuation_id is null)
      or (kind = 'shared-thread' and post_id is null
        and thread_id is not null and continuation_id is null)
      or (kind = 'shared-continuation' and post_id is null
        and thread_id is not null and continuation_id is not null)
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Existing group messages do not satisfy the content-reference contract.',
      hint = 'Repair each message kind/reference combination before retrying; this migration will not rewrite message history.';
  end if;
end;
$$;

alter table public.inbox_group_messages
  drop constraint if exists inbox_group_messages_kind_check;
alter table public.inbox_group_messages
  drop constraint if exists inbox_group_messages_check;
alter table public.inbox_group_messages
  drop constraint if exists inbox_group_messages_content_check;
alter table public.inbox_group_messages
  add constraint inbox_group_messages_kind_check
  check (kind in ('text', 'shared-post', 'shared-thread', 'shared-continuation')),
  add constraint inbox_group_messages_content_check
  check (
    (kind = 'text' and nullif(trim(text_body), '') is not null
      and post_id is null and thread_id is null and continuation_id is null)
    or (kind = 'shared-post' and post_id is not null
      and thread_id is null and continuation_id is null)
    or (kind = 'shared-thread' and post_id is null
      and thread_id is not null and continuation_id is null)
    or (kind = 'shared-continuation' and post_id is null
      and thread_id is not null and continuation_id is not null)
  );

create index if not exists inbox_group_messages_post_created_idx
  on public.inbox_group_messages (post_id, created_at desc)
  where post_id is not null;
create index if not exists inbox_group_messages_thread_created_idx
  on public.inbox_group_messages (thread_id, created_at desc)
  where thread_id is not null;

create table if not exists public.post_group_shares (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.posts(id) on delete cascade,
  sender_user_id text not null references public.users(id) on delete cascade,
  group_id text not null references public.inbox_groups(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 2000)
);

create table if not exists public.thread_group_shares (
  id text primary key default gen_random_uuid()::text,
  thread_id text not null references public.poetry_threads(id) on delete cascade,
  continuation_id text references public.thread_continuations(id) on delete cascade,
  sender_user_id text not null references public.users(id) on delete cascade,
  group_id text not null references public.inbox_groups(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 2000)
);

create index if not exists post_group_shares_group_created_idx
  on public.post_group_shares (group_id, created_at desc);
create index if not exists post_group_shares_post_created_idx
  on public.post_group_shares (post_id, created_at desc);
create index if not exists thread_group_shares_group_created_idx
  on public.thread_group_shares (group_id, created_at desc);
create index if not exists thread_group_shares_thread_created_idx
  on public.thread_group_shares (thread_id, created_at desc);

alter table public.poetry_threads
  add column if not exists shares_count bigint not null default 0
  check (shares_count >= 0);
alter table public.thread_continuations
  add column if not exists shares_count bigint not null default 0
  check (shares_count >= 0);
alter table public.thread_versions
  add column if not exists published_post_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'thread_versions_published_post_id_fkey'
      and conrelid = 'public.thread_versions'::regclass
  ) then
    alter table public.thread_versions
      add constraint thread_versions_published_post_id_fkey
      foreign key (published_post_id) references public.posts(id) on delete set null;
  end if;
end;
$$;

create unique index if not exists thread_versions_published_post_idx
  on public.thread_versions (published_post_id)
  where published_post_id is not null;

-- The historical Thread counter trigger ran with the caller's privileges and
-- could not update the protected stats table. Preserve its behavior while
-- making the trigger the only privileged counter writer.
create or replace function public.sync_thread_profile_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  thread_author text;
  saver text;
begin
  if tg_table_name = 'poetry_threads' then
    update public.user_profile_stats
    set threads_count = greatest(0, threads_count + delta), updated_at = now()
    where user_id = case when tg_op = 'INSERT' then new.author_user_id else old.author_user_id end;
  elsif tg_table_name = 'thread_saves' then
    saver := case when tg_op = 'INSERT' then new.user_id else old.user_id end;
    update public.user_profile_stats
    set saves_count = greatest(0, saves_count + delta), updated_at = now()
    where user_id = saver;
    select author_user_id into thread_author
    from public.poetry_threads
    where id = case when tg_op = 'INSERT' then new.thread_id else old.thread_id end;
    update public.user_profile_stats
    set saves_received_count = greatest(0, saves_received_count + delta), updated_at = now()
    where user_id = thread_author;
  end if;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

revoke execute on function public.sync_thread_profile_counters()
from public, anon, authenticated;

create or replace function public.sync_post_group_share_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target_post text := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  update public.posts
  set shares_count = greatest(0, shares_count + delta), edited_at = now()
  where id = target_post;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists post_group_shares_sync_counter on public.post_group_shares;
create trigger post_group_shares_sync_counter
after insert or delete on public.post_group_shares
for each row execute function public.sync_post_group_share_counter();

create or replace function public.sync_thread_share_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target_thread text := case when tg_op = 'INSERT' then new.thread_id else old.thread_id end;
  target_continuation text := case when tg_op = 'INSERT' then new.continuation_id else old.continuation_id end;
begin
  update public.poetry_threads
  set shares_count = greatest(0, shares_count + delta), updated_at = now()
  where id = target_thread;
  if target_continuation is not null then
    update public.thread_continuations
    set shares_count = greatest(0, shares_count + delta), updated_at = now()
    where id = target_continuation;
  end if;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists thread_shares_sync_counters on public.thread_shares;
create trigger thread_shares_sync_counters
after insert or delete on public.thread_shares
for each row execute function public.sync_thread_share_counters();
drop trigger if exists thread_group_shares_sync_counters on public.thread_group_shares;
create trigger thread_group_shares_sync_counters
after insert or delete on public.thread_group_shares
for each row execute function public.sync_thread_share_counters();

-- Derived counters may be safely reconciled; no authored content is changed.
update public.poetry_threads thread
set shares_count =
  (select count(*) from public.thread_shares share where share.thread_id = thread.id)
  + (select count(*) from public.thread_group_shares share where share.thread_id = thread.id);
update public.thread_continuations continuation
set shares_count =
  (select count(*) from public.thread_shares share where share.continuation_id = continuation.id)
  + (select count(*) from public.thread_group_shares share where share.continuation_id = continuation.id);

create or replace function public.publish_thread_version_as_post(
  p_thread_id text,
  p_version_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  version_row public.thread_versions;
  thread_row public.poetry_threads;
  post_id text := gen_random_uuid()::text;
  post_body text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select * into version_row
  from public.thread_versions
  where id = p_version_id and thread_id = p_thread_id
  for update;
  if version_row.id is null then
    raise exception using errcode = 'P0002', message = 'Thread version not found';
  end if;
  select * into thread_row
  from public.poetry_threads
  where id = p_thread_id;
  if thread_row.id is null or thread_row.author_user_id <> actor_id then
    raise exception using errcode = '42501', message = 'Only the Thread author can publish this version';
  end if;
  if version_row.published_post_id is not null then
    return version_row.published_post_id;
  end if;
  select string_agg(line.text_content, E'\n' order by line.line_number)
  into post_body
  from public.thread_version_lines line
  where line.version_id = p_version_id;
  if post_body is null or char_length(trim(post_body)) = 0 then
    raise exception using errcode = '22023', message = 'Thread version has no publishable lines';
  end if;
  if char_length(post_body) > 100000 then
    raise exception using errcode = '22001', message = 'Thread version exceeds the Post body limit';
  end if;
  insert into public.posts (
    id, author_user_id, title, body, tags, mentions, media,
    visibility, audience_user_ids, status, declare_original,
    allow_comments, allow_sharing, allow_save
  ) values (
    post_id, actor_id, version_row.title, post_body,
    thread_row.tags, thread_row.mentions, thread_row.media,
    case when thread_row.visibility = 'public' then 'public' else 'include' end,
    case when thread_row.visibility = 'public' then '{}'::text[] else array[actor_id] end,
    'published', false, true, true, true
  );
  update public.thread_versions
  set published_post_id = post_id, updated_at = now()
  where id = p_version_id;
  return post_id;
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
  if actor_id is null or cardinality(coalesce(p_recipient_user_ids, '{}')) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'One to fifty recipients are required';
  end if;
  if p_note is not null and char_length(trim(p_note)) > 2000 then
    raise exception using errcode = '22023', message = 'Share note is too long';
  end if;
  if p_post_id is null or not exists (
    select 1 from public.posts
    where id = p_post_id
      and allow_sharing
      and public.current_user_can_view_post(id)
  ) then
    raise exception using errcode = '42501', message = 'Post cannot be shared';
  end if;
  for recipient_id in
    select distinct recipient from unnest(p_recipient_user_ids) as recipient
  loop
    if recipient_id is null or recipient_id = actor_id then
      raise exception using errcode = '42501', message = 'Invalid share recipient';
    end if;
    created := public.send_inbox_message(
      recipient_id, p_note, 'shared-post', p_post_id, null, null, null
    );
    insert into public.post_shares (
      post_id, sender_user_id, recipient_user_id, note
    ) values (
      p_post_id, actor_id, recipient_id, nullif(trim(p_note), '')
    );
    return next created;
  end loop;
  return;
end;
$$;

create or replace function public.share_post_to_inbox_group(
  p_group_id text,
  p_post_id text,
  p_note text default null
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
  if actor_id is null
     or not public.current_user_is_active_inbox_group_member(p_group_id) then
    raise exception using errcode = '42501', message = 'Group membership required';
  end if;
  if p_note is not null and char_length(trim(p_note)) > 2000 then
    raise exception using errcode = '22023', message = 'Share note is too long';
  end if;
  if p_post_id is null or not exists (
    select 1 from public.posts
    where id = p_post_id
      and allow_sharing
      and public.current_user_can_view_post(id)
  ) then
    raise exception using errcode = '42501', message = 'Post cannot be shared';
  end if;
  insert into public.inbox_group_messages (
    id, group_id, sender_user_id, kind, text_body, post_id
  ) values (
    gen_random_uuid()::text, p_group_id, actor_id, 'shared-post',
    nullif(trim(p_note), ''), p_post_id
  ) returning * into created;
  insert into public.post_group_shares (post_id, sender_user_id, group_id, note)
  values (p_post_id, actor_id, p_group_id, nullif(trim(p_note), ''));
  return created;
end;
$$;

create or replace function public.share_thread_to_inbox_group(
  p_group_id text,
  p_thread_id text,
  p_continuation_id text default null,
  p_note text default null
)
returns public.inbox_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  created public.inbox_group_messages;
  resolved_excerpt text;
  resolved_line integer;
begin
  if actor_id is null
     or not public.current_user_is_active_inbox_group_member(p_group_id) then
    raise exception using errcode = '42501', message = 'Group membership required';
  end if;
  if p_note is not null and char_length(trim(p_note)) > 2000 then
    raise exception using errcode = '22023', message = 'Share note is too long';
  end if;
  select starting_content into resolved_excerpt
  from public.poetry_threads
  where id = p_thread_id
    and (visibility = 'public' or author_user_id = actor_id);
  if resolved_excerpt is null then
    raise exception using errcode = '42501', message = 'Thread cannot be shared';
  end if;
  if p_continuation_id is not null then
    select content, line_number into resolved_excerpt, resolved_line
    from public.thread_continuations
    where id = p_continuation_id and thread_id = p_thread_id;
    if resolved_excerpt is null then
      raise exception using errcode = '23503', message = 'Continuation not found';
    end if;
  end if;
  insert into public.inbox_group_messages (
    id, group_id, sender_user_id, kind, text_body, thread_id,
    continuation_id, excerpt, line_number
  ) values (
    gen_random_uuid()::text, p_group_id, actor_id,
    case when p_continuation_id is null then 'shared-thread'
         else 'shared-continuation' end,
    nullif(trim(p_note), ''), p_thread_id, p_continuation_id,
    left(resolved_excerpt, 1000), resolved_line
  ) returning * into created;
  insert into public.thread_group_shares (
    thread_id, continuation_id, sender_user_id, group_id, note
  ) values (
    p_thread_id, p_continuation_id, actor_id, p_group_id,
    nullif(trim(p_note), '')
  );
  return created;
end;
$$;

-- Correct direct Thread share previews so the click target and excerpt always
-- come from persisted content, never from caller-supplied display text.
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
  resolved_excerpt text;
  resolved_line integer;
begin
  if actor_id is null or cardinality(coalesce(p_recipient_user_ids, '{}')) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'One to fifty recipients are required';
  end if;
  if p_note is not null and char_length(trim(p_note)) > 2000 then
    raise exception using errcode = '22023', message = 'Share note is too long';
  end if;
  select starting_content into resolved_excerpt
  from public.poetry_threads
  where id = p_thread_id
    and (visibility = 'public' or author_user_id = actor_id);
  if resolved_excerpt is null then
    raise exception using errcode = '42501', message = 'Thread cannot be shared';
  end if;
  if p_continuation_id is not null then
    select content, line_number into resolved_excerpt, resolved_line
    from public.thread_continuations
    where id = p_continuation_id and thread_id = p_thread_id;
    if resolved_excerpt is null then
      raise exception using errcode = '23503', message = 'Continuation not found';
    end if;
  end if;
  for recipient_id in
    select distinct recipient from unnest(p_recipient_user_ids) as recipient
  loop
    if recipient_id is null or recipient_id = actor_id then
      raise exception using errcode = '42501', message = 'Invalid share recipient';
    end if;
    created := public.send_inbox_message(
      recipient_id, p_note,
      case when p_continuation_id is null then 'shared-thread'
           else 'shared-continuation' end,
      null, p_thread_id, p_continuation_id, left(resolved_excerpt, 1000)
    );
    update public.inbox_messages
    set line_number = resolved_line
    where id = created.id
    returning * into created;
    insert into public.thread_shares (
      id, thread_id, continuation_id, sender_user_id, recipient_user_id, note
    ) values (
      gen_random_uuid()::text, p_thread_id, p_continuation_id,
      actor_id, recipient_id, nullif(trim(p_note), '')
    );
    return next created;
  end loop;
  return;
end;
$$;

alter table public.post_group_shares enable row level security;
alter table public.thread_group_shares enable row level security;

drop policy if exists "active members read post group shares" on public.post_group_shares;
create policy "active members read post group shares"
on public.post_group_shares for select to authenticated
using (public.current_user_is_active_inbox_group_member(group_id));
drop policy if exists "active members read thread group shares" on public.thread_group_shares;
create policy "active members read thread group shares"
on public.thread_group_shares for select to authenticated
using (public.current_user_is_active_inbox_group_member(group_id));

revoke all on public.post_group_shares, public.thread_group_shares
from public, anon, authenticated;
grant select on public.post_group_shares, public.thread_group_shares
to authenticated;
grant all on public.post_group_shares, public.thread_group_shares
to service_role;

revoke insert, update, delete on public.inbox_group_messages from authenticated;
grant select (
  id, group_id, sender_user_id, kind, text_body, post_id,
  thread_id, continuation_id, excerpt, line_number, created_at
) on public.inbox_group_messages to authenticated;

revoke execute on function public.share_post_to_inbox_group(text, text, text)
from public, anon;
grant execute on function public.share_post_to_inbox_group(text, text, text)
to authenticated;
revoke execute on function public.share_thread_to_inbox_group(text, text, text, text)
from public, anon;
grant execute on function public.share_thread_to_inbox_group(text, text, text, text)
to authenticated;
revoke execute on function public.share_thread_to_inbox(text, text, text[], text)
from public, anon;
grant execute on function public.share_thread_to_inbox(text, text, text[], text)
to authenticated;
revoke execute on function public.share_post_to_inbox(text, text[], text)
from public, anon;
grant execute on function public.share_post_to_inbox(text, text[], text)
to authenticated;
revoke execute on function public.publish_thread_version_as_post(text, text)
from public, anon;
grant execute on function public.publish_thread_version_as_post(text, text)
to authenticated;
