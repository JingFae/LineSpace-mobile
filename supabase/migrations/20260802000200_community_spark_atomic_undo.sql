-- Community Spark application runs through a security-definer RPC because
-- regular authenticated clients intentionally cannot update posts directly.
-- Undo must use the same boundary and compare the current poem atomically.

create or replace function public.undo_community_spark(
  p_post_id text,
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
  expected_body text;
begin
  perform set_config('lock_timeout', '5s', true);

  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Community Spark authentication required';
  end if;
  if cardinality(p_applied_lines) not between 1 and 200
    or cardinality(p_previous_lines) not between 1 and 200
    or exists (
      select 1
      from unnest(p_applied_lines || p_previous_lines) as poem_line
      where btrim(poem_line) = '' or length(poem_line) > 2000
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid Community Spark undo lines';
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
  text[],
  text[]
) from public, anon;
grant execute on function public.undo_community_spark(
  text,
  text[],
  text[]
) to authenticated;
