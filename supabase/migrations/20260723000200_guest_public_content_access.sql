-- Public Post and Thread policies resolve the current LineSpace actor even
-- when the request is anonymous. For the anon role auth.uid() is null, so the
-- helper safely returns null; granting EXECUTE only lets the existing RLS
-- policies distinguish public content from authenticated-owner content.
--
-- The helper was previously revoked from anon while public Thread policies
-- called it directly. PostgreSQL therefore rejected anonymous SELECTs with
-- 42501 before it could evaluate `visibility = 'public'`.

revoke execute on function public.current_linespace_user_id() from public;
grant execute on function public.current_linespace_user_id() to anon, authenticated;

