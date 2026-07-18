# LineSpace Supabase migrations

This directory is the only migration source used by Supabase CLI.

Current migration order:

```text
20260715000000_profile_foundation.sql
20260715000100_auth_identity.sql
20260716000400_auth_trigger_idempotent.sql
20260718000100_user_domain_persistence.sql
20260718000200_inbox_groups.sql
```

## Current cloud scope

The canonical chain intentionally contains only:

- Supabase Auth to `public.users` identity mapping
- public profiles, badges, statistics, and visibility
- follows, mutual-follow friendship derivation, and recent-contact queries
- the minimal `inbox_messages` participant/timestamp contract
- JWT/RLS-protected inbox group conversations and invitation membership
- RLS, grants, triggers, and JWT-scoped RPC functions for that user domain

Post, Poem, Comment, Feed, Compose, and content-engagement persistence remains
under `apps/api/src/database/deferred-migrations/`. Those files are design
references, are not read by Supabase CLI, and must be rebased and security
reviewed before they are promoted into this directory.

## Local verification

Docker must be running:

```bash
pnpm db:start
pnpm db:reset
pnpm db:lint
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
