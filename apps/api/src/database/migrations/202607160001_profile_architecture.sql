-- Profile architecture: post/thread/comment collections and per-section visibility.
-- This migration is additive so existing profile rows remain readable while the
-- application rolls out the new profile tabs.

alter table if exists user_profile_stats
  add column if not exists threads_count bigint not null default 0;

create table if not exists user_profile_visibility (
  user_id text primary key references users(id) on delete cascade,
  posts_public boolean not null default true,
  threads_public boolean not null default true,
  comments_public boolean not null default true,
  saves_public boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into user_profile_visibility (user_id)
select id from users
on conflict (user_id) do nothing;

alter table if exists user_profile_content
  add column if not exists content_kind varchar(16) not null default 'post',
  add column if not exists thread_relation varchar(16),
  add column if not exists collection_kind varchar(16),
  add column if not exists reference_content_id text,
  add column if not exists reference_text text;

alter table if exists user_profile_content
  drop constraint if exists user_profile_content_section_check;

alter table if exists user_profile_content
  add constraint user_profile_content_section_check
  check (section in ('posts', 'threads', 'comments', 'saves'));

alter table if exists user_profile_content
  add constraint user_profile_content_kind_check
  check (content_kind in ('post', 'thread', 'comment'));

alter table if exists user_profile_content
  add constraint user_profile_content_thread_relation_check
  check (thread_relation is null or thread_relation in ('started', 'participated'));

alter table if exists user_profile_content
  add constraint user_profile_content_collection_kind_check
  check (collection_kind is null or collection_kind in ('liked', 'saved'));

create index if not exists user_profile_content_kind_idx
  on user_profile_content (user_id, section, content_kind, created_at desc);

