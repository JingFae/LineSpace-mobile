begin;

-- 管理员归档区域，不暴露给客户端
create schema if not exists archive;

revoke all on schema archive
from public, anon, authenticated;

-- 固定白名单，后续不要再依赖可修改的用户名
create temporary table protected_users (
  user_id text primary key
) on commit drop;

insert into protected_users (user_id)
values
  ('cf370ad7-4e71-411a-aa70-b0383d65c398'), -- jinghe
  ('65c251b6-a71c-48d7-80a1-bd620fe10fe4'); -- linespacedeveloper

-- 防止用户 ID 错误导致大范围误更新
do $$
begin
  if (
    select count(*)
    from public.users u
    join protected_users protected
      on protected.user_id = u.id
  ) <> 2 then
    raise exception 'Protected user validation failed; aborting migration.';
  end if;
end;
$$;

-- 保存 Post 原始可见性，用于回滚
create table archive.content_visibility_posts_20260806 as
select
  post.id,
  post.author_user_id,
  post.visibility,
  post.audience_user_ids,
  post.updated_at
from public.posts post
where post.status = 'published'
  and not exists (
    select 1
    from protected_users protected
    where protected.user_id = post.author_user_id
  );

-- 保存 Thread 原始可见性
create table archive.content_visibility_threads_20260806 as
select
  thread.id,
  thread.author_user_id,
  thread.visibility,
  thread.updated_at
from public.poetry_threads thread
where not exists (
  select 1
  from protected_users protected
  where protected.user_id = thread.author_user_id
);

revoke all on all tables in schema archive
from public, anon, authenticated;

-- Post：仅作者本人可见
update public.posts post
set
  visibility = 'include',
  audience_user_ids = array[post.author_user_id]::text[],
  updated_at = now()
where post.status = 'published'
  and not exists (
    select 1
    from protected_users protected
    where protected.user_id = post.author_user_id
  );

-- Thread：当前 RLS 中，只要不是 public，就只有 Thread 作者可见
update public.poetry_threads thread
set
  visibility = 'include',
  updated_at = now()
where not exists (
  select 1
  from protected_users protected
  where protected.user_id = thread.author_user_id
);

-- 修复 Thread 版本表原先过宽的公开读取策略
drop policy if exists "public versions are readable"
on public.thread_versions;

create policy "visible thread versions are readable"
on public.thread_versions
for select to anon, authenticated
using (
  exists (
    select 1
    from public.poetry_threads thread
    where thread.id = thread_versions.thread_id
      and (
        thread.visibility = 'public'
        or thread.author_user_id = public.current_linespace_user_id()
      )
  )
);

drop policy if exists "public version lines are readable"
on public.thread_version_lines;

create policy "visible thread version lines are readable"
on public.thread_version_lines
for select to anon, authenticated
using (
  exists (
    select 1
    from public.thread_versions version
    join public.poetry_threads thread
      on thread.id = version.thread_id
    where version.id = thread_version_lines.version_id
      and (
        thread.visibility = 'public'
        or thread.author_user_id = public.current_linespace_user_id()
      )
  )
);

commit;