-- Track whether an idempotent Community Spark application has been undone so
-- the same card can be applied again without duplicating its reply or credit.

alter table public.community_spark_applications
  add column if not exists undone_at timestamptz;

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
    if existing_application.undone_at is null then
      return jsonb_build_object(
        'postId', existing_application.post_id,
        'replyCommentId', existing_application.reply_comment_id
      );
    end if;
    -- Reapplication keeps the original conversation reply and contributor
    -- credit instead of creating duplicates.
    reply_id := existing_application.reply_comment_id;
  elsif p_source_comment_id is not null then
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
    -- A concurrent first application or reapplication is a successful retry.
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
      if existing_application.undone_at is null then
        return jsonb_build_object(
          'postId', existing_application.post_id,
          'replyCommentId', existing_application.reply_comment_id
        );
      end if;
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

  if existing_application.id is not null then
    update public.community_spark_applications
    set
      applied_lines = p_proposed_lines,
      undone_at = null
    where id = p_suggestion_id;
    return jsonb_build_object(
      'postId', p_post_id,
      'replyCommentId', reply_id
    );
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
    applied_lines,
    undone_at
  ) values (
    p_suggestion_id,
    p_post_id,
    actor_id,
    source_row.id,
    reply_id,
    p_proposed_lines,
    null
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

create or replace function public.undo_community_spark(
  p_post_id text,
  p_suggestion_id text,
  p_applied_lines text[],
  p_previous_lines text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  restored_post public.posts;
  application_row public.community_spark_applications;
  expected_body text;
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
    or cardinality(p_applied_lines) not between 1 and 200
    or cardinality(p_previous_lines) not between 1 and 200
    or exists (
      select 1
      from unnest(p_applied_lines || p_previous_lines) as poem_line
      where btrim(poem_line) = '' or length(poem_line) > 2000
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid Community Spark undo';
  end if;

  select * into application_row
  from public.community_spark_applications
  where id = p_suggestion_id;
  if not found
    or application_row.post_id <> p_post_id
    or application_row.owner_user_id <> actor_id
  then
    raise exception using
      errcode = '42501',
      message = 'Community Spark application access denied';
  end if;
  if application_row.undone_at is not null then
    return jsonb_build_object('postId', application_row.post_id);
  end if;

  select array_to_string(array(
    select btrim(applied_line.line)
    from unnest(p_applied_lines) with ordinality
      as applied_line(line, position)
    where btrim(applied_line.line) <> ''
    order by applied_line.position
  ), E'\n')
  into expected_body;

  update public.posts as candidate
  set
    body = array_to_string(array(
      select btrim(previous_line.line)
      from unnest(p_previous_lines) with ordinality
        as previous_line(line, position)
      where btrim(previous_line.line) <> ''
      order by previous_line.position
    ), E'\n'),
    edited_at = now(),
    updated_at = now()
  where candidate.id = p_post_id
    and candidate.author_user_id = actor_id
    and candidate.status = 'published'
    and array_to_string(array(
      select btrim(current_line.line)
      from regexp_split_to_table(candidate.body, E'\\r?\\n')
        with ordinality as current_line(line, position)
      where btrim(current_line.line) <> ''
      order by current_line.position
    ), E'\n') = expected_body
  returning candidate.* into restored_post;

  if restored_post.id is null then
    select * into application_row
    from public.community_spark_applications
    where id = p_suggestion_id;
    if found and application_row.undone_at is not null then
      return jsonb_build_object('postId', application_row.post_id);
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
        message = 'Community Spark undo is stale';
    end if;
    raise exception using
      errcode = '42501',
      message = 'Community Spark post access denied';
  end if;

  update public.community_spark_applications
  set undone_at = now()
  where id = p_suggestion_id;

  return jsonb_build_object('postId', restored_post.id);
exception
  when lock_not_available then
    raise exception using
      errcode = '40001',
      message = 'Community Spark post is busy; retry';
end;
$$;

revoke execute on function public.undo_community_spark(
  text,
  text,
  text[],
  text[]
) from public, anon;
grant execute on function public.undo_community_spark(
  text,
  text,
  text[],
  text[]
) to authenticated;
