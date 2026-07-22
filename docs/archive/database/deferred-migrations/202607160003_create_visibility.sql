-- DEFERRED: not part of the canonical Supabase migration chain.
-- Create-flow metadata for post and poem-relay drafts.
-- Audience membership is stored as user ids so visibility can be enforced at publish time.

alter table poem_drafts
  add column if not exists mentions jsonb not null default '[]'::jsonb;

alter table poem_drafts
  add column if not exists visibility varchar(16) not null default 'public'
    check (visibility in ('public', 'include', 'exclude'));

alter table poem_drafts
  add column if not exists audience_user_ids jsonb not null default '[]'::jsonb;

alter table poem_drafts
  add column if not exists allow_sharing boolean not null default true;

create index if not exists poem_drafts_visibility_idx
  on poem_drafts (visibility, updated_at desc);

create table if not exists poem_draft_audiences (
  draft_id text not null references poem_drafts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  mode varchar(16) not null check (mode in ('include', 'exclude')),
  created_at timestamptz not null default now(),
  primary key (draft_id, user_id)
);

create index if not exists poem_draft_audiences_user_idx
  on poem_draft_audiences (user_id, draft_id);

-- The current thread store is API-backed; this table is the durable relay setup
-- contract used when the production thread repository is connected.
create table if not exists poem_relay_threads (
  id text primary key,
  author_user_id text not null references users(id) on delete cascade,
  title varchar(180),
  rules text not null,
  tags jsonb not null default '[]'::jsonb,
  mentions jsonb not null default '[]'::jsonb,
  visibility varchar(16) not null default 'public'
    check (visibility in ('public', 'include', 'exclude')),
  created_at timestamptz not null default now()
);

create index if not exists poem_relay_threads_author_created_idx
  on poem_relay_threads (author_user_id, created_at desc);
