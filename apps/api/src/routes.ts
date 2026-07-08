import {
  createMockLineSpaceApi,
  type AiAssistRequest,
  type FeedFilter,
  type FeedSection
} from "@linespace/api-client";

const api = createMockLineSpaceApi();

export type ApiResponse = {
  status: number;
  body: unknown;
};

export async function handleApiRequest(
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  body?: unknown
): Promise<ApiResponse> {
  if (method === "GET" && pathname === "/health") {
    return json(200, { ok: true, service: "linespace-api" });
  }

  if (method === "GET" && pathname === "/v1/feed") {
    const filter = searchParams.get("filter") ?? undefined;
    const section = searchParams.get("section") ?? undefined;
    const feed = await api.listFeed({
      filter: isFeedFilter(filter) ? filter : undefined,
      section: isFeedSection(section) ? section : undefined
    });

    return json(200, feed);
  }

  if (method === "GET" && pathname.startsWith("/v1/poems/")) {
    const id = decodeURIComponent(pathname.replace("/v1/poems/", ""));
    return json(200, await api.getPoem(id));
  }

  if (method === "POST" && pathname === "/v1/ai/assist") {
    const request = body as AiAssistRequest;
    return json(501, {
      code: "LLM_NOT_CONFIGURED",
      message:
        "The LLM boundary is reserved here. Add OpenAI client calls, rate limits, and moderation before enabling this route.",
      intent: request.intent
    });
  }

  return json(404, { code: "NOT_FOUND" });
}

function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}

function isFeedFilter(value: string | undefined): value is FeedFilter {
  return (
    value === "all" ||
    value === "most-contributed" ||
    value === "growing" ||
    value === "final"
  );
}

function isFeedSection(value: string | undefined): value is FeedSection {
  return value === "latest" || value === "popular" || value === "following";
}
