-- Let active group members invite any LineSpace user, without requiring a
-- mutual follow. Invitations remain pending until each invitee accepts them.

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

  if new.status = 'invited' and (
    new.invited_by_user_id is null
    or not exists (
      select 1
      from public.inbox_group_members inviter
      where inviter.group_id = new.group_id
        and inviter.user_id = new.invited_by_user_id
        and inviter.status = 'active'
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'An active group member must send the invitation';
  end if;

  return new;
end;
$$;

drop policy if exists "active members invite mutuals"
  on public.inbox_group_members;
drop policy if exists "active members invite community users"
  on public.inbox_group_members;
create policy "active members invite community users"
on public.inbox_group_members for insert
to authenticated
with check (
  (
    user_id = public.current_linespace_user_id()
    and role = 'owner'
    and status = 'active'
    and exists (
      select 1
      from public.inbox_groups group_row
      where group_row.id = inbox_group_members.group_id
        and group_row.owner_user_id = public.current_linespace_user_id()
    )
  )
  or (
    invited_by_user_id = public.current_linespace_user_id()
    and public.current_user_is_active_inbox_group_member(
      inbox_group_members.group_id
    )
  )
);

create or replace function public.create_inbox_group(
  p_name text,
  p_invitee_user_ids text[] default '{}'
)
returns public.inbox_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  group_row public.inbox_groups;
  invitee_ids text[];
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authenticated profile required';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Invalid group name';
  end if;

  select coalesce(array_agg(distinct invitee_id), '{}'::text[])
  into invitee_ids
  from unnest(coalesce(p_invitee_user_ids, '{}'::text[])) as invitees(invitee_id)
  where invitee_id is not null and invitee_id <> actor_id;

  if cardinality(invitee_ids) > 50 then
    raise exception using errcode = '22023', message = 'A group can invite at most 50 users';
  end if;
  if exists (
    select 1
    from unnest(invitee_ids) as invitees(invitee_id)
    where not exists (
      select 1 from public.users where id = invitees.invitee_id
    )
  ) then
    raise exception using errcode = '22023', message = 'An invited user was not found';
  end if;

  insert into public.inbox_groups (id, name, owner_user_id)
  values (gen_random_uuid()::text, trim(p_name), actor_id)
  returning * into group_row;

  insert into public.inbox_group_members (
    group_id, user_id, role, status,
    invited_by_user_id, joined_at, responded_at
  )
  values (
    group_row.id, actor_id, 'owner', 'active', actor_id, now(), now()
  );

  insert into public.inbox_group_members (
    group_id, user_id, role, status, invited_by_user_id
  )
  select group_row.id, invitee_id, 'member', 'invited', actor_id
  from unnest(invitee_ids) as invitees(invitee_id);

  return group_row;
end;
$$;

create or replace function public.invite_inbox_group_members(
  p_group_id text,
  p_invitee_user_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  invitee_ids text[];
begin
  if actor_id is null or not exists (
    select 1
    from public.inbox_group_members
    where group_id = p_group_id
      and user_id = actor_id
      and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Group membership required';
  end if;

  select coalesce(array_agg(distinct invitee_id), '{}'::text[])
  into invitee_ids
  from unnest(coalesce(p_invitee_user_ids, '{}'::text[])) as invitees(invitee_id)
  where invitee_id is not null and invitee_id <> actor_id;

  if cardinality(invitee_ids) > 50 then
    raise exception using errcode = '22023', message = 'At most 50 users can be invited at once';
  end if;
  if exists (
    select 1
    from unnest(invitee_ids) as invitees(invitee_id)
    where not exists (
      select 1 from public.users where id = invitees.invitee_id
    )
  ) then
    raise exception using errcode = '22023', message = 'An invited user was not found';
  end if;

  insert into public.inbox_group_members (
    group_id, user_id, role, status, invited_by_user_id
  )
  select p_group_id, invitee_id, 'member', 'invited', actor_id
  from unnest(invitee_ids) as invitees(invitee_id)
  on conflict (group_id, user_id) do nothing;

  if cardinality(invitee_ids) > 0 then
    update public.inbox_groups
    set updated_at = now()
    where id = p_group_id;
  end if;
end;
$$;

revoke execute on function public.validate_inbox_group_invitee()
  from public, anon, authenticated;
revoke execute on function public.create_inbox_group(text, text[])
  from public, anon;
grant execute on function public.create_inbox_group(text, text[])
  to authenticated;
revoke execute on function public.invite_inbox_group_members(text, text[])
  from public, anon;
grant execute on function public.invite_inbox_group_members(text, text[])
  to authenticated;
