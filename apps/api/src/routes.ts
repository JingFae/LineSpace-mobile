import {
  createMockLineSpaceApi,
  type AuthUser,
  type AiAssistRequest,
  type CreateContinuationInput,
  type CreatePoemDraftInput,
  type CreateThreadContinuationInput,
  type DraftOperationInput,
  type FeedFilter,
  type FeedSection,
  type InviteDraftCollaboratorInput,
  type PoemCollectionKind,
  type PublishPoemDraftInput,
  type UpdatePoemDraftInput,
  type UpdateContinuationLikeInput,
  type UpdateThreadLikeInput,
  type UpdateUserProfileInput,
  type UserConnectionKind,
  type UserProfileContentSection
} from "@linespace/api-client";
import {
  authErrorResponse,
  getServerAuthService,
  handleAuthRoute,
  parseBearerToken,
  type AuthRequestContext
} from "./auth";

const api = createMockLineSpaceApi();

export type ApiResponse = {
  status: number;
  body: unknown;
};

export async function handleApiRequest(
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  body?: unknown,
  context: AuthRequestContext = {}
): Promise<ApiResponse> {
  if (method === "GET" && pathname === "/health") {
    return json(200, { ok: true, service: "linespace-api" });
  }

  const authRoute = await handleAuthRoute(method, pathname, body, context);
  if (authRoute) return authRoute;

  if (method === "GET" && pathname === "/v1/threads") {
    const sort = searchParams.get("sort");
    return json(
      200,
      await api.listThreads({
        sort: sort === "top" || sort === "latest" || sort === "following" ? sort : undefined,
        viewerId: searchParams.get("viewerId") ?? undefined
      })
    );
  }

  const threadRoute = parseThreadRoute(pathname);
  if (threadRoute) {
    try {
      if (threadRoute.resource === "thread" && method === "GET") {
        return json(
          200,
          await api.getThread(threadRoute.threadId, searchParams.get("viewerId") ?? undefined)
        );
      }

      if (threadRoute.resource === "continuations" && method === "POST") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        const request = body as Omit<CreateThreadContinuationInput, "threadId" | "userId">;
        if (typeof request?.content !== "string") {
          return json(400, { code: "INVALID_THREAD_CONTINUATION" });
        }
        return json(
          201,
          await api.createThreadContinuation({
            threadId: threadRoute.threadId,
            ...request,
            userId: actor.user.id
          })
        );
      }

      if (threadRoute.resource === "like" && method === "PUT") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        const request = body as Omit<UpdateThreadLikeInput, "threadId" | "userId">;
        if (typeof request?.isActive !== "boolean") {
          return json(400, { code: "INVALID_THREAD_LIKE" });
        }
        return json(
          200,
          await api.setThreadLike({
            threadId: threadRoute.threadId,
            ...request,
            userId: actor.user.id
          })
        );
      }

      if (threadRoute.resource === "share" && method === "POST") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        return json(
          200,
          await api.recordThreadShare({
            kind: "thread",
            threadId: threadRoute.threadId,
            userId: actor.user.id
          })
        );
      }
    } catch {
      return json(404, { code: "THREAD_NOT_FOUND" });
    }
  }

  const continuationRoute = parseContinuationRoute(pathname);
  if (continuationRoute) {
    try {
      if (continuationRoute.resource === "continuation" && method === "GET") {
        return json(
          200,
          await api.getContinuationDetail(
            continuationRoute.continuationId,
            searchParams.get("viewerId") ?? undefined
          )
        );
      }

      if (continuationRoute.resource === "continuations" && method === "POST") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        const request = body as Omit<CreateContinuationInput, "continuationId" | "userId">;
        if (typeof request?.content !== "string") {
          return json(400, { code: "INVALID_CONTINUATION_CREATE" });
        }
        return json(
          201,
          await api.createContinuation({
            continuationId: continuationRoute.continuationId,
            ...request,
            userId: actor.user.id
          })
        );
      }

      if (continuationRoute.resource === "like" && method === "PUT") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        const request = body as Omit<UpdateContinuationLikeInput, "continuationId" | "userId">;
        if (typeof request?.isActive !== "boolean") {
          return json(400, { code: "INVALID_CONTINUATION_LIKE" });
        }
        return json(
          200,
          await api.setContinuationLike({
            continuationId: continuationRoute.continuationId,
            ...request,
            userId: actor.user.id
          })
        );
      }

      if (continuationRoute.resource === "share" && method === "POST") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        return json(
          200,
          await api.recordThreadShare({
            kind: "continuation",
            continuationId: continuationRoute.continuationId,
            userId: actor.user.id
          })
        );
      }
    } catch {
      return json(404, { code: "CONTINUATION_NOT_FOUND" });
    }
  }

  if (method === "GET" && pathname === "/v1/compose/design-catalog") {
    return json(200, await api.getPoemDesignCatalog());
  }

  if (method === "POST" && pathname === "/v1/drafts") {
    const actor = await authenticateRequest(context);
    if (!actor.ok) return actor.response;
    const request = body as Partial<Omit<CreatePoemDraftInput, "ownerId">> | undefined;
    if (request?.mode !== "draft" && request?.mode !== "relay") {
      return json(400, { code: "INVALID_DRAFT_CREATE" });
    }
    try {
      return json(
        201,
        await api.createPoemDraft({ ownerId: actor.user.id, mode: request.mode })
      );
    } catch {
      return json(404, { code: "USER_NOT_FOUND" });
    }
  }

  const draftRoute = parseDraftRoute(pathname);
  if (draftRoute) {
    try {
      if (method === "GET" && draftRoute.resource === "draft") {
        return json(200, await api.getPoemDraft(draftRoute.draftId));
      }

      if (method === "PUT" && draftRoute.resource === "draft") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        const request = (body ?? {}) as Omit<UpdatePoemDraftInput, "draftId" | "userId">;
        return json(
          200,
          await api.updatePoemDraft({
            draftId: draftRoute.draftId,
            ...request,
            userId: actor.user.id
          })
        );
      }

      if (method === "POST" && draftRoute.resource === "operations") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        const request = body as Omit<DraftOperationInput, "draftId" | "userId">;
        if (typeof request?.body !== "string") {
          return json(400, { code: "INVALID_DRAFT_OPERATION" });
        }
        return json(
          200,
          await api.applyDraftOperation({
            draftId: draftRoute.draftId,
            ...request,
            userId: actor.user.id
          })
        );
      }

      if (method === "POST" && draftRoute.resource === "invitations") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        const request = body as Omit<InviteDraftCollaboratorInput, "draftId" | "inviterId">;
        if (!request?.inviteeId) {
          return json(400, { code: "INVALID_DRAFT_INVITATION" });
        }
        return json(
          201,
          await api.inviteDraftCollaborator({
            draftId: draftRoute.draftId,
            ...request,
            inviterId: actor.user.id
          })
        );
      }

      if (method === "POST" && draftRoute.resource === "publish") {
        const actor = await authenticateRequest(context);
        if (!actor.ok) return actor.response;
        return json(
          200,
          await api.publishPoemDraft({
            draftId: draftRoute.draftId,
            userId: actor.user.id
          })
        );
      }
    } catch {
      return json(404, { code: "DRAFT_NOT_FOUND_OR_FORBIDDEN" });
    }
  }

  const inviteCandidatesUserId = parseInviteCandidatesRoute(pathname);
  if (method === "GET" && inviteCandidatesUserId) {
    return json(200, await api.listDraftInviteCandidates(inviteCandidatesUserId));
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

  const inboxSummaryUserId = parseInboxSummaryRoute(pathname);
  if (method === "GET" && inboxSummaryUserId) {
    const actor = await authenticateRequest(context);
    if (!actor.ok) return actor.response;
    if (inboxSummaryUserId !== actor.user.id) {
      return json(403, { code: "FORBIDDEN", message: "This inbox belongs to another user." });
    }
    return json(200, await api.getInboxActivitySummary(actor.user.id));
  }

  const profileRoute = parseUserProfileRoute(pathname);
  if (profileRoute?.resource === "profile" && method === "PUT") {
    const actor = await authenticateRequest(context);
    if (!actor.ok) return actor.response;
    if (profileRoute.userId !== actor.user.id) {
      return json(403, { code: "FORBIDDEN", message: "This resource belongs to another user." });
    }
    const changes = parseUserProfileChanges(body);
    if (!changes.ok) {
      return json(400, {
        code: "INVALID_PROFILE_UPDATE",
        message: changes.message
      });
    }

    try {
      return json(
        200,
        await api.updateUserProfile({ userId: actor.user.id, ...changes.value })
      );
    } catch {
      return json(404, { code: "USER_NOT_FOUND" });
    }
  }

  if (profileRoute && method === "GET") {
    if (profileRoute.resource === "profile") {
      return json(200, await api.getUserProfile(profileRoute.userId));
    }

    if (profileRoute.resource === "profile-content") {
      return json(
        200,
        await api.listUserProfileContent(profileRoute.userId, profileRoute.section)
      );
    }

    const rawLimit = Number(searchParams.get("limit") ?? 20);
    return json(
      200,
      await api.listUserConnections(profileRoute.userId, profileRoute.kind, {
        cursor: searchParams.get("cursor") ?? undefined,
        limit: Number.isFinite(rawLimit) ? rawLimit : 20,
        viewerId: searchParams.get("viewerId") ?? undefined
      })
    );
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
    const actor = await authenticateRequest(context);
    if (!actor.ok) return actor.response;
    if (collectionRoute.userId !== actor.user.id) {
      return json(403, { code: "FORBIDDEN", message: "This resource belongs to another user." });
    }
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
          userId: actor.user.id,
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
    const actor = await authenticateRequest(context);
    if (!actor.ok) return actor.response;
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

async function authenticateRequest(
  context: AuthRequestContext
): Promise<
  | { ok: true; user: AuthUser }
  | { ok: false; response: ApiResponse }
> {
  try {
    const accessToken = parseBearerToken(context.authorization);
    const service = context.authService ?? getServerAuthService();
    const user = await service.authenticate(accessToken);
    return { ok: true, user };
  } catch (error) {
    return { ok: false, response: authErrorResponse(error) };
  }
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

type ParsedThreadRoute = {
  threadId: string;
  resource: "thread" | "continuations" | "like" | "share";
};

function parseThreadRoute(pathname: string): ParsedThreadRoute | null {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== "v1" || segments[1] !== "threads" || !segments[2]) {
    return null;
  }
  if (segments.length === 3) return { threadId: segments[2], resource: "thread" };
  const resource = segments[3];
  if (
    segments.length === 4 &&
    (resource === "continuations" || resource === "like" || resource === "share")
  ) {
    return { threadId: segments[2], resource };
  }
  return null;
}

type ParsedContinuationRoute = {
  continuationId: string;
  resource: "continuation" | "continuations" | "like" | "share";
};

function parseContinuationRoute(pathname: string): ParsedContinuationRoute | null {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== "v1" || segments[1] !== "continuations" || !segments[2]) {
    return null;
  }
  if (segments.length === 3) {
    return { continuationId: segments[2], resource: "continuation" };
  }
  const resource = segments[3];
  if (
    segments.length === 4 &&
    (resource === "continuations" || resource === "like" || resource === "share")
  ) {
    return { continuationId: segments[2], resource };
  }
  return null;
}

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

type ParsedDraftRoute = {
  draftId: string;
  resource: "draft" | "operations" | "invitations" | "publish";
};

function parseDraftRoute(pathname: string): ParsedDraftRoute | null {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== "v1" || segments[1] !== "drafts" || !segments[2]) {
    return null;
  }
  if (segments.length === 3) return { draftId: segments[2], resource: "draft" };
  const resource = segments[3];
  if (
    segments.length === 4 &&
    (resource === "operations" || resource === "invitations" || resource === "publish")
  ) {
    return { draftId: segments[2], resource };
  }
  return null;
}

