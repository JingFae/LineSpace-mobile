-- Community Spark turns reader feedback into an author-controlled edit while
-- preserving a durable, auditable attribution to the source comment.

create table if not exists public.post_comment_contributions (
  post_id text not null references public.posts(id) on delete cascade,
  comment_id text not null references public.post_comments(id) on delete cascade,
  contributor_user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, comment_id)
);

create index if not exists post_comment_contributions_user_idx
  on public.post_comment_contributions (contributor_user_id, created_at desc);

create table if not exists public.community_spark_applications (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  owner_user_id text not null references public.users(id) on delete cascade,
  source_comment_id text references public.post_comments(id) on delete set null,
  reply_comment_id text references public.post_comments(id) on delete set null,
  applied_lines text[] not null check (cardinality(applied_lines) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists community_spark_applications_post_idx
  on public.community_spark_applications (post_id, created_at desc);

alter table public.post_comment_contributions enable row level security;
alter table public.community_spark_applications enable row level security;

drop policy if exists "read visible post comment contributions"
  on public.post_comment_contributions;
create policy "read visible post comment contributions"
on public.post_comment_contributions for select to anon, authenticated
using (
  exists (
    select 1
    from public.posts post
    where post.id = post_comment_contributions.post_id
      and post.status = 'published'
      and (
        post.visibility = 'public'
        or post.author_user_id = public.current_linespace_user_id()
        or (
          post.visibility = 'include'
          and public.current_linespace_user_id() is not null
          and public.current_linespace_user_id() = any(post.audience_user_ids)
        )
        or (
          post.visibility = 'exclude'
          and (
            public.current_linespace_user_id() is null
            or not (public.current_linespace_user_id() = any(post.audience_user_ids))
          )
        )
      )
  )
);

create or replace function public.apply_community_spark(
  p_post_id text,
  p_suggestion_id text,
  p_base_revision text,
  p_proposed_lines text[],
  p_source_comment_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  post_row public.posts;
  source_row public.post_comments;
  existing_application public.community_spark_applications;
  reply_id text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Community Spark authentication required';
  end if;
  if p_suggestion_id is null or btrim(p_suggestion_id) = '' or length(p_suggestion_id) > 200 then
    raise exception using errcode = '22023', message = 'Invalid Community Spark suggestion';
  end if;
  if cardinality(p_proposed_lines) not between 1 and 200
    or exists (
      select 1
      from unnest(p_proposed_lines) as proposed_line
      where btrim(proposed_line) = '' or length(proposed_line) > 2000
    )
  then
    raise exception using errcode = '22023', message = 'Invalid Community Spark lines';
  end if;

  select * into post_row
  from public.posts
  where id = p_post_id
    and author_user_id = actor_id
    and status = 'published'
  for update;
  if post_row.id is null then
    raise exception using errcode = '42501', message = 'Community Spark post access denied';
  end if;

  select * into existing_application
  from public.community_spark_applications
  where id = p_suggestion_id;
  if found then
    if existing_application.post_id <> p_post_id
      or existing_application.owner_user_id <> actor_id
    then
      raise exception using errcode = '42501', message = 'Community Spark suggestion access denied';
    end if;
    return jsonb_build_object(
      'postId', existing_application.post_id,
      'replyCommentId', existing_application.reply_comment_id
    );
  end if;

  if md5(array_to_string(array(
    select btrim(source_line.line)
    from regexp_split_to_table(post_row.body, E'\\r?\\n')
      with ordinality as source_line(line, position)
    where btrim(source_line.line) <> ''
    order by source_line.position
  ), E'\n')) is distinct from p_base_revision then
    raise exception using errcode = '40001', message = 'Community Spark suggestion is stale';
  end if;

  if p_source_comment_id is not null then
    select * into source_row
    from public.post_comments
    where id = p_source_comment_id
      and post_id = p_post_id;
    if source_row.id is null or source_row.author_user_id = actor_id then
      raise exception using errcode = '22023', message = 'Invalid Community Spark source comment';
    end if;
    reply_id := gen_random_uuid()::text;
  end if;

  update public.posts
  set
    body = array_to_string(p_proposed_lines, E'\n'),
    version_lines = null,
    edited_at = now(),
    updated_at = now()
  where id = p_post_id;

  if source_row.id is not null then
    insert into public.post_comments (
      id,
      post_id,
      author_user_id,
      parent_comment_id,
      body
    ) values (
      reply_id,
      p_post_id,
      actor_id,
      source_row.id,
      'this comment gives me inspiration'
    );

    insert into public.post_comment_contributions (
      post_id,
      comment_id,
      contributor_user_id
    ) values (
      p_post_id,
      source_row.id,
      source_row.author_user_id
    )
    on conflict (post_id, comment_id) do nothing;
  end if;

  insert into public.community_spark_applications (
    id,
    post_id,
    owner_user_id,
    source_comment_id,
    reply_comment_id,
    applied_lines
  ) values (
    p_suggestion_id,
    p_post_id,
    actor_id,
    source_row.id,
    reply_id,
    p_proposed_lines
  );

  return jsonb_build_object(
    'postId', p_post_id,
    'replyCommentId', reply_id
  );
end;
$$;

revoke all on public.community_spark_applications from public, anon, authenticated;
revoke insert, update, delete on public.post_comment_contributions from public, anon, authenticated;
grant select on public.post_comment_contributions to anon, authenticated;

revoke execute on function public.apply_community_spark(
  text,
  text,
  text,
  text[],
  text
) from public, anon;
grant execute on function public.apply_community_spark(
  text,
  text,
  text,
  text[],
  text
) to authenticated;
