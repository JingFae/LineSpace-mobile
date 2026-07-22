# 环境变量

本地开发先复制 `.env.example` 为 `.env`。`.env` 和 `.env.*` 已被 Git 忽略，只有不含真实密钥的 `.env.example` 可以提交。

## 当前变量

| 变量 | 当前是否必需 | 读取位置 | 说明 |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_USE_MOCKS` | 可选，默认视为 `true` | `apps/mobile` | 只有精确为 `false` 才尝试 HTTP 模式 |
| `EXPO_PUBLIC_API_BASE_URL` | HTTP 模式必需 | `apps/mobile` | API Base URL，例如 `http://localhost:4000` |
| `EXPO_PUBLIC_CURRENT_USER_ID` | 仅 Mock 模式可选 | `apps/mobile` | Mock 开发用户，默认 `user-lili`；生产身份不得来自此变量 |
| `PORT` | 可选 | `apps/api` | 本地 API 端口，默认 `4000` |
| `DATABASE_URL` | 未来可选 | 只能由 `apps/api` 读取 | PostgreSQL 连接串；当前运行时未使用 |
| `SUPABASE_URL` | 认证 API 必需 | `apps/api` | Supabase 项目 URL |
| `SUPABASE_PUBLISHABLE_KEY` | 认证 API 必需 | `apps/api` | 服务端调用公开 Auth API 的首选 Publishable Key |
| `SUPABASE_ANON_KEY` | 兼容可选 | `apps/api` | 旧项目的公开 Anon Key；仅在未设置 Publishable Key 时作为回退 |
| `SUPABASE_SERVICE_ROLE_KEY` | 认证 API 必需 | 只能由 `apps/api` 读取 | 解析 username 到 Auth 用户及撤销 Session；严禁进入客户端 |
| `AUTH_EMAIL_REDIRECT_URL` | 可选 | `apps/api` | 注册确认邮件完成后返回 LineSpace 的地址，必须加入 Supabase Redirect URLs；Web 与 Native 应按部署环境分别配置 |
| `OPENAI_API_KEY` | AI 功能必需 | 只能由 `apps/api` 读取 | Community Spark 与 Thread 版本 AI 请求；不得进入 Expo 客户端 |
| `OPENAI_MODEL` | 可选 | `apps/api` | 旧 Thread 推荐与 AI 功能的通用模型覆盖值 |
| `OPENAI_COMMUNITY_SPARK_MODEL` | 可选 | `apps/api` | 仅覆盖 Community Spark 模型，默认 `gpt-5.6`；未设置时优先沿用 `OPENAI_MODEL` |

所有 `EXPO_PUBLIC_*` 变量都会进入客户端产物，只能放公开配置。不要给 Service Role Key 或数据库连接串添加这个前缀。认证后端只读取普通服务端变量。前端由 `AuthSessionProvider` 恢复和刷新 Session：Native Refresh Token 写入 Expo SecureStore，Web 写入 `sessionStorage`，Access Token 仅驻留内存。Web 存储仍可能被 XSS 读取，生产环境应配置 CSP 并避免在 URL、日志或错误中暴露 Token。

## 邮箱确认回跳

Supabase Dashboard → Authentication → URL Configuration → Redirect URLs 至少加入当前环境的两类地址：

- Web 本地：`http://localhost:8081/auth/confirm`；生产：`https://<web-domain>/auth/confirm`。
- Native：`linespace://auth/confirm`（若使用 Expo Go/开发客户端，也把实际 dev scheme 地址加入允许列表）。

`AUTH_EMAIL_REDIRECT_URL` 是后端注册时传给 Supabase `signUp` 的单一回跳地址。Web 部署使用 Web 地址，Native 独立构建使用 `linespace://auth/confirm`；切换环境后重启 API，使变量生效。当前服务端 Supabase JS 客户端使用 implicit flow：确认回跳页读取 fragment 中的短期 Session、立即从 Web 地址栏清除 fragment，再调用 LineSpace `/v1/auth/me` 验证并建立本地 Session。失败或过期链接只显示通用错误，并提供返回登录/重新注册入口。

## Mock 模式

