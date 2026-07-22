-- Preserve immutable Thread Version attribution when a Version becomes a Post.

alter table public.posts
  add column if not exists version_lines jsonb;

-- Recover attribution for Version Posts created through the earlier direct
-- publish endpoint. Draft-based Version Posts start persisting this field
-- below as soon as this migration is active.
update public.posts post
set version_lines = source.version_lines
from (
  select
    mapping.post_id,
    jsonb_agg(
      jsonb_build_object(
        'lineNumber', line.line_number,
        'text', line.text_content,
        'authorId', line.author_user_id,
        'likes', line.likes
      ) order by line.line_number
    ) as version_lines
  from public.thread_version_posts mapping
  join public.thread_version_lines line on line.version_id = mapping.version_id
  group by mapping.post_id
) source
where post.id = source.post_id
  and post.version_lines is null;

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
    id, author_user_id, title, body, tags, mentions, media, layout, version_lines,
    visibility, audience_user_ids, status, declare_original,
    allow_comments, allow_sharing, allow_save
  )
  values (
    post_id, actor_id, draft_row.title, draft_row.body, draft_row.tags,
    draft_row.mentions, draft_row.media, draft_row.layout, draft_row.version_lines,
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
    version_lines = draft_row.version_lines,
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

create or replace function public.publish_thread_version_as_post(
  p_thread_id text,
  p_version_id text,
  p_title text default null
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
  existing_post_id text;
  post_id text := gen_random_uuid()::text;
  post_body text;
  post_version_lines jsonb;
  resolved_title text;
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

  select * into thread_row from public.poetry_threads where id = p_thread_id;
  if thread_row.id is null then
    raise exception using errcode = 'P0002', message = 'Thread not found';
  end if;

  if thread_row.author_user_id <> actor_id and not exists (
    select 1 from public.thread_continuations continuation
    where continuation.thread_id = p_thread_id
      and continuation.author_user_id = actor_id
  ) then
    raise exception using errcode = '42501',
      message = 'Only Thread participants can publish this version';
  end if;

  select mapping.post_id into existing_post_id
  from public.thread_version_posts mapping
  where mapping.version_id = p_version_id and mapping.user_id = actor_id;
  if existing_post_id is not null then return existing_post_id; end if;

  resolved_title := coalesce(nullif(btrim(p_title), ''), version_row.title);
  if char_length(resolved_title) > 180 then
    raise exception using errcode = '22001', message = 'Post title exceeds 180 characters';
  end if;

  select
    string_agg(line.text_content, E'\n' order by line.line_number),
    jsonb_agg(
      jsonb_build_object(
        'lineNumber', line.line_number,
        'text', line.text_content,
        'authorId', line.author_user_id,
        'likes', line.likes
      ) order by line.line_number
    )
  into post_body, post_version_lines
  from public.thread_version_lines line
  where line.version_id = p_version_id;

  if post_body is null or char_length(trim(post_body)) = 0 then
    raise exception using errcode = '22023', message = 'Thread version has no publishable lines';
  end if;
  if char_length(post_body) > 100000 then
    raise exception using errcode = '22001', message = 'Thread version exceeds the Post body limit';
  end if;

  insert into public.posts (
    id, author_user_id, title, body, tags, mentions, media, version_lines,
    visibility, audience_user_ids, status, declare_original,
    allow_comments, allow_sharing, allow_save
  ) values (
    post_id, actor_id, resolved_title, post_body,
    thread_row.tags, thread_row.mentions, thread_row.media, post_version_lines,
    case when thread_row.visibility = 'public' then 'public' else 'include' end,
    case when thread_row.visibility = 'public' then '{}'::text[] else array[actor_id] end,
    'published', false, true, true, true
  );

  insert into public.thread_version_posts (version_id, user_id, post_id)
  values (p_version_id, actor_id, post_id);
  update public.thread_versions
  set published_post_id = coalesce(published_post_id, post_id), updated_at = now()
  where id = p_version_id;
  return post_id;
end;
$$;

revoke execute on function public.publish_thread_version_as_post(text, text, text)
from public, anon;
grant execute on function public.publish_thread_version_as_post(text, text, text)
to authenticated;

-- Started Threads are owned resources. Participants continue to have read and
-- contribution access, but only the starter can edit or delete the setup.
create or replace function public.update_my_thread(
  p_thread_id text,
  p_title text,
  p_starting_content text,
  p_rules text,
  p_tags text[],
  p_mentions text[],
  p_visibility text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  affected bigint;
  resolved_title text := coalesce(nullif(btrim(p_title), ''), 'poem relay');
  resolved_first_line text := btrim(coalesce(p_starting_content, ''));
  resolved_rules text := btrim(coalesce(p_rules, ''));
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if resolved_first_line = '' or char_length(resolved_first_line) > 1000 then
    raise exception using errcode = '22023', message = 'Invalid Thread first line';
  end if;
  if resolved_rules = '' or char_length(resolved_rules) > 5000 then
    raise exception using errcode = '22023', message = 'Invalid Thread rules';
  end if;
  if char_length(resolved_title) > 180 or p_visibility not in ('public', 'include', 'exclude') then
    raise exception using errcode = '22023', message = 'Invalid Thread setup';
  end if;

  update public.poetry_threads
  set title = resolved_title,
      prompt = resolved_rules,
      starting_content = resolved_first_line,
      rules = resolved_rules,
      tags = coalesce(p_tags, '{}'),
      mentions = coalesce(p_mentions, '{}'),
      visibility = p_visibility,
      updated_at = now()
  where id = p_thread_id and author_user_id = actor_id;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.delete_my_thread(p_thread_id text)
returns boolean
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
  delete from public.poetry_threads
  where id = p_thread_id and author_user_id = actor_id;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke execute on function public.update_my_thread(text, text, text, text, text[], text[], text)
from public, anon;
grant execute on function public.update_my_thread(text, text, text, text, text[], text[], text)
to authenticated;
revoke execute on function public.delete_my_thread(text) from public, anon;
grant execute on function public.delete_my_thread(text) to authenticated;
