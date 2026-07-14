# LineSpace 架构与 Pipeline

## 1. 设计与素材进入路径

Figma Frame、设计上下文、截图、变量和导出素材先经过设计交接。重复视觉值进入 `packages/tokens`；可复用组件和代码化图标进入 `packages/ui`；只属于 App 的位图进入 `apps/mobile/assets/<domain>`。素材用途无法确认时保留，不以“未被当前页面引用”为唯一删除依据。

## 2. UI Token 与组件层

```text
packages/tokens ──> packages/ui ──> apps/mobile
```

- `packages/tokens`：颜色、排版、间距、圆角等平台无关常量。
- `packages/ui`：React Native 复用组件和图标，只依赖 tokens、React Native 与绘图能力。
- `packages/ui` 不读取环境变量，不访问 `lineSpaceApi`，也不发起网络请求。
- 页面示例内容不进入通用 UI；它属于 `packages/api-client/src/mock-data.ts`。

## 3. Expo Router 与 Feature 页面层

`apps/mobile/app` 是 Expo Router 文件路由入口；`apps/mobile/src/features` 是页面实现。路由文件只读取参数并渲染 Screen，根布局只提供 Query Client 和 Stack。

| Expo 路由 | 路由文件 | Screen / 作用 |
| --- | --- | --- |
| `/` / `/(tabs)` | `app/(tabs)/index.tsx` | `LineSpaceHomeScreen` |
| `/(tabs)/discover` | `app/(tabs)/discover.tsx` | `PlaceholderScreen`（待实现） |
| `/(tabs)/compose` | `app/(tabs)/compose.tsx` | 读取 `session`，渲染 `ComposeScreen` |
| `/(tabs)/comments` | `app/(tabs)/comments.tsx` | `PlaceholderScreen`（待实现） |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | `ProfileScreen` |
| `/compose-preview` | `app/compose-preview.tsx` | 透传预览参数到 `ComposePreviewScreen` |
| `/compose/collaborate/[id]` | `app/compose/collaborate/[id].tsx` | 读取草稿 `id`，渲染 `CollaborativeComposeScreen` |
| `/poem/[id]` | `app/poem/[id].tsx` | 读取诗歌 `id`，渲染 `PoemDetailScreen` |
| `/profile/edit` | `app/profile/edit.tsx` | `ProfileEditScreen` |

`app/_layout.tsx` 提供 `QueryClientProvider` 和根 Stack；`app/(tabs)/_layout.tsx` 提供隐藏原生 Tab Bar 的 Expo Tabs，实际底部导航由共享 UI 组件渲染。

## 4. `lineSpaceApi` 的 Mock / HTTP 选择

唯一选择点是 `apps/mobile/src/services/lineSpaceApi.ts`：

```text
EXPO_PUBLIC_USE_MOCKS !== "false" ──> createMockLineSpaceApi()
EXPO_PUBLIC_USE_MOCKS === "false"
  + EXPO_PUBLIC_API_BASE_URL 存在 ──> HttpLineSpaceApi
  + API 地址缺失                 ──> createMockLineSpaceApi()
```

Screen 只依赖 `LineSpaceApi`，不直接调用 `fetch`。`EXPO_PUBLIC_CURRENT_USER_ID` 在认证接入前提供开发用户，默认是 `user-lili`。

Mock 流：

```text
Feature Screen
  -> lineSpaceApi
  -> MockLineSpaceApi
  -> packages/api-client/src/mock-data.ts + 进程内可变状态
```

HTTP 流：

```text
Feature Screen
  -> lineSpaceApi
  -> HttpLineSpaceApi
  -> apps/api/src/server.ts
  -> apps/api/src/routes.ts
  -> 当前仍为服务端进程内 MockLineSpaceApi
```

因此 HTTP 模式验证了网络与端点边界，但当前仍不提供数据库持久化。

## 5. `packages/api-client` 接口契约

- `types.ts`：请求、响应和领域类型。
- `client.ts`：公开 `LineSpaceApi` 接口、Mock 实现及进程内状态。
- `mock-data.ts`：开发示例数据和设计目录。
- `http-client.ts`：保持相同方法签名的 HTTP 实现。
- `index.ts`：唯一公共导出面。

