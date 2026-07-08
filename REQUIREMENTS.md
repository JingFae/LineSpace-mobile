# LineSpace requirements

This project is a TypeScript monorepo for a mobile-first poetry community app. It currently contains an Expo app, an API scaffold, shared UI components, design tokens, and a mock/API client boundary.

## Required local tools

| Tool | Required | Recommended |
| --- | --- | --- |
| Node.js | 20+ | 22 LTS or newer |
| pnpm | 11.x | 11.7.0, matching `package.json` |
| Git | Yes | Latest stable |
| Expo CLI | Via `pnpm` scripts | Do not install globally unless needed |
| Android Studio | Android builds only | Java 17, Android SDK, emulator |
| Xcode | iOS builds only | macOS only |
| Figma access | Design implementation | Figma Dev Mode or Figma MCP |

## Runtime services

| Service | Required now | Used for |
| --- | --- | --- |
| Local API | Optional | Replacing mock feed data |
| PostgreSQL | Later | Users, poems, comments, follows, reactions |
| Supabase | Later | Auth, storage, realtime, Postgres hosting |
| OpenAI API | Later | AI writing assistance, moderation, tagging |
| Redis/Valkey | Later | Queues, rate limits, background AI jobs |

## Environment files

Create a local `.env` from `.env.example`.

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

See `docs/environment.md` for variable meanings.

## Install and run

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install
pnpm typecheck
pnpm dev:web
```

API scaffold:

```bash
pnpm dev:api
```

## Current validation note

If `pnpm typecheck` fails before TypeScript starts, treat it as an environment/package-manager issue first. See `docs/pnpm-troubleshooting.md`.
