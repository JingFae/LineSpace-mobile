-- SQLSTATE 40001 means serialization_failure. PostgREST may retry that error
-- automatically, so using it for an expected stale-suggestion conflict can
-- turn one HTTP request into a database retry storm. Preserve the existing
-- implementation behind private wrappers and translate only those expected
-- conflicts to PostgREST's explicit HTTP 409 code.

alter function public.apply_community_spark(text, text, text, text[], text)
  rename to apply_community_spark_retryable_legacy;

alter function public.undo_community_spark(text, text, text[], text[])
  rename to undo_community_spark_retryable_legacy;

revoke execute on function public.apply_community_spark_retryable_legacy(
  text, text, text, text[], text
) from public, anon, authenticated;

revoke execute on function public.undo_community_spark_retryable_legacy(
  text, text, text[], text[]
) from public, anon, authenticated;

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
  conflict_message text;
begin
  return public.apply_community_spark_retryable_legacy(
    p_post_id,
    p_suggestion_id,
    p_base_revision,
    p_proposed_lines,
    p_source_comment_id
  );
exception
  when serialization_failure then
    get stacked diagnostics conflict_message = message_text;
    raise sqlstate 'PT409' using message = conflict_message;
end;
$$;

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
  conflict_message text;
begin
  return public.undo_community_spark_retryable_legacy(
    p_post_id,
    p_suggestion_id,
    p_applied_lines,
    p_previous_lines
  );
exception
  when serialization_failure then
    get stacked diagnostics conflict_message = message_text;
    raise sqlstate 'PT409' using message = conflict_message;
end;
$$;

revoke execute on function public.apply_community_spark(
  text, text, text, text[], text
) from public, anon;
grant execute on function public.apply_community_spark(
  text, text, text, text[], text
) to authenticated;

revoke execute on function public.undo_community_spark(
  text, text, text[], text[]
) from public, anon;
grant execute on function public.undo_community_spark(
  text, text, text[], text[]
) to authenticated;

notify pgrst, 'reload schema';
