-- Inbox group conversations. Group invitations are limited to mutual follows
-- and remain pending until the invitee explicitly accepts them.

create table if not exists public.inbox_groups (
  id text primary key default gen_random_uuid()::text,
  name varchar(80) not null check (char_length(trim(name)) between 1 and 80),
  owner_user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbox_group_members (
  group_id text not null references public.inbox_groups(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  role varchar(16) not null default 'member' check (role in ('owner', 'member')),
  status varchar(16) not null default 'invited' check (status in ('invited', 'active', 'declined')),
  invited_by_user_id text references public.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  joined_at timestamptz,
  primary key (group_id, user_id)
);

create table if not exists public.inbox_group_messages (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references public.inbox_groups(id) on delete cascade,
  sender_user_id text not null references public.users(id) on delete cascade,
  kind varchar(24) not null default 'text' check (kind in ('text', 'shared-post')),
  text_body text,
  post_id text,
  created_at timestamptz not null default now(),
  check (nullif(trim(text_body), '') is not null or post_id is not null)
);

create index if not exists inbox_groups_owner_updated_idx
  on public.inbox_groups (owner_user_id, updated_at desc);
create index if not exists inbox_group_members_user_status_idx
  on public.inbox_group_members (user_id, status, invited_at desc);
create index if not exists inbox_group_messages_group_created_idx
  on public.inbox_group_messages (group_id, created_at asc);

create or replace function public.touch_inbox_group_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inbox_groups_touch_updated_at on public.inbox_groups;
create trigger inbox_groups_touch_updated_at
before update on public.inbox_groups
for each row execute function public.touch_inbox_group_updated_at();

create or replace function public.touch_inbox_group_from_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.inbox_groups
  set updated_at = new.created_at
  where id = new.group_id;
  return new;
end;
$$;

drop trigger if exists inbox_group_messages_touch_group on public.inbox_group_messages;
create trigger inbox_group_messages_touch_group
after insert on public.inbox_group_messages
for each row execute function public.touch_inbox_group_from_message();

create or replace function public.validate_inbox_group_invitee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner' then
    return new;
  end if;

  if new.status = 'invited' and not exists (
    select 1
    from public.user_follows first_follow
    join public.user_follows second_follow
      on second_follow.follower_user_id = first_follow.following_user_id
     and second_follow.following_user_id = first_follow.follower_user_id
    where first_follow.follower_user_id = coalesce(new.invited_by_user_id, (
      select owner_user_id from public.inbox_groups where id = new.group_id
    ))
      and first_follow.following_user_id = new.user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Group invitations are limited to mutual connections';
  end if;

  return new;
end;
$$;

drop trigger if exists inbox_group_members_validate_invitee on public.inbox_group_members;
create trigger inbox_group_members_validate_invitee
before insert or update on public.inbox_group_members
for each row execute function public.validate_inbox_group_invitee();

create or replace function public.is_active_inbox_group_member(
  p_group_id text,
  p_user_id text default public.current_linespace_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inbox_group_members
    where group_id = p_group_id
      and user_id = p_user_id
      and status = 'active'
  );
$$;

revoke execute on function public.is_active_inbox_group_member(text, text)
  from public, anon;
grant execute on function public.is_active_inbox_group_member(text, text)
  to authenticated;

alter table public.inbox_groups enable row level security;
alter table public.inbox_group_members enable row level security;
alter table public.inbox_group_messages enable row level security;

drop policy if exists "members can read their groups" on public.inbox_groups;
create policy "members can read their groups"
on public.inbox_groups for select
to authenticated
using (
  owner_user_id = public.current_linespace_user_id()
  or public.is_active_inbox_group_member(inbox_groups.id)
  or exists (
    select 1 from public.inbox_group_members member
    where member.group_id = inbox_groups.id
      and member.user_id = public.current_linespace_user_id()
      and member.status = 'invited'
  )
);

drop policy if exists "users create their own groups" on public.inbox_groups;
create policy "users create their own groups"
on public.inbox_groups for insert
to authenticated
with check (owner_user_id = public.current_linespace_user_id());

drop policy if exists "owners update their groups" on public.inbox_groups;
create policy "owners update their groups"
on public.inbox_groups for update
to authenticated
using (
  owner_user_id = public.current_linespace_user_id()
  and public.is_active_inbox_group_member(inbox_groups.id)
)
with check (owner_user_id = public.current_linespace_user_id());

drop policy if exists "members read group memberships" on public.inbox_group_members;
create policy "members read group memberships"
on public.inbox_group_members for select
to authenticated
using (
  user_id = public.current_linespace_user_id()
  or public.is_active_inbox_group_member(inbox_group_members.group_id)
);

drop policy if exists "active members invite mutuals" on public.inbox_group_members;
create policy "active members invite mutuals"
on public.inbox_group_members for insert
to authenticated
with check (
  (
    user_id = public.current_linespace_user_id()
    and role = 'owner'
    and status = 'active'
    and exists (
      select 1 from public.inbox_groups group_row
      where group_row.id = inbox_group_members.group_id
        and group_row.owner_user_id = public.current_linespace_user_id()
    )
  )
  or (
    invited_by_user_id = public.current_linespace_user_id()
    and public.is_active_inbox_group_member(inbox_group_members.group_id)
  )
);

drop policy if exists "invitees respond to invitations" on public.inbox_group_members;
create policy "invitees respond to invitations"
on public.inbox_group_members for update
to authenticated
using (user_id = public.current_linespace_user_id() and status = 'invited')
with check (
  user_id = public.current_linespace_user_id()
  and status in ('active', 'declined')
);

drop policy if exists "active members read group messages" on public.inbox_group_messages;
create policy "active members read group messages"
on public.inbox_group_messages for select
to authenticated
using (
  public.is_active_inbox_group_member(inbox_group_messages.group_id)
);

drop policy if exists "active members send group messages" on public.inbox_group_messages;
create policy "active members send group messages"
on public.inbox_group_messages for insert
to authenticated
with check (
  sender_user_id = public.current_linespace_user_id()
  and public.is_active_inbox_group_member(inbox_group_messages.group_id)
);

revoke all privileges on table public.inbox_groups from anon, authenticated;
grant select (id, name, owner_user_id, created_at, updated_at)
  on public.inbox_groups to authenticated;
grant insert (id, name, owner_user_id)
  on public.inbox_groups to authenticated;
grant update (name, updated_at)
  on public.inbox_groups to authenticated;

revoke all privileges on table public.inbox_group_members from anon, authenticated;
grant select (group_id, user_id, role, status, invited_by_user_id, invited_at, responded_at, joined_at)
  on public.inbox_group_members to authenticated;
grant insert (group_id, user_id, role, status, invited_by_user_id, invited_at)
  on public.inbox_group_members to authenticated;
grant update (status, responded_at, joined_at)
  on public.inbox_group_members to authenticated;

revoke all privileges on table public.inbox_group_messages from anon, authenticated;
grant select (id, group_id, sender_user_id, kind, text_body, post_id, created_at)
  on public.inbox_group_messages to authenticated;
grant insert (id, group_id, sender_user_id, kind, text_body, post_id)
  on public.inbox_group_messages to authenticated;
