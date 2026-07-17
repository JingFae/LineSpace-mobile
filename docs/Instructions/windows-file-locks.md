# Windows 文件锁排查

Expo 静态导出写入 `apps/mobile/dist`。该目录是生成物，已被 Git 忽略。

## 正常处理

先停止当前仓库正在运行的 Expo/Metro：

```text
Ctrl + C
```

确认终端位于仓库根目录，再检查是否仍有当前项目进程。只停止命令行明确包含当前仓库路径或 Expo 项目标识的进程，不要无差别结束所有 Node 进程。

确认没有开发服务器使用 `dist` 后，可以删除该生成目录并重新导出：

```powershell
$target = (Resolve-Path .\apps\mobile\dist).Path
Remove-Item -LiteralPath $target -Recurse -Force
pnpm build:web
```

执行递归删除前应核对 `$target` 确实位于当前仓库的 `apps/mobile/dist`。如果目录不存在，直接运行 `pnpm build:web`。

## 常见占用来源

- 仍在运行的 `pnpm dev:web`、Expo 或 Metro。
- 浏览器、静态文件服务器或编辑器正在监视导出目录。
- 杀毒软件正在扫描新生成的大型 Bundle。
- 先前以不同权限级别创建的文件。

## 不应采用的做法

- 不要运行 `git clean` 或 `git reset --hard`。
- 不要删除 `pnpm-lock.yaml` 来处理文件锁。
- 不要把 `dist` 加入 Git。
- 不要无差别结束机器上的全部 Node 进程。
- 不要为了规避锁而把生成物改到源码目录。

如果只有自动化沙箱报 `spawn EPERM`，而普通本地终端能够导出，这通常是子进程权限限制，不是 `dist` 文件损坏。
