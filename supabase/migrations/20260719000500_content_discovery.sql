-- Search and Tag discovery for published Posts and public/owned Threads.
-- Tags remain embedded on content for fast reads, while normalized link tables
-- make every tag a durable, navigable collection.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_content_tag(raw_tag text)
returns text
language sql
immutable
set search_path = public
as $$
  select left(lower(trim(both from regexp_replace(coalesce(raw_tag, ''), '^#+', ''))), 64)
$$;

create or replace function public.normalize_content_tags(raw_tags text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(normalized order by first_position), '{}'::text[])
  from (
    select public.normalize_content_tag(value) as normalized, min(position) as first_position
    from unnest(coalesce(raw_tags, '{}'::text[])) with ordinality as source(value, position)
    where public.normalize_content_tag(value) <> ''
    group by public.normalize_content_tag(value)
  ) deduplicated
$$;

-- PostgreSQL marks array_to_string as STABLE, so using it directly in a GIN
-- expression index fails with "functions in index expression must be marked
-- IMMUTABLE". Tags are plain text values, making this narrow immutable
-- wrapper safe and allowing the search query to use the exact indexed form.
create or replace function public.content_search_document(parts text[])
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select lower(array_to_string(coalesce(parts, '{}'::text[]), ' '))
$$;

create or replace function public.normalize_content_tags_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.tags := public.normalize_content_tags(new.tags);
  return new;
end;
$$;

drop trigger if exists posts_normalize_tags on public.posts;
create trigger posts_normalize_tags
before insert or update of tags on public.posts
for each row execute function public.normalize_content_tags_before_write();

drop trigger if exists poetry_threads_normalize_tags on public.poetry_threads;
create trigger poetry_threads_normalize_tags
before insert or update of tags on public.poetry_threads
for each row execute function public.normalize_content_tags_before_write();

update public.posts set tags = public.normalize_content_tags(tags)
where tags is distinct from public.normalize_content_tags(tags);
update public.poetry_threads set tags = public.normalize_content_tags(tags)
where tags is distinct from public.normalize_content_tags(tags);

create table if not exists public.content_tags (
  slug varchar(64) primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug = public.normalize_content_tag(slug) and char_length(slug) between 1 and 64)
);

create table if not exists public.post_tags (
  post_id text not null references public.posts(id) on delete cascade,
  tag_slug varchar(64) not null references public.content_tags(slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag_slug)
);

create table if not exists public.thread_tags (
  thread_id text not null references public.poetry_threads(id) on delete cascade,
  tag_slug varchar(64) not null references public.content_tags(slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, tag_slug)
);

create index if not exists post_tags_tag_created_idx
  on public.post_tags (tag_slug, created_at desc, post_id);
create index if not exists thread_tags_tag_created_idx
  on public.thread_tags (tag_slug, created_at desc, thread_id);
create index if not exists poetry_threads_tags_gin_idx
  on public.poetry_threads using gin (tags);
create index if not exists posts_search_trgm_idx
  on public.posts using gin (
    public.content_search_document(array[title, body] || tags)
    extensions.gin_trgm_ops
  );
create index if not exists poetry_threads_search_trgm_idx
  on public.poetry_threads using gin (
    public.content_search_document(array[title, prompt, starting_content, rules] || tags)
    extensions.gin_trgm_ops
  );
create index if not exists thread_continuations_search_trgm_idx
  on public.thread_continuations using gin (lower(content) extensions.gin_trgm_ops);

create or replace function public.sync_post_tag_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.post_tags where post_id = new.id;
  insert into public.content_tags (slug)
    select value from unnest(new.tags) as value
    on conflict (slug) do update set updated_at = now();
  insert into public.post_tags (post_id, tag_slug)
    select new.id, value from unnest(new.tags) as value
    on conflict do nothing;
  return new;
end;
$$;

create or replace function public.sync_thread_tag_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.thread_tags where thread_id = new.id;
  insert into public.content_tags (slug)
    select value from unnest(new.tags) as value
    on conflict (slug) do update set updated_at = now();
  insert into public.thread_tags (thread_id, tag_slug)
    select new.id, value from unnest(new.tags) as value
    on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists posts_sync_tag_links on public.posts;
create trigger posts_sync_tag_links
after insert or update of tags on public.posts
for each row execute function public.sync_post_tag_links();

drop trigger if exists poetry_threads_sync_tag_links on public.poetry_threads;
create trigger poetry_threads_sync_tag_links
after insert or update of tags on public.poetry_threads
for each row execute function public.sync_thread_tag_links();

