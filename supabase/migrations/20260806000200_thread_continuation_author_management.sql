-- Allow relay contributors to revise or remove only the continuation rows they authored.
-- Deleting a row intentionally cascades through its descendant branch because those
-- descendants cannot retain a valid parent path on their own.

drop policy if exists "authors update their thread continuations"
  on public.thread_continuations;
create policy "authors update their thread continuations"
on public.thread_continuations for update to authenticated
using (author_user_id = public.current_linespace_user_id())
with check (author_user_id = public.current_linespace_user_id());

drop policy if exists "authors delete their thread continuations"
  on public.thread_continuations;
create policy "authors delete their thread continuations"
on public.thread_continuations for delete to authenticated
using (author_user_id = public.current_linespace_user_id());

grant update, delete on public.thread_continuations to authenticated;
