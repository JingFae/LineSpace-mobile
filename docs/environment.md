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
| `AUTH_EMAIL_REDIRECT_URL` | 可选 | `apps/api` | 注册确认邮件完成后返回 LineSpace 的地址，必须加入 Supabase Redirect URLs |
| `OPENAI_API_KEY` | 未来可选 | 只能由 `apps/api` 读取 | AI 写作与审核；当前路由固定返回 501 |

所有 `EXPO_PUBLIC_*` 变量都会进入客户端产物，只能放公开配置。不要给 Service Role Key 或数据库连接串添加这个前缀。当前认证后端只读取普通服务端变量；前端 Session 接入将在后续阶段完成。

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

或将第二条替换为 `pnpm dev`。如果关闭 Mock 却遗漏 `EXPO_PUBLIC_API_BASE_URL`，选择器会回退到 Mock，避免构造无效 HTTP 客户端。HTTP 写接口现在要求 `Authorization: Bearer <access-token>`；当前前端尚未实现登录页面和 Session Provider，因此本阶段主要通过 API 测试和直接 HTTP 请求验证。

## Supabase Auth 数据库准备

先应用现有 profile schema，再执行认证迁移：

```text
apps/api/src/database/profile-schema.sql
apps/api/src/database/migrations/202607150001_auth_identity.sql
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
