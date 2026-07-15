# 部署说明

## 当前部署边界

当前 `vercel.json` 构建并发布 Expo Web 静态前端，仓库根目录同时提供 API Function：

```text
source: apps/mobile + workspace packages
command: pnpm build:web
output: apps/mobile/dist
host: Vercel static hosting + `/api/*` Node Function
```

`pnpm dev:api` 仍然启动本地 Node HTTP 服务；Vercel 部署时 `/api/v1/auth/*` 由仓库根目录的 `api/[...path].ts` Function 转发到认证路由。当前业务数据实现仍是 Mock，只有认证身份由 Supabase Auth 和 PostgreSQL 映射提供。

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

## CI

`.github/workflows/ci.yml` 在 Node 22 / pnpm 11.7.0 上执行：

1. `pnpm install --frozen-lockfile`
2. `pnpm check`

`pnpm check` 包含全仓 TypeScript、API 契约冒烟检查和 Expo Web 生产导出。
