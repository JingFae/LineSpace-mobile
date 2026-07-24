# LineSpace

LineSpace 是一个面向 iOS、Android 和移动 Web 的诗歌社交与创意写作平台。
它把公开阅读、诗歌发布、Thread Relay 接力创作、评论反馈、私聊分享和作者控制的 AI 共创放在同一个创作循环里：读者可以发现一首诗，参与一条 Thread，留下评论，再把反馈转化为下一次修改。

当前仓库是一个 TypeScript Monorepo，包含 Expo/React Native 客户端、Node.js/Vercel API、共享 API 契约、无业务 UI 组件、设计 tokens，以及 Supabase Auth/PostgreSQL/RLS 数据层。

> README 描述当前代码已经实现的能力和真实边界；架构约束、数据库细节和部署检查分别见 [docs/architecture.md](docs/architecture.md)、[docs/environment.md](docs/environment.md) 和 [docs/deployment.md](docs/deployment.md)。

## 当前实现概览

### 已落地的产品能力

- 访客模式：无需登录即可浏览公开 Feed、Post、Thread、搜索、标签和公开资料；涉及发布、互动、保存、关注、分享或 Inbox 时再引导登录。
- Supabase Auth 认证：注册、登录、邮箱确认回跳、刷新、退出、`/me` 和修改密码。
- Thread Relay：创建主题与首行，按父子关系继续写作，展开完整分支树，查看稳定行号，并从 Thread 版本中继续创作或发布为个人 Post。
- Thread 版本：支持推荐、最高赞、最长路径和自定义版本；版本预览支持分享、Web 图片/PDF 导出，以及可选 AI 版本推荐。
- Post / Poem：标题、正文、标签、提及、图片/视频、草稿、发布、评论/回复、喜欢、收藏、分享和作者删除。
- 诗歌视觉设计：模板、字体、背景和贴纸由 design catalog 统一提供；发布后的布局和 Thread Version 的署名行会被持久化。
- Compose Relay：普通诗歌草稿与 Relay 草稿分离，Relay 的首行和写作主题/规则分别保存；支持协作者邀请、版本操作、预览和发布。
- Discovery：Feed 支持 `latest`、`popular`、`following`，并支持 `all`、`most-contributed`、`growing`、`final` 筛选；支持跨 Post/Thread/User 搜索和标签结果页。
- Profile：资料编辑、头像、简介、资料可见性、关注/互关关系、Followers/Following 列表、内容统计、草稿和 Posts/Threads/Comments/Saves 内容分区。
- 成长体系：创作者与评论者经验值、Level 1–10、进度和徽章；经验事件由数据库以幂等方式记录。
- Inbox：评论、喜欢/收藏、Thread、关注/提及等活动摘要；支持已读标记、私聊、群聊、群邀请，以及 Post/Thread/Continuation 内容分享。
- Community Spark（界面文案为 Creative Spark）：仅作者可以打开，服务端根据当前诗作与读者评论生成三条同语言的修改/续写建议；作者可将建议应用到当前诗作、回复来源评论并写入贡献署名。

### 当前边界

- Mock 模式使用 `packages/api-client` 的进程内数据，适合 UI 和 Feature 开发。
- HTTP 模式在 Supabase 环境完整配置时使用 PostgreSQL/RLS Repository；服务端未配置数据库时会回退到 Mock，生产环境应通过 readiness 检查阻止这种误配置。
- 本仓库没有生产 Supabase 凭据，因此本地检查不能替代生产注册、邮箱确认、云端迁移和真实数据的端到端验证。
- 实时协作传输、审核策略、分布式限流和完整可观测性尚未接入；当前协作能力是草稿操作/邀请与持久化边界，不是 Realtime 同步编辑器。
- Community Spark 需要服务端 `DEEPSEEK_API_KEY`；Thread 版本 AI 推荐为可选能力，未配置 AI 密钥时保留确定性版本选择或可重试的降级状态。
- Web Refresh Token 使用 `sessionStorage`，Access Token 只驻留内存；生产部署仍应配置 CSP、严格脚本控制和服务端限流。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 客户端 | Expo 52、Expo Router 4、React Native 0.76、React 18、React Native Web |
| 数据请求 / 状态 | TanStack Query 5、Zustand 5 |
| 语言 | TypeScript 5、Node.js 20+ |
| API | Node.js HTTP、`tsx`、Vercel Node Function |
| 认证 | Supabase Auth、JWT、Native SecureStore、Web sessionStorage |
| 数据库 | Supabase PostgreSQL、SQL Migration、RLS、JWT-derived RPC |
| Monorepo | pnpm Workspace 11.7、Turborepo 2 |
| UI | React Native、React Native SVG、共享 UI components 和 design tokens |
| AI | DeepSeek Community Spark；OpenAI Thread 版本推荐兼容入口 |
| 部署 | Expo Web 静态导出、Vercel 静态托管 + `/api/*` Function |

