-- The existing Thread engagement RLS policies already restrict deletes to the
-- JWT-derived owner, but the table grants omitted DELETE. Restore the minimum
-- table privilege needed for unlike/unsave while retaining those RLS checks.

grant delete on public.thread_likes,
  public.thread_continuation_likes,
  public.thread_saves
to authenticated;