function parseInviteCandidatesRoute(pathname: string) {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  return segments.length === 4 &&
    segments[0] === "v1" &&
    segments[1] === "users" &&
    segments[2] &&
    segments[3] === "invite-candidates"
    ? segments[2]
    : null;
}

function parseInboxSummaryRoute(pathname: string) {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  return segments.length === 4 &&
    segments[0] === "v1" &&
    segments[1] === "users" &&
    segments[2] &&
    segments[3] === "inbox-summary"
    ? segments[2]
    : null;
}

function isPoemCollectionKind(value: string | undefined): value is PoemCollectionKind {
  return value === "liked" || value === "saved";
}

type ParsedUserProfileRoute =
  | { userId: string; resource: "profile" }
  | {
      userId: string;
      resource: "profile-content";
      section: UserProfileContentSection;
    }
  | { userId: string; resource: "connections"; kind: UserConnectionKind };

function parseUserProfileRoute(pathname: string): ParsedUserProfileRoute | null {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const userId = segments[2];
  if (segments[0] !== "v1" || segments[1] !== "users" || !userId) {
    return null;
  }

  if (segments.length === 4 && segments[3] === "profile") {
    return { userId, resource: "profile" };
  }

  const section = segments[4];
  if (
    segments.length === 5 &&
    segments[3] === "profile-content" &&
    isUserProfileContentSection(section)
  ) {
    return { userId, resource: "profile-content", section };
  }

  const kind = segments[3];
  if (segments.length === 4 && isUserConnectionKind(kind)) {
    return { userId, resource: "connections", kind };
  }

  return null;
}

