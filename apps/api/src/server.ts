import { createServer, type IncomingMessage } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApiRequest } from "./routes.js";

loadLocalEnvironment();

const port = Number(process.env.PORT ?? 4000);

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  const origin = `http://${request.headers.host ?? "localhost"}`;
  const url = new URL(request.url ?? "/", origin);
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    response.writeHead(400, {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders()
    });
    response.end(
      JSON.stringify({ code: "INVALID_JSON", message: "Request body must be valid JSON." })
    );
    return;
  }
  const result = await handleApiRequest(
    request.method ?? "GET",
    url.pathname,
    url.searchParams,
    body,
    { authorization: request.headers.authorization }
  );

  response.writeHead(result.status, {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders()
  });
  response.end(result.status === 204 ? undefined : JSON.stringify(result.body));
});

server.listen(port, () => {
  process.stdout.write(`LineSpace API listening on http://localhost:${port}\n`);
});

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.method !== "POST" && request.method !== "PUT") {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw.length > 0 ? JSON.parse(raw) : undefined;
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type"
  };
}

/**
 * Keep local API startup aligned with the repository-level .env documented for
 * developers. Process and Vercel-provided variables always win; apps/api/.env
 * then overrides the root file for local API-specific settings.
 */
function loadLocalEnvironment() {
  if (process.env.VERCEL === "1") return;

  const inheritedKeys = new Set(Object.keys(process.env));
  const serverDirectory = dirname(fileURLToPath(import.meta.url));
  loadEnvFile(resolve(serverDirectory, "../../.env"), inheritedKeys);
  loadEnvFile(resolve(serverDirectory, "../.env"), inheritedKeys);
}

function loadEnvFile(filePath: string, inheritedKeys: Set<string>) {
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(
      line
    );
    if (!match) continue;
    const name = match[1];
    const rawValue = match[2];
    if (!name || rawValue === undefined || inheritedKeys.has(name)) continue;

    const value = parseEnvValue(rawValue);
    process.env[name] = value;
  }
}

function parseEnvValue(rawValue: string) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}
