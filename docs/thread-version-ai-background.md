# Thread Version AI snapshots

Recommended and AI Harmonized are shared, content-addressed Thread artifacts.
Opening the version screen never calls the model directly.

## Lifecycle

1. A Thread or continuation content change increments
   `poetry_threads.content_revision`.
2. Database triggers coalesce the latest revision into
   `thread_ai_generation_jobs`.
3. The API schedules a debounced Vercel background task after normal Thread
   writes. A daily Vercel Cron drains any durable jobs left behind by an
   interrupted invocation.
4. The worker calls DeepSeek once and upserts
   `thread_ai_version_snapshots`.
5. `GET /v1/threads/:threadId/ai-versions` returns the current snapshot, or the
   previous ready snapshot with `isStale: true` while a new revision is pending.

Likes, saves, shares, page visits, and pager navigation do not change the
content revision. Popular remains a deterministic live ranking and is not part
of the AI cache key.

## Production configuration

Apply the Supabase migration before deploying the API:

```bash
pnpm db:push:dry-run
pnpm db:push
```

Configure these server-only Vercel variables:

```env
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_COMMUNITY_SPARK_MODEL=deepseek-v4-flash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
INTERNAL_THREAD_VERSION_SECRET=...
```

`CRON_SECRET` should contain at least 16 random characters. Vercel supplies it
to the configured Cron invocation as a bearer token.

The optional internal wake endpoint is:

```text
POST /api/internal/thread-ai-jobs/rebuild
Authorization: Bearer <INTERNAL_THREAD_VERSION_SECRET>
Content-Type: application/json

{"threadId":"..."}
```

It is suitable for a Supabase Database Webhook. It enqueues an idempotent job;
it does not create a second model request for an already-ready revision.
