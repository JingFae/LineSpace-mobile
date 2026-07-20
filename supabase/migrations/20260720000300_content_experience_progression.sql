-- Make Level 1 the baseline and drive all experience awards from durable
-- content rows. Experience events are append-only and idempotent by event_key.

update public.user_experience
set level = greatest(1, least(10, level));

alter table public.user_experience
  alter column level set default 1;
alter table public.user_experience
  drop constraint if exists user_experience_level_check;
alter table public.user_experience
  add constraint user_experience_level_check check (level between 1 and 10);

update public.users
set level = greatest(1, least(10, level));

alter table public.users
  drop constraint if exists users_level_range_check;
alter table public.users
  add constraint users_level_range_check check (level between 1 and 10);

insert into public.user_experience (user_id, level)
select id, 1
from public.users
on conflict (user_id) do nothing;

-- Suspend row-by-row recalculation while deterministic events are backfilled.
drop trigger if exists experience_events_recalculate on public.experience_events;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  author_user_id, 'creator', 'publish_post', 5,
  'content:post:publish:' || id,
  author_user_id, author_user_id, created_at
from public.posts
where status = 'published'
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  author_user_id, 'creator', 'publish_thread', 5,
  'content:thread:publish:' || id,
  author_user_id, author_user_id, created_at
from public.poetry_threads
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  author_user_id, 'creator', 'participate_thread', 5,
  'content:thread:continuation:' || id,
  author_user_id, author_user_id, created_at
from public.thread_continuations
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  author_user_id, 'reviewer', 'comment_post', 5,
  'content:post:comment:' || id,
  author_user_id, author_user_id, created_at
from public.post_comments
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  post.author_user_id, 'creator', 'content_like', 2,
  'content:post:like:' || engagement.post_id || ':' || engagement.user_id,
  engagement.user_id, post.author_user_id, engagement.created_at
from public.post_likes engagement
join public.posts post on post.id = engagement.post_id
where post.author_user_id <> engagement.user_id
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  post.author_user_id, 'creator', 'content_save', 2,
  'content:post:save:' || engagement.post_id || ':' || engagement.user_id,
  engagement.user_id, post.author_user_id, engagement.created_at
from public.post_saves engagement
join public.posts post on post.id = engagement.post_id
where post.author_user_id <> engagement.user_id
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  thread.author_user_id, 'creator', 'content_like', 2,
  'content:thread:like:' || engagement.thread_id || ':' || engagement.user_id,
  engagement.user_id, thread.author_user_id, engagement.created_at
from public.thread_likes engagement
join public.poetry_threads thread on thread.id = engagement.thread_id
where thread.author_user_id <> engagement.user_id
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  thread.author_user_id, 'creator', 'content_save', 2,
  'content:thread:save:' || engagement.thread_id || ':' || engagement.user_id,
  engagement.user_id, thread.author_user_id, engagement.created_at
from public.thread_saves engagement
join public.poetry_threads thread on thread.id = engagement.thread_id
where thread.author_user_id <> engagement.user_id
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  continuation.author_user_id, 'creator', 'content_like', 2,
  'content:continuation:like:' || engagement.continuation_id || ':' || engagement.user_id,
  engagement.user_id, continuation.author_user_id, engagement.created_at
from public.thread_continuation_likes engagement
join public.thread_continuations continuation
  on continuation.id = engagement.continuation_id
where continuation.author_user_id <> engagement.user_id
on conflict (event_key) do nothing;

insert into public.experience_events (
  user_id, category, reason, points, event_key,
  actor_user_id, subject_user_id, created_at
)
select
  comment.author_user_id,
  'reviewer',
  case when engagement.kind = 'liked' then 'comment_like' else 'comment_save' end,
  2,
  'content:comment:' || engagement.kind || ':' || engagement.comment_id || ':' || engagement.user_id,
  engagement.user_id,
  comment.author_user_id,
  engagement.created_at
from public.post_comment_engagements engagement
join public.post_comments comment on comment.id = engagement.comment_id
where comment.author_user_id <> engagement.user_id
on conflict (event_key) do nothing;

-- Rebuild the materialized totals from the ledger before restoring the trigger.
with totals as (
  select
    users.id as user_id,
    coalesce(sum(events.points) filter (where events.category = 'creator'), 0)::integer
      as creator_total,
    coalesce(sum(events.points) filter (where events.category = 'reviewer'), 0)::integer
      as reviewer_total
  from public.users users
  left join public.experience_events events on events.user_id = users.id
  group by users.id
)
insert into public.user_experience (
  user_id, creator_experience, reviewer_experience, total_experience, level, updated_at
)
select
  user_id,
  creator_total,
  reviewer_total,
  creator_total + reviewer_total,
  greatest(1, least(10, floor((creator_total + reviewer_total) / 10.0)::integer + 1)),
  now()
