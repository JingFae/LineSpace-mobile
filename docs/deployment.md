# 部署说明

## 当前部署边界

当前 `vercel.json` 只构建并发布 Expo Web 静态前端：

```text
source: apps/mobile + workspace packages
command: pnpm build:web
output: apps/mobile/dist
host: Vercel static hosting
```

`apps/api` 没有被配置为 Vercel Function，也没有包含在静态产物中。`pnpm dev:api` 启动的是本地 Node HTTP 服务。需要 HTTP 生产模式时，必须先为 API 选择独立运行环境、域名、HTTPS、持久数据库和密钥管理方案。

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
EXPO_PUBLIC_API_BASE_URL=https://api.example.com
```

`EXPO_PUBLIC_*` 会进入客户端 Bundle，不能保存密钥。`OPENAI_API_KEY`、`DATABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 等服务端变量不得设置为 Expo 公共变量，也不会被当前静态部署使用。

## API 上线前检查

独立部署 `apps/api` 前至少需要：

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
