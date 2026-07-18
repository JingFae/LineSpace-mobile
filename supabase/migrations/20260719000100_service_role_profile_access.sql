-- The API uses the server-side service_role client to resolve a LineSpace
-- profile before and after Supabase Auth operations. RLS bypass alone does
-- not grant table privileges, so explicitly allow the server role to read
-- the identity mapping.
grant select on table public.users to service_role;
