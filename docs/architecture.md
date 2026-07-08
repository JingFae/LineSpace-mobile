# LineSpace architecture

## Runtime surfaces

- Authenticated product: `apps/mobile` with Expo Router. This is the main iOS, Android, and mobile web app.
- Public API boundary: `apps/api`. Keep LLM keys, database access, moderation, and rate limits on the server.
- Future SEO/public pages: add `apps/web-public` with Next.js only if public poem pages need search indexing.

## Dependency direction

```txt
apps/mobile -> packages/ui -> packages/tokens
apps/mobile -> packages/api-client
apps/api    -> packages/api-client
```

`packages/ui` should not call network APIs. Screens compose UI components and fetch data through `packages/api-client`.

## Replaceable boundaries

- Mock feed data lives in `packages/api-client/src/mock-data.ts`.
- HTTP data access lives in `packages/api-client/src/http-client.ts`.
- LLM route placeholders live in `apps/api/src/routes.ts`.
- Figma token values live in `packages/tokens/src`.
