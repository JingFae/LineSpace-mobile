# 部署说明

## 当前部署边界

当前 `vercel.json` 构建并发布 Expo Web 静态前端，仓库根目录同时提供 API Function：

```text
source: apps/mobile + workspace packages
command: pnpm build:web
output: apps/mobile/dist
host: Vercel static hosting + `/api/*` Node Function
```

`pnpm dev:api` 仍然启动本地 Node HTTP 服务；Vercel 部署时 `/api/*` 由仓库根目录的
`api/[...path].ts` Function 转发到路由层。HTTP 模式下资料、Post、Comment、
Thread、Draft、Inbox 和 Storage 由 request-scoped Supabase Client 与 PostgreSQL
RLS 提供；`EXPO_PUBLIC_USE_MOCKS=true` 时仍使用 Mock API。

## 本地生产导出

从仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm build:web
```

导出目录：

```text
apps/mobile/dist
```

`dist` 是生成物，已被 Git 忽略，不应提交。

## Vercel 配置

仓库内配置等价于：

```json
{
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build:web",
  "outputDirectory": "apps/mobile/dist"
}
```

Dashboard 应使用仓库根目录作为 Root Directory，Framework Preset 选择 Other，并让项目读取仓库内 `vercel.json`。不要把 Root Directory 设为 `apps/mobile`，否则 pnpm Workspace 共享包和根锁文件无法按当前配置解析。

## SPA 刷新

Expo 配置使用单页输出。`vercel.json` 将未命中的路径重写到 `/index.html`，因此直接刷新 `/poem/:id`、`/profile/edit` 等客户端路由仍由 Expo Router 接管。静态资源继续由 `apps/mobile/dist` 提供。

## 环境变量

默认静态部署建议使用：

```env
EXPO_PUBLIC_USE_MOCKS=true
EXPO_PUBLIC_CURRENT_USER_ID=user-lili
```

生产 HTTP 模式需要在 Vercel 构建环境设置：

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=/api
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_example
SUPABASE_SERVICE_ROLE_KEY=server-only-secret
AUTH_EMAIL_REDIRECT_URL=https://your-domain.example/auth/confirm
```

`EXPO_PUBLIC_*` 会进入客户端 Bundle，不能保存密钥。`SUPABASE_SERVICE_ROLE_KEY`、`DATABASE_URL` 和 `OPENAI_API_KEY` 必须使用 Vercel Server-only 环境变量；它们不得改名为 `EXPO_PUBLIC_*`。

Supabase Dashboard 的 Redirect URLs 还需要包含 `https://your-domain.example/auth/confirm`。Native 构建使用同一个后端时，将 `AUTH_EMAIL_REDIRECT_URL` 配为 `linespace://auth/confirm`，并在 Supabase 允许列表中加入该自定义 scheme；Web 与 Native 不应混用错误的回跳地址。

## API 上线前检查

启用 Vercel Function 或独立部署 `apps/api` 前至少需要：

- 生产启动与进程管理配置。
- 正式数据库迁移和回滚流程。
- HTTPS、允许来源明确的 CORS、认证与资源授权。
- 密钥管理、请求体限制、日志脱敏、限流、超时和健康监控。
- 将当前进程内 Mock 存储替换为持久实现，同时保持 `LineSpaceApi` 返回类型兼容。

完成这些工作前，文档和产品配置都不应声称 API 已上线。

## 用户域数据库上线顺序

在将 `EXPO_PUBLIC_USE_MOCKS` 设为 `false` 前，必须在目标 Supabase 项目按
`docs/environment.md` 的顺序执行全部用户资料迁移，最后执行
`supabase/migrations/20260718000100_user_domain_persistence.sql`。该迁移只负责
`public.users` 的资料读取/更新、`user_follows`、用户资料统计/可见性、
`badges`/`user_badges` 和 `inbox_messages` 的 RLS 与用户域查询 RPC；
Feed、Poem、Post、评论和 Compose 不会因此变成 PostgreSQL 持久化。

API Function 仅配置服务端 `SUPABASE_URL`、Publishable/Anon Key 和
`SUPABASE_SERVICE_ROLE_KEY`。普通用户域查询使用请求 JWT；Service Role
只保留给现有认证映射与受控后台动作，绝不能配置为 `EXPO_PUBLIC_*`。
发布前需确认 Supabase Dashboard 已启用 RLS、邮箱确认回跳地址和生产
Redirect URL，并在隔离数据库中执行迁移幂等性与 RLS 测试。当前仓库没有
真实生产 Supabase 数据库凭据，因此本地检查不会声称完成端到端数据库验证。

## CI

`.github/workflows/ci.yml` 在 Node 22 / pnpm 11.7.0 上执行：

1. `pnpm install --frozen-lockfile`
2. `pnpm check`

`pnpm check` 包含全仓 TypeScript、API 契约冒烟检查和 Expo Web 生产导出。

## Canonical database deployment

For the current browser/cloud phase, deploy the complete canonical chain in
`supabase/migrations/`, including the Post/Comment, Draft, Inbox, direct/group
Thread/Post sharing, click-target metadata, Thread Version publication, and
Storage contracts. The final `20260720000100_live_content_runtime.sql`
migration adds the Feed/Thread keyset indexes, atomically maintained Thread
like counts, and the JWT-derived Compose draft creation RPC. It deliberately
seeds no demo identities, conversations, Threads, or Posts. The following
`20260720000200_inbox_activity_notifications.sql` migration persists comment,
like/save, Thread continuation, follow, and mention activity with recipient-only
RLS. Apply the following progression and group-transaction migrations in order:

```text
20260720000300_content_experience_progression.sql
20260720000400_inbox_group_transactions.sql
20260720000500_thread_engagement_delete_permissions.sql
```

The first backfills deterministic experience events from existing content and
normalizes all levels to 1–10. The second removes direct client group writes in
favor of JWT-derived transaction RPCs. The third restores unlike/unsave table
permissions while the existing owner-only RLS remains authoritative. The SQL under
`apps/api/src/database/deferred-migrations/` is historical reference material,
is not part of the cloud push, and must not be copied into the migration
directory:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <staging-project-ref>
pnpm db:push:dry-run
pnpm db:push
```

The first deployment should target a dedicated Staging project. Review the
dry-run output and verify the Supabase migration history before pushing.
Production should use a separate linked project. Never run
`supabase db reset --linked` against production.

If a project already has schema changes applied manually, reconcile the remote
schema and `supabase_migrations.schema_migrations` first with
`supabase db pull` or a deliberately reviewed `supabase migration repair`.

## Separate Vercel Web and API projects

Both Vercel projects must keep the repository root as their Root Directory so
the pnpm workspace and the root `api/` Function entry are available. The
checked-in routing order is intentional:

1. `/api/:path*` rewrites to the stable `/api` Vercel Function and passes the
   remaining path through an internal query parameter.
2. Only non-API paths fall back to the Expo Web `index.html`.

The Web project should build with:

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=https://line-space-mobile-api.vercel.app/api
```

The API project must define the server-only Supabase variables. After each API
deployment, verify routing and configuration before testing registration:

```text
GET https://line-space-mobile-api.vercel.app/api/health
200 {"ok":true,"service":"linespace-api"}

GET https://line-space-mobile-api.vercel.app/api/health/ready
200 {"ok":true,"service":"linespace-api","authConfigured":true}
```

If either URL returns Expo HTML, the API rewrite/Function was not deployed. If
the readiness endpoint returns `503` with `authConfigured:false`, verify
`SUPABASE_URL`, the Publishable/Anon key, and `SUPABASE_SERVICE_ROLE_KEY` in
the API Vercel project, then redeploy that project. Email confirmation is not
involved until the registration endpoint has successfully reached Supabase.

### Vercel Node ESM boundary

The root `api/` Function and `apps/api` service are both ES modules. Keep
`"type": "module"` in the repository root `package.json`; otherwise Vercel can
compile the root Function as CommonJS and crash before routing with
`ERR_REQUIRE_ESM`. The Function also loads `apps/api/src/routes` through a
cached dynamic `import()` so the runtime never crosses this boundary with
`require()`. Runtime-relative imports in the Vercel Function, API service, and
API client use explicit `.js` specifiers: Vercel emits JavaScript files, and
Node ESM does not add file extensions or resolve directory imports implicitly.