## 快速开始

### 环境要求

- Node.js `>=20.0.0`；CI 使用 Node 22。
- pnpm `11.7.0`，推荐通过 Corepack 启用。
- iOS 原生开发需要 macOS/Xcode；Android 原生开发需要 Android Studio、SDK 和设备或模拟器。
- Supabase CLI 和 Docker 仅在本地数据库验证或迁移检查时需要。

### 安装与 Mock 开发

在仓库根目录执行：

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
pnpm dev
```

默认 `.env.example` 使用 Mock：

```env
EXPO_PUBLIC_USE_MOCKS=true
EXPO_PUBLIC_CURRENT_USER_ID=user-lili
```

常用启动方式：

```bash
pnpm dev                  # Expo 开发服务器
pnpm dev:web              # Expo Web
pnpm dev:api              # 本地 Node API，默认 http://localhost:4000
pnpm --filter @linespace/mobile android
pnpm --filter @linespace/mobile ios
```

Web 端会以移动设备外壳展示应用，便于在桌面浏览器中检查移动布局；原生端通过 Expo 启动。

### HTTP / Supabase 开发

客户端切换到 HTTP：

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

API 服务端至少需要：

```env
SUPABASE_URL=http://127.0.0.1:55421
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
AUTH_EMAIL_REDIRECT_URL=http://localhost:8081/auth/confirm
```

本地 Supabase 端口来自 `supabase/config.toml`：API/PostgREST `55421`、PostgreSQL `55432`、Studio `55423`、Mailpit `55424`。

启动本地数据库并执行验证：

```bash
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm db:security-check
pnpm dev:api
```

如果只需要跑 HTTP 路由而没有 Supabase，API 会使用 Mock fallback；这适合契约调试，不代表数据库已经连接成功。使用 `GET /health/ready` 检查 Auth 和 Community Spark 配置。

## 工程结构

```text
LineSpace-mobile/
├─ apps/
│  ├─ mobile/                         # Expo Router 应用、Feature Screens、认证和导航
│  │  ├─ app/                         # 文件路由适配层，只处理参数、导航和 Route Guard
│  │  │  ├─ (tabs)/                   # Thread、Post/Discover、Compose、Inbox、Profile
│  │  │  ├─ auth/confirm.tsx          # 邮箱确认回跳
│  │  │  ├─ poem/                     # Post 详情与分享
│  │  │  ├─ profile/                  # 资料、编辑与草稿
│  │  │  ├─ thread/                   # Thread、继续创作、分享与版本
│  │  │  ├─ search.tsx                # 全局搜索
│  │  │  └─ tags/[tag].tsx            # 标签结果
│  │  ├─ src/
│  │  │  ├─ auth/                     # Session、访客模式、Token 存储和刷新
│  │  │  ├─ features/                 # 按产品域组织的 Screen 和交互逻辑
│  │  │  │  ├─ auth/ compose/ feed/ discovery/
│  │  │  │  ├─ inbox/ poem/ profile/ thread/
│  │  │  ├─ navigation/               # Tab 模型和导航常量
│  │  │  ├─ screens/                  # 通用/占位页面
│  │  │  └─ services/                 # Mock/HTTP 选择和当前会话用户
│  │  └─ assets/                      # App 专属图片和位图素材
│  └─ api/                            # Node HTTP / Vercel API
│     └─ src/
│        ├─ ai/                       # Community Spark、Thread AI 推荐
│        ├─ auth/                     # Auth Service、校验和认证路由
│        ├─ database/
│        │  ├─ core/                  # request-scoped Client、身份和错误
│        │  ├─ profile/               # 资料、搜索、连接和关注
│        │  ├─ post/                  # Feed、Post、评论和互动
│        │  ├─ thread/                # Thread、Continuation、Version
│        │  ├─ draft/                 # 草稿、发布、协作者和 Storage
│        │  ├─ inbox/                 # 私聊、群聊、分享和活动
│        │  ├─ discovery/             # 搜索和 Profile 内容聚合
│        │  ├─ checks/                # 迁移、Vercel 和本地安全检查
│        │  └─ linespace-api.facade.ts
│        ├─ routes.ts                 # HTTP 路由编排和输入验证
│        ├─ server.ts                 # 本地 Node HTTP 适配层
│        └─ *-check.ts                # Auth、API、AI、迁移契约检查
├─ packages/
│  ├─ api-client/                     # 共享 API 类型、Mock、HTTP、Auth Client
│  ├─ ui/                             # 无业务、无网络的 React Native 组件和图标
│  └─ tokens/                         # 颜色、字体、间距和圆角等设计变量
├─ api/[...path].ts                   # Vercel Function 稳定入口
├─ supabase/migrations/               # 唯一可部署的有序迁移来源
├─ docs/                              # 架构、环境、部署和设计交接
├─ .env.example
├─ package.json / pnpm-workspace.yaml
├─ turbo.json / tsconfig.base.json
└─ vercel.json
```

## 模块职责与依赖方向

```text
apps/mobile ──> packages/api-client
             └─> packages/ui ──> packages/tokens

