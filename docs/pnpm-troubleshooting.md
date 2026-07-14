# pnpm 故障排查

项目固定使用 pnpm `11.7.0`，Node.js 要求 `>=20.0.0`，CI 使用 Node 22。

## 1. 确认版本

```powershell
node --version
pnpm --version
corepack --version
```

版本不一致时优先通过 Corepack 启用 `package.json#packageManager` 指定的版本，不要把仓库永久切换到 npm 或 yarn。

## 2. 锁定安装

```powershell
pnpm install --frozen-lockfile
```

这应当是本地复现和 CI 的默认安装方式。除非正在有意更新依赖，否则不要删除或重写 `pnpm-lock.yaml`。

## 3. 依赖构建脚本

`pnpm-workspace.yaml` 使用最小 allowlist，只允许 `esbuild` 执行构建脚本。`tsx` 的运行需要该二进制。如果出现 ignored builds 提示，先确认配置仍是：

```yaml
allowBuilds:
  esbuild: true
```

然后运行：

```powershell
pnpm install --frozen-lockfile
pnpm rebuild esbuild
```

不要开启允许所有依赖脚本的宽泛配置。

## 4. `spawn EPERM`

Windows、受限沙箱或安全软件可能阻止 pnpm、Metro、tsx/esbuild 创建子进程。先关闭遗留的 Expo/Node 进程并在普通本地终端重试。若只在受限执行环境失败，而同一命令在正常终端通过，应把它记录为环境限制，不要为此重写产品代码。

全仓 TypeScript 命令已经使用串行 Workspace 执行，以减少 Windows 进程并发导致的 `EPERM`：

```powershell
pnpm typecheck
```

## 5. 文件锁

如果 pnpm 报告临时文件或 `apps/mobile/dist` 被占用：

1. 停止当前仓库的 Expo、Metro 和 Node 服务。
2. 关闭正在预览导出文件的工具。
3. 在新终端重试命令。
4. 仍失败时参考 `docs/windows-file-locks.md`，只处理确认属于当前仓库的进程和生成目录。

## 6. Registry / 网络

```powershell
pnpm config get registry
```

默认 Registry 应为 `https://registry.npmjs.org/`。公司代理、证书和镜像应按组织策略配置到用户环境，不提交到项目文件。

## 7. 最小诊断顺序

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm check:api
pnpm build:web
```

记录第一个失败命令及完整错误。不要在未确认原因时删除 `node_modules`、锁文件或源码。