from totals
on conflict (user_id) do update set
  creator_experience = excluded.creator_experience,
  reviewer_experience = excluded.reviewer_experience,
  total_experience = excluded.total_experience,
  level = excluded.level,
  updated_at = excluded.updated_at;

update public.users users
set level = experience.level,
    updated_at = now()
from public.user_experience experience
where experience.user_id = users.id
  and users.level is distinct from experience.level;

insert into public.user_badges (user_id, badge_id, display_order)
select user_id, 'badge-ink-weaver', 10
from public.user_experience
where creator_experience >= 20
on conflict (user_id, badge_id) do nothing;

insert into public.user_badges (user_id, badge_id, display_order)
select user_id, 'badge-soul-echo', 20
from public.user_experience
where reviewer_experience >= 20
on conflict (user_id, badge_id) do nothing;

create or replace function public.recalculate_user_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_total integer;
  reviewer_total integer;
  combined_total integer;
  calculated_level integer;
begin
  select
    coalesce(sum(points) filter (where category = 'creator'), 0)::integer,
    coalesce(sum(points) filter (where category = 'reviewer'), 0)::integer
  into creator_total, reviewer_total
  from public.experience_events
  where user_id = new.user_id;

  combined_total := creator_total + reviewer_total;
  calculated_level := greatest(
    1,
    least(10, floor(combined_total / 10.0)::integer + 1)
  );

  insert into public.user_experience (
    user_id, creator_experience, reviewer_experience,
    total_experience, level, updated_at
  )
  values (
    new.user_id, creator_total, reviewer_total,
    combined_total, calculated_level, now()
  )
  on conflict (user_id) do update set
    creator_experience = excluded.creator_experience,
    reviewer_experience = excluded.reviewer_experience,
    total_experience = excluded.total_experience,
    level = excluded.level,
    updated_at = excluded.updated_at;

  update public.users
  set level = calculated_level,
      updated_at = now()
  where id = new.user_id;

  if creator_total >= 20 then
    insert into public.user_badges (user_id, badge_id, display_order)
    values (new.user_id, 'badge-ink-weaver', 10)
    on conflict (user_id, badge_id) do nothing;
  end if;
  if reviewer_total >= 20 then
    insert into public.user_badges (user_id, badge_id, display_order)
    values (new.user_id, 'badge-soul-echo', 20)
    on conflict (user_id, badge_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.record_content_experience(
  p_user_id text,
  p_category text,
  p_reason text,
  p_points integer,
  p_event_key text,
  p_actor_user_id text,
  p_subject_user_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_event_key is null or p_event_key = '' then
    return;
  end if;
  if p_category not in ('creator', 'reviewer')
     or p_reason not in (
       'publish_post', 'publish_thread', 'participate_thread',
       'content_like', 'content_save', 'comment_post',
       'comment_like', 'comment_save'
     )
     or p_points not in (2, 5) then
    raise exception using errcode = '22023', message = 'Invalid content experience event';
  end if;

  insert into public.experience_events (
    user_id, category, reason, points, event_key,
    actor_user_id, subject_user_id
  )
  values (
    p_user_id, p_category, p_reason, p_points, p_event_key,
    p_actor_user_id, p_subject_user_id
  )
  on conflict (event_key) do nothing;
end;
$$;

create or replace function public.award_content_experience_from_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id text;
  reason_name text;
begin
  if tg_table_name = 'posts' then
    if new.status = 'published' then
      perform public.record_content_experience(
        new.author_user_id, 'creator', 'publish_post', 5,
        'content:post:publish:' || new.id,
        new.author_user_id, new.author_user_id
      );
    end if;
  elsif tg_table_name = 'poetry_threads' then
    perform public.record_content_experience(
      new.author_user_id, 'creator', 'publish_thread', 5,
      'content:thread:publish:' || new.id,
      new.author_user_id, new.author_user_id
    );
  elsif tg_table_name = 'thread_continuations' then
    perform public.record_content_experience(
      new.author_user_id, 'creator', 'participate_thread', 5,
      'content:thread:continuation:' || new.id,
      new.author_user_id, new.author_user_id
    );
  elsif tg_table_name = 'post_comments' then
    perform public.record_content_experience(
      new.author_user_id, 'reviewer', 'comment_post', 5,
      'content:post:comment:' || new.id,
      new.author_user_id, new.author_user_id
    );
  elsif tg_table_name = 'post_likes' or tg_table_name = 'post_saves' then
    select author_user_id into recipient_id from public.posts where id = new.post_id;
    if recipient_id is distinct from new.user_id then
      reason_name := case when tg_table_name = 'post_likes' then 'content_like' else 'content_save' end;
      perform public.record_content_experience(
        recipient_id, 'creator', reason_name, 2,
        'content:post:' || case when tg_table_name = 'post_likes' then 'like:' else 'save:' end
          || new.post_id || ':' || new.user_id,
        new.user_id, recipient_id
      );
    end if;
  elsif tg_table_name = 'thread_likes' or tg_table_name = 'thread_saves' then
    select author_user_id into recipient_id from public.poetry_threads where id = new.thread_id;
    if recipient_id is distinct from new.user_id then
      reason_name := case when tg_table_name = 'thread_likes' then 'content_like' else 'content_save' end;
      perform public.record_content_experience(
        recipient_id, 'creator', reason_name, 2,
        'content:thread:' || case when tg_table_name = 'thread_likes' then 'like:' else 'save:' end
          || new.thread_id || ':' || new.user_id,
        new.user_id, recipient_id
      );
    end if;
  elsif tg_table_name = 'thread_continuation_likes' then
    select author_user_id into recipient_id
    from public.thread_continuations where id = new.continuation_id;
    if recipient_id is distinct from new.user_id then
      perform public.record_content_experience(
        recipient_id, 'creator', 'content_like', 2,
        'content:continuation:like:' || new.continuation_id || ':' || new.user_id,
        new.user_id, recipient_id
      );
    end if;
  elsif tg_table_name = 'post_comment_engagements' then
    select author_user_id into recipient_id
    from public.post_comments where id = new.comment_id;
    if recipient_id is distinct from new.user_id then
      reason_name := case when new.kind = 'liked' then 'comment_like' else 'comment_save' end;
      perform public.record_content_experience(
        recipient_id, 'reviewer', reason_name, 2,
        'content:comment:' || new.kind || ':' || new.comment_id || ':' || new.user_id,
        new.user_id, recipient_id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists experience_events_recalculate on public.experience_events;
create trigger experience_events_recalculate
after insert on public.experience_events
for each row execute function public.recalculate_user_experience();

drop trigger if exists posts_award_experience on public.posts;
create trigger posts_award_experience
after insert or update of status on public.posts
for each row execute function public.award_content_experience_from_row();

drop trigger if exists poetry_threads_award_experience on public.poetry_threads;
create trigger poetry_threads_award_experience
after insert on public.poetry_threads
for each row execute function public.award_content_experience_from_row();

drop trigger if exists thread_continuations_award_experience on public.thread_continuations;
create trigger thread_continuations_award_experience
after insert on public.thread_continuations
for each row execute function public.award_content_experience_from_row();

drop trigger if exists post_comments_award_experience on public.post_comments;
create trigger post_comments_award_experience
after insert on public.post_comments
for each row execute function public.award_content_experience_from_row();

drop trigger if exists post_likes_award_experience on public.post_likes;
create trigger post_likes_award_experience
after insert on public.post_likes
for each row execute function public.award_content_experience_from_row();

drop trigger if exists post_saves_award_experience on public.post_saves;
create trigger post_saves_award_experience
after insert on public.post_saves
for each row execute function public.award_content_experience_from_row();

drop trigger if exists thread_likes_award_experience on public.thread_likes;
create trigger thread_likes_award_experience
after insert on public.thread_likes
for each row execute function public.award_content_experience_from_row();

drop trigger if exists thread_saves_award_experience on public.thread_saves;
create trigger thread_saves_award_experience
after insert on public.thread_saves
for each row execute function public.award_content_experience_from_row();

drop trigger if exists thread_continuation_likes_award_experience
  on public.thread_continuation_likes;
create trigger thread_continuation_likes_award_experience
after insert on public.thread_continuation_likes
for each row execute function public.award_content_experience_from_row();

drop trigger if exists post_comment_engagements_award_experience
  on public.post_comment_engagements;
create trigger post_comment_engagements_award_experience
after insert on public.post_comment_engagements
for each row execute function public.award_content_experience_from_row();

revoke execute on function public.recalculate_user_experience()
from public, anon, authenticated;
revoke execute on function public.record_content_experience(text, text, text, integer, text, text, text)
from public, anon, authenticated;
revoke execute on function public.award_content_experience_from_row()
from public, anon, authenticated;

grant execute on function public.recalculate_user_experience(),
  public.record_content_experience(text, text, text, integer, text, text, text),
  public.award_content_experience_from_row()
to service_role;
