# LineSpace 架构与代码边界

本文说明 LineSpace 的工程分层、模块职责、依赖方向、数据流和扩展规则。
它与 [README.md](../README.md) 配套使用：README 负责快速启动，本文负责
工程级设计约束。

## 1. 总体分层

```text
┌──────────────────────────────────────────────────────────────┐
│ apps/mobile                                                   │
│ Expo Router + Feature Screens + AuthSessionProvider           │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
                │ shared contract               │ shared visual system
                ▼                               ▼
┌─────────────────────────┐       ┌────────────────────────────┐
│ packages/api-client     │       │ packages/ui + packages/tokens│
│ types / Mock / HTTP      │       │ components / icons / tokens │
└───────────────┬─────────┘       └────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│ apps/api                                                       │
│ routes -> auth / repositories -> Supabase Auth / PostgreSQL RLS│
└──────────────────────────────────────────────────────────────┘
```

核心原则：

1. 路由、页面和通用 UI 分离。
2. 前后端共享 API 契约，不共享服务端密钥和数据库客户端。
3. 普通业务查询使用请求 JWT 和数据库 RLS。
4. Mock 和 HTTP 实现必须保持 `LineSpaceApi` 方法兼容。
5. 数据库权限由 JWT 推导身份，不能信任前端传入的 actor ID。

## 2. Monorepo 工作区

| 工作区 | 包名 | 职责 |
| --- | --- | --- |
| `apps/mobile` | `@linespace/mobile` | Expo App、Expo Web、路由和 Feature |
| `apps/api` | `@linespace/api` | Node/Vercel API、认证、Repository、迁移检查 |
| `packages/api-client` | `@linespace/api-client` | API 类型、Mock Client、HTTP Client、Auth Client |
| `packages/ui` | `@linespace/ui` | 无业务网络依赖的 React Native 组件和图标 |
| `packages/tokens` | `@linespace/tokens` | 颜色、字体、间距、圆角等设计变量 |

允许的依赖方向：

```text
apps/mobile ──> packages/api-client
apps/mobile ──> packages/ui ──> packages/tokens
apps/api    ──> packages/api-client
```

禁止的依赖：

- `packages/ui` 依赖 `apps/mobile` 或 API。
- `packages/tokens` 依赖 React、页面或网络。
- `packages/api-client` 依赖 React Native 页面。
- `apps/api` 导入移动端 Screen、Assets 或 Expo 运行时。
- 移动端直接导入 Supabase Service Role 或数据库客户端。

## 3. 移动端目录约定

### 3.1 `app/`：路由适配层

`apps/mobile/app` 是 Expo Router 的文件路由目录。路由文件只负责：

- 读取动态参数和查询参数；
- 配置公开/受保护路由；
- 把参数传给 Feature Screen；
- 保持 Stack、Tabs 和回跳地址稳定。

业务请求、复杂状态和页面布局应放到 `src/features`，不要堆积在路由文件中。

主要路由分区：

```text
app/
├─ _layout.tsx                 # QueryClient、AuthSession、RouteGuard
├─ (tabs)/
│  ├─ index.tsx                # Feed 首页
│  ├─ discover.tsx             # Discover 占位
│  ├─ compose.tsx              # Compose 入口
│  ├─ comments.tsx             # Comments/Notes 占位
│  ├─ profile.tsx              # 当前用户 Profile
│  └─ _layout.tsx              # Expo Tabs 容器
├─ auth/confirm.tsx             # 邮箱确认回跳
├─ login.tsx / register.tsx     # 公开认证页面
├─ compose-preview.tsx          # 草稿预览
├─ compose/collaborate/[id].tsx # 协作草稿
├─ poem/[id].tsx                # 诗歌详情
├─ poem/share/[id].tsx          # 诗歌分享
├─ profile/[id].tsx             # 用户资料
├─ profile/edit.tsx             # 资料编辑
├─ profile/drafts.tsx            # 草稿列表
└─ thread/...                    # Thread、继续创作和版本
```

### 3.2 `src/features/`：按产品领域拆分

```text
src/features/
├─ auth/       # 登录、注册、邮箱确认 UI
├─ compose/    # 草稿、图片、协作者、预览、发布
├─ feed/       # 首页 Feed
├─ inbox/      # Inbox 活动与会话
├─ poem/       # 诗歌详情、评论、分享、互动
├─ profile/    # 资料、连接、编辑、草稿
└─ thread/     # Thread Relay、继续创作、版本树
```

