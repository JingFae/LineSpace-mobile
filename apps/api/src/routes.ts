import {
  createMockLineSpaceApi,
  type AiAssistRequest,
  type FeedFilter,
  type FeedSection,
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
      section: isFeedSection(section) ? section : undefined,
      viewerId: searchParams.get("viewerId") ?? undefined
    });

    return json(200, feed);
  }

  if (method === "GET" && pathname.startsWith("/v1/poems/")) {
    const id = decodeURIComponent(pathname.replace("/v1/poems/", ""));
    return json(200, await api.getPoem(id, searchParams.get("viewerId") ?? undefined));
  }

  const collectionRoute = parsePoemCollectionRoute(pathname);
  if (collectionRoute && method === "GET" && !collectionRoute.collection) {
    return json(200, await api.getUserPoemCollections(collectionRoute.userId));
  }

  if (
    collectionRoute?.collection &&
    collectionRoute.poemId &&
    method === "PUT"
  ) {
    const isActive = (body as { isActive?: unknown } | undefined)?.isActive;
    if (typeof isActive !== "boolean") {
      return json(400, {
        code: "INVALID_COLLECTION_STATE",
        message: "isActive must be a boolean"
      });
    }

    try {
      return json(
        200,
        await api.setPoemCollection({
          userId: collectionRoute.userId,
          poemId: collectionRoute.poemId,
          collection: collectionRoute.collection,
          isActive
        })
      );
    } catch {
      return json(404, { code: "POEM_NOT_FOUND" });
    }
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

type ParsedCollectionRoute = {
  userId: string;
  collection?: PoemCollectionKind;
  poemId?: string;
};

function parsePoemCollectionRoute(pathname: string): ParsedCollectionRoute | null {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (
    segments[0] !== "v1" ||
    segments[1] !== "users" ||
    !segments[2] ||
    segments[3] !== "poem-collections"
  ) {
    return null;
  }

  if (segments.length === 4) {
    return { userId: segments[2] };
  }

  const collection = segments[4];
  const poemId = segments[5];
  if (segments.length !== 6 || !isPoemCollectionKind(collection) || !poemId) {
    return null;
  }

  return { userId: segments[2], collection, poemId };
}

function isPoemCollectionKind(value: string | undefined): value is PoemCollectionKind {
  return value === "liked" || value === "saved";
}
