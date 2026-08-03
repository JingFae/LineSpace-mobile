-- Persist one durable row for every authenticated Spark generation attempt.
-- The table is private analytics infrastructure: only the server-side
-- service role may read or write it.

create table if not exists public.ai_spark_requests (
  id text primary key check (char_length(id) between 1 and 100),
  user_id text not null references public.users(id) on delete cascade,
  feature varchar(32) not null
    check (feature in ('creative_spark', 'community_spark')),
  source_surface varchar(32) not null
    check (source_surface in ('compose_new', 'compose_edit', 'post_detail')),
  post_id text references public.posts(id) on delete set null,
  status varchar(16) not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  provider varchar(32) not null,
  model varchar(120) not null,
  provider_request_id text,
  suggestions_count integer not null default 0
    check (suggestions_count between 0 and 20),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  error_code varchar(100),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status = 'pending' and completed_at is null)
    or (status in ('succeeded', 'failed') and completed_at is not null)
  )
);

create index if not exists ai_spark_requests_user_feature_started_idx
  on public.ai_spark_requests (user_id, feature, started_at desc);

create index if not exists ai_spark_requests_feature_status_started_idx
  on public.ai_spark_requests (feature, status, started_at desc);

alter table public.ai_spark_requests enable row level security;

revoke all on table public.ai_spark_requests
from public, anon, authenticated;
grant all on table public.ai_spark_requests to service_role;

create or replace view public.ai_spark_usage_by_user
with (security_invoker = true)
as
select
  app_user.id as user_id,
  app_user.handle,
  app_user.display_name,
  count(spark_request.id) filter (
    where spark_request.feature = 'creative_spark'
  )::bigint as creative_spark_requests,
  count(spark_request.id) filter (
    where spark_request.feature = 'community_spark'
  )::bigint as community_spark_requests,
  count(spark_request.id) filter (
    where spark_request.feature = 'creative_spark'
      and spark_request.status = 'succeeded'
  )::bigint as creative_spark_successes,
  count(spark_request.id) filter (
    where spark_request.feature = 'community_spark'
      and spark_request.status = 'succeeded'
  )::bigint as community_spark_successes,
  count(spark_request.id) filter (
    where spark_request.status = 'failed'
  )::bigint as failed_requests,
  coalesce(sum(spark_request.input_tokens), 0)::bigint as input_tokens,
  coalesce(sum(spark_request.output_tokens), 0)::bigint as output_tokens,
  max(spark_request.started_at) as last_requested_at
from public.users as app_user
left join public.ai_spark_requests as spark_request
  on spark_request.user_id = app_user.id
group by app_user.id, app_user.handle, app_user.display_name;

revoke all on table public.ai_spark_usage_by_user
from public, anon, authenticated;
grant select on table public.ai_spark_usage_by_user to service_role;
