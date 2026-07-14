# 环境变量

本地开发先复制 `.env.example` 为 `.env`。`.env` 和 `.env.*` 已被 Git 忽略，只有不含真实密钥的 `.env.example` 可以提交。

## 当前变量

| 变量 | 当前是否必需 | 读取位置 | 说明 |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_USE_MOCKS` | 可选，默认视为 `true` | `apps/mobile` | 只有精确为 `false` 才尝试 HTTP 模式 |
| `EXPO_PUBLIC_API_BASE_URL` | HTTP 模式必需 | `apps/mobile` | API Base URL，例如 `http://localhost:4000` |
| `EXPO_PUBLIC_CURRENT_USER_ID` | 可选 | `apps/mobile` | 认证接入前的开发用户，默认 `user-lili` |
| `PORT` | 可选 | `apps/api` | 本地 API 端口，默认 `4000` |
| `DATABASE_URL` | 未来可选 | 只能由 `apps/api` 读取 | PostgreSQL 连接串；当前运行时未使用 |
| `SUPABASE_URL` | 未来可选 | App 可使用公开 URL，管理操作在 API | Supabase 项目 URL；当前未使用 |
| `SUPABASE_ANON_KEY` | 未来可选 | 可由 App 使用，但必须配合 RLS | Supabase 公共匿名 Key；当前未使用 |
| `SUPABASE_SERVICE_ROLE_KEY` | 未来可选 | 只能由 `apps/api` 读取 | 高权限管理 Key；当前未使用 |
| `OPENAI_API_KEY` | 未来可选 | 只能由 `apps/api` 读取 | AI 写作与审核；当前路由固定返回 501 |

所有 `EXPO_PUBLIC_*` 变量都会进入客户端产物，只能放公开配置。不要给密钥添加这个前缀。

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
EXPO_PUBLIC_CURRENT_USER_ID=user-lili
PORT=4000
```

分别启动：

```bash
pnpm dev:api
pnpm dev:web
```

或将第二条替换为 `pnpm dev`。如果关闭 Mock 却遗漏 `EXPO_PUBLIC_API_BASE_URL`，选择器会回退到 Mock，避免构造无效 HTTP 客户端。

## Expo 环境读取说明

Expo 会在打包时内联 `EXPO_PUBLIC_*` 变量。修改后应重新启动开发服务器或重新执行 `pnpm build:web`。服务端的普通变量由 Node 进程读取，不会因静态前端部署自动生效。

## 生产建议

- 在托管平台的密钥管理中保存服务端密钥，不提交 `.env`。
- 前端 API 地址必须使用 HTTPS。
- Supabase Service Role 和 OpenAI Key 只能出现在独立后端运行环境。
- 当前 Vercel 项目只构建静态前端，配置服务端变量不会使 `apps/api` 自动上线。
