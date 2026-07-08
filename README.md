# LineSpace

LineSpace is a mobile-first poetry community for creators. This repository is structured as a TypeScript monorepo so the mobile app, mobile web surface, API boundary, UI components, and design tokens can evolve independently.

## Stack

- `apps/mobile`: Expo Router app for iOS, Android, and mobile web.
- `apps/api`: API boundary scaffold. It currently exposes mock-compatible routes and is intended to be replaced or expanded with NestJS/Fastify when persistence and LLM calls are wired.
- `packages/ui`: Product UI components translated from Figma into reusable React Native components.
- `packages/tokens`: Design tokens mapped from the Figma visual language.
- `packages/api-client`: Shared API contract, mock data, and HTTP client.

## Commands

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm typecheck
```

## Environment

Start with `REQUIREMENTS.md`, then copy `.env.example` to `.env`.

If pnpm fails before dependencies install, use `docs/pnpm-troubleshooting.md`.

## Figma implementation workflow

For each Figma frame:

1. Fetch design context, screenshot, assets, and variables from Figma MCP.
2. Add or update tokens in `packages/tokens`.
3. Add reusable components in `packages/ui`.
4. Implement the app screen in `apps/mobile`.
5. Keep business data behind `packages/api-client`.
6. Run `pnpm typecheck`.

The current session did not expose Figma MCP tools, so this initial scaffold is based on the provided design screenshot and keeps clear extension points for a follow-up MCP-driven pass.