apps/api    ──> packages/api-client
```

### 移动端

- `app/` 是 Expo Router 的适配层，只读取路由参数、配置公开/受保护路由并渲染 Feature Screen。
- `src/features/` 按 `auth`、`compose`、`feed`、`discovery`、`inbox`、`poem`、`profile`、`thread` 拆分产品域。
- `src/auth/` 负责 Session 恢复、访客模式、邮箱确认、刷新、退出和平台差异化 Token 存储。
- Feature 只依赖 `lineSpaceApi`、Auth hooks、共享 UI 和 tokens，不直接调用 `fetch`、Supabase 或服务端密钥。

### API 与数据库

- `routes.ts` 负责方法、路径、身份检查、输入验证、错误映射和 Repository 编排，不拼接 SQL。
- `database/` 以 Profile、Post、Thread、Draft、Inbox、Discovery 为边界拆分 Repository/Query。
- 每个请求创建带当前 Bearer JWT 的 Supabase Client；数据库通过 `auth.uid()` 映射到 `public.users.id`，再由 RLS、约束和事务 RPC 做最终授权。
- `Service Role` 只允许存在于服务端认证映射或明确的受控后台动作中。

### 共享 API 契约

`packages/api-client` 的 `LineSpaceApi` 是前后端唯一业务契约面：

- `types.ts`：请求、响应和领域模型。
- `client.ts`：进程内 `MockLineSpaceApi`。
- `http-client.ts`：与 `/v1/*` 对齐的 `HttpLineSpaceApi`。
- `auth-client.ts`：认证 API 客户端。
- `mock-data.ts`：Mock 种子数据和可变状态。

新增业务方法时，需要同时更新类型、Mock、HTTP Client、API 路由/Repository 和对应的 smoke check，避免 Mock 与真实实现漂移。

## 数据与身份模式

### Mock 模式

```text
Feature Screen
  -> lineSpaceApi
  -> MockLineSpaceApi
  -> packages/api-client/src/mock-data.ts + 进程内状态
```

只有 `EXPO_PUBLIC_USE_MOCKS=true` 才启用 Mock。此模式使用 `EXPO_PUBLIC_CURRENT_USER_ID`（默认 `user-lili`）作为开发身份，不需要 Supabase。

### HTTP 模式

```text
Feature Screen
  -> HttpLineSpaceApi / HttpAuthClient
  -> apps/api/src/routes.ts
  -> Auth Service / LineSpace API Facade
  -> Profile / Post / Thread / Draft / Inbox Repository
  -> Supabase Auth + PostgreSQL RLS/RPC/Storage
```

HTTP 模式的关键行为：

- Access Token 只驻留内存。
- Native Refresh Token 使用 Expo SecureStore；Web Refresh Token 使用 `sessionStorage`。
- 收到 401 时只触发一次 single-flight refresh，并且只重试原请求一次。
- 业务身份始终来自认证 Session/JWT；HTTP 模式不会把 `EXPO_PUBLIC_CURRENT_USER_ID` 当作权限依据。
- Feed、Thread、User Search 使用不透明 cursor 作为分页锚点；服务端对 limit 和输入长度做边界校验。
- Supabase Storage 使用 `linespace-media` 和 `linespace-drafts` bucket，并要求对象路径以当前用户 ID 开头。

## 产品域与核心 API

| 产品域 | 主要能力 | 主要入口 |
| --- | --- | --- |
| Health | 存活与配置就绪检查 | `GET /health`、`GET /health/ready` |
| Auth | 注册、登录、刷新、退出、当前用户、修改密码 | `/v1/auth/*` |
| Discovery | Feed、Thread Feed、全文搜索、标签 | `/v1/feed`、`/v1/threads`、`/v1/search`、`/v1/tags/:tag` |
| Post | 详情、评论、喜欢/收藏、删除、私聊分享 | `/v1/poems/:id/*`、`/v1/users/:id/poem-collections/*` |
| Thread | 详情、Continuation、点赞/收藏、分享、删除 | `/v1/threads/:id/*`、`/v1/continuations/:id/*` |
| Version | 版本发布为 Post、版本推荐 | `/v1/threads/:threadId/versions/:versionId/publish`、`POST /v1/ai/assist` |
| Compose | design catalog、草稿、并发操作、协作者、发布、Storage URL | `/v1/compose/*`、`/v1/drafts/*`、`/v1/storage/upload-url` |
| Profile | 资料、搜索、关注、连接、内容分区、草稿 | `/v1/users/*` |
| Inbox | 活动摘要、已读、私聊、群聊、内容分享 | `/v1/users/:id/inbox/*`、`/v1/inbox/groups/*` |
| Community Spark | 生成建议、应用建议、评论贡献署名 | `/v1/poems/:id/community-spark`、`/apply` |

用户域和内容域的权限都由服务端 JWT 推导。请求中携带的 `userId`、`viewerId` 或 `senderId` 不能单独构成授权依据。

## AI 能力边界

### Community Spark / Creative Spark

- 生成入口只允许 Post 作者调用。
- 服务端加载 Post、评论和作者身份；客户端可提交未保存的工作副本，不能伪造评论来源或作者权限。
- 每次返回三条建议，每条包含 `revise` 或 `continue` 类型、预览行、来源评论和版本指纹。
- 应用时带上 `baseRevision`，过期建议会返回冲突，避免覆盖作者最新修改。
- 应用操作在数据库中写入作者控制的修改、来源评论回复和贡献署名，保持可审计。
- API Key、模型名和 provider 错误只在服务端处理，不进入 Expo Bundle。

### Thread 版本推荐

`POST /v1/ai/assist` 为旧 Thread AI 推荐兼容入口，当前版本页先生成确定性版本（推荐、最高赞、最长、自定义），再尝试 AI 解释/选择。没有 `OPENAI_API_KEY` 或 provider 不可用时，页面仍可使用确定性版本。

服务端配置：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_COMMUNITY_SPARK_MODEL=deepseek-v4-flash
OPENAI_API_KEY=
OPENAI_MODEL=
```

## 数据库迁移与持久化

`supabase/migrations/` 是 Supabase CLI 唯一可部署的迁移目录；`docs/archive/database/deferred-migrations/` 仅保存历史设计，不得复制回正式迁移链。

当前迁移必须按以下顺序执行：

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
supabase/migrations/20260720000600_engagement_profile_inbox_post_management.sql
supabase/migrations/20260721000100_relay_draft_semantics.sql
supabase/migrations/20260721000200_thread_version_participant_posts.sql
supabase/migrations/20260722000100_thread_continuation_stable_lines.sql
supabase/migrations/20260722000200_post_version_layout.sql
supabase/migrations/20260723000100_community_spark.sql
supabase/migrations/20260723000200_guest_public_content_access.sql
```

迁移链现在覆盖：

- Auth identity、Profile、关注关系、连接列表、徽章和经验值。
- Post、评论、喜欢/收藏、Feed、Thread、Continuation、Version 和 Draft 持久化。
- 私聊/群聊、邀请、Post/Thread/Continuation 内容分享和 Inbox 活动通知。
- Discovery 搜索与标签索引、keyset 查询和公开内容访问。
- Thread 行号稳定性、Version-to-Post 幂等发布、Post 布局/署名保存。
- Community Spark 应用记录、评论来源和贡献署名。
- Supabase Storage bucket、对象路径隔离、JWT-derived RPC 和 RLS 权限。

经验事件使用 append-only `event_key` 幂等记录，Level 限定为 1–10；群组创建、邀请响应、群消息发送、草稿创建和内容发布等敏感写入由数据库事务函数推导当前身份，客户端不能拼装越权状态。

## 环境变量

复制 `.env.example` 为 `.env`。任何 `EXPO_PUBLIC_*` 变量都会进入客户端 Bundle，只能放公开配置。

### 客户端

| 变量 | 说明 |
| --- | --- |
| `EXPO_PUBLIC_USE_MOCKS` | 精确为 `true` 才启用 Mock；HTTP/生产应设为 `false` |
| `EXPO_PUBLIC_API_BASE_URL` | HTTP API 地址；HTTP 模式必需，例如 `http://localhost:4000` 或 `/api` |
| `EXPO_PUBLIC_CURRENT_USER_ID` | 仅 Mock 模式使用，默认 `user-lili` |

### 服务端

| 变量 | 说明 |
| --- | --- |
| `PORT` | 本地 Node API 端口，默认 `4000` |
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_PUBLISHABLE_KEY` | 服务端调用公开 Supabase API 的首选 key |
| `SUPABASE_ANON_KEY` | `SUPABASE_PUBLISHABLE_KEY` 不存在时的兼容回退 |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅服务端使用，用于认证身份映射和受控动作 |
| `AUTH_EMAIL_REDIRECT_URL` | 邮箱确认完成后的 Web 或 Native 回跳地址 |
| `DEEPSEEK_API_KEY` | Community Spark 服务端密钥 |
| `DEEPSEEK_BASE_URL` | DeepSeek API 根地址，默认 `https://api.deepseek.com` |
| `DEEPSEEK_COMMUNITY_SPARK_MODEL` | Community Spark 模型，默认 `deepseek-v4-flash` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Thread AI 推荐兼容入口 |

`.env.example` 中的 `DATABASE_URL` 是保留的未来配置；当前运行时通过带 JWT 的 Supabase Client 访问 PostgreSQL，不将连接串直接暴露给移动端。

## 部署

当前 `vercel.json` 从仓库根目录完成两件事：

```text
pnpm build:web
  -> apps/mobile/dist
  -> Expo Web 静态站点

/api/:path*
  -> api/[...path].ts
  -> apps/api/src/routes.ts
```

Vercel 配置：

```json
{
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build:web",
  "outputDirectory": "apps/mobile/dist"
}
```

Dashboard 的 Root Directory 必须保持仓库根目录，不能改为 `apps/mobile`；否则 pnpm workspace、根锁文件和 `api/` Function 入口无法按当前配置解析。

静态 Web 生产配置示例：

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=/api
```

服务端变量只配置在 Vercel Server 环境：

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
AUTH_EMAIL_REDIRECT_URL=https://<web-domain>/auth/confirm
DEEPSEEK_API_KEY=<server-only-secret>
DEEPSEEK_COMMUNITY_SPARK_MODEL=deepseek-v4-flash
```

部署后先检查：

```text
GET /api/health
GET /api/health/ready
```

`/api/health/ready` 会返回 Auth、Community Spark、模型和 provider 的公开状态，不会返回任何密钥。生产迁移应先连接 Staging 项目并审查 dry-run：

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <staging-project-ref>
pnpm db:push:dry-run
pnpm db:push
```

不要对 Production 执行 `supabase db reset --linked`。若云端曾经手工执行过 SQL，先用 `supabase db pull` 或经过审查的 `supabase migration repair` 对齐迁移历史。

## 检查命令

```bash
pnpm typecheck            # 全 Workspace TypeScript 检查
pnpm check:api            # Auth、API、Mock、Community Spark、Migration、Vercel 检查
pnpm build:web            # Expo Web 生产导出
pnpm check                # typecheck + check:api + build:web
pnpm lint                 # 当前兼容为 pnpm typecheck，仓库暂无独立 ESLint
```

本地数据库检查：

```bash
pnpm db:start
pnpm db:reset             # 仅本地 Supabase
pnpm db:lint
pnpm db:security-check    # 多用户 RLS、群分享、Storage 和内容写入边界
```

CI 在 Node 22 / pnpm 11.7.0 上执行 `pnpm install --frozen-lockfile` 和 `pnpm check`，并显式使用 Mock 以保证检查不依赖生产凭据。

## 开发约束

- 不在客户端调用 Supabase Service Role API，也不把 Service Role、数据库连接串或 AI Key 放进 `EXPO_PUBLIC_*`。
- 不通过前端传入的 actor ID、viewer ID 或 sender ID 建立权限；权限必须由 JWT、RLS 和事务 RPC 推导。
- 不在日志、URL、错误信息或业务表中保存密码、Access Token 或 Refresh Token。
- 不让 `packages/ui`、`packages/tokens` 或移动端直接依赖数据库、Supabase 或服务端环境变量。
- 新增产品域时先定义共享 API 类型，再同步实现 Mock、HTTP、路由、Repository、Migration、RLS 和契约检查。
- 数据库迁移只能追加到 `supabase/migrations/`，必须保持顺序、幂等、可检查，不能通过关闭 RLS 绕过历史数据问题。
- 修改 UI 时优先复用 `packages/tokens` 和 `packages/ui`；不要为单个 Feature 引入第二套大型状态管理框架。

## 相关文档

- [架构与代码边界](docs/architecture.md)
- [环境变量与数据库准备](docs/environment.md)
- [部署说明](docs/deployment.md)
- [Thread Feed 设计参考](docs/reference/thread/01-thread-feed.jpg)
