# LineSpace Supabase migrations

This directory is the only migration source used by Supabase CLI.

## Local host ports

Windows on this machine reserves the default `543xx` host-port range, so
`supabase/config.toml` maps the local services to:

```text
API/PostgREST:  http://127.0.0.1:55421
PostgreSQL:     127.0.0.1:55432
Studio:         http://127.0.0.1:55423
Mailpit:        http://127.0.0.1:55424
SMTP:           127.0.0.1:55425
```

These are local host ports only; they do not change the hosted Supabase
project or the Vercel API URL.

Current migration order:

```text
20260715000000_profile_foundation.sql
20260715000100_auth_identity.sql
20260716000400_auth_trigger_idempotent.sql
20260718000100_user_domain_persistence.sql
20260718000200_inbox_groups.sql
20260718000300_profile_experience.sql
20260719000100_service_role_profile_access.sql
20260719000200_thread_persistence.sql
20260719000300_content_draft_inbox_persistence.sql
20260719000400_group_content_sharing.sql
```

## Current cloud scope

The canonical chain contains:

- Supabase Auth to `public.users` identity mapping
- public profiles, badges, statistics, and visibility
- follows, mutual-follow friendship derivation, and recent-contact queries
- post/feed records, comments, likes, saves, shares, and database-maintained counters
- compose drafts, collaboration operations, and draft-to-post/thread publishing
- media and draft Storage buckets with owner-scoped object policies
- inbox messages for direct, group, post-share, and thread-share conversations
- JWT/RLS-protected inbox group conversations and invitation membership
- actor-derived Post/Thread/continuation sharing into direct and group Inbox,
  including durable click targets and derived share counters
- author-only, idempotent Thread Version publication into a durable Post
- RLS, grants, triggers, and JWT-scoped RPC functions for these domains

The files under `docs/archive/database/deferred-migrations/` remain historical
design references only. They are not read by Supabase CLI and must not be
applied in addition to the canonical chain.

The content migration provides the server-side persistence contract. It does
not alter Feed, Thread, Post, Comment, or Compose UI behavior by itself.

## Repository selection

When a request contains a valid Bearer JWT and the server has Supabase
configuration, the API creates a request-scoped publishable-key client. The
database enforces the user boundary with `auth.uid()` and RLS. The Service
Role client remains limited to server-side authentication mapping and explicit
administrative operations; it is never sent to the Expo bundle.

When `EXPO_PUBLIC_USE_MOCKS=true` (or Supabase server configuration is absent
in local development), routes continue to use `MockLineSpaceApi`.

## Migration order and deployment

Apply migrations strictly in filename order. The content migrations depend on
the profile, follow, inbox-group, experience, and thread migrations that
precede it. For a linked hosted project, review:

```bash
pnpm exec supabase migration list
pnpm db:push:dry-run
pnpm db:push
```

Never run `supabase db reset --linked` against a hosted project. If any SQL was
applied manually, reconcile migration history before pushing.

## Local verification

Docker must be running:

```bash
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm db:security-check
```

`db:reset` is explicitly local. It rebuilds the local Supabase database from
the canonical migrations.

## Hosted staging deployment

Create and link a dedicated staging Supabase project:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <staging-project-ref>
pnpm exec supabase migration list
pnpm db:push:dry-run
pnpm db:push
```

Review the dry run before the push. Never put the database password, access
token, publishable key, or Service Role key in `config.toml`.

If a hosted project already received SQL manually, do not push until its schema
and `supabase_migrations.schema_migrations` history have been reconciled with
`supabase db pull` or a deliberately reviewed `supabase migration repair`.
Never use `supabase db reset --linked` against production.
