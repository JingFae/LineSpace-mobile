-- Thread Version AI is derived content. Generate it once per content revision,
-- persist the result, and serve the same snapshot to every reader.

alter table public.poetry_threads
  add column if not exists content_revision bigint not null default 1;

alter table public.poetry_threads
  drop constraint if exists poetry_threads_content_revision_check;
alter table public.poetry_threads
  add constraint poetry_threads_content_revision_check
  check (content_revision >= 1);

create table if not exists public.thread_ai_version_snapshots (
  id text primary key default gen_random_uuid()::text,
  thread_id text not null references public.poetry_threads(id) on delete cascade,
  source_revision bigint not null check (source_revision >= 1),
  source_hash text not null,
  status text not null
    check (status in ('processing', 'ready', 'failed')),
  prompt_version text not null,
  model text not null,
  selected_version_id text,
  recommended_rationale text,
  harmonized_rationale text,
  result jsonb,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  error_code text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (thread_id, source_revision, prompt_version, model)
);

create index if not exists thread_ai_snapshots_latest_ready_idx
  on public.thread_ai_version_snapshots
    (thread_id, prompt_version, model, source_revision desc)
  where status = 'ready';

create table if not exists public.thread_ai_generation_jobs (
  thread_id text primary key references public.poetry_threads(id) on delete cascade,
  target_revision bigint not null check (target_revision >= 1),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  run_after timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists thread_ai_jobs_due_idx
  on public.thread_ai_generation_jobs (run_after, updated_at)
  where status in ('pending', 'failed');

create or replace function public.enqueue_thread_ai_generation(
  p_thread_id text,
  p_delay_seconds integer default 12
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_revision bigint;
begin
  select content_revision
  into current_revision
  from public.poetry_threads
  where id = p_thread_id;

  if current_revision is null then
    return;
  end if;

  insert into public.thread_ai_generation_jobs (
    thread_id,
    target_revision,
    status,
    run_after,
    attempts,
    locked_at,
    last_error,
    updated_at
  )
  values (
    p_thread_id,
    current_revision,
    'pending',
    now() + make_interval(secs => greatest(0, least(p_delay_seconds, 300))),
    0,
    null,
    null,
    now()
  )
  on conflict (thread_id) do update
  set
    target_revision = excluded.target_revision,
    status = case
      when
        public.thread_ai_generation_jobs.target_revision = excluded.target_revision
        and public.thread_ai_generation_jobs.status = 'processing'
      then 'processing'
      else 'pending'
    end,
    run_after = case
      when
        public.thread_ai_generation_jobs.target_revision = excluded.target_revision
        and public.thread_ai_generation_jobs.status = 'processing'
      then public.thread_ai_generation_jobs.run_after
      else excluded.run_after
    end,
    attempts = case
      when public.thread_ai_generation_jobs.target_revision = excluded.target_revision
        then public.thread_ai_generation_jobs.attempts
      else 0
    end,
    locked_at = case
      when
        public.thread_ai_generation_jobs.target_revision = excluded.target_revision
        and public.thread_ai_generation_jobs.status = 'processing'
      then public.thread_ai_generation_jobs.locked_at
      else null
    end,
    last_error = null,
    updated_at = now();
end;
$$;

create or replace function public.bump_thread_content_revision()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if
    new.title is distinct from old.title
    or new.prompt is distinct from old.prompt
    or new.starting_content is distinct from old.starting_content
    or new.rules is distinct from old.rules
  then
    new.content_revision := old.content_revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists poetry_threads_bump_content_revision
  on public.poetry_threads;
create trigger poetry_threads_bump_content_revision
before update of title, prompt, starting_content, rules
on public.poetry_threads
for each row execute function public.bump_thread_content_revision();

create or replace function public.enqueue_thread_ai_after_thread_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_thread_ai_generation(new.id, 12);
  elsif new.content_revision is distinct from old.content_revision then
    perform public.enqueue_thread_ai_generation(new.id, 12);
  end if;
  return new;
end;
$$;

drop trigger if exists poetry_threads_enqueue_ai_version
  on public.poetry_threads;
create trigger poetry_threads_enqueue_ai_version
after insert or update
on public.poetry_threads
for each row execute function public.enqueue_thread_ai_after_thread_change();

create or replace function public.bump_thread_revision_after_continuation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_thread_id text;
begin
  affected_thread_id := case when tg_op = 'DELETE' then old.thread_id else new.thread_id end;

  if tg_op = 'INSERT' or tg_op = 'DELETE' then
    update public.poetry_threads
    set content_revision = content_revision + 1
    where id = affected_thread_id;
  elsif
    new.content is distinct from old.content
    or new.parent_continuation_id is distinct from old.parent_continuation_id
    or new.line_number is distinct from old.line_number
  then
    update public.poetry_threads
    set content_revision = content_revision + 1
    where id = affected_thread_id;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists thread_continuations_bump_thread_revision
  on public.thread_continuations;
drop trigger if exists thread_continuations_bump_thread_revision_insert
  on public.thread_continuations;
drop trigger if exists thread_continuations_bump_thread_revision_update
  on public.thread_continuations;
drop trigger if exists thread_continuations_bump_thread_revision_delete
  on public.thread_continuations;

create trigger thread_continuations_bump_thread_revision_insert
after insert
on public.thread_continuations
for each row execute function public.bump_thread_revision_after_continuation();

create trigger thread_continuations_bump_thread_revision_update
after update of content, parent_continuation_id, line_number
on public.thread_continuations
for each row execute function public.bump_thread_revision_after_continuation();

create trigger thread_continuations_bump_thread_revision_delete
after delete
on public.thread_continuations
for each row execute function public.bump_thread_revision_after_continuation();

create or replace function public.claim_thread_ai_generation_job(
  p_thread_id text default null,
  p_force boolean default false
)
returns table (
  thread_id text,
  target_revision bigint,
  attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidate as (
    select job.thread_id
    from public.thread_ai_generation_jobs job
    where
      (p_thread_id is null or job.thread_id = p_thread_id)
      and (
        job.status in ('pending', 'failed')
        or (
          job.status = 'processing'
          and job.locked_at < now() - interval '5 minutes'
        )
      )
      and job.attempts < 5
      and (p_force or job.run_after <= now())
    order by job.run_after, job.updated_at
    for update skip locked
    limit 1
  ),
  claimed as (
    update public.thread_ai_generation_jobs job
    set
      status = 'processing',
      attempts = job.attempts + 1,
      locked_at = now(),
      last_error = null,
      updated_at = now()
    from candidate
    where job.thread_id = candidate.thread_id
    returning job.thread_id, job.target_revision, job.attempts
  )
  select claimed.thread_id, claimed.target_revision, claimed.attempts
  from claimed;
end;
$$;

alter table public.thread_ai_version_snapshots enable row level security;
alter table public.thread_ai_generation_jobs enable row level security;

drop policy if exists "public reads Thread AI version snapshots"
  on public.thread_ai_version_snapshots;
create policy "public reads Thread AI version snapshots"
on public.thread_ai_version_snapshots
for select to anon, authenticated
using (
  exists (
    select 1
    from public.poetry_threads thread
    where thread.id = thread_ai_version_snapshots.thread_id
      and (
        thread.visibility = 'public'
        or thread.author_user_id = public.current_linespace_user_id()
      )
  )
);

revoke all on table public.thread_ai_version_snapshots,
  public.thread_ai_generation_jobs
from public, anon, authenticated;

grant select on table public.thread_ai_version_snapshots
to anon, authenticated;

grant all on table public.thread_ai_version_snapshots,
  public.thread_ai_generation_jobs
to service_role;

revoke all on function public.enqueue_thread_ai_generation(text, integer)
from public, anon, authenticated;
grant execute on function public.enqueue_thread_ai_generation(text, integer)
to service_role;

revoke all on function public.claim_thread_ai_generation_job(text, boolean)
from public, anon, authenticated;
grant execute on function public.claim_thread_ai_generation_job(text, boolean)
to service_role;

revoke all on function public.bump_thread_content_revision()
from public, anon, authenticated;
revoke all on function public.enqueue_thread_ai_after_thread_change()
from public, anon, authenticated;
revoke all on function public.bump_thread_revision_after_continuation()
from public, anon, authenticated;

insert into public.thread_ai_generation_jobs (
  thread_id,
  target_revision,
  status,
  run_after,
  attempts,
  updated_at
)
select
  thread.id,
  thread.content_revision,
  'pending',
  now(),
  0,
  now()
from public.poetry_threads thread
on conflict (thread_id) do update
set
  target_revision = excluded.target_revision,
  status = 'pending',
  run_after = excluded.run_after,
  attempts = 0,
  locked_at = null,
  last_error = null,
  updated_at = now();
