# LineSpace 运行环境与服务依赖

本项目是 TypeScript/pnpm Monorepo，不使用 Python 依赖管理，也不需要 `requirements.txt`。JavaScript 依赖以根 `package.json`、各 Workspace 的 `package.json` 和 `pnpm-lock.yaml` 为准。

## 当前必需工具

| 工具 | 要求 | 依据与用途 |
| --- | --- | --- |
| Node.js | `>=20.0.0` | 根 `package.json#engines`；CI 使用 Node 22 |
| pnpm | `11.7.0` | 根 `package.json#packageManager` 与 CI 固定版本 |
| Git | 当前必需 | 版本控制和协作 |
| Expo CLI | 由项目依赖提供 | 通过 `pnpm dev`、`pnpm dev:web`、`pnpm build:web` 调用，不要求全局安装 |
| TypeScript | 声明 `^5.7.2`，锁文件解析为 `5.9.3` | 全仓静态检查 |

锁文件当前解析的关键前端版本包括 Expo `52.0.49`、Expo Router `4.0.22`、React Native `0.76.5`、React `18.3.1` 和 Turbo `2.10.4`。不要绕过锁文件随意升级；依赖变更应单独评估并重新验证三端构建。

## 按平台需要的本地工具

| 工具 | 何时需要 | 说明 |
| --- | --- | --- |
| Android Studio、Android SDK、设备/模拟器 | Android 本地开发或原生构建 | 建议使用 Expo SDK 52 兼容的 JDK/SDK 组合 |
| Xcode、iOS Simulator | iOS 本地开发或原生构建 | 只在 macOS 可用 |
| 浏览器 | mobile web 开发与静态导出检查 | 使用 `pnpm dev:web` 或导出后的静态目录 |
| Figma 访问与 Figma MCP | 设计还原任务 | 开发运行本身不依赖 Figma |

## 当前运行模式

| 服务 | 当前是否必需 | 用途 |
| --- | --- | --- |
| `packages/api-client` Mock 实现 | 默认必需 | 无后端时提供 Feed、草稿、个人页等进程内数据 |
| 本地 `apps/api` | 可选 | 验证 HTTP 模式和服务端边界，默认 `http://localhost:4000` |
| Vercel | 可选 | 发布 `apps/mobile/dist` 静态前端；当前不托管 `apps/api` |

## 未来可选服务

| 服务 | 当前状态 | 未来用途 |
| --- | --- | --- |
| PostgreSQL | Schema 草案已存在，未接入运行时 | 用户、诗歌、草稿、互动与操作日志持久化 |
| Supabase | 未接入 | 托管 Postgres、认证、对象存储、Realtime |
| OpenAI API | 仅保留 `501` 路由边界 | 写作辅助、标题/标签建议、审核预检 |
| Redis / Valkey | 未接入 | 分布式限流、队列与后台任务（只有需求出现时再引入） |

未来服务的密钥、管理凭据和数据库连接只能由 `apps/api` 读取。`OPENAI_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 和 `DATABASE_URL` 不得进入 Expo 客户端或 Git。

## 安装

```bash
corepack enable
pnpm --version
pnpm install --frozen-lockfile
```

预期 pnpm 版本为 `11.7.0`。`pnpm-workspace.yaml` 只允许 `esbuild` 执行依赖构建脚本，这是 `tsx` 等工具正常运行所需的最小范围。

## 本地运行与验证

```bash
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm typecheck
pnpm check:api
pnpm build:web
pnpm check
```

环境变量先从 `.env.example` 复制到本地 `.env`；变量分级和 Mock/HTTP 切换见 `docs/environment.md`。

## 许可证

当前仓库没有许可证文件。这不是运行阻塞项，但在公开发布、接受外部贡献或分发代码前，项目所有者必须明确选择许可证；工程整理不会替项目擅自决定。
