-- Make Community Spark application idempotent and revision-checked without
-- holding a post row lock while performing preliminary reads. A short lock
-- timeout prevents abandoned browser requests from queueing for minutes.

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
  perform set_config('lock_timeout', '5s', true);

  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Community Spark authentication required';
  end if;
  if p_suggestion_id is null
    or btrim(p_suggestion_id) = ''
    or length(p_suggestion_id) > 200
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid Community Spark suggestion';
  end if;
  if cardinality(p_proposed_lines) not between 1 and 200
    or exists (
      select 1
      from unnest(p_proposed_lines) as proposed_line
      where btrim(proposed_line) = '' or length(proposed_line) > 2000
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid Community Spark lines';
  end if;

  -- A retried browser request for an already committed suggestion is a
  -- successful no-op and should not wait for the post row again.
  select * into existing_application
  from public.community_spark_applications
  where id = p_suggestion_id;
  if found then
    if existing_application.post_id <> p_post_id
      or existing_application.owner_user_id <> actor_id
    then
      raise exception using
        errcode = '42501',
        message = 'Community Spark suggestion access denied';
    end if;
    return jsonb_build_object(
      'postId', existing_application.post_id,
      'replyCommentId', existing_application.reply_comment_id
    );
  end if;

  if p_source_comment_id is not null then
    select * into source_row
    from public.post_comments
    where id = p_source_comment_id
      and post_id = p_post_id;
    if source_row.id is null or source_row.author_user_id = actor_id then
      raise exception using
        errcode = '22023',
        message = 'Invalid Community Spark source comment';
    end if;
    reply_id := gen_random_uuid()::text;
  end if;

  -- PostgreSQL evaluates this condition against the row version it actually
  -- updates. Two suggestions generated from the same poem cannot both win.
  update public.posts as candidate
  set
    body = array_to_string(p_proposed_lines, E'\n'),
    version_lines = null,
    edited_at = now(),
    updated_at = now()
  where candidate.id = p_post_id
    and candidate.author_user_id = actor_id
    and candidate.status = 'published'
    and md5(array_to_string(array(
      select btrim(source_line.line)
      from regexp_split_to_table(candidate.body, E'\\r?\\n')
        with ordinality as source_line(line, position)
      where btrim(source_line.line) <> ''
      order by source_line.position
    ), E'\n')) = p_base_revision
  returning candidate.* into post_row;

  if post_row.id is null then
    -- A concurrent retry can become visible after waiting for the winner.
    select * into existing_application
    from public.community_spark_applications
    where id = p_suggestion_id;
    if found then
      if existing_application.post_id <> p_post_id
        or existing_application.owner_user_id <> actor_id
      then
        raise exception using
          errcode = '42501',
          message = 'Community Spark suggestion access denied';
      end if;
      return jsonb_build_object(
        'postId', existing_application.post_id,
        'replyCommentId', existing_application.reply_comment_id
      );
    end if;

    if exists (
      select 1
      from public.posts
      where id = p_post_id
        and author_user_id = actor_id
        and status = 'published'
    ) then
      raise exception using
        errcode = '40001',
        message = 'Community Spark suggestion is stale';
    end if;
    raise exception using
      errcode = '42501',
      message = 'Community Spark post access denied';
  end if;

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
exception
  when lock_not_available then
    raise exception using
      errcode = '40001',
      message = 'Community Spark post is busy; retry';
end;
$$;

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