function isUserProfileContentSection(
  value: string | undefined
): value is UserProfileContentSection {
  return value === "posts" || value === "comments" || value === "quotes" || value === "saves";
}

function isUserConnectionKind(value: string | undefined): value is UserConnectionKind {
  return value === "followers" || value === "following";
}

type ProfileChanges = Omit<UpdateUserProfileInput, "userId">;

function parseUserProfileChanges(
  body: unknown
): { ok: true; value: ProfileChanges } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "A profile update body is required." };
  }

  const source = body as Record<string, unknown>;
  const value: ProfileChanges = {};

  if (source.displayName !== undefined) {
    if (typeof source.displayName !== "string") {
      return { ok: false, message: "displayName must be a string." };
    }
    const displayName = source.displayName.trim();
    if (displayName.length === 0 || displayName.length > 120) {
      return { ok: false, message: "displayName must contain 1 to 120 characters." };
    }
    value.displayName = displayName;
  }

  if (source.bio !== undefined) {
    if (typeof source.bio !== "string") {
      return { ok: false, message: "bio must be a string." };
    }
    const bio = source.bio.trim();
    if (bio.length > 280) {
      return { ok: false, message: "bio cannot exceed 280 characters." };
    }
    value.bio = bio;
  }

  if (source.avatarUrl !== undefined) {
    if (typeof source.avatarUrl !== "string" || source.avatarUrl.trim().length === 0) {
      return { ok: false, message: "avatarUrl must be a non-empty string." };
    }
    value.avatarUrl = source.avatarUrl.trim();
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, message: "No editable profile fields were provided." };
  }

  return { ok: true, value };
}
