# LineSpace

LineSpace 是一个面向 iOS、Android 与移动网页的诗歌创作社交产品。仓库采用 TypeScript Monorepo：Expo Router 应用负责三端界面，Node.js 服务保留服务端边界，共享包分别承载 UI、设计变量以及 Mock/HTTP 一致的 API 契约。

## 当前状态

已经实现：

- 首页诗歌 Feed、分区与筛选、喜欢和收藏。
- 普通创作、图片选择、协作者邀请、协作草稿、版式预览与发布流程。
- 诗歌详情、评论/贡献展示、署名信息和互动状态。
- 个人页、内容分区、关注列表、资料与头像编辑。
- Mock 数据实现、HTTP 客户端，以及与 HTTP 客户端对应的本地 Node API 路由。
- Expo Web 静态导出和 Vercel 单页应用刷新回退。

仍为占位或未来能力：

- “Discover/Read”和“Comments/Notes”标签页目前显示占位页。
- 身份认证、持久化数据库、对象存储、实时协作传输、审核和限流尚未接入。
- AI 路由边界已保留，但当前固定返回 `501 LLM_NOT_CONFIGURED`，不会在客户端调用密钥。
- `apps/api` 是本地服务脚手架；当前 Vercel 配置只部署 Expo 静态前端。

## 技术栈

| 层 | 技术 |
| --- | --- |
| App / mobile web | Expo 52、Expo Router 4、React Native 0.76、React 18 |
| 状态与请求 | TanStack Query、Zustand（已安装，当前核心数据流以 Query 为主） |
| API | Node.js HTTP、tsx、共享 `LineSpaceApi` 契约 |
| Monorepo | pnpm Workspace 11.7、Turbo 2、TypeScript 5 |
| 部署 | Expo 静态导出、Vercel |

## 目录职责

```text
LineSpace-mobile/
├─ apps/
│  ├─ mobile/
│  │  ├─ app/                  # Expo Router 轻量路由入口
│  │  ├─ src/features/         # feed、compose、poem、profile 页面与状态
│  │  ├─ src/navigation/       # 导航模型
│  │  ├─ src/services/         # Mock/HTTP API 选择
│  │  └─ assets/               # App 专用位图素材
│  └─ api/
│     └─ src/
│        ├─ routes.ts          # 当前本地 HTTP 路由入口
│        ├─ server.ts          # Node HTTP 适配层
│        ├─ smoke-check.ts     # Mock/HTTP/API 契约冒烟检查
│        └─ database/          # PostgreSQL Schema 草案
├─ packages/
│  ├─ api-client/              # 共享类型、接口、Mock 与 HTTP 实现
│  ├─ ui/                      # 无网络请求的 React Native UI
│  └─ tokens/                  # 颜色、字体、间距、圆角等设计变量
├─ docs/                       # 架构、部署、环境与设计协作文档
├─ .github/workflows/ci.yml    # 锁定安装、检查与 Web 导出
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ vercel.json
```

`apps/mobile` 是核心前端，不是与仓库名重复的废弃目录。`apps/mobile/app` 负责文件路由，`apps/mobile/src/features` 负责实际页面实现，两者职责不同。

## 工程 Pipeline

1. Figma 设计、截图和导出素材先进入设计交接流程；App 专用位图放到 `apps/mobile/assets`，可复用图标留在 `packages/ui`。
2. 重复的视觉值进入 `packages/tokens`，无业务数据和网络请求的复用组件进入 `packages/ui`。
3. Feature Screen 在 `apps/mobile/src/features` 组合 UI 与业务状态，`apps/mobile/app` 只读取路由参数并渲染 Screen。
4. `apps/mobile/src/services/lineSpaceApi.ts` 根据 `EXPO_PUBLIC_USE_MOCKS` 和 API 地址选择 Mock 或 HTTP 实现。
5. `packages/api-client` 的 `LineSpaceApi`、共享类型、Mock 实现和 HTTP 实现共同定义前后端契约。
6. `apps/api` 将 HTTP 路由适配到同一契约；数据库、认证、OpenAI、审核、限流和对象存储只能在服务端接入。
7. `pnpm build:web` 将 Expo Web 导出到 `apps/mobile/dist`，Vercel 只发布该静态目录并将客户端路由刷新回退到 `index.html`。

