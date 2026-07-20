-- Complete engagement counters, Inbox read state, and owner-safe Post editing.
-- All mutating RPCs derive the actor from the request JWT.

alter table public.poetry_threads
  add column if not exists saves_count bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.poetry_threads'::regclass
      and conname = 'poetry_threads_saves_count_check'
  ) then
    alter table public.poetry_threads
      add constraint poetry_threads_saves_count_check check (saves_count >= 0);
  end if;
end;
$$;

update public.poetry_threads thread
set saves_count = (
  select count(*) from public.thread_saves saved where saved.thread_id = thread.id
);

create or replace function public.sync_thread_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id text := case when tg_op = 'INSERT' then new.thread_id else old.thread_id end;
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  update public.poetry_threads
  set saves_count = greatest(0, saves_count + delta), updated_at = now()
  where id = target_id;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists thread_saves_sync_thread_count on public.thread_saves;
create trigger thread_saves_sync_thread_count
after insert or delete on public.thread_saves
for each row execute function public.sync_thread_save_count();

update public.post_comments comment
set
  likes_count = (
    select count(*) from public.post_comment_engagements engagement
    where engagement.comment_id = comment.id and engagement.kind = 'liked'
  ),
  saves_count = (
    select count(*) from public.post_comment_engagements engagement
    where engagement.comment_id = comment.id and engagement.kind = 'saved'
  );

create or replace function public.sync_post_comment_engagement_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id text := case when tg_op = 'INSERT' then new.comment_id else old.comment_id end;
  target_kind text := case when tg_op = 'INSERT' then new.kind else old.kind end;
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if target_kind = 'liked' then
    update public.post_comments
    set likes_count = greatest(0, likes_count + delta)
    where id = target_id;
  elsif target_kind = 'saved' then
    update public.post_comments
    set saves_count = greatest(0, saves_count + delta)
    where id = target_id;
  end if;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists post_comment_engagements_sync_count
  on public.post_comment_engagements;
create trigger post_comment_engagements_sync_count
after insert or delete on public.post_comment_engagements
for each row execute function public.sync_post_comment_engagement_count();

create or replace function public.mark_inbox_activity_read(p_category text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  affected bigint;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_category not in ('comments', 'likes', 'thread', 'social') then
    raise exception using errcode = '22023', message = 'Invalid Inbox activity category';
  end if;
  update public.inbox_activity_events
  set read_at = now()
  where recipient_user_id = actor_id
    and category = p_category
    and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.publish_draft_over_post(
  p_draft_id text,
  p_post_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  draft_row public.poem_drafts;
  updated_id text;
begin
  select * into draft_row
  from public.poem_drafts
  where id = p_draft_id
    and owner_user_id = actor_id
    and status <> 'published'
  for update;
  if draft_row.id is null then
    raise exception using errcode = '42501', message = 'Draft access denied';
  end if;

  update public.posts
  set
    title = draft_row.title,
    body = draft_row.body,
    tags = draft_row.tags,
    mentions = draft_row.mentions,
    media = draft_row.media,
    layout = draft_row.layout,
    visibility = coalesce(draft_row.settings ->> 'visibility', 'public'),
    audience_user_ids = coalesce(
      array(select jsonb_array_elements_text(draft_row.settings -> 'audienceUserIds')),
      '{}'
    ),
    declare_original = coalesce((draft_row.settings ->> 'declareOriginal')::boolean, false),
    allow_comments = coalesce((draft_row.settings ->> 'allowComments')::boolean, true),
    allow_sharing = coalesce((draft_row.settings ->> 'allowSharing')::boolean, true),
    allow_save = coalesce((draft_row.settings ->> 'allowSave')::boolean, true),
    edited_at = now(),
    updated_at = now()
  where id = p_post_id
    and author_user_id = actor_id
    and status = 'published'
  returning id into updated_id;

  if updated_id is null then
    raise exception using errcode = '42501', message = 'Post access denied';
  end if;

  update public.poem_drafts
  set status = 'published', published_post_id = updated_id, updated_at = now()
  where id = p_draft_id;
  return updated_id;
end;
$$;

create or replace function public.delete_my_post(p_post_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  affected bigint;
  target_likes bigint;
  target_saves bigint;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select likes_count, saves_count into target_likes, target_saves
  from public.posts
  where id = p_post_id and author_user_id = actor_id
  for update;
  if not found then return false; end if;

  -- Cascaded engagement deletes can no longer resolve the deleted Post author,
  -- so adjust the author's received counters while the row is still locked.
  update public.user_profile_stats
  set
    likes_received_count = greatest(0, likes_received_count - coalesce(target_likes, 0)),
    saves_received_count = greatest(0, saves_received_count - coalesce(target_saves, 0)),
    updated_at = now()
  where user_id = actor_id;

  delete from public.posts where id = p_post_id and author_user_id = actor_id;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke execute on function public.sync_thread_save_count(),
  public.sync_post_comment_engagement_count(),
  public.mark_inbox_activity_read(text),
  public.publish_draft_over_post(text, text),
  public.delete_my_post(text)
from public, anon, authenticated;

grant execute on function public.mark_inbox_activity_read(text),
  public.publish_draft_over_post(text, text),
  public.delete_my_post(text)
to authenticated;

grant execute on function public.sync_thread_save_count(),
  public.sync_post_comment_engagement_count()
to service_role;
