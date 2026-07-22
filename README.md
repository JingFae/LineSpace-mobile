# LineSpace

LineSpace 是面向 iOS、Android 和移动 Web 的诗歌创作、分享与协作产品。
项目采用 TypeScript Monorepo，前端使用 Expo/React Native/Expo Router，
服务端使用 Node.js API Function，认证使用 Supabase Auth，用户资料和用户
关系域逐步迁移到 Supabase/PostgreSQL。

本 README 用于快速理解仓库职责、启动工程和选择数据模式。完整的边界、
依赖方向、路由映射和数据流请阅读
[docs/architecture.md](docs/architecture.md)。

## 项目状态

当前已经具备：

- Expo Router 移动端和 Web 单页导出。
- Feed、诗歌详情、评论/贡献展示、喜欢和收藏交互。
- 普通创作、图片选择、草稿、协作邀请、版本预览和发布流程。
- Thread/Poem Relay 创作流程。
- Profile、资料编辑、头像、本人与其他用户的连接列表。
- Inbox 活动摘要、私聊、群聊和内容分享消息的 Mock/HTTP 双实现。
- Supabase Auth 注册、登录、刷新、退出和 `/me`。
- `AuthSessionProvider`、路由保护、Refresh Token 安全存储和 401 single-flight 刷新。
- `public.users.auth_user_id -> auth.users.id` 身份映射。
- 用户资料、用户搜索、关注关系和最近联系人 PostgreSQL Repository 边界。
- Mock API 与 HTTP API 共用同一套 `LineSpaceApi` 类型契约。
- Expo Web 静态导出和 Vercel `/api/*` Function 入口。
- Community Spark / Creative Spark：仅作者可见，使用原帖与读者评论生成三条
  同语言建议，并可事务性应用诗句、回复来源评论和写入贡献署名。

当前仍为占位或后续能力：

- Discover/Read 和 Comments/Notes 标签页仍是占位页面。
- Mock 模式仍使用内存数据；HTTP 模式已将 Post、Comment、Draft、Inbox
  和 Thread 分享接入 PostgreSQL/RLS。
- Storage 上传已接入用户隔离 bucket；实时协作传输、审核、限流和完整可观测性
  仍未接入。
- Thread 版本 AI 推荐和 Community Spark 都需要服务端 `OPENAI_API_KEY`；
  未配置时 UI 会保留可重试的降级状态。
- 本地仓库没有真实生产 Supabase 凭据，因此不能将静态迁移检查当作真实数据库验证。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Mobile / Web | Expo 52、Expo Router 4、React Native 0.76、React 18 |
| 数据请求 | TanStack Query 5 |
| 客户端语言 | TypeScript 5 |
| API | Node.js HTTP、tsx、Vercel Function |
| 认证 | Supabase Auth、JWT |
| 数据库 | Supabase PostgreSQL、RLS、SQL Migration |
| Monorepo | pnpm Workspace 11.7、Turborepo 2 |
| UI | React Native、React Native SVG、共享 tokens |
| 部署 | Expo Web 静态导出、Vercel |

## 仓库结构