每个 Feature 内部推荐按照以下顺序组织：

```text
Screen
  ├─ query/mutation hooks
  ├─ domain-specific view components
  ├─ local formatters / helpers
  └─ styles
```

Feature 可以依赖 `lineSpaceApi`、`useAuth`、`packages/ui` 和 `packages/tokens`，
不能直接访问 `fetch`、Supabase 或服务端环境变量。

### 3.3 `src/auth/`：认证基础设施

| 文件 | 职责 |
| --- | --- |
| `AuthSessionProvider.tsx` | Session 状态、启动恢复、登录、注册、刷新、退出 |
| `authStorage.ts` | Native SecureStore / Web sessionStorage |
| `session-store.ts` | 内存 Access Token 和 Refresh single-flight |
| `emailConfirmation.ts` | 邮箱确认回跳处理 |

认证状态初始化完成前，`RouteGuard` 只显示加载态，不能短暂渲染受保护页面。

## 4. API Client 分层

`packages/api-client/src` 是客户端唯一公共 API 面：

```text
types.ts
  ├─ client.ts       # LineSpaceApi + MockLineSpaceApi
  ├─ http-client.ts  # HttpLineSpaceApi
  ├─ auth-client.ts  # HttpAuthClient
  └─ mock-data.ts    # Mock 数据和本地状态种子
```

### `LineSpaceApi`

所有 Feature 只依赖这个接口。该接口覆盖：

- Auth 之外的资料和用户关系；
- Feed、Poem、Thread、Compose；
- 评论、喜欢、收藏、分享；
- Inbox 和草稿流程。

新增方法时必须同时考虑：

1. `types.ts` 请求/响应类型；
2. `MockLineSpaceApi` 行为；
3. `HttpLineSpaceApi` 路径、方法和错误；
4. `apps/api/src/routes.ts` 路由；
5. API smoke check。

### HTTP 认证行为

`HttpLineSpaceApi` 通过 `getAccessToken` 附加：

```http
Authorization: Bearer <access-token>
```

收到 401 时最多执行一次 single-flight Refresh，再重试原请求一次。登录、
注册和 Refresh 不通过业务请求的自动重试机制无限重试。

## 5. 服务端分层

### 5.1 `auth/`

```text
auth/
├─ routes.ts              # /v1/auth/* 路由和 AuthRequestContext
├─ service.ts             # AuthService 接口
├─ supabase-auth-service.ts
├─ validation.ts
├─ errors.ts
└─ index.ts
```

认证服务负责：

- username 到 email 的服务端映射；
- Supabase Auth 注册、登录、Refresh、Logout 和 `/me`；
- JWT 验证；
- 通用错误；
- Service Role 的严格服务端边界。

Service Role 不得被移动端、`packages/api-client` 或 `packages/ui` 引用。

### 5.2 `routes.ts`

路由层只做四件事：

1. 解析 HTTP 方法、路径和参数；
2. 认证受保护请求；
3. 校验输入并转换为类型化输入；
4. 调用 Mock API 或 Repository，并映射稳定错误。

路由层不应：

- 拼接 SQL；
- 读取 Service Role Key；
- 把 Supabase 内部错误直接返回给客户端；
- 用请求体中的 `userId` 作为权限依据。

### 5.3 `database/`

```text
database/
├─ profile-repository.ts        # 用户资料、搜索、关系和最近联系人
├─ profile-schema.sql            # Profile 域基础 schema
├─ compose-schema.sql            # Compose 域 schema 草案
├─ migrations/                  # 按时间排序的正式迁移
└─ migration-check.ts            # 静态迁移契约检查
```

Repository 通过 request-scoped Supabase Client 访问数据库：

```text
Bearer JWT
  -> Supabase Client
  -> auth.uid()
  -> current_linespace_user_id()
  -> public.users.id
  -> RLS / RPC / table constraints
```

用户域使用：

- `public.users`
- `user_profile_stats`
- `user_profile_visibility`
- `badges`
- `user_badges`
- `user_follows`
- `inbox_messages`

搜索、连接列表和资料更新使用受控 RPC；普通写入不使用 Service Role。

## 6. 用户域 API 边界

```text
GET    /v1/users/:id/profile
PUT    /v1/users/:id/profile
GET    /v1/users/search?query&limit&cursor
GET    /v1/users/:id/connections?kind=followers|following
GET    /v1/users/:id/followers
GET    /v1/users/:id/following
PUT    /v1/users/:id/follow
DELETE /v1/users/:id/follow
```

