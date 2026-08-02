-- Before undone_at existed, Undo restored the post body but left the latest
-- application looking active. Mark only the latest mismatched application per
-- post as undone so existing cards can be reapplied after the rollout.

with latest_application as (
  select distinct on (application.post_id)
    application.id,
    application.post_id,
    application.applied_lines
  from public.community_spark_applications as application
  where application.undone_at is null
  order by application.post_id, application.created_at desc, application.id desc
), legacy_undo as (
  select latest.id
  from latest_application as latest
  join public.posts as post on post.id = latest.post_id
  where array_to_string(array(
    select btrim(current_line.line)
    from regexp_split_to_table(post.body, E'\\r?\\n')
      with ordinality as current_line(line, position)
    where btrim(current_line.line) <> ''
    order by current_line.position
  ), E'\n') <> array_to_string(array(
    select btrim(applied_line.line)
    from unnest(latest.applied_lines) with ordinality
      as applied_line(line, position)
    where btrim(applied_line.line) <> ''
    order by applied_line.position
  ), E'\n')
)
update public.community_spark_applications as application
set undone_at = now()
from legacy_undo
where application.id = legacy_undo.id;
