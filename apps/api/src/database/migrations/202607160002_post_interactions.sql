-- Durable post detail, comment, share and inbox message records.
-- Media bytes stay in object storage; these tables keep the relationships and
-- counters required by the mobile detail experience.

create table if not exists posts (
  id text primary key,
  author_user_id text not null references users(id) on delete cascade,
  title varchar(180) not null default '',
  body text not null default '',
  tags jsonb not null default '[]'::jsonb,
  artwork_url text,
  started_at timestamptz not null default now(),
  edited_at timestamptz not null default now(),
  comments_count bigint not null default 0 check (comments_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  shares_count bigint not null default 0 check (shares_count >= 0),
  saves_count bigint not null default 0 check (saves_count >= 0)
);

create table if not exists post_comments (
  id text primary key,
  post_id text not null references posts(id) on delete cascade,
  author_user_id text not null references users(id) on delete cascade,
  parent_comment_id text references post_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  likes_count bigint not null default 0 check (likes_count >= 0),
  saves_count bigint not null default 0 check (saves_count >= 0)
);

create index if not exists post_comments_post_created_idx
  on post_comments (post_id, created_at asc);

create table if not exists post_comment_engagements (
  user_id text not null references users(id) on delete cascade,
  comment_id text not null references post_comments(id) on delete cascade,
  kind varchar(16) not null check (kind in ('liked', 'saved')),
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id, kind)
);

create table if not exists post_shares (
  id text primary key,
  post_id text not null references posts(id) on delete cascade,
  sender_user_id text not null references users(id) on delete cascade,
  recipient_user_id text not null references users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists post_shares_recipient_created_idx
  on post_shares (recipient_user_id, created_at desc);

create table if not exists inbox_messages (
  id text primary key,
  sender_user_id text not null references users(id) on delete cascade,
  recipient_user_id text not null references users(id) on delete cascade,
  kind varchar(24) not null check (kind in ('text', 'shared-post')),
  text_body text,
  post_id text references posts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inbox_messages_pair_created_idx
  on inbox_messages (sender_user_id, recipient_user_id, created_at asc);

create or replace function sync_post_comment_count()
returns trigger language plpgsql as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target_post text := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  update posts set comments_count = greatest(0, comments_count + delta), edited_at = now()
  where id = target_post;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists post_comments_sync_count on post_comments;
create trigger post_comments_sync_count
after insert or delete on post_comments
for each row execute function sync_post_comment_count();

create or replace function sync_comment_engagement_count()
returns trigger language plpgsql as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target_comment text := case when tg_op = 'INSERT' then new.comment_id else old.comment_id end;
  engagement_kind text := case when tg_op = 'INSERT' then new.kind else old.kind end;
begin
  if engagement_kind = 'liked' then
    update post_comments set likes_count = greatest(0, likes_count + delta) where id = target_comment;
  else
    update post_comments set saves_count = greatest(0, saves_count + delta) where id = target_comment;
  end if;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists post_comment_engagements_sync_count on post_comment_engagements;
create trigger post_comment_engagements_sync_count
after insert or delete on post_comment_engagements
for each row execute function sync_comment_engagement_count();

create or replace function sync_post_share_count()
returns trigger language plpgsql as $$
declare
  target_post text := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  update posts set shares_count = greatest(0, shares_count + delta) where id = target_post;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

drop trigger if exists post_shares_sync_count on post_shares;
create trigger post_shares_sync_count
after insert or delete on post_shares
for each row execute function sync_post_share_count();