```text
LineSpace-mobile/
├─ apps/
│  ├─ mobile/                         # Expo Router 应用
│  │  ├─ app/                         # 文件路由适配层，只负责路由和参数
│  │  │  ├─ (tabs)/                   # 首页、Discover、Compose、Comments、Profile
│  │  │  ├─ auth/                     # 邮箱确认回跳
│  │  │  ├─ compose/                  # 协作创作路由
│  │  │  ├─ poem/                     # 诗歌详情和分享路由
│  │  │  ├─ profile/                  # 资料、编辑、草稿路由
│  │  │  ├─ thread/                   # Thread、继续创作、版本路由
│  │  │  ├─ _layout.tsx               # QueryClient、Session、根路由保护
│  │  │  └─ compose-preview.tsx       # 预览路由
│  │  ├─ src/
│  │  │  ├─ auth/                     # AuthSessionProvider、Token 存储和确认回跳
│  │  │  ├─ features/                 # 按产品领域组织的 Screen 和交互逻辑
│  │  │  │  ├─ auth/
│  │  │  │  ├─ compose/
│  │  │  │  ├─ feed/
│  │  │  │  ├─ inbox/
│  │  │  │  ├─ poem/
│  │  │  │  ├─ profile/
│  │  │  │  └─ thread/
│  │  │  ├─ navigation/               # Tab 路由模型和导航常量
│  │  │  ├─ screens/                  # 可复用的占位/通用页面
│  │  │  └─ services/                 # Mock/HTTP API 选择和当前会话用户 ID
│  │  ├─ assets/                      # App 专属图片、Logo 和位图素材
│  │  ├─ app.json                     # Expo 配置
│  │  ├─ babel.config.cjs             # Babel 配置
│  │  └─ metro.config.cjs             # Monorepo Metro 配置
│  │
│  └─ api/                            # Node/Vercel API
│     └─ src/
│        ├─ auth/                     # Auth Service、校验、错误和 Auth Routes
│        ├─ database/                 # Repository、Schema、Migration、数据库检查
│        │  ├─ migrations/
│        │  ├─ profile-repository.ts
│        │  ├─ profile-schema.sql
│        │  └─ compose-schema.sql
│        ├─ routes.ts                  # HTTP 路由编排和输入校验
│        ├─ server.ts                  # 本地 Node HTTP 适配层
│        ├─ auth-check.ts              # 认证契约检查
│        └─ smoke-check.ts             # API、Mock、HTTP 契约冒烟检查
│
├─ packages/
│  ├─ api-client/                     # 前后端共享 API 契约和客户端实现
│  │  └─ src/
│  │     ├─ types.ts                  # 请求、响应和领域类型
│  │     ├─ client.ts                 # LineSpaceApi + MockLineSpaceApi
│  │     ├─ http-client.ts             # HttpLineSpaceApi
│  │     ├─ auth-client.ts             # Auth HTTP Client
│  │     ├─ mock-data.ts               # Mock 数据和本地可变状态种子
│  │     └─ index.ts                  # 公共导出面
│  ├─ ui/                             # 无业务、无网络的 React Native 组件库
│  │  └─ src/
│  │     ├─ components/
│  │     ├─ icon/
│  │     └─ index.ts
│  └─ tokens/                         # 颜色、排版、间距和圆角等设计变量
│     └─ src/
│        ├─ colors.ts
│        ├─ spacing.ts
│        ├─ typography.ts
│        └─ index.ts
│
├─ api/[...path].ts                   # Vercel Function 入口
├─ docs/                              # 架构、环境、部署和设计交接文档
├─ .env.example                       # 环境变量模板
├─ package.json                       # 根命令和 Workspace 脚本
├─ pnpm-workspace.yaml                # Workspace 声明
├─ turbo.json                         # Turbo 构建编排
├─ tsconfig.base.json                 # 共享 TypeScript 基础配置
└─ vercel.json                        # Web 静态部署和 API 路由配置
```

## 模块职责

### `apps/mobile`

移动端只组合 UI、Feature 和共享 API Client：

- `app/` 是 Expo Router 路由适配层，不放业务数据请求。
- `src/features/` 按 Feed、Compose、Poem、Profile、Inbox、Thread 等产品域拆分。
- `src/auth/` 管理 Session 状态、刷新、退出和安全存储。
- `src/services/lineSpaceApi.ts` 是 Mock/HTTP 的唯一选择点。
- Feature 不直接调用 `fetch`，只依赖 `LineSpaceApi`。

### `apps/api`

服务端按“认证、路由、数据访问”分层：

- `auth/` 负责 Supabase Auth 交互、JWT 认证、输入校验和通用错误。
- `routes.ts` 负责 HTTP 方法、路径、输入校验、身份检查和 Repository 编排。
- `database/` 负责 PostgreSQL Schema、Migration、RLS 契约和 Repository。
- 普通用户资料和关系查询使用当前请求 JWT。
- Service Role 只允许存在于服务端认证映射或明确的后台动作中。

### `packages/api-client`

这是前后端共享的 API 契约层：

- `types.ts` 定义稳定的请求和响应类型。
- `client.ts` 实现 Mock API。
- `http-client.ts` 实现与 Node API 对齐的 HTTP API。
- `auth-client.ts` 实现认证 API 客户端。
- 业务组件不应绕过该包直接拼接 API 请求。

### `packages/ui` 与 `packages/tokens`

- `tokens` 只保存平台无关的设计变量。
- `ui` 只保存可复用组件、图标和展示逻辑。
- UI 包不能读取环境变量、调用 API 或依赖具体 Feature。
- 页面示例数据必须留在 Mock/API Client 层，不进入通用 UI。