HTTP 客户端与本地 API 的端点对应：

| `LineSpaceApi` 方法 | HTTP | `apps/api` 路由 |
| --- | --- | --- |
| `getPoemDesignCatalog` | GET | `/v1/compose/design-catalog` |
| `createPoemDraft` | POST | `/v1/drafts` |
| `getPoemDraft` | GET | `/v1/drafts/:draftId` |
| `updatePoemDraft` | PUT | `/v1/drafts/:draftId` |
| `applyDraftOperation` | POST | `/v1/drafts/:draftId/operations` |
| `listDraftInviteCandidates` | GET | `/v1/users/:userId/invite-candidates` |
| `inviteDraftCollaborator` | POST | `/v1/drafts/:draftId/invitations` |
| `publishPoemDraft` | POST | `/v1/drafts/:draftId/publish` |
| `listFeed` | GET | `/v1/feed?section&filter&viewerId` |
| `getPoem` | GET | `/v1/poems/:poemId?viewerId` |
| `setPoemCollection` | PUT | `/v1/users/:userId/poem-collections/:kind/:poemId` |
| `getUserPoemCollections` | GET | `/v1/users/:userId/poem-collections` |
| `getUserProfile` | GET | `/v1/users/:userId/profile` |
| `updateUserProfile` | PUT | `/v1/users/:userId/profile` |
| `listUserProfileContent` | GET | `/v1/users/:userId/profile-content/:section` |
| `listUserConnections` | GET | `/v1/users/:userId/:followers-or-following` |
| `requestAiAssist` | POST | `/v1/ai/assist`（当前返回 501） |

`apps/api/src/smoke-check.ts` 使用内存 Fetch 适配器让真实 `HttpLineSpaceApi` 逐项访问 `handleApiRequest`，避免仅凭字符串扫描判断契约一致性。

## 6. `apps/api` 与未来服务边界

当前结构：

- `server.ts`：Node HTTP、JSON Body 与 CORS 适配。
- `routes.ts`：HTTP 方法、路径、输入校验与 `LineSpaceApi` 调用。
- `database/*.sql`：PostgreSQL 领域 Schema 草案，不会在启动时自动执行。
- `smoke-check.ts`：开发和 CI 契约检查，不进入产品运行时。

未来数据库 Repository、认证、对象存储、AI、审核、限流和实时协作应作为 `apps/api/src/services` 或等价服务层加入，再由路由调用。不要把服务端 SDK 或密钥移动到 `packages/api-client`、`packages/ui` 或 `apps/mobile`。

数据库草案若转为正式迁移，应先创建 profile/users 相关表，再创建引用 `users(id)` 的 compose 表，并通过迁移工具记录顺序；目前 SQL 文件只是设计草案。

## 7. Expo Web 导出与 Vercel

```text
pnpm build:web
  -> @linespace/mobile export:web
  -> expo export --platform web
  -> apps/mobile/dist
  -> Vercel 静态发布
  -> 未命中静态文件的路径重写到 /index.html
```

`apps/mobile/app.json` 使用 Metro 和 `web.output = "single"`；`metro.config.cjs` 监视 Workspace 根目录并解析根与 App 的 `node_modules`。`vercel.json` 不包含 Node Function 或 `apps/api` 构建，因此不能把本地 API 描述为 Vercel 后端。

## 依赖方向保护

```text
apps/mobile ──> packages/ui ──> packages/tokens
apps/mobile ──> packages/api-client
apps/api    ──> packages/api-client
```

禁止反向依赖：tokens 不依赖 UI；UI 不依赖 API；api-client 不依赖 App；后端不导入移动端 Screen。

## 审计后的文件分类

- 必须保留：`apps/mobile`、所有路由和 Feature、共享包、数据库草案、当前图片、根构建与部署配置。
- 可以整理：文档口径、根脚本、CI、忽略规则；本次未进行无收益的源码搬家。
- 可以确认删除：`work/mobile-web.*.log` 三份临时启动日志，以及空的 `outputs/mobile-web-check`。
- 待确认并保留：`packages/ui/src/icon/*.svg`。当前运行时使用 `index.tsx` 的代码化图标，独立 SVG 未被 import，但它们可能是 Figma 原始交付资产，缺少产品确认时不删除。
