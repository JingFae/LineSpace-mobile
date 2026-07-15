import { createServer, type IncomingMessage } from "node:http";
import { handleApiRequest } from "./routes";

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
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "authorization,content-type"
  };
}