## 数据模式

### Mock 模式

默认使用 Mock：

```env
EXPO_PUBLIC_USE_MOCKS=true
EXPO_PUBLIC_CURRENT_USER_ID=user-lili
```

数据流：

```text
Feature Screen
  -> lineSpaceApi
  -> MockLineSpaceApi
  -> packages/api-client/src/mock-data.ts
```

Mock 模式不需要真实 Supabase 环境，不会因为认证或数据库不可用而阻塞页面开发。

### HTTP 模式

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

数据流：

```text
Feature Screen
  -> lineSpaceApi
  -> HttpLineSpaceApi
  -> /api/[...path].ts 或 apps/api/src/server.ts
  -> apps/api/src/routes.ts
  -> Auth Service / ProfileRepository / Mock fallback
  -> Supabase Auth / PostgreSQL RLS
```

HTTP 模式下：

- Access Token 只保存在内存。
- Native Refresh Token 使用 Expo SecureStore。
- Web Refresh Token 使用 sessionStorage，不使用 localStorage。
- 401 最多触发一次 single-flight Refresh，并只重试原请求一次。
- 当前身份来自 AuthSessionProvider 和 JWT，不信任 `EXPO_PUBLIC_CURRENT_USER_ID`。

## 核心 API 分区

### Auth

```text
POST /v1/auth/register
POST /v1/auth/login
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/auth/me
```

### User Domain

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

用户域 Repository 使用：

- `public.users`
- `user_profile_stats`
- `user_profile_visibility`
- `badges`
- `user_badges`
- `user_follows`
- `inbox_messages`

搜索的 actor、连接关系状态和关注写入都由服务端 JWT 推导，前端传入的
`userId`/`viewerId` 不构成权限依据。

### Content Domain

Feed、Poem、Thread、Compose、评论、喜欢、收藏和转发仍通过现有
`LineSpaceApi` 契约工作。HTTP 模式现在由 PostRepository、CommentRepository、
ThreadRepository、DraftRepository 和 InboxRepository 使用 PostgreSQL/RLS
持久化；Mock 模式仍保持原有内存行为。

## 数据库迁移顺序

```text
supabase/migrations/20260715000000_profile_foundation.sql
supabase/migrations/20260715000100_auth_identity.sql
supabase/migrations/20260716000400_auth_trigger_idempotent.sql
supabase/migrations/20260718000100_user_domain_persistence.sql
supabase/migrations/20260718000200_inbox_groups.sql
supabase/migrations/20260718000300_profile_experience.sql
supabase/migrations/20260719000100_service_role_profile_access.sql
supabase/migrations/20260719000200_thread_persistence.sql
supabase/migrations/20260719000300_content_draft_inbox_persistence.sql
supabase/migrations/20260719000400_group_content_sharing.sql
supabase/migrations/20260719000500_content_discovery.sql
supabase/migrations/20260720000100_live_content_runtime.sql
supabase/migrations/20260720000200_inbox_activity_notifications.sql
supabase/migrations/20260720000300_content_experience_progression.sql
supabase/migrations/20260720000400_inbox_group_transactions.sql
supabase/migrations/20260720000500_thread_engagement_delete_permissions.sql
```

Level is uniformly bounded to 1–10. PostgreSQL awards append-only, idempotent
experience events from published Posts/Threads, continuations, comments,
likes, and saves. Inbox groups are created, accepted/declined, and messaged
through JWT-derived transactional RPCs; clients cannot assemble group state
with direct table writes.

新环境和已有环境都必须按顺序执行。迁移会检查非法 handle、资料字段和缺失表，
不会静默覆盖已有用户资料。RLS 不得通过关闭的方式绕过。

## 常用命令

```bash
corepack enable
pnpm install --frozen-lockfile

pnpm dev                  # Expo 开发服务器
pnpm dev:web              # Expo Web 开发服务器
pnpm dev:api              # 本地 Node API，默认 4000

pnpm typecheck            # 全 Workspace TypeScript 检查
pnpm check:api            # Auth、API、Mock、Migration 契约检查
pnpm build:web            # Expo Web 生产导出
pnpm check                # typecheck + check:api + build:web
pnpm db:security-check    # 本地 Supabase 多用户 RLS/群分享集成检查
```

