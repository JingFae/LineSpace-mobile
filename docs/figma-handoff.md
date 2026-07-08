# Figma handoff rules

## Required input per screen

- Figma frame URL pointing to the exact frame.
- Design context from Figma MCP.
- Screenshot from Figma MCP.
- Exported image or SVG assets when the frame uses real assets.
- Variable definitions for color, type, spacing, radius, and effects.

If Figma MCP is unavailable in the Codex session, do not claim visual parity. Implement only a structural pass from the visible screenshot or written brief, then schedule a second pass once MCP tools are available.

## Implementation rules

- Do not use a full-page exported screenshot as UI.
- Treat Figma generated code as reference only.
- Convert repeated visual blocks into `packages/ui` components.
- Convert values that repeat across screens into `packages/tokens`.
- Keep sample content in mock API data, not inside UI components.
- Document any design deviations in the PR or implementation note.

## Suggested Codex prompt

```txt
Implement Figma frame: <url>
Target screen: apps/mobile/app/(tabs)/index.tsx
Requirements:
1. Fetch design context, screenshot, assets, variables.
2. Reuse packages/ui and packages/tokens.
3. Do not use a page screenshot as background.
4. Use packages/api-client for data.
5. Run typecheck.
```