### 身份规则

- URL 中的目标用户只表示资源目标。
- 当前用户从 JWT 推导。
- `viewerId` 不能成为 HTTP 权限依据。
- Repository 接收 actor/target 是为了避免路由遗漏校验，但数据库 RLS 是最终权限边界。

### 搜索规则

- 只搜索 `handle` 和 `display_name`；
- 查询最多 64 字符；
- limit 限制为 1–50；
- 使用稳定 keyset cursor，不使用无限 offset；
- 当前用户默认排除；
- `recent` 由当前用户 Inbox 参与者推导；
- `friends` 必须是双方互相关注；
- 不返回 email、auth_user_id、密码、Token 或认证 metadata。

### 关注和计数

`user_follows` 使用联合主键或唯一约束防重复，禁止自关注。关注计数由数据库
Trigger 与关系写操作同步，不采用 Node 端“读取计数后加一”的竞态实现。

## 7. 数据模式选择

### Mock

```text
EXPO_PUBLIC_USE_MOCKS !== "false"
  -> createMockLineSpaceApi()
  -> mock-data.ts + 进程内状态
```

Mock 模式适用于无 Supabase 环境的 UI 和 Feature 开发，并继续支持
`EXPO_PUBLIC_CURRENT_USER_ID`。

### HTTP

```text
EXPO_PUBLIC_USE_MOCKS=false
  -> HttpLineSpaceApi
  -> apps/api
  -> Auth Service / ProfileRepository
  -> Supabase Auth / PostgreSQL
```

HTTP 模式下，`EXPO_PUBLIC_CURRENT_USER_ID` 不再是可信身份来源。若服务端未
配置 Supabase，用户域 Repository 会返回不可用，不能把该状态误认为生产数据库
已连接；本地开发可以继续使用 Mock。

## 8. 数据库迁移顺序

```text
profile-schema.sql
202607150001_auth_identity.sql
202607160001_profile_architecture.sql
202607160002_post_interactions.sql
202607160003_create_visibility.sql
202607160004_auth_trigger_idempotent.sql
202607180001_user_domain_persistence.sql
```

迁移要求：

- 按顺序执行；
- 已有非法数据必须明确失败；
- 不能静默覆盖已有资料；
- 使用 `if exists`、`if not exists` 或 catalog 检查；
- 不关闭 RLS；
- 不修改 Feed/Poem/Post/评论的持久化范围；
- 通过 `pnpm check:api` 运行静态契约检查。

具备隔离 Supabase CLI 或 PostgreSQL 时，再执行真实 Migration 和双用户 RLS 测试。
没有真实数据库环境时，不得声称 SQL/RLS 已完成端到端验证。

## 9. 请求与部署流

本地 API：

```text
pnpm dev:api
  -> apps/api/src/server.ts
  -> apps/api/src/routes.ts
```

Vercel：

```text
/api/*
  -> api/[...path].ts
  -> apps/api route handler
```

Web 静态导出：

```text
pnpm build:web
  -> expo export --platform web
  -> apps/mobile/dist
  -> Vercel SPA fallback
```

Vercel API Function 和静态 Web 构建必须分别配置环境变量。任何
`EXPO_PUBLIC_*` 变量都会进入客户端 Bundle。

## 10. 新增模块的实施规则

新增一个产品域时按以下顺序：

1. 明确域边界：页面、API、数据表和权限。
2. 在 `packages/api-client/src/types.ts` 定义请求/响应。
3. 为 Mock 和 HTTP 实现相同的 `LineSpaceApi` 方法。
4. 在 `apps/api/src/routes.ts` 增加最小路由编排。
5. 需要持久化时新增 Repository 和 Migration。
6. 为数据库补充 RLS、索引、约束和幂等行为。
7. 在 `smoke-check.ts` 和 `migration-check.ts` 增加契约检查。
8. 更新 README、architecture、environment 和 deployment 文档。
9. 运行 `pnpm check`。

不应为了一个 Feature 引入第二套大型状态管理框架，也不应把服务端 SDK、
数据库类型或密钥复制到移动端。

## 11. 检查命令

```bash
pnpm typecheck
pnpm check:api
pnpm build:web
pnpm check
```

`pnpm check` 是当前 CI 级综合检查，包含 TypeScript、Auth/API 契约和 Expo Web
导出。当前仓库没有独立 ESLint，`pnpm lint` 兼容执行 TypeScript 检查。
