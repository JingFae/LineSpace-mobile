-- PostgreSQL schema for Draft, Layout and collaborative editing.
-- Media binaries/background assets belong in object storage; these tables keep durable URLs and choices.

create table if not exists poem_design_templates (
  id text primary key,
  label varchar(80) not null,
  description varchar(240) not null,
  layout_config jsonb not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists poem_drafts (
  id text primary key,
  owner_user_id text not null references users(id) on delete cascade,
  mode varchar(16) not null check (mode in ('draft', 'relay')),
  status varchar(16) not null default 'editing' check (status in ('editing', 'ready', 'published')),
  title varchar(180) not null default '',
  body text not null default '',
  byline varchar(120) not null default '',
  tags jsonb not null default '[]'::jsonb,
  media_url text,
  media_kind varchar(16) check (media_kind in ('image', 'video')),
  media_name text,
  mentions jsonb not null default '[]'::jsonb,
  visibility varchar(16) not null default 'public' check (visibility in ('public', 'include', 'exclude')),
  audience_user_ids jsonb not null default '[]'::jsonb,
  allow_sharing boolean not null default true,
  settings jsonb not null default '{"declareOriginal":false,"isPublic":true,"visibility":"public","audienceUserIds":[],"allowComments":true,"allowQuotes":true,"allowSharing":true,"allowSave":true}'::jsonb,
  template_id text references poem_design_templates(id),
  typography_id text not null default 'literary-serif',
  background_id text not null default 'letter-paper',
  sticker_ids jsonb not null default '[]'::jsonb,
  version bigint not null default 1,
  published_poem_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poem_drafts_owner_updated_idx
  on poem_drafts (owner_user_id, updated_at desc);

create table if not exists draft_collaborators (
  draft_id text not null references poem_drafts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role varchar(16) not null check (role in ('owner', 'editor')),
  status varchar(16) not null check (status in ('invited', 'active')),
  cursor_line integer,
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (draft_id, user_id)
);

create index if not exists draft_collaborators_user_idx
  on draft_collaborators (user_id, last_seen_at desc);

create table if not exists draft_invitations (
  id text primary key,
  draft_id text not null references poem_drafts(id) on delete cascade,
  inviter_user_id text not null references users(id) on delete cascade,
  invitee_user_id text not null references users(id) on delete cascade,
  status varchar(16) not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (draft_id, invitee_user_id)
);

create table if not exists draft_operations (
  id bigserial primary key,
  draft_id text not null references poem_drafts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  base_version bigint not null,
  result_version bigint not null,
  operation jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists draft_operations_draft_version_idx
  on draft_operations (draft_id, result_version);

create or replace function touch_poem_draft()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if row(new.title, new.body, new.byline, new.tags, new.mentions, new.visibility,
         new.audience_user_ids, new.allow_sharing, new.settings, new.template_id,
         new.typography_id, new.background_id, new.sticker_ids)
     is distinct from
     row(old.title, old.body, old.byline, old.tags, old.settings, old.template_id,
         old.typography_id, old.background_id, old.sticker_ids) then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists poem_drafts_touch_version on poem_drafts;
create trigger poem_drafts_touch_version
before update on poem_drafts
for each row execute function touch_poem_draft();

-- Realtime transport should broadcast committed draft_operations over WebSocket/Supabase Realtime.
-- The version columns provide optimistic-concurrency and reconnect replay boundaries.
