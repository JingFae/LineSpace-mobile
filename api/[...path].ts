import { keepVercelTaskAlive } from "../apps/api/src/vercel-background.js";

let routeModulePromise: Promise<typeof import("../apps/api/src/routes.js")> | undefined;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,x-linespace-request-id",
  "access-control-expose-headers": "x-linespace-request-id"
};

/**
 * Vercel Node Function entry point. The mobile web build can use `/api` as
 * its base URL while local development continues to use apps/api/src/server.ts.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const requestId = normalizeRequestId(request.headers.get("x-linespace-request-id"));
    const startedAt = Date.now();
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, "x-linespace-request-id": requestId }
      });
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
      }, requestId);
    }

    const { handleApiRequest } = await loadRouteModule();
    try {
      const result = await handleApiRequest(
        request.method,
        pathname,
        url.searchParams,
        body,
        {
          authorization: request.headers.get("authorization") ?? undefined,
          waitUntil: keepVercelTaskAlive
        }
      );
      console.info(JSON.stringify({
        event: "api_request_completed",
        requestId,
        method: request.method,
        pathname,
        status: result.status,
        durationMs: Date.now() - startedAt
      }));
      return jsonResponse(result.status, result.body, requestId);
    } catch (error) {
      console.error(JSON.stringify({
        event: "api_request_failed",
        requestId,
        method: request.method,
        pathname,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown error"
      }));
      throw error;
    }
  }
};

function loadRouteModule() {
  routeModulePromise ??= import("../apps/api/src/routes.js");
  return routeModulePromise;
}

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

function jsonResponse(status: number, body: unknown, requestId: string) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "x-linespace-request-id": requestId,
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function normalizeRequestId(value: string | null) {
  if (value && /^[a-zA-Z0-9_-]{8,80}$/.test(value)) return value;
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
