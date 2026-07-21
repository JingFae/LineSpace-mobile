-- Keep a relay's opening line distinct from its theme/rules. Existing generic
-- draft columns remain intact so older clients and saved drafts keep working.

alter table public.poem_drafts
  add column if not exists relay_first_line text,
  add column if not exists relay_rules text;

do $$
begin
  if exists (
    select 1 from public.poem_drafts
    where relay_first_line is not null and char_length(relay_first_line) > 1000
  ) then
    raise exception using message =
      'poem_drafts.relay_first_line contains values longer than 1000 characters; shorten them before applying this migration';
  end if;
  if exists (
    select 1 from public.poem_drafts
    where relay_rules is not null and char_length(relay_rules) > 5000
  ) then
    raise exception using message =
      'poem_drafts.relay_rules contains values longer than 5000 characters; shorten them before applying this migration';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.poem_drafts'::regclass
      and conname = 'poem_drafts_relay_first_line_length_check'
  ) then
    alter table public.poem_drafts
      add constraint poem_drafts_relay_first_line_length_check
      check (relay_first_line is null or char_length(relay_first_line) <= 1000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.poem_drafts'::regclass
      and conname = 'poem_drafts_relay_rules_length_check'
  ) then
    alter table public.poem_drafts
      add constraint poem_drafts_relay_rules_length_check
      check (relay_rules is null or char_length(relay_rules) <= 5000);
  end if;
end;
$$;

create or replace function public.publish_draft_as_thread(p_draft_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  draft_row public.poem_drafts;
  thread_id text := gen_random_uuid()::text;
  line_row jsonb;
  line_index integer := 0;
  parent_id text := null;
  continuation_id text;
  resolved_title text;
  resolved_first_line text;
  resolved_rules text;
begin
  select * into draft_row
  from public.poem_drafts
  where id = p_draft_id and owner_user_id = actor_id
    and status <> 'published'
  for update;

  if draft_row.id is null then
    raise exception using errcode = '42501', message = 'Draft access denied';
  end if;
  if draft_row.mode <> 'relay' then
    raise exception using errcode = '22023', message = 'Only relay drafts can become threads';
  end if;

  resolved_title := coalesce(nullif(btrim(draft_row.title), ''), 'poem relay');
  resolved_first_line := coalesce(
    nullif(btrim(draft_row.relay_first_line), ''),
    nullif(btrim(draft_row.body), '')
  );
  resolved_rules := nullif(btrim(draft_row.relay_rules), '');

  if resolved_first_line is null then
    raise exception using errcode = '23514', message = 'A poem relay needs a first line';
  end if;

  insert into public.poetry_threads (
    id, author_user_id, title, prompt, starting_content, rules, tags, mentions,
    media, visibility, status
  )
  values (
    thread_id,
    actor_id,
    resolved_title,
    coalesce(resolved_rules, resolved_title),
    resolved_first_line,
    resolved_rules,
    draft_row.tags,
    draft_row.mentions,
    draft_row.media,
    coalesce(draft_row.settings ->> 'visibility', 'public'),
    'open'
  );

  for line_row in
    select value from jsonb_array_elements(coalesce(draft_row.version_lines, '[]'::jsonb))
  loop
    line_index := line_index + 1;
    continuation_id := gen_random_uuid()::text;
    insert into public.thread_continuations (
      id, thread_id, parent_continuation_id, line_number, content, author_user_id
    )
    values (
      continuation_id,
      thread_id,
      parent_id,
      line_index + 1,
      coalesce(line_row ->> 'text', ''),
      actor_id
    );
    parent_id := continuation_id;
  end loop;

  update public.poem_drafts
  set status = 'published',
      title = resolved_title,
      relay_first_line = resolved_first_line,
      relay_rules = resolved_rules,
      published_thread_id = thread_id
  where id = p_draft_id;
  return thread_id;
end;
$$;

grant update (relay_first_line, relay_rules)
on public.poem_drafts to authenticated;

revoke execute on function public.publish_draft_as_thread(text)
from public, anon;
grant execute on function public.publish_draft_as_thread(text)
to authenticated;
