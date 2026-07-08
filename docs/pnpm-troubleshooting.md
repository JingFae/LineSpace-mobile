# pnpm troubleshooting

This project uses `pnpm@11.7.0`. Most pnpm failures on Windows fall into four categories: version switching, locked temp files, network/registry access, or a corrupted store.

## 1. Confirm versions

```powershell
node -v
pnpm -v
corepack --version
```

Expected:

- Node.js: `20+`, recommended `22 LTS` or newer.
- pnpm: `11.x`, recommended `11.7.0`.

If pnpm is missing or the version is inconsistent:

```powershell
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm -v
```

## 2. Fix pnpm version auto-download issues

This repository includes `.npmrc` settings:

```ini
manage-package-manager-versions=false
package-manager-strict=false
```

These prevent pnpm from stopping or downloading another pnpm version just because `package.json` pins a version.

If your global config overrides this, run:

```powershell
pnpm config set manage-package-manager-versions false --global
pnpm config set package-manager-strict false --global
```

## 3. Fix `EPERM: operation not permitted, unlink ... _tmp_*`

This usually means a pnpm temp file is locked by the terminal, editor, antivirus, or a previous failed pnpm process.

Steps:

1. Close running dev servers and terminals inside this repo.
2. Close editors that may be indexing the folder.
3. Open a fresh PowerShell terminal.
4. Remove stale root temp files:

```powershell
Remove-Item -LiteralPath .\_tmp_* -Force
```

If PowerShell refuses because a file is still locked, restart the terminal or reboot Windows, then run the command again.

Optional: move pnpm's store out of volatile temp paths:

```powershell
pnpm config set store-dir "$env:LOCALAPPDATA\pnpm-store" --global
pnpm store prune
```

Then reinstall:

```powershell
pnpm install
```

## 4. Fix registry/network errors

Check registry:

```powershell
pnpm config get registry
```

Use the default npm registry:

```powershell
pnpm config set registry https://registry.npmjs.org/
```

If you are behind a proxy, configure npm/pnpm proxy settings through your company network instructions:

```powershell
pnpm config set proxy http://host:port
pnpm config set https-proxy http://host:port
```

## 5. Clean install

Use this only after saving your work.

```powershell
Remove-Item -LiteralPath .\node_modules -Recurse -Force
Remove-Item -LiteralPath .\pnpm-lock.yaml -Force
Remove-Item -LiteralPath .\_tmp_* -Force
pnpm store prune
pnpm install
pnpm typecheck
```

If `pnpm-lock.yaml` already exists and should be preserved, do not delete it. Run `pnpm install --frozen-lockfile` instead.

## 6. Fix `ERR_PNPM_IGNORED_BUILDS`

If pnpm reports:

```text
ERR_PNPM_IGNORED_BUILDS Ignored build scripts: esbuild
Run "pnpm approve-builds"
```

This means pnpm blocked a dependency postinstall script. `esbuild` needs that script to install its platform binary.

This repository allows `esbuild` in `pnpm-workspace.yaml`:

```yaml
onlyBuiltDependencies:
  - esbuild
```

Then run:

```powershell
pnpm install
pnpm rebuild esbuild
pnpm dev:web
```

If pnpm still asks for approval, run:

```powershell
pnpm approve-builds
```

Select `esbuild` with `Space`, then press `Enter`.

## 7. Temporary fallback

If pnpm remains blocked, do not switch the repo permanently to npm. Use npm only to inspect whether Node itself is functional:

```powershell
npm -v
node -v
```

The project workspace layout expects pnpm.
