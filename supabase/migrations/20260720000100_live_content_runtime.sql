-- Runtime compatibility for the authenticated Web experience.
-- This migration is additive and safe to re-run through the Supabase
-- migration history. It does not seed demo users, conversations, or content.

do $$
begin
  if to_regclass('public.posts') is null
     or to_regclass('public.poetry_threads') is null
     or to_regclass('public.poem_drafts') is null
     or to_regclass('public.inbox_groups') is null
     or to_regclass('public.inbox_messages') is null then
    raise exception using
      errcode = '55000',
      message = 'LineSpace content-domain migrations are incomplete',
      hint = 'Apply every migration through 20260719000500_content_discovery.sql before this migration.';
  end if;
end;
$$;

alter table public.poetry_threads
  add column if not exists likes_count bigint not null default 0
  check (likes_count >= 0);

update public.poetry_threads thread
set likes_count = source.total
from (
  select thread_id, count(*)::bigint as total
  from public.thread_likes
  group by thread_id
) source
where thread.id = source.thread_id
  and thread.likes_count is distinct from source.total;

create or replace function public.sync_thread_like_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_thread_id text := case
    when tg_op = 'INSERT' then new.thread_id
    else old.thread_id
  end;
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  update public.poetry_threads
  set likes_count = greatest(0, likes_count + delta),
      updated_at = now()
  where id = target_thread_id;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists thread_likes_sync_counter on public.thread_likes;
create trigger thread_likes_sync_counter
after insert or delete on public.thread_likes
for each row execute function public.sync_thread_like_counter();

create index if not exists posts_latest_page_idx
  on public.posts (status, started_at desc, id desc);
create index if not exists posts_popular_page_idx
  on public.posts (status, likes_count desc, started_at desc, id desc);
create index if not exists threads_latest_page_idx
  on public.poetry_threads (created_at desc, id desc);
create index if not exists threads_popular_page_idx
  on public.poetry_threads (likes_count desc, created_at desc, id desc);

create or replace function public.create_poem_draft(
  p_mode text default 'draft'
)
returns public.poem_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  created public.poem_drafts;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_mode not in ('draft', 'relay') then
    raise exception using errcode = '22023', message = 'Invalid draft mode';
  end if;

  insert into public.poem_drafts (
    id,
    owner_user_id,
    mode,
    status,
    title,
    body,
    byline,
    tags,
    mentions,
    version_lines,
    media,
    settings,
    layout
  ) values (
    gen_random_uuid()::text,
    actor_id,
    p_mode,
    'editing',
    '',
    '',
    '',
    '{}',
    '{}',
    '[]'::jsonb,
    null,
    jsonb_build_object(
      'declareOriginal', false,
      'isPublic', true,
      'visibility', 'public',
      'audienceUserIds', '[]'::jsonb,
      'allowComments', true,
      'allowQuotes', true,
      'allowSharing', true,
      'allowSave', true
    ),
    jsonb_build_object(
      'templateId', 'quiet-letter',
      'typographyId', 'literary-serif',
      'backgroundId', 'letter-paper',
      'stickerIds', '[]'::jsonb
    )
  )
  returning * into created;

  return created;
end;
$$;

revoke execute on function public.create_poem_draft(text)
from public, anon;
grant execute on function public.create_poem_draft(text)
to authenticated;

grant select on public.posts, public.post_likes, public.post_saves,
  public.poetry_threads, public.thread_continuations, public.thread_likes,
  public.thread_continuation_likes, public.thread_saves,
  public.poem_drafts, public.inbox_messages, public.inbox_groups,
  public.inbox_group_members, public.inbox_group_messages
to authenticated;

