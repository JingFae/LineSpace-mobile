-- Thread persistence: one immutable starting line, parent-linked relay lines,
-- recipient sharing, saves, and reproducible version snapshots.

create table if not exists public.poetry_threads (
  id text primary key,
  author_user_id text not null references public.users(id) on delete cascade,
  title varchar(180),
  prompt text not null,
  starting_content text not null,
  rules text,
  tags text[] not null default '{}',
  mentions text[] not null default '{}',
  media jsonb,
  visibility varchar(16) not null default 'public'
    check (visibility in ('public', 'include', 'exclude')),
  status varchar(16) not null default 'open'
    check (status in ('open', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.thread_continuations (
  id text primary key,
  thread_id text not null references public.poetry_threads(id) on delete cascade,
  parent_continuation_id text references public.thread_continuations(id) on delete cascade,
  line_number integer not null check (line_number >= 2),
  content text not null check (char_length(trim(content)) > 0),
  author_user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (thread_id, id),
  unique (thread_id, parent_continuation_id, id)
);

create index if not exists thread_continuations_thread_line_idx
  on public.thread_continuations (thread_id, line_number, created_at);
create index if not exists thread_continuations_parent_idx
  on public.thread_continuations (parent_continuation_id, created_at);

create or replace function public.validate_thread_continuation_parent()
returns trigger
language plpgsql
as $$
declare
  parent_thread_id text;
  parent_line_number integer;
begin
  if new.parent_continuation_id is null then
    if new.line_number <> 2 then
      raise exception using message = 'root continuation must be line 2';
    end if;
    return new;
  end if;

  select thread_id, line_number
    into parent_thread_id, parent_line_number
    from public.thread_continuations
    where id = new.parent_continuation_id;

  if parent_thread_id is null or parent_thread_id <> new.thread_id then
    raise exception using message = 'continuation parent must belong to the same thread';
  end if;
  if new.line_number <> parent_line_number + 1 then
    raise exception using message = 'continuation line number must follow its parent';
  end if;
  return new;
end;
$$;

drop trigger if exists thread_continuations_validate_parent
  on public.thread_continuations;
create trigger thread_continuations_validate_parent
before insert or update of thread_id, parent_continuation_id, line_number
on public.thread_continuations
for each row execute function public.validate_thread_continuation_parent();

create table if not exists public.thread_likes (
  thread_id text not null references public.poetry_threads(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.thread_continuation_likes (
  continuation_id text not null references public.thread_continuations(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (continuation_id, user_id)
);

create table if not exists public.thread_saves (
  thread_id text not null references public.poetry_threads(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.thread_shares (
  id text primary key,
  thread_id text not null references public.poetry_threads(id) on delete cascade,
  continuation_id text references public.thread_continuations(id) on delete cascade,
  sender_user_id text not null references public.users(id) on delete cascade,
  recipient_user_id text not null references public.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  check (continuation_id is null or thread_id is not null)
);

create index if not exists thread_shares_recipient_created_idx
  on public.thread_shares (recipient_user_id, created_at desc);

create table if not exists public.thread_versions (
  id text primary key,
  thread_id text not null references public.poetry_threads(id) on delete cascade,
  kind varchar(20) not null
    check (kind in ('recommended', 'most-popular', 'longest', 'custom')),
  title varchar(180) not null,
  selected_continuation_ids jsonb not null default '[]'::jsonb,
  total_likes bigint not null default 0 check (total_likes >= 0),
  line_count integer not null default 1 check (line_count >= 1),
  ai_rationale text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists thread_versions_thread_kind_idx
  on public.thread_versions (thread_id, kind)
  where kind <> 'custom';

create table if not exists public.thread_version_lines (
  version_id text not null references public.thread_versions(id) on delete cascade,
  line_number integer not null check (line_number >= 1),
  continuation_id text references public.thread_continuations(id) on delete set null,
  text_content text not null,
  author_user_id text not null references public.users(id) on delete cascade,
  likes bigint not null default 0 check (likes >= 0),
  primary key (version_id, line_number)
);

alter table public.inbox_messages
  add column if not exists thread_id text references public.poetry_threads(id) on delete cascade,
  add column if not exists continuation_id text references public.thread_continuations(id) on delete cascade,
  add column if not exists excerpt text,
  add column if not exists line_number integer;

alter table public.inbox_messages drop constraint if exists inbox_messages_kind_check;
alter table public.inbox_messages
  add constraint inbox_messages_kind_check
  check (kind in ('text', 'shared-post', 'shared-thread', 'shared-continuation'));

create or replace function public.touch_poetry_thread_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists poetry_threads_touch_updated_at on public.poetry_threads;
create trigger poetry_threads_touch_updated_at
before update on public.poetry_threads
for each row execute function public.touch_poetry_thread_updated_at();

drop trigger if exists thread_continuations_touch_updated_at on public.thread_continuations;
create trigger thread_continuations_touch_updated_at
before update on public.thread_continuations
for each row execute function public.touch_poetry_thread_updated_at();

create or replace function public.sync_thread_profile_counters()
returns trigger language plpgsql as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  thread_author text;
  saver text;
begin
  if tg_table_name = 'poetry_threads' then
    update public.user_profile_stats
      set threads_count = greatest(0, threads_count + delta), updated_at = now()
      where user_id = case when tg_op = 'INSERT' then new.author_user_id else old.author_user_id end;
  elsif tg_table_name = 'thread_saves' then
    saver := case when tg_op = 'INSERT' then new.user_id else old.user_id end;
    update public.user_profile_stats
      set saves_count = greatest(0, saves_count + delta), updated_at = now()
      where user_id = saver;
    select author_user_id into thread_author
      from public.poetry_threads
      where id = case when tg_op = 'INSERT' then new.thread_id else old.thread_id end;
    update public.user_profile_stats
      set saves_received_count = greatest(0, saves_received_count + delta), updated_at = now()
      where user_id = thread_author;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists poetry_threads_sync_profile_counters on public.poetry_threads;
create trigger poetry_threads_sync_profile_counters
after insert or delete on public.poetry_threads
for each row execute function public.sync_thread_profile_counters();

drop trigger if exists thread_saves_sync_profile_counters on public.thread_saves;
create trigger thread_saves_sync_profile_counters
after insert or delete on public.thread_saves
for each row execute function public.sync_thread_profile_counters();

alter table public.poetry_threads enable row level security;
alter table public.thread_continuations enable row level security;
alter table public.thread_likes enable row level security;
alter table public.thread_continuation_likes enable row level security;
alter table public.thread_saves enable row level security;
alter table public.thread_shares enable row level security;
alter table public.thread_versions enable row level security;
alter table public.thread_version_lines enable row level security;

create policy "public threads are readable"
on public.poetry_threads for select to anon, authenticated
using (visibility = 'public' or author_user_id = public.current_linespace_user_id());

create policy "authenticated users can create their threads"
on public.poetry_threads for insert to authenticated
with check (author_user_id = public.current_linespace_user_id());

create policy "authors can update their threads"
on public.poetry_threads for update to authenticated
using (author_user_id = public.current_linespace_user_id())
with check (author_user_id = public.current_linespace_user_id());

create policy "public thread lines are readable"
on public.thread_continuations for select to anon, authenticated
using (
  exists (
    select 1 from public.poetry_threads t
    where t.id = thread_id
      and (t.visibility = 'public' or t.author_user_id = public.current_linespace_user_id())
  )
);

create policy "authenticated users can add thread lines"
on public.thread_continuations for insert to authenticated
with check (author_user_id = public.current_linespace_user_id());

create policy "thread engagement is readable"
on public.thread_likes for select to authenticated using (true);
create policy "users manage their thread likes"
on public.thread_likes for all to authenticated
using (user_id = public.current_linespace_user_id())
with check (user_id = public.current_linespace_user_id());

create policy "continuation engagement is readable"
on public.thread_continuation_likes for select to authenticated using (true);
create policy "users manage continuation likes"
on public.thread_continuation_likes for all to authenticated
using (user_id = public.current_linespace_user_id())
with check (user_id = public.current_linespace_user_id());

create policy "users read their thread saves"
on public.thread_saves for select to authenticated
using (user_id = public.current_linespace_user_id());
create policy "users manage their thread saves"
on public.thread_saves for all to authenticated
using (user_id = public.current_linespace_user_id())
with check (user_id = public.current_linespace_user_id());

create policy "participants read thread shares"
on public.thread_shares for select to authenticated
using (
  sender_user_id = public.current_linespace_user_id()
  or recipient_user_id = public.current_linespace_user_id()
);
create policy "users create thread shares"
on public.thread_shares for insert to authenticated
with check (sender_user_id = public.current_linespace_user_id());

create policy "public versions are readable"
on public.thread_versions for select to anon, authenticated using (true);
create policy "public version lines are readable"
on public.thread_version_lines for select to anon, authenticated using (true);
create policy "users create custom versions"
on public.thread_versions for insert to authenticated
with check (created_by = public.current_linespace_user_id());

revoke all on table public.poetry_threads, public.thread_continuations,
  public.thread_likes, public.thread_continuation_likes, public.thread_saves,
  public.thread_shares, public.thread_versions, public.thread_version_lines
  from anon, authenticated;

grant select on public.poetry_threads, public.thread_continuations,
  public.thread_likes, public.thread_continuation_likes, public.thread_saves,
  public.thread_shares, public.thread_versions, public.thread_version_lines
  to anon, authenticated;
grant insert, update on public.poetry_threads, public.thread_continuations,
  public.thread_likes, public.thread_continuation_likes, public.thread_saves,
  public.thread_shares, public.thread_versions, public.thread_version_lines
  to authenticated;
grant all on public.poetry_threads, public.thread_continuations,
  public.thread_likes, public.thread_continuation_likes, public.thread_saves,
  public.thread_shares, public.thread_versions, public.thread_version_lines
  to service_role;

grant select, insert, update on public.poetry_threads, public.thread_continuations,
  public.thread_likes, public.thread_continuation_likes, public.thread_saves,
  public.thread_shares, public.thread_versions, public.thread_version_lines
  to service_role;
