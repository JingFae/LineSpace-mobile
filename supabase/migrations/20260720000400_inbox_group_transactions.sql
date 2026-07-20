-- Make group creation, invitation response, and message sending available only
-- through JWT-derived transactional RPCs. Existing RPC names remain as secure
-- compatibility wrappers while repositories migrate to the canonical names.

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
    ) or not (
      exists (
        select 1 from public.user_follows
        where follower_user_id = actor_id
          and following_user_id = invitees.invitee_id
      ) and exists (
        select 1 from public.user_follows
        where follower_user_id = invitees.invitee_id
          and following_user_id = actor_id
      )
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Group invitations are limited to mutual connections';
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

create or replace function public.respond_to_group_invitation(
  p_group_id text,
  p_response text
)
returns public.inbox_group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  normalized_response text := lower(trim(coalesce(p_response, '')));
  desired_status text;
  member_row public.inbox_group_members;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authenticated profile required';
  end if;
  if normalized_response in ('accept', 'accepted') then
    desired_status := 'active';
  elsif normalized_response in ('decline', 'declined') then
    desired_status := 'declined';
  else
    raise exception using errcode = '22023', message = 'Invalid invitation response';
  end if;

  select * into member_row
  from public.inbox_group_members
  where group_id = p_group_id and user_id = actor_id
  for update;

  if member_row.group_id is null or member_row.role = 'owner' then
    raise exception using errcode = '42501', message = 'Invitation not found';
  end if;
  if member_row.status = desired_status then
    return member_row;
  end if;
  if member_row.status <> 'invited' then
    raise exception using errcode = '40900', message = 'Invitation was already answered';
  end if;

  update public.inbox_group_members
  set status = desired_status,
      responded_at = now(),
      joined_at = case when desired_status = 'active' then now() else null end
  where group_id = p_group_id and user_id = actor_id
  returning * into member_row;

  return member_row;
end;
$$;

create or replace function public.send_group_message(
  p_group_id text,
  p_text text
)
returns public.inbox_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_linespace_user_id();
  created public.inbox_group_messages;
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
  if p_text is null or char_length(trim(p_text)) not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'Invalid group message';
  end if;

  insert into public.inbox_group_messages (
    id, group_id, sender_user_id, kind, text_body
  )
  values (
    gen_random_uuid()::text, p_group_id, actor_id, 'text', trim(p_text)
  )
  returning * into created;

  return created;
end;
$$;

create or replace function public.respond_inbox_group_invite(
  p_group_id text,
  p_accept boolean
)
returns public.inbox_group_members
language sql
security definer
set search_path = public
as $$
  select public.respond_to_group_invitation(
    p_group_id,
    case when p_accept then 'accepted' else 'declined' end
  );
$$;

create or replace function public.send_inbox_group_message(
  p_group_id text,
  p_text text
)
returns public.inbox_group_messages
language sql
security definer
set search_path = public
as $$
  select public.send_group_message(p_group_id, p_text);
$$;

-- Group state cannot be assembled piecemeal by browser or mobile clients.
revoke insert on public.inbox_groups from authenticated;
revoke insert, update, delete on public.inbox_group_members from authenticated;
revoke insert, update, delete on public.inbox_group_messages from authenticated;

revoke execute on function public.create_inbox_group(text, text[]),
  public.respond_to_group_invitation(text, text),
  public.send_group_message(text, text),
  public.respond_inbox_group_invite(text, boolean),
  public.send_inbox_group_message(text, text)
from public, anon;

grant execute on function public.create_inbox_group(text, text[]),
  public.respond_to_group_invitation(text, text),
  public.send_group_message(text, text),
  public.respond_inbox_group_invite(text, boolean),
  public.send_inbox_group_message(text, text)
to authenticated;
