# Deployment

## Recommended preview deployment: Vercel

Deploy from the repository root:

```powershell
cd B:\LineSpace\LineSpace-mobile
pnpm install
pnpm --filter @linespace/mobile export:web
```

The static web output is:

```txt
apps/mobile/dist
```

Vercel configuration is stored in `vercel.json`:

```json
{
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter @linespace/mobile export:web",
  "outputDirectory": "apps/mobile/dist"
}
```

## Vercel Dashboard settings

If you deploy through the Vercel Dashboard, use:

- Framework Preset: Other
- Root Directory: repository root
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm --filter @linespace/mobile export:web`
- Output Directory: `apps/mobile/dist`

## Local temporary preview

For a short-lived teammate preview without cloud deployment, run the local web app and expose it with a tunnel tool:

```powershell
pnpm dev:web
```

Then use a tunnel such as Cloudflare Tunnel or ngrok against `http://localhost:8081`.

This is only suitable for quick review. Use Vercel for stable preview links.
