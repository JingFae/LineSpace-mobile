-- Make relay line numbers a durable property of the parent chosen at creation.
-- Repair legacy rows first, then prevent parent/thread/line identity changes.

drop trigger if exists thread_continuations_validate_parent
  on public.thread_continuations;

with recursive continuation_lines as (
  select continuation.id, 2 as line_number
  from public.thread_continuations continuation
  where continuation.parent_continuation_id is null

  union all

  select child.id, parent.line_number + 1
  from public.thread_continuations child
  join continuation_lines parent
    on parent.id = child.parent_continuation_id
)
update public.thread_continuations continuation
set line_number = resolved.line_number
from continuation_lines resolved
where continuation.id = resolved.id
  and continuation.line_number is distinct from resolved.line_number;

do $$
begin
  if exists (
    select 1
    from public.thread_continuations continuation
    left join public.thread_continuations parent
      on parent.id = continuation.parent_continuation_id
    where (
      continuation.parent_continuation_id is null
      and continuation.line_number <> 2
    ) or (
      continuation.parent_continuation_id is not null
      and (
        parent.id is null
        or parent.thread_id <> continuation.thread_id
        or continuation.line_number <> parent.line_number + 1
      )
    )
  ) then
    raise exception using message =
      'thread continuation hierarchy contains an invalid or cyclic parent chain';
  end if;
end;
$$;

create or replace function public.validate_thread_continuation_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_thread_id text;
  parent_line_number integer;
begin
  if tg_op = 'UPDATE' then
    if new.thread_id is distinct from old.thread_id
       or new.parent_continuation_id is distinct from old.parent_continuation_id
       or new.line_number is distinct from old.line_number then
      raise exception using message =
        'continuation thread, parent, and line number are immutable';
    end if;
    return new;
  end if;

  if new.parent_continuation_id is null then
    new.line_number := 2;
    return new;
  end if;

  select parent.thread_id, parent.line_number
    into parent_thread_id, parent_line_number
  from public.thread_continuations parent
  where parent.id = new.parent_continuation_id;

  if parent_thread_id is null or parent_thread_id <> new.thread_id then
    raise exception using message =
      'continuation parent must belong to the same thread';
  end if;

  new.line_number := parent_line_number + 1;
  return new;
end;
$$;

create trigger thread_continuations_validate_parent
before insert or update of thread_id, parent_continuation_id, line_number
on public.thread_continuations
for each row execute function public.validate_thread_continuation_parent();

revoke execute on function public.validate_thread_continuation_parent()
  from public, anon, authenticated;