```env
EXPO_PUBLIC_USE_MOCKS=true
EXPO_PUBLIC_CURRENT_USER_ID=user-lili
```

数据链路：

```text
Feature -> lineSpaceApi -> MockLineSpaceApi -> mock-data + 进程内状态
```

即使设置了 API 地址，只要 `EXPO_PUBLIC_USE_MOCKS` 不是 `false`，前端仍使用 Mock。

## 本地 HTTP 模式

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_example
SUPABASE_SERVICE_ROLE_KEY=server-only-secret
AUTH_EMAIL_REDIRECT_URL=http://localhost:8081/auth/confirm
```

分别启动：

```bash
pnpm dev:api
pnpm dev:web
```

或将第二条替换为 `pnpm dev`。如果关闭 Mock 却遗漏 `EXPO_PUBLIC_API_BASE_URL`，选择器会回退到 Mock，避免构造无效 HTTP 客户端。HTTP 模式会先进入登录页；登录、注册、Session 恢复和 401 Refresh 都通过 LineSpace `/v1/auth/*` 后端完成，业务写请求自动附加 `Authorization: Bearer <access-token>`。

## Supabase Auth 数据库准备

先应用现有 profile schema，再执行认证迁移：

```text
supabase/migrations/20260715000000_profile_foundation.sql
supabase/migrations/20260715000100_auth_identity.sql
supabase/migrations/20260716000400_auth_trigger_idempotent.sql
```

迁移会完成：

- 为 `public.users` 增加 `auth_user_id uuid`，外键指向 `auth.users(id)`；
- 对规范化后的 `handle` 建立大小写不敏感唯一索引；
- 注册时通过 `auth.users` trigger 创建 LineSpace 业务用户；
- 启用 `public.users` RLS：资料可读，用户只能修改自己的可编辑资料字段；
- 邮箱、密码哈希和认证 Session 继续由 Supabase Auth 管理，不写入业务表。

迁移会在现有 handle 不符合 `3-32` 位规则，或存在大小写不敏感重复值时主动失败。应先清理冲突，不要删除唯一性检查来绕过失败。

## 认证 API 变量检查

`apps/api` 启动认证路由时要求同时具备：

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

若新式 Publishable Key 尚不可用，可以暂时只设置 `SUPABASE_ANON_KEY`。`SUPABASE_SERVICE_ROLE_KEY` 只能配置在独立 Node API 的密钥管理中，不能传给 Vercel Expo 静态前端。

## Expo 环境读取说明

Expo 会在打包时内联 `EXPO_PUBLIC_*` 变量。修改后应重新启动开发服务器或重新执行 `pnpm build:web`。服务端的普通变量由 Node 进程读取，不会因静态前端部署自动生效。

## 生产建议

- 在托管平台的密钥管理中保存服务端密钥，不提交 `.env`。
- 前端 API 地址必须使用 HTTPS。
- Supabase Service Role 和 OpenAI Key 只能出现在独立后端运行环境。
- 生产 Supabase Auth 应启用邮箱确认、足够强的密码策略、泄漏密码保护（若套餐支持）和登录限流。
- 登录错误统一返回 `Invalid username or password.`，日志不得记录注册或登录请求体。
- 当前 Vercel 项目只构建静态前端，配置服务端变量不会使 `apps/api` 自动上线。

## 用户资料与关系域持久化

HTTP 模式的 `ProfileRepository` 使用 `SUPABASE_URL` 与
`SUPABASE_PUBLISHABLE_KEY`（兼容回退 `SUPABASE_ANON_KEY`），并把当前请求
的 `Authorization: Bearer <access-token>` 传给 Supabase。Repository 是
request-scoped；不会复用携带某个用户 JWT 的全局 Client，也不会使用
`SUPABASE_SERVICE_ROLE_KEY` 访问普通用户资料、搜索、关注关系或 Inbox。

执行迁移的顺序为：

1. `supabase/migrations/20260715000000_profile_foundation.sql`
2. `supabase/migrations/20260715000100_auth_identity.sql`
3. `supabase/migrations/20260716000400_auth_trigger_idempotent.sql`
4. `supabase/migrations/20260718000100_user_domain_persistence.sql`
5. `supabase/migrations/20260718000200_inbox_groups.sql`
6. `supabase/migrations/20260718000300_profile_experience.sql`
7. `supabase/migrations/20260719000100_service_role_profile_access.sql`
8. `supabase/migrations/20260719000200_thread_persistence.sql`
9. `supabase/migrations/20260719000300_content_draft_inbox_persistence.sql`
10. `supabase/migrations/20260719000400_group_content_sharing.sql`
11. `supabase/migrations/20260719000500_content_discovery.sql`
12. `supabase/migrations/20260720000100_live_content_runtime.sql`
13. `supabase/migrations/20260720000200_inbox_activity_notifications.sql`

最后一个迁移启用用户关系域的 RLS、最近联系人索引、关注计数器和
`search_public_users`/`list_public_connections` RPC。执行前应先运行
`pnpm check:api` 的迁移静态契约检查；若已有环境存在非法 handle 或约束冲突，
必须先修复数据，不能通过删除唯一性或关闭 RLS 绕过。

用户资料公开读取只返回安全字段。资料更新、关注/取消关注和 Inbox 查询都
由 JWT 映射到 `public.users.id`，数据库再次执行 RLS 校验。Mock 模式仍只
使用 `MockLineSpaceApi` 和 `EXPO_PUBLIC_CURRENT_USER_ID`，不会连接数据库。

本地数据库验证可在具备 Supabase CLI 时使用隔离项目执行
`supabase db reset`，再用两个测试用户分别验证资料更新、重复关注、互关、
取消关注和 Inbox RLS；也可以将迁移按上述顺序通过 `psql "$DATABASE_URL" -f`
逐个执行。当前仓库只提供静态迁移契约和 Repository/路由测试，不包含生产
数据库凭据。

## Supabase CLI and cloud database variables

The repository now uses `supabase/config.toml` and
`supabase/migrations/` as the canonical database deployment entry point.
`docs/archive/database/deferred-migrations/` is intentionally excluded from
the current cloud push because it contains historical design references.
Post, Thread, Compose, Inbox, and discovery persistence are deployed only
from the ordered canonical migration chain above.

For local Supabase, run:

```bash
pnpm db:start
pnpm db:reset
pnpm db:lint
```

For a dedicated hosted Staging project:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <staging-project-ref>
pnpm db:push:dry-run
pnpm db:push
```

The API server receives these variables through Vercel/server process
configuration, never through the Expo bundle:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
AUTH_EMAIL_REDIRECT_URL=https://<web-domain>/auth/confirm
```

`SUPABASE_SERVICE_ROLE_KEY`, database passwords, and connection strings must
not use the `EXPO_PUBLIC_` prefix. `EXPO_PUBLIC_USE_MOCKS=false` and
`EXPO_PUBLIC_API_BASE_URL` are the only client build switches needed to point
the Web app at the HTTP API.

### Local Supabase ports on Windows

This machine reserves the default `543xx` host-port range. The checked-in
`supabase/config.toml` therefore uses:

```text
API/PostgREST: http://127.0.0.1:55421
PostgreSQL:    127.0.0.1:55432
Studio:        http://127.0.0.1:55423
Mailpit:       http://127.0.0.1:55424
```

The LineSpace API should use `SUPABASE_URL=http://127.0.0.1:55421` when
running against the local stack. These port changes are local-only.

## Real Web identity mode

Mock data is now enabled only when `EXPO_PUBLIC_USE_MOCKS=true` is set
explicitly. A missing `EXPO_PUBLIC_API_BASE_URL` no longer falls back to the
fixed `user-lili` identity; the Web build fails with a configuration error so
an incomplete production deployment cannot look like a successful login.

For separate Vercel projects, configure the Web project with public build
variables only:

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=https://<api-project-domain>/api
```

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and `AUTH_EMAIL_REDIRECT_URL` only on the API
project. After changing either `EXPO_PUBLIC_*` value, rebuild the Web project;
Expo embeds these values at build time. The authenticated business user ID
comes from `/v1/auth/login`, `/v1/auth/refresh`, or `/v1/auth/me` and is then
used for profile queries. `EXPO_PUBLIC_CURRENT_USER_ID` is read only in
explicit Mock mode.
