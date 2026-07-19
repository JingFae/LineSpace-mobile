import { handleApiRequest } from "../apps/api/src/routes";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type"
};

/**
 * Vercel Node Function entry point. The mobile web build can use `/api` as
 * its base URL while local development continues to use apps/api/src/server.ts.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const rewrittenPath = url.searchParams.get("__linespace_api_path");
    url.searchParams.delete("__linespace_api_path");
    const pathname = rewrittenPath !== null
      ? normalizeRewrittenPath(rewrittenPath)
      : url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      return jsonResponse(400, {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON."
      });
    }

    const result = await handleApiRequest(
      request.method,
      pathname,
      url.searchParams,
      body,
      { authorization: request.headers.get("authorization") ?? undefined }
    );

    return jsonResponse(result.status, result.body);
  }
};

function normalizeRewrittenPath(path: string) {
  const normalized = path
    .split("/")
    .filter(Boolean)
    .join("/");
  return normalized ? `/${normalized}` : "/";
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (request.method !== "POST" && request.method !== "PUT") return undefined;

  const raw = (await request.text()).trim();
  return raw.length > 0 ? JSON.parse(raw) : undefined;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8"
    }
  });
}
