# Environment configuration

## Package manager

The repository is pinned to `pnpm@11.7.0` in `package.json`.

Recommended setup:

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm -v
```

The project `.npmrc` disables automatic package-manager version switching:

```ini
manage-package-manager-versions=false
package-manager-strict=false
```

This avoids pnpm trying to download a different pnpm version before installing project dependencies.

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Required | Used by | Meaning |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Optional now | Mobile app | API base URL, for example `http://localhost:4000` |
| `EXPO_PUBLIC_USE_MOCKS` | Optional | Mobile app | Use `true` for mock data, `false` for HTTP API |
| `PORT` | Optional | API | API port, default `4000` |
| `DATABASE_URL` | Later | API | PostgreSQL connection string |
| `SUPABASE_URL` | Later | Mobile/API | Supabase project URL |
| `SUPABASE_ANON_KEY` | Later | Mobile app | Public Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Later | API only | Server-side Supabase admin key |
| `OPENAI_API_KEY` | Later | API only | Server-side OpenAI key |

Do not expose `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the Expo app. Only variables prefixed with `EXPO_PUBLIC_` are safe for the client bundle.

## Local startup

Install dependencies:

```bash
pnpm install
```

Run mobile web:

```bash
pnpm dev:web
```

Run Expo app:

```bash
pnpm dev
```

Run API scaffold:

```bash
pnpm dev:api
```

Run type checks:

```bash
pnpm typecheck
```

## Development modes

Mock mode is the default. The app uses `packages/api-client` mock data if `EXPO_PUBLIC_USE_MOCKS` is not set to `false`.

To call the local API instead:

```env
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

Start the API with:

```bash
pnpm dev:api
```

## Figma implementation prerequisites

For design-to-code work, Codex needs access to Figma MCP tools:

- design context
- screenshot
- assets
- variables/tokens

If those tools are unavailable, implement only a structural pass and schedule a second visual parity pass after MCP is available.