insert into public.content_tags (slug)
select distinct value
from (
  select unnest(tags) as value from public.posts
  union all
  select unnest(tags) as value from public.poetry_threads
) existing
where value <> ''
on conflict (slug) do nothing;

insert into public.post_tags (post_id, tag_slug)
select post.id, tag
from public.posts post cross join lateral unnest(post.tags) tag
on conflict do nothing;

insert into public.thread_tags (thread_id, tag_slug)
select thread.id, tag
from public.poetry_threads thread cross join lateral unnest(thread.tags) tag
on conflict do nothing;

create or replace view public.content_tag_catalog
with (security_invoker = true)
as
select
  tag.slug,
  count(distinct post_link.post_id)::bigint as post_count,
  count(distinct thread_link.thread_id)::bigint as thread_count,
  tag.updated_at
from public.content_tags tag
left join public.post_tags post_link on post_link.tag_slug = tag.slug
left join public.thread_tags thread_link on thread_link.tag_slug = tag.slug
group by tag.slug, tag.updated_at;

alter table public.content_tags enable row level security;
alter table public.post_tags enable row level security;
alter table public.thread_tags enable row level security;

create policy "tags are readable"
on public.content_tags for select to anon, authenticated using (true);
create policy "visible post tags are readable"
on public.post_tags for select to anon, authenticated
using (public.current_user_can_view_post(post_id));
create policy "visible thread tags are readable"
on public.thread_tags for select to anon, authenticated
using (
  exists (
    select 1 from public.poetry_threads thread
    where thread.id = thread_id
      and (thread.visibility = 'public' or thread.author_user_id = public.current_linespace_user_id())
  )
);

create or replace function public.search_content_ids(
  p_query text,
  p_limit integer default 40
)
returns table (
  content_kind text,
  content_id text,
  occurred_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select
      replace(
        replace(
          replace(lower(trim(coalesce(p_query, ''))), chr(92), chr(92) || chr(92)),
          '%', chr(92) || '%'
        ),
        '_', chr(92) || '_'
      ) as query,
           least(100, greatest(1, coalesce(p_limit, 40))) as result_limit
  ), matches as (
    select 'post'::text as content_kind, post.id as content_id, post.started_at as occurred_at
    from public.posts post cross join input
    where post.status = 'published'
      and input.query <> ''
      and public.content_search_document(array[post.title, post.body] || post.tags)
        like '%' || input.query || '%' escape '\'
    union all
    select 'thread'::text, thread.id, thread.created_at
    from public.poetry_threads thread cross join input
    where input.query <> ''
      and (
        public.content_search_document(array[thread.title, thread.prompt, thread.starting_content, thread.rules] || thread.tags)
          like '%' || input.query || '%' escape '\'
        or exists (
          select 1 from public.thread_continuations continuation
          where continuation.thread_id = thread.id
            and lower(continuation.content) like '%' || input.query || '%' escape '\'
        )
      )
  )
  select matches.content_kind, matches.content_id, matches.occurred_at
  from matches cross join input
  order by matches.occurred_at desc, matches.content_id
  limit (select result_limit from input)
$$;

create or replace function public.list_tag_content_ids(
  p_tag text,
  p_limit integer default 100
)
returns table (
  content_kind text,
  content_id text,
  occurred_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with input as (
    select public.normalize_content_tag(p_tag) as tag,
           least(200, greatest(1, coalesce(p_limit, 100))) as result_limit
  ), matches as (
    select 'post'::text as content_kind, post.id as content_id, post.started_at as occurred_at
    from public.post_tags link
    join public.posts post on post.id = link.post_id
    cross join input
    where link.tag_slug = input.tag and post.status = 'published'
    union all
    select 'thread'::text, thread.id, thread.created_at
    from public.thread_tags link
    join public.poetry_threads thread on thread.id = link.thread_id
    cross join input
    where link.tag_slug = input.tag
  )
  select matches.content_kind, matches.content_id, matches.occurred_at
  from matches cross join input
  order by matches.occurred_at desc, matches.content_id
  limit (select result_limit from input)
$$;

revoke all on table public.content_tags, public.post_tags, public.thread_tags from anon, authenticated;
grant select on table public.content_tags, public.post_tags, public.thread_tags to anon, authenticated;
grant select on public.content_tag_catalog to anon, authenticated;
grant execute on function public.search_content_ids(text, integer) to authenticated;
grant execute on function public.list_tag_content_ids(text, integer) to authenticated;
grant all on table public.content_tags, public.post_tags, public.thread_tags to service_role;