更完整的路由、端点和依赖映射见 [docs/architecture.md](docs/architecture.md)。

## 安装与命令

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev          # Expo App 开发服务器
pnpm dev:web      # mobile web 开发服务器
pnpm dev:api      # 本地 Node API，默认端口 4000
pnpm typecheck    # 全仓 TypeScript 检查
pnpm check:api    # Mock/HTTP/API 契约冒烟检查
pnpm build:web    # Expo Web 生产导出
pnpm build        # 通过 Turbo 执行有效的 mobile Web 构建
pnpm check        # CI 统一检查：typecheck + API 契约 + Web 导出
```

Android 与 iOS：

```bash
pnpm --filter @linespace/mobile android
pnpm --filter @linespace/mobile ios
```

iOS 本地运行需要 macOS 与 Xcode；Android 本地运行需要 Android Studio、SDK 和可用设备或模拟器。

## 环境变量与数据模式

复制 `.env.example` 为本地 `.env`，不要提交真实值。变量说明见 [docs/environment.md](docs/environment.md)。

Mock 是默认模式：

```env
EXPO_PUBLIC_USE_MOCKS=true
EXPO_PUBLIC_CURRENT_USER_ID=user-lili
```

连接本地 API：

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
EXPO_PUBLIC_CURRENT_USER_ID=user-lili
```

然后分别运行 `pnpm dev:api` 和 `pnpm dev`/`pnpm dev:web`。如果 `EXPO_PUBLIC_USE_MOCKS` 不是 `false`，或未提供 API 地址，前端会安全回退到 Mock 实现。

## Vercel 前端部署

从仓库根目录导入项目，使用现有 `vercel.json`。其构建命令是 `pnpm build:web`，输出目录是 `apps/mobile/dist`。当前配置没有部署 `apps/api`，因此 HTTP 模式上线前必须另行部署后端并配置 `EXPO_PUBLIC_API_BASE_URL`。详见 [docs/deployment.md](docs/deployment.md)。

## Figma 与素材流程

每个设计任务应提供精确的 Figma Frame URL，并通过 Figma MCP 获取设计上下文、截图、变量和所需素材。实现顺序是 tokens → 可复用 UI → Feature Screen → 轻量路由 → 三端检查。不要把整页截图当作 UI，也不要把 Mock 内容写入通用组件。

- App 独占的 PNG/JPG/WebP：`apps/mobile/assets/<domain>/`。
- 多页面复用的 React Native 图标/组件：`packages/ui/src/`。
- 重复视觉值：`packages/tokens/src/`。
- 原始设计资产用途不明确时保留并记录，不猜测删除。

详见 [docs/figma-handoff.md](docs/figma-handoff.md) 和 [docs/figma-mcp-setup.md](docs/figma-mcp-setup.md)。

## 后端扩展边界

- PostgreSQL / Supabase：从 `apps/api/src/database` 的 Schema 草案演进，补充正式迁移工具后再用于生产。
- 认证与授权：在 `apps/api` 校验会话和资源权限，再向前端返回公开数据。
- 对象存储：头像与诗歌媒体只在数据库保存持久 URL，不保存本地设备 URI。
- OpenAI：只在 `apps/api` 读取 `OPENAI_API_KEY`，并在启用前接入审核、限流、超时、重试和用量记录。
- 实时协作：以草稿版本号和操作日志为一致性边界，通过 WebSocket 或 Supabase Realtime 传输。

## 当前限制

- 数据仍是进程内 Mock；API 重启后草稿、互动和资料修改会重置。
- HTTP API 暂无生产级鉴权、持久化、速率限制或正式部署配置。
- 没有独立 ESLint 配置；`pnpm lint` 当前作为兼容命令执行 TypeScript 检查。
- 仓库目前没有开源许可证；公开发布前需要由项目所有者选择合适许可证。