原生开发：

```bash
pnpm --filter @linespace/mobile android
pnpm --filter @linespace/mobile ios
```

iOS 需要 macOS/Xcode，Android 需要 Android Studio、SDK 和可用设备或模拟器。

## 环境变量

复制 `.env.example` 为本地 `.env`，不要提交真实密钥。

客户端变量：

- `EXPO_PUBLIC_USE_MOCKS`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_CURRENT_USER_ID`（仅 Mock 模式）

服务端变量：

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` 或 `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_EMAIL_REDIRECT_URL`
- `PORT`

任何 `EXPO_PUBLIC_*` 变量都会进入客户端 Bundle，不能放入 Service Role、
数据库连接串或其他私密密钥。完整说明见
[docs/environment.md](docs/environment.md)。

## 设计资产与文档

- [架构与代码边界](docs/architecture.md)
- [环境变量与数据库准备](docs/environment.md)
- [部署说明](docs/deployment.md)
- [Figma 交接](docs/Instructions/figma-handoff.md)
- [UI 团队技术交接](docs/Instructions/UI团队技术交接.md)
- [Windows 文件锁排查](docs/Instructions/windows-file-locks.md)
- [pnpm 排查](docs/Instructions/pnpm-troubleshooting.md)

## 开发边界

- 不在客户端调用 Supabase Service Role API。
- 不在日志、URL、错误信息或业务表中保存密码和 Token。
- 不通过前端 actor ID 建立权限。
- 不把数据库访问代码放入 `packages/ui` 或 `apps/mobile`。
- 不把 Feed/Poem/Post 持久化混入用户资料域迁移。
- 修改 UI 时优先复用 `packages/tokens` 和 `packages/ui`。
- 新增业务域时先定义共享 API 类型，再接入 Mock 和 HTTP 实现。

## 已知限制

- Thread 的完整版本计算、Feed 排序策略和 AI 生成仍有后续产品工作；
  本轮未实现实时协作传输。
- 尚未连接真实生产 Supabase 项目完成注册、邮箱确认和云端迁移后的端到端验证；
  本地 Docker Supabase 已完成关键 RLS 与写入验证。
- `apps/api` 的本地服务器与 Vercel Function 需要分别配置服务端环境变量。
- Web sessionStorage 仍存在 XSS 风险，生产部署应配置 CSP 和严格脚本控制。
- 仓库当前没有独立 ESLint；`pnpm lint` 目前兼容为 TypeScript 检查。

## Supabase 云端迁移（当前执行入口）

当前唯一会被 Supabase CLI 执行的迁移目录是 `supabase/migrations/`。
正式链现在覆盖 Auth、用户资料/关系、Thread、Post/Comment、Compose 草稿、
私聊/群聊内容分享、Thread Version 原子发布为 Post 和 Storage 权限。
`docs/archive/database/deferred-migrations/`
只保留历史设计参考，不会被 `supabase db push` 自动执行，也不应复制回正式
迁移目录。

本地验证（需要 Docker）：

```bash
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm check:api
```

部署到已链接的 Staging Supabase 项目：

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <staging-project-ref>
pnpm db:push:dry-run
pnpm db:push
```

先检查 dry-run 输出，再执行正式推送。不要对 Production 执行
`supabase db reset --linked`。如果云端曾经手工执行过 SQL，先使用
`supabase db pull` 或经过审查的 `supabase migration repair` 对齐迁移历史。

### 数据库目录职责

```text
apps/api/src/database/
├─ core/                       # Client、认证上下文、错误和公共映射
├─ profile/                    # 用户资料、搜索、关注和最近联系人
├─ post/                       # Feed、Post、评论及互动
├─ thread/                     # Thread、Continuation 和分享
├─ draft/                      # 草稿、协作、发布和 Storage 上传
├─ inbox/                      # 私聊、群聊和消息内容映射
├─ discovery/                  # 内容搜索和个人主页聚合查询
├─ checks/                     # 静态迁移契约和本地安全检查
└─ linespace-api.facade.ts     # request-scoped 兼容门面

docs/archive/database/
└─ deferred-migrations/        # 历史设计参考，不是部署入口

supabase/
├─ config.toml                 # Supabase CLI 本地配置
└─ migrations/                 # 唯一可部署迁移来源
```
