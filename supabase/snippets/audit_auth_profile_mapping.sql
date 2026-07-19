select
  au.id as auth_user_id,
  au.email,
  au.email_confirmed_at,
  pu.id as profile_id,
  pu.auth_user_id as profile_auth_user_id,
  pu.handle,
  pu.display_name
from auth.users au
left join public.users pu
  on pu.auth_user_id = au.id
order by au.created_at desc
limit 10;