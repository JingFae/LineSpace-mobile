# Windows file lock troubleshooting

Expo static export writes to:

```txt
apps/mobile/dist
```

If export fails with:

```txt
EPERM: operation not permitted, unlink '...\apps\mobile\dist\index.html'
```

Windows is locking the previous build output.

## Normal fix

Stop Expo first:

```powershell
Ctrl + C
```

Then remove the old export:

```powershell
cd B:\LineSpace\LineSpace-mobile
Remove-Item -LiteralPath .\apps\mobile\dist -Recurse -Force
pnpm --filter @linespace/mobile export:web
```

Do not run `expo export` while `pnpm dev:web` is still running.

## Find project node processes

Use this before killing processes:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match 'LineSpace-mobile|expo|metro|node' } |
  Select-Object ProcessId, Name, CommandLine
```

Stop only the relevant process:

```powershell
Stop-Process -Id <PID> -Force
```

If you are certain no other Node project is running, this broader command is faster:

```powershell
taskkill /F /IM node.exe
```

## If the file is still locked

Remove read-only attributes:

```powershell
attrib -R .\apps\mobile\dist\* /S /D
Remove-Item -LiteralPath .\apps\mobile\dist -Recurse -Force
```

If the folder was created from an elevated/admin terminal and your normal terminal cannot overwrite it, repair permissions:

```powershell
icacls B:\LineSpace\LineSpace-mobile /grant "$env:USERNAME:(OI)(CI)F" /T
```

Run that from an administrator PowerShell only if normal deletion still fails.

## Windows Defender / antivirus

If locks happen repeatedly, add a trusted-folder exclusion for:

```txt
B:\LineSpace\LineSpace-mobile
```

Windows Security path:

```txt
Windows Security -> Virus & threat protection -> Manage settings -> Exclusions -> Add folder exclusion
```

Only do this for trusted local development folders.

## Clean export command

After the lock is gone:

```powershell
cd B:\LineSpace\LineSpace-mobile
pnpm --filter @linespace/mobile export:web
```

