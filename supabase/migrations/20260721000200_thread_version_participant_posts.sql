-- Allow every Thread participant to publish their own immutable Version copy.
-- Publication is idempotent per (version, user), not globally per version.

create table if not exists public.thread_version_posts (
  version_id text not null references public.thread_versions(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  post_id text not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (version_id, user_id),
  unique (post_id)
);

create index if not exists thread_version_posts_user_created_idx
  on public.thread_version_posts (user_id, created_at desc);

alter table public.thread_version_posts enable row level security;

drop policy if exists "users read their version posts" on public.thread_version_posts;
create policy "users read their version posts"
on public.thread_version_posts for select to authenticated
using (user_id = public.current_linespace_user_id());

revoke all on public.thread_version_posts from public, anon, authenticated;
grant select on public.thread_version_posts to authenticated;
grant all on public.thread_version_posts to service_role;

drop function if exists public.publish_thread_version_as_post(text, text);

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

  select * into thread_row
  from public.poetry_threads
  where id = p_thread_id;
  if thread_row.id is null then
    raise exception using errcode = 'P0002', message = 'Thread not found';
  end if;

  if thread_row.author_user_id <> actor_id and not exists (
    select 1
    from public.thread_continuations continuation
    where continuation.thread_id = p_thread_id
      and continuation.author_user_id = actor_id
  ) then
    raise exception using errcode = '42501',
      message = 'Only Thread participants can publish this version';
  end if;

  select mapping.post_id into existing_post_id
  from public.thread_version_posts mapping
  where mapping.version_id = p_version_id and mapping.user_id = actor_id;
  if existing_post_id is not null then
    return existing_post_id;
  end if;

  resolved_title := coalesce(nullif(btrim(p_title), ''), version_row.title);
  if char_length(resolved_title) > 180 then
    raise exception using errcode = '22001', message = 'Post title exceeds 180 characters';
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
    post_id, actor_id, resolved_title, post_body,
    thread_row.tags, thread_row.mentions, thread_row.media,
    case when thread_row.visibility = 'public' then 'public' else 'include' end,
    case when thread_row.visibility = 'public' then '{}'::text[] else array[actor_id] end,
    'published', false, true, true, true
  );

  insert into public.thread_version_posts (version_id, user_id, post_id)
  values (p_version_id, actor_id, post_id);

  -- Retain the historical pointer as the first publication only. Per-user
  -- publications are tracked by thread_version_posts.
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
