# Figma MCP setup

The Figma skill files live in:

```txt
B:\LineSpace\.codex\skills\figma
```

The skill explains how Codex should use Figma, but the MCP server must also be registered in the Codex config.

## Current requirement

Codex needs:

- a Figma OAuth token in `FIGMA_OAUTH_TOKEN`
- a Figma MCP server entry in `C:\Users\yu_da\.codex\config.toml`
- RMCP enabled
- a full restart of Codex after config/env changes

## Windows environment variable

Set the token persistently for the current Windows user:

```powershell
[Environment]::SetEnvironmentVariable("FIGMA_OAUTH_TOKEN", "<your-figma-oauth-token>", "User")
```

Open a new PowerShell and verify:

```powershell
if ($env:FIGMA_OAUTH_TOKEN) { "FIGMA_OAUTH_TOKEN=SET" } else { "FIGMA_OAUTH_TOKEN=NOT_SET" }
```

Do not commit the token to the repository.

## Codex config

Edit:

```txt
C:\Users\yu_da\.codex\config.toml
```

Add `rmcp_client = true` inside the existing `[features]` table. Do not create a second `[features]` block.

```toml
[features]
js_repl = false
rmcp_client = true
```

Then add the Figma server:

```toml
[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
http_headers = { "X-Figma-Region" = "us-east-1" }
startup_timeout_sec = 30
tool_timeout_sec = 120
```

Keep `X-Figma-Region` aligned with your Figma organization region. Use `us-east-1` unless your organization explicitly uses another region.

## Restart and verify

1. Close Codex completely.
2. Reopen Codex.
3. Start a new turn and ask Codex to find Figma tools.
4. A working setup should expose tools such as:

```txt
get_design_context
get_screenshot
get_metadata
get_variable_defs
whoami
```

If only `node_repl` appears, the Figma MCP server is still not loaded.

## Desktop plugin note

The installed curated Figma plugin also contains its own MCP manifest at:

```txt
C:\Users\yu_da\.codex\plugins\cache\openai-curated\figma\<version>\.mcp.json
```

It uses an app-backed OAuth connection:

```json
{
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "oauth_resource": "https://mcp.figma.com/mcp"
    }
  }
}
```

If `config.toml`, `FIGMA_OAUTH_TOKEN`, and network access are all correct but Figma tools still do not appear, connect the Figma plugin/integration from the Codex Desktop plugin or connector UI, then restart Codex and open a new thread.

In that state, the issue is not the project path and not the Figma skill file. It is the Codex Desktop integration not exposing the app-backed MCP tools to the current thread.

## Required Figma implementation flow

For each Figma frame:

1. `get_design_context`
2. `get_metadata` if context is too large
3. `get_screenshot`
4. `get_variable_defs`
5. download assets if the design uses images/SVGs
6. translate into project components under `packages/ui`
