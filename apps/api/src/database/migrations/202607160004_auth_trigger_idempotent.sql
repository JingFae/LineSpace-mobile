-- Make auth -> business-profile provisioning safe when the Supabase trigger
-- and a backend reconciliation attempt observe the same auth user concurrently.
-- Existing profile values are never overwritten; a conflicting handle still
-- fails the transaction and must be repaired explicitly.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_handle text := lower(trim(new.raw_user_meta_data ->> 'username'));
begin
  if requested_handle is null
     or char_length(requested_handle) not between 3 and 32
     or requested_handle !~ '^[a-z0-9][a-z0-9._-]*$' then
    raise exception using
      errcode = '23514',
      message = 'invalid LineSpace username metadata';
  end if;

  insert into public.users (
    id,
    auth_user_id,
    linespace_id,
    handle,
    display_name
  ) values (
    new.id::text,
    new.id,
    left('ls_' || replace(new.id::text, '-', ''), 32),
    requested_handle,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), requested_handle), 120)
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
